-- Operational inventory, locations and traceability for JLG Cargo Net.

create unique index if not exists warehouse_locations_code_unique
  on public.warehouse_locations (upper(code));

alter table public.warehouse_movements
  add column if not exists performed_by_name text;

create or replace function public.create_warehouse_location(
  p_code text, p_zone text, p_rack text default null,
  p_level text default null, p_position text default null,
  p_description text default null
)
returns public.warehouse_locations
language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_location public.warehouse_locations%rowtype;
begin
  if nullif(trim(p_code), '') is null or nullif(trim(p_zone), '') is null then
    raise exception 'El código y la zona son obligatorios.';
  end if;
  insert into public.warehouse_locations
    (code, zone, rack, level, position, description, is_active)
  values
    (upper(trim(p_code)), upper(trim(p_zone)), nullif(trim(p_rack), ''),
     nullif(trim(p_level), ''), nullif(trim(p_position), ''),
     nullif(trim(p_description), ''), true)
  returning * into v_location;
  return v_location;
exception when unique_violation then
  raise exception 'Ya existe una ubicación con el código %.', upper(trim(p_code));
end;
$fn$;

create or replace function public.move_warehouse_receipt(
  p_receipt_id uuid, p_to_location_id uuid, p_to_status text default null,
  p_notes text default null, p_operator_name text default null
)
returns setof public.warehouse_receipts
language sql volatile security definer set search_path = public, extensions
as $fn$
with current_row as (
  select * from public.warehouse_receipts
  where id = p_receipt_id and status not in ('dispatched', 'cancelled')
  for update
), updated_row as (
  update public.warehouse_receipts r
  set location_id = p_to_location_id,
      status = coalesce(nullif(trim(p_to_status), '')::public.warehouse_receipt_status, r.status),
      updated_at = now()
  from current_row c
  where r.id = c.id
    and (r.location_id is distinct from p_to_location_id
      or r.status is distinct from coalesce(nullif(trim(p_to_status), '')::public.warehouse_receipt_status, r.status))
  returning r.*
), movement_row as (
  insert into public.warehouse_movements
    (warehouse_receipt_id, movement_type, from_location_id, to_location_id,
     from_status, to_status, notes, performed_by_name)
  select u.id,
    case
      when c.location_id is null and u.location_id is not null then 'location_assignment'::public.warehouse_movement_type
      when c.location_id is distinct from u.location_id then 'relocation'::public.warehouse_movement_type
      else 'status_change'::public.warehouse_movement_type
    end,
    c.location_id, u.location_id, c.status, u.status,
    nullif(trim(p_notes), ''), nullif(trim(p_operator_name), '')
  from updated_row u join current_row c on c.id = u.id
  returning id
)
select u.* from updated_row u where exists (select 1 from movement_row);
$fn$;

create or replace function public.inspect_warehouse_receipt(
  p_receipt_id uuid, p_pieces integer, p_weight_kg numeric,
  p_length_cm numeric, p_width_cm numeric, p_height_cm numeric,
  p_cargo_condition text, p_has_visible_damage boolean, p_damage_notes text,
  p_location_id uuid, p_status text, p_notes text, p_internal_notes text,
  p_operator_name text default null
)
returns setof public.warehouse_receipts
language sql volatile security definer set search_path = public, extensions
as $fn$
with current_row as (
  select * from public.warehouse_receipts
  where id = p_receipt_id and status not in ('dispatched', 'cancelled')
    and coalesce(p_pieces, 0) >= 0 and coalesce(p_weight_kg, 0) >= 0
  for update
), updated_row as (
  update public.warehouse_receipts r
  set pieces = coalesce(p_pieces, 0), weight_kg = coalesce(p_weight_kg, 0),
      length_cm = coalesce(p_length_cm, 0), width_cm = coalesce(p_width_cm, 0),
      height_cm = coalesce(p_height_cm, 0),
      cargo_condition = p_cargo_condition::public.cargo_condition,
      has_visible_damage = coalesce(p_has_visible_damage, false),
      damage_notes = nullif(trim(p_damage_notes), ''), location_id = p_location_id,
      status = p_status::public.warehouse_receipt_status,
      notes = nullif(trim(p_notes), ''), internal_notes = nullif(trim(p_internal_notes), ''),
      updated_at = now()
  from current_row c where r.id = c.id
  returning r.*
), movement_row as (
  insert into public.warehouse_movements
    (warehouse_receipt_id, movement_type, from_location_id, to_location_id,
     from_status, to_status, notes, performed_by_name)
  select u.id, 'inspection'::public.warehouse_movement_type,
    c.location_id, u.location_id, c.status, u.status,
    coalesce(nullif(trim(p_internal_notes), ''), 'Inspección de carga registrada.'),
    nullif(trim(p_operator_name), '')
  from updated_row u join current_row c on c.id = u.id
  returning id
)
select u.* from updated_row u where exists (select 1 from movement_row);
$fn$;

grant execute on function public.create_warehouse_location(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.move_warehouse_receipt(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.inspect_warehouse_receipt(uuid, integer, numeric, numeric, numeric, numeric, text, boolean, text, uuid, text, text, text, text) to anon, authenticated;
grant select on public.warehouse_locations to anon, authenticated;
grant select on public.warehouse_movements to anon, authenticated;

drop policy if exists warehouse_locations_select_dev on public.warehouse_locations;
create policy warehouse_locations_select_dev on public.warehouse_locations
  for select to anon, authenticated using (true);
drop policy if exists warehouse_movements_select_dev on public.warehouse_movements;
create policy warehouse_movements_select_dev on public.warehouse_movements
  for select to anon, authenticated using (true);
