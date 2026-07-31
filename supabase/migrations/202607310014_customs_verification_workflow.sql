begin;

-- Customs verification is a separate operational gate between inspection /
-- storage and the final billing and dispatch stage.
alter table public.warehouse_receipts
  add column if not exists customs_status text not null default 'pending',
  add column if not exists customs_reference text,
  add column if not exists customs_notes text,
  add column if not exists customs_verified_at timestamptz,
  add column if not exists customs_verified_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'warehouse_receipts_customs_status_check'
  ) then
    alter table public.warehouse_receipts
      add constraint warehouse_receipts_customs_status_check
      check (customs_status in ('pending', 'verified', 'held'));
  end if;
end
$$;

create index if not exists warehouse_receipts_customs_queue_idx
  on public.warehouse_receipts (customs_status, updated_at desc)
  where status not in ('dispatched', 'cancelled');

-- Preserve historical operations without retroactively invalidating dispatches.
update public.warehouse_receipts receipt
set customs_status = 'verified',
    customs_reference = coalesce(receipt.customs_reference, 'MIGRACIÓN HISTÓRICA'),
    customs_notes = coalesce(
      receipt.customs_notes,
      'Verificación registrada automáticamente para una carga despachada antes de habilitar esta etapa.'
    ),
    customs_verified_at = coalesce(receipt.customs_verified_at, receipt.updated_at, now()),
    customs_verified_by = coalesce(receipt.customs_verified_by, 'Sistema')
where receipt.status = 'dispatched'
   or exists (
     select 1 from public.warehouse_dispatches dispatch
     where dispatch.receipt_id = receipt.id
       and dispatch.dispatch_status <> 'cancelled'
   );

create or replace function public.set_warehouse_customs_verification(
  p_receipt_id uuid,
  p_customs_status text,
  p_customs_reference text,
  p_customs_notes text,
  p_operator_name text
)
returns public.warehouse_receipts
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_receipt public.warehouse_receipts%rowtype;
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para registrar la verificación de Aduanas.';
  end if;

  if p_customs_status not in ('pending', 'verified', 'held') then
    raise exception 'El resultado de la verificación de Aduanas no es válido.';
  end if;

  if nullif(trim(coalesce(p_operator_name, '')), '') is null then
    raise exception 'Indique el responsable de la verificación de Aduanas.';
  end if;

  select * into strict v_receipt
  from public.warehouse_receipts
  where id = p_receipt_id
  for update;

  v_previous_status := v_receipt.customs_status;

  if v_receipt.status::text in ('dispatched', 'cancelled') then
    raise exception 'La carga está cerrada y su verificación aduanal no puede modificarse.';
  end if;

  if coalesce(v_receipt.reception_complete, false) is not true
     or coalesce(v_receipt.reconciliation_status, 'pending') = 'pending' then
    raise exception 'Primero debe completarse la recepción del BL.';
  end if;

  if v_receipt.status::text <> 'available'
     or v_receipt.location_id is null
     or coalesce(v_receipt.has_visible_damage, false) then
    raise exception 'Primero complete la inspección y asigne la carga al almacén sin incidencias pendientes.';
  end if;

  if p_customs_status = 'verified'
     and nullif(trim(coalesce(p_customs_reference, '')), '') is null then
    raise exception 'La referencia de Aduanas es obligatoria para verificar la carga.';
  end if;

  update public.warehouse_receipts
  set customs_status = p_customs_status,
      customs_reference = nullif(trim(coalesce(p_customs_reference, '')), ''),
      customs_notes = nullif(trim(coalesce(p_customs_notes, '')), ''),
      customs_verified_at = case when p_customs_status = 'verified' then now() else null end,
      customs_verified_by = case
        when p_customs_status = 'verified' then trim(p_operator_name)
        else null
      end,
      updated_at = now()
  where id = p_receipt_id
  returning * into v_receipt;

  insert into public.warehouse_movements (
    warehouse_receipt_id, movement_type, from_location_id, to_location_id,
    from_status, to_status, notes, performed_by_name
  ) values (
    v_receipt.id,
    'status_change'::public.warehouse_movement_type,
    v_receipt.location_id,
    v_receipt.location_id,
    v_receipt.status,
    v_receipt.status,
    format(
      'Verificación de Aduanas: %s → %s%s%s',
      coalesce(v_previous_status, 'pending'),
      p_customs_status,
      case when nullif(trim(coalesce(p_customs_reference, '')), '') is not null
        then ' · Referencia: ' || trim(p_customs_reference) else '' end,
      case when nullif(trim(coalesce(p_customs_notes, '')), '') is not null
        then ' · ' || trim(p_customs_notes) else '' end
    ),
    trim(p_operator_name)
  );

  return v_receipt;
exception
  when no_data_found then
    raise exception 'No se encontró la recepción solicitada.';
end;
$$;

-- Editing inspection or storage data invalidates a previous customs approval.
create or replace function public.reset_customs_verification_after_inspection_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if old.customs_status = 'verified'
     and (
       new.pieces is distinct from old.pieces
       or new.weight_kg is distinct from old.weight_kg
       or new.length_cm is distinct from old.length_cm
       or new.width_cm is distinct from old.width_cm
       or new.height_cm is distinct from old.height_cm
       or new.cargo_condition is distinct from old.cargo_condition
       or new.has_visible_damage is distinct from old.has_visible_damage
       or new.damage_notes is distinct from old.damage_notes
       or new.location_id is distinct from old.location_id
     )
  then
    new.customs_status := 'pending';
    new.customs_reference := null;
    new.customs_notes := 'Requiere nueva verificación porque se modificó la inspección o ubicación.';
    new.customs_verified_at := null;
    new.customs_verified_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists warehouse_receipts_reset_customs_verification
  on public.warehouse_receipts;
create trigger warehouse_receipts_reset_customs_verification
  before update on public.warehouse_receipts
  for each row execute function public.reset_customs_verification_after_inspection_change();

-- The database enforces the sequence even if a client bypasses the UI.
create or replace function public.enforce_customs_verification_before_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_customs_status text;
begin
  select customs_status into v_customs_status
  from public.warehouse_receipts
  where id = new.receipt_id;

  if coalesce(v_customs_status, 'pending') <> 'verified' then
    raise exception 'El BL debe completar la verificación de Aduanas antes de facturarse o despacharse.';
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_dispatches_customs_verification_guard
  on public.warehouse_dispatches;
create trigger warehouse_dispatches_customs_verification_guard
  before insert on public.warehouse_dispatches
  for each row execute function public.enforce_customs_verification_before_dispatch();

revoke all on function public.set_warehouse_customs_verification(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.set_warehouse_customs_verification(uuid, text, text, text, text)
  to authenticated;

revoke all on function public.reset_customs_verification_after_inspection_change()
  from public, anon;
grant execute on function public.reset_customs_verification_after_inspection_change()
  to authenticated;

revoke all on function public.enforce_customs_verification_before_dispatch()
  from public, anon;
grant execute on function public.enforce_customs_verification_before_dispatch()
  to authenticated;

notify pgrst, 'reload schema';

commit;
