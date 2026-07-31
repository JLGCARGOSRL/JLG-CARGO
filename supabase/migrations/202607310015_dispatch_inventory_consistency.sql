begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- Keep physical inventory derived from active dispatches. A fully dispatched
-- receipt must not remain available or occupy a warehouse location.
create or replace function public.sync_warehouse_receipt_dispatch_state()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_receipt_id uuid;
  v_receipt public.warehouse_receipts%rowtype;
  v_dispatched_pieces numeric;
  v_remaining_pieces numeric;
begin
  v_receipt_id := coalesce(new.receipt_id, old.receipt_id);

  select * into v_receipt
  from public.warehouse_receipts
  where id = v_receipt_id
  for update;

  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select coalesce(sum(pieces_dispatched), 0)
  into v_dispatched_pieces
  from public.warehouse_dispatches
  where receipt_id = v_receipt_id
    and dispatch_status in ('confirmed', 'delivered');

  v_remaining_pieces := greatest(coalesce(v_receipt.pieces, 0) - v_dispatched_pieces, 0);

  update public.warehouse_receipts
  set status = (
        case when v_remaining_pieces = 0 then 'dispatched' else 'available' end
      )::public.warehouse_receipt_status,
      location_id = case when v_remaining_pieces = 0 then null else location_id end,
      updated_at = now()
  where id = v_receipt_id;

  if v_receipt.manifest_item_id is not null then
    update public.warehouse_manifest_items
    set status = (
          case when v_remaining_pieces = 0 then 'dispatched' else 'ready_to_dispatch' end
        )::public.warehouse_manifest_item_status,
        updated_at = now()
    where id = v_receipt.manifest_item_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
exception
  when no_data_found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists warehouse_dispatches_sync_inventory
  on public.warehouse_dispatches;
create trigger warehouse_dispatches_sync_inventory
  after insert or update of pieces_dispatched, dispatch_status or delete
  on public.warehouse_dispatches
  for each row execute function public.sync_warehouse_receipt_dispatch_state();

-- A receipt with no remaining pieces is operationally closed. Only the
-- automatic transition to dispatched with no location is allowed.
create or replace function public.guard_fully_dispatched_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_dispatched_pieces numeric;
begin
  select coalesce(sum(pieces_dispatched), 0)
  into v_dispatched_pieces
  from public.warehouse_dispatches
  where receipt_id = old.id
    and dispatch_status in ('confirmed', 'delivered');

  if v_dispatched_pieces > coalesce(new.pieces, 0) then
    raise exception 'Los bultos recibidos no pueden ser menores que los ya despachados (%).', v_dispatched_pieces;
  end if;

  if v_dispatched_pieces >= coalesce(old.pieces, 0)
     and v_dispatched_pieces > 0
     and (
       new.status::text <> 'dispatched'
       or new.location_id is not null
       or new.pieces is distinct from old.pieces
       or new.weight_kg is distinct from old.weight_kg
       or new.length_cm is distinct from old.length_cm
       or new.width_cm is distinct from old.width_cm
       or new.height_cm is distinct from old.height_cm
       or new.cargo_condition is distinct from old.cargo_condition
       or new.has_visible_damage is distinct from old.has_visible_damage
       or new.damage_notes is distinct from old.damage_notes
     )
  then
    raise exception 'El BL ya fue despachado completamente y no admite inspecciones, movimientos ni cambios de inventario.';
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_receipts_guard_fully_dispatched
  on public.warehouse_receipts;
create trigger warehouse_receipts_guard_fully_dispatched
  before update on public.warehouse_receipts
  for each row execute function public.guard_fully_dispatched_receipt();

-- Releasing a location as part of a completed dispatch must not invalidate an
-- customs approval. Other inspection or storage edits still require recheck.
create or replace function public.reset_customs_verification_after_inspection_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if old.customs_status = 'verified'
     and not (new.status::text = 'dispatched' and new.location_id is null)
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

-- Audit and repair receipts that already have zero balance but remain open.
with balances as (
  select
    receipt.id,
    receipt.location_id,
    receipt.status,
    coalesce(sum(dispatch.pieces_dispatched) filter (
      where dispatch.dispatch_status in ('confirmed', 'delivered')
    ), 0) as dispatched_pieces
  from public.warehouse_receipts receipt
  left join public.warehouse_dispatches dispatch on dispatch.receipt_id = receipt.id
  group by receipt.id
), inconsistent as (
  select *
  from balances
  where dispatched_pieces > 0
    and dispatched_pieces >= coalesce((
      select pieces from public.warehouse_receipts where id = balances.id
    ), 0)
    and (status::text <> 'dispatched' or location_id is not null)
)
insert into public.warehouse_movements (
  warehouse_receipt_id, movement_type, from_location_id, to_location_id,
  from_status, to_status, notes, performed_by_name
)
select
  id, 'dispatch'::public.warehouse_movement_type, location_id, null,
  status, 'dispatched'::public.warehouse_receipt_status,
  'Corrección automática: despacho completo conciliado con inventario.',
  'Sistema'
from inconsistent;

with balances as (
  select
    receipt.id,
    receipt.manifest_item_id,
    coalesce(sum(dispatch.pieces_dispatched) filter (
      where dispatch.dispatch_status in ('confirmed', 'delivered')
    ), 0) as dispatched_pieces
  from public.warehouse_receipts receipt
  left join public.warehouse_dispatches dispatch on dispatch.receipt_id = receipt.id
  group by receipt.id
), closed as (
  select balances.id, balances.manifest_item_id
  from balances
  join public.warehouse_receipts receipt on receipt.id = balances.id
  where balances.dispatched_pieces > 0
    and balances.dispatched_pieces >= coalesce(receipt.pieces, 0)
)
update public.warehouse_receipts receipt
set status = 'dispatched'::public.warehouse_receipt_status,
    location_id = null,
    updated_at = now()
from closed
where receipt.id = closed.id;

with closed_items as (
  select distinct receipt.manifest_item_id
  from public.warehouse_receipts receipt
  where receipt.status::text = 'dispatched'
    and receipt.manifest_item_id is not null
)
update public.warehouse_manifest_items item
set status = 'dispatched'::public.warehouse_manifest_item_status,
    updated_at = now()
from closed_items
where item.id = closed_items.manifest_item_id;

revoke all on function public.sync_warehouse_receipt_dispatch_state() from public;
grant execute on function public.sync_warehouse_receipt_dispatch_state() to authenticated;
revoke all on function public.guard_fully_dispatched_receipt() from public;
grant execute on function public.guard_fully_dispatched_receipt() to authenticated;

notify pgrst, 'reload schema';

commit;
