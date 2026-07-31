begin;

alter table public.warehouse_receipts
  add column if not exists reconciliation_status text not null default 'pending',
  add column if not exists piece_difference numeric not null default 0,
  add column if not exists reception_complete boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'warehouse_receipts_reconciliation_status_check'
  ) then
    alter table public.warehouse_receipts
      add constraint warehouse_receipts_reconciliation_status_check
      check (reconciliation_status in (
        'pending', 'correct', 'partial', 'shortage',
        'overage', 'damaged', 'not_received'
      ));
  end if;
end
$$;

create table if not exists public.warehouse_receipt_confirmations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.warehouse_receipts(id) on delete cascade,
  manifest_id uuid not null references public.warehouse_manifests(id) on delete cascade,
  manifest_item_id uuid not null references public.warehouse_manifest_items(id) on delete cascade,
  version_no integer not null,
  expected_pieces numeric not null default 0,
  received_pieces numeric not null default 0,
  expected_weight_kg numeric not null default 0,
  received_weight_kg numeric not null default 0,
  piece_difference numeric not null default 0,
  reconciliation_status text not null,
  reception_complete boolean not null default false,
  cargo_condition text not null default 'unknown',
  has_visible_damage boolean not null default false,
  damage_notes text,
  location_id uuid references public.warehouse_locations(id) on delete set null,
  operator_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint warehouse_receipt_confirmations_status_check
    check (reconciliation_status in (
      'pending', 'correct', 'partial', 'shortage',
      'overage', 'damaged', 'not_received'
    )),
  constraint warehouse_receipt_confirmations_version_unique
    unique (receipt_id, version_no)
);

create index if not exists warehouse_receipt_confirmations_manifest_idx
  on public.warehouse_receipt_confirmations (manifest_id, created_at desc);

create index if not exists warehouse_receipt_confirmations_receipt_idx
  on public.warehouse_receipt_confirmations (receipt_id, created_at desc);

create or replace function public.confirm_warehouse_bl(
  p_receipt_id uuid,
  p_received_pieces numeric,
  p_received_weight_kg numeric,
  p_cargo_condition text,
  p_has_visible_damage boolean,
  p_damage_notes text,
  p_location_id uuid,
  p_operator_name text,
  p_notes text,
  p_reception_complete boolean
)
returns public.warehouse_receipts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.warehouse_receipts%rowtype;
  v_manifest_item public.warehouse_manifest_items%rowtype;
  v_status text;
  v_difference numeric;
  v_version integer;
begin
  if p_received_pieces is null or p_received_pieces < 0 then
    raise exception 'La cantidad de bultos recibidos no puede ser negativa.';
  end if;

  if p_received_weight_kg is null or p_received_weight_kg < 0 then
    raise exception 'El peso recibido no puede ser negativo.';
  end if;

  if nullif(trim(p_operator_name), '') is null then
    raise exception 'Debes indicar el nombre del operador.';
  end if;

  select * into strict v_receipt
  from public.warehouse_receipts
  where id = p_receipt_id
  for update;

  if v_receipt.manifest_id is null or v_receipt.manifest_item_id is null then
    raise exception 'La recepción no está vinculada a un BL de manifiesto.';
  end if;

  select * into strict v_manifest_item
  from public.warehouse_manifest_items
  where id = v_receipt.manifest_item_id
    and manifest_id = v_receipt.manifest_id;

  v_difference := p_received_pieces - coalesce(v_manifest_item.package_quantity, 0);

  if p_has_visible_damage or p_cargo_condition in (
    'damaged', 'partial_damage', 'open_box', 'missing_pieces', 'wet'
  ) then
    v_status := 'damaged';
  elsif p_received_pieces = 0 then
    v_status := 'not_received';
  elsif v_difference = 0 then
    v_status := 'correct';
  elsif v_difference > 0 then
    v_status := 'overage';
  elsif p_reception_complete then
    v_status := 'shortage';
  else
    v_status := 'partial';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_version
  from public.warehouse_receipt_confirmations
  where receipt_id = p_receipt_id;

  update public.warehouse_receipts
  set pieces = p_received_pieces,
      weight_kg = p_received_weight_kg,
      cargo_condition = p_cargo_condition::public.cargo_condition,
      has_visible_damage = p_has_visible_damage,
      damage_notes = nullif(trim(coalesce(p_damage_notes, '')), ''),
      location_id = p_location_id,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      status = (case when v_status = 'damaged' then 'inspection' else 'received' end)::public.warehouse_receipt_status,
      received_date = current_date,
      received_at = now(),
      reconciliation_status = v_status,
      piece_difference = v_difference,
      reception_complete = p_reception_complete,
      confirmed_at = now(),
      confirmed_by_name = trim(p_operator_name),
      updated_at = now()
  where id = p_receipt_id
  returning * into v_receipt;

  insert into public.warehouse_receipt_confirmations (
    receipt_id, manifest_id, manifest_item_id, version_no,
    expected_pieces, received_pieces, expected_weight_kg, received_weight_kg,
    piece_difference, reconciliation_status, reception_complete,
    cargo_condition, has_visible_damage, damage_notes, location_id,
    operator_name, notes
  ) values (
    p_receipt_id, v_receipt.manifest_id, v_receipt.manifest_item_id, v_version,
    coalesce(v_manifest_item.package_quantity, 0), p_received_pieces,
    coalesce(v_manifest_item.gross_weight_kg, 0), p_received_weight_kg,
    v_difference, v_status, p_reception_complete,
    p_cargo_condition, p_has_visible_damage,
    nullif(trim(coalesce(p_damage_notes, '')), ''), p_location_id,
    trim(p_operator_name), nullif(trim(coalesce(p_notes, '')), '')
  );

  update public.warehouse_manifest_items
  set status = (case when v_status = 'damaged' then 'in_inspection' else 'received' end)::public.warehouse_manifest_item_status,
      updated_at = now()
  where id = v_receipt.manifest_item_id;

  update public.warehouse_manifests manifest
  set status = (case
        when exists (
          select 1 from public.warehouse_receipts receipt
          where receipt.manifest_id = manifest.id
            and receipt.reconciliation_status in ('pending', 'partial')
        ) then 'receiving'
        when exists (
          select 1 from public.warehouse_receipts receipt
          where receipt.manifest_id = manifest.id
            and receipt.reconciliation_status in (
              'shortage', 'overage', 'damaged', 'not_received'
            )
        ) then 'in_inspection'
        else 'received'
      end)::public.warehouse_manifest_status,
      updated_at = now()
  where manifest.id = v_receipt.manifest_id;

  return v_receipt;
exception
  when no_data_found then
    raise exception 'No se encontró el WR o el BL relacionado.';
end;
$$;

grant select, insert on public.warehouse_receipt_confirmations to anon, authenticated;
grant execute on function public.confirm_warehouse_bl(
  uuid, numeric, numeric, text, boolean, text, uuid, text, text, boolean
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
