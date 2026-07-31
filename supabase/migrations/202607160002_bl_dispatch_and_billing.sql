begin;

create sequence if not exists public.warehouse_dispatch_number_seq start 1;

create table if not exists public.warehouse_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_number text not null unique default (
    'DSP-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.warehouse_dispatch_number_seq')::text, 6, '0')
  ),
  receipt_id uuid not null references public.warehouse_receipts(id) on delete restrict,
  manifest_id uuid not null references public.warehouse_manifests(id) on delete restrict,
  manifest_item_id uuid not null references public.warehouse_manifest_items(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  dispatch_status text not null default 'confirmed',
  billing_status text not null default 'pending',
  dispatch_type text not null default 'full',
  pieces_dispatched numeric not null,
  weight_dispatched_kg numeric not null default 0,
  remaining_pieces numeric not null default 0,
  currency text not null default 'DOP',
  recipient_name text not null,
  recipient_identification text,
  recipient_phone text,
  carrier_name text,
  driver_name text,
  vehicle_plate text,
  delivery_address text,
  authorization_reference text,
  operator_name text not null,
  delivery_notes text,
  invoice_reference text,
  subtotal numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  total_amount numeric not null default 0,
  dispatched_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_dispatches_status_check
    check (dispatch_status in ('confirmed', 'delivered', 'cancelled')),
  constraint warehouse_dispatches_billing_status_check
    check (billing_status in ('pending', 'ready', 'invoiced', 'paid', 'cancelled')),
  constraint warehouse_dispatches_type_check
    check (dispatch_type in ('full', 'partial')),
  constraint warehouse_dispatches_currency_check
    check (currency in ('DOP', 'USD')),
  constraint warehouse_dispatches_amounts_check
    check (
      pieces_dispatched > 0 and weight_dispatched_kg >= 0 and
      remaining_pieces >= 0 and subtotal >= 0 and tax_rate >= 0 and
      tax_amount >= 0 and discount_amount >= 0 and total_amount >= 0
    )
);

create table if not exists public.warehouse_dispatch_charges (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.warehouse_dispatches(id) on delete cascade,
  sort_order integer not null default 1,
  charge_code text not null default 'service',
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'servicio',
  unit_rate numeric not null default 0,
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint warehouse_dispatch_charges_values_check
    check (quantity > 0 and unit_rate >= 0 and amount >= 0)
);

create table if not exists public.warehouse_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.warehouse_dispatches(id) on delete cascade,
  event_type text not null,
  operator_name text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_dispatches_receipt_idx
  on public.warehouse_dispatches (receipt_id, dispatched_at desc);
create index if not exists warehouse_dispatches_manifest_idx
  on public.warehouse_dispatches (manifest_id, dispatched_at desc);
create index if not exists warehouse_dispatches_billing_idx
  on public.warehouse_dispatches (billing_status, dispatched_at desc);
create index if not exists warehouse_dispatch_charges_dispatch_idx
  on public.warehouse_dispatch_charges (dispatch_id, sort_order);
create index if not exists warehouse_dispatch_events_dispatch_idx
  on public.warehouse_dispatch_events (dispatch_id, created_at desc);

alter table public.warehouse_dispatches enable row level security;
alter table public.warehouse_dispatch_charges enable row level security;
alter table public.warehouse_dispatch_events enable row level security;

drop policy if exists warehouse_dispatches_read on public.warehouse_dispatches;
create policy warehouse_dispatches_read on public.warehouse_dispatches
  for select to anon, authenticated using (true);

drop policy if exists warehouse_dispatch_charges_read on public.warehouse_dispatch_charges;
create policy warehouse_dispatch_charges_read on public.warehouse_dispatch_charges
  for select to anon, authenticated using (true);

drop policy if exists warehouse_dispatch_events_read on public.warehouse_dispatch_events;
create policy warehouse_dispatch_events_read on public.warehouse_dispatch_events
  for select to anon, authenticated using (true);

create or replace function public.create_warehouse_bl_dispatch(
  p_receipt_id uuid,
  p_pieces_dispatched numeric,
  p_weight_dispatched_kg numeric,
  p_recipient_name text,
  p_recipient_identification text,
  p_recipient_phone text,
  p_carrier_name text,
  p_driver_name text,
  p_vehicle_plate text,
  p_delivery_address text,
  p_authorization_reference text,
  p_operator_name text,
  p_delivery_notes text,
  p_currency text,
  p_tax_rate numeric,
  p_discount_amount numeric,
  p_charges jsonb
)
returns public.warehouse_dispatches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.warehouse_receipts%rowtype;
  v_item public.warehouse_manifest_items%rowtype;
  v_dispatch public.warehouse_dispatches%rowtype;
  v_previously_dispatched numeric;
  v_previous_weight numeric;
  v_available_pieces numeric;
  v_available_weight numeric;
  v_subtotal numeric;
  v_tax_rate numeric;
  v_discount numeric;
begin
  if p_pieces_dispatched is null or p_pieces_dispatched <= 0 then
    raise exception 'Debes indicar una cantidad de bultos mayor que cero.';
  end if;

  if trunc(p_pieces_dispatched) <> p_pieces_dispatched then
    raise exception 'La cantidad de bultos debe ser un número entero.';
  end if;

  if coalesce(p_weight_dispatched_kg, 0) < 0 then
    raise exception 'El peso despachado no puede ser negativo.';
  end if;

  if nullif(trim(coalesce(p_recipient_name, '')), '') is null then
    raise exception 'Debes indicar quién recibe la carga.';
  end if;

  if nullif(trim(coalesce(p_operator_name, '')), '') is null then
    raise exception 'Debes indicar el operador responsable.';
  end if;

  if upper(coalesce(p_currency, '')) not in ('DOP', 'USD') then
    raise exception 'La moneda debe ser DOP o USD.';
  end if;

  select * into strict v_receipt
  from public.warehouse_receipts
  where id = p_receipt_id
  for update;

  if v_receipt.manifest_id is null or v_receipt.manifest_item_id is null then
    raise exception 'La recepción no está vinculada a un BL de manifiesto.';
  end if;

  if coalesce(v_receipt.reception_complete, false) is not true or
     coalesce(v_receipt.reconciliation_status, 'pending') = 'pending' then
    raise exception 'El BL debe tener su recepción confirmada antes de despacharse.';
  end if;

  if coalesce(v_receipt.has_visible_damage, false) or v_receipt.status::text = 'inspection' then
    raise exception 'El BL tiene una inspección pendiente y no puede despacharse.';
  end if;

  select * into strict v_item
  from public.warehouse_manifest_items
  where id = v_receipt.manifest_item_id
    and manifest_id = v_receipt.manifest_id;

  select
    coalesce(sum(pieces_dispatched), 0),
    coalesce(sum(weight_dispatched_kg), 0)
  into v_previously_dispatched, v_previous_weight
  from public.warehouse_dispatches
  where receipt_id = p_receipt_id
    and dispatch_status in ('confirmed', 'delivered');

  v_available_pieces := greatest(coalesce(v_receipt.pieces, 0) - v_previously_dispatched, 0);
  v_available_weight := greatest(coalesce(v_receipt.weight_kg, 0) - v_previous_weight, 0);

  if p_pieces_dispatched > v_available_pieces then
    raise exception 'Solo hay % bultos disponibles para despacho.', v_available_pieces;
  end if;

  if coalesce(p_weight_dispatched_kg, 0) > v_available_weight + 0.001 then
    raise exception 'El peso indicado supera el peso disponible de % KG.', v_available_weight;
  end if;

  insert into public.warehouse_dispatches (
    receipt_id, manifest_id, manifest_item_id, customer_id,
    dispatch_status, billing_status, dispatch_type,
    pieces_dispatched, weight_dispatched_kg, remaining_pieces,
    currency, recipient_name, recipient_identification, recipient_phone,
    carrier_name, driver_name, vehicle_plate, delivery_address,
    authorization_reference, operator_name, delivery_notes,
    tax_rate, discount_amount, delivered_at
  ) values (
    v_receipt.id, v_receipt.manifest_id, v_receipt.manifest_item_id,
    v_receipt.customer_id, 'confirmed', 'pending',
    case when p_pieces_dispatched = v_available_pieces then 'full' else 'partial' end,
    p_pieces_dispatched, coalesce(p_weight_dispatched_kg, 0),
    v_available_pieces - p_pieces_dispatched,
    upper(p_currency), trim(p_recipient_name),
    nullif(trim(coalesce(p_recipient_identification, '')), ''),
    nullif(trim(coalesce(p_recipient_phone, '')), ''),
    nullif(trim(coalesce(p_carrier_name, '')), ''),
    nullif(trim(coalesce(p_driver_name, '')), ''),
    nullif(upper(trim(coalesce(p_vehicle_plate, ''))), ''),
    nullif(trim(coalesce(p_delivery_address, '')), ''),
    nullif(trim(coalesce(p_authorization_reference, '')), ''),
    trim(p_operator_name), nullif(trim(coalesce(p_delivery_notes, '')), ''),
    least(greatest(coalesce(p_tax_rate, 0), 0), 100),
    greatest(coalesce(p_discount_amount, 0), 0), now()
  ) returning * into v_dispatch;

  insert into public.warehouse_dispatch_charges (
    dispatch_id, sort_order, charge_code, description,
    quantity, unit, unit_rate, amount
  )
  select
    v_dispatch.id,
    charge.ordinality::integer,
    coalesce(nullif(trim(charge.value->>'code'), ''), 'service'),
    trim(charge.value->>'description'),
    (charge.value->>'quantity')::numeric,
    coalesce(nullif(trim(charge.value->>'unit'), ''), 'servicio'),
    (charge.value->>'unit_rate')::numeric,
    round(
      (charge.value->>'quantity')::numeric *
      (charge.value->>'unit_rate')::numeric,
      2
    )
  from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb))
    with ordinality as charge(value, ordinality)
  where nullif(trim(charge.value->>'description'), '') is not null
    and (charge.value->>'quantity')::numeric > 0
    and (charge.value->>'unit_rate')::numeric >= 0;

  select coalesce(sum(amount), 0) into v_subtotal
  from public.warehouse_dispatch_charges
  where dispatch_id = v_dispatch.id;

  v_tax_rate := least(greatest(coalesce(p_tax_rate, 0), 0), 100);
  v_discount := least(
    greatest(coalesce(p_discount_amount, 0), 0),
    v_subtotal + round(v_subtotal * v_tax_rate / 100, 2)
  );

  update public.warehouse_dispatches
  set subtotal = v_subtotal,
      tax_rate = v_tax_rate,
      tax_amount = round(v_subtotal * v_tax_rate / 100, 2),
      discount_amount = v_discount,
      total_amount = v_subtotal + round(v_subtotal * v_tax_rate / 100, 2) - v_discount,
      updated_at = now()
  where id = v_dispatch.id
  returning * into v_dispatch;

  update public.warehouse_receipts
  set status = (
        case when v_dispatch.remaining_pieces = 0 then 'dispatched' else 'available' end
      )::public.warehouse_receipt_status,
      updated_at = now()
  where id = v_receipt.id;

  update public.warehouse_manifest_items
  set status = (
        case when v_dispatch.remaining_pieces = 0 then 'dispatched' else 'ready_to_dispatch' end
      )::public.warehouse_manifest_item_status,
      updated_at = now()
  where id = v_receipt.manifest_item_id;

  update public.warehouse_manifests manifest
  set status = (
        case
          when not exists (
            select 1
            from public.warehouse_receipts receipt
            where receipt.manifest_id = manifest.id
              and coalesce(receipt.pieces, 0) > coalesce((
                select sum(dispatch.pieces_dispatched)
                from public.warehouse_dispatches dispatch
                where dispatch.receipt_id = receipt.id
                  and dispatch.dispatch_status in ('confirmed', 'delivered')
              ), 0)
          ) then 'dispatched'
          else 'partially_dispatched'
        end
      )::public.warehouse_manifest_status,
      updated_at = now()
  where manifest.id = v_receipt.manifest_id;

  insert into public.warehouse_dispatch_events (
    dispatch_id, event_type, operator_name, notes, metadata
  ) values (
    v_dispatch.id, 'dispatch_confirmed', trim(p_operator_name),
    nullif(trim(coalesce(p_delivery_notes, '')), ''),
    jsonb_build_object(
      'pieces_dispatched', p_pieces_dispatched,
      'weight_dispatched_kg', coalesce(p_weight_dispatched_kg, 0),
      'remaining_pieces', v_dispatch.remaining_pieces,
      'total_amount', v_dispatch.total_amount,
      'currency', v_dispatch.currency
    )
  );

  return v_dispatch;
exception
  when no_data_found then
    raise exception 'No se encontró el WR o el BL relacionado.';
end;
$$;

create or replace function public.set_warehouse_dispatch_billing_status(
  p_dispatch_id uuid,
  p_billing_status text,
  p_invoice_reference text,
  p_operator_name text
)
returns public.warehouse_dispatches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispatch public.warehouse_dispatches%rowtype;
begin
  if p_billing_status not in ('pending', 'ready', 'invoiced', 'paid') then
    raise exception 'Estado de cobro no válido.';
  end if;

  if nullif(trim(coalesce(p_operator_name, '')), '') is null then
    raise exception 'Debes indicar el operador responsable.';
  end if;

  update public.warehouse_dispatches
  set billing_status = p_billing_status,
      invoice_reference = nullif(trim(coalesce(p_invoice_reference, '')), ''),
      updated_at = now()
  where id = p_dispatch_id
    and dispatch_status <> 'cancelled'
  returning * into strict v_dispatch;

  insert into public.warehouse_dispatch_events (
    dispatch_id, event_type, operator_name, notes, metadata
  ) values (
    v_dispatch.id, 'billing_status_changed', trim(p_operator_name),
    'Estado de cobro actualizado a ' || p_billing_status,
    jsonb_build_object(
      'billing_status', p_billing_status,
      'invoice_reference', v_dispatch.invoice_reference
    )
  );

  return v_dispatch;
exception
  when no_data_found then
    raise exception 'No se encontró el despacho o está cancelado.';
end;
$$;

create or replace function public.cancel_warehouse_bl_dispatch(
  p_dispatch_id uuid,
  p_operator_name text,
  p_reason text
)
returns public.warehouse_dispatches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispatch public.warehouse_dispatches%rowtype;
  v_remaining numeric;
  v_active_dispatches integer;
begin
  if nullif(trim(coalesce(p_operator_name, '')), '') is null then
    raise exception 'Debes indicar el operador responsable.';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Debes indicar el motivo de cancelación.';
  end if;

  select * into strict v_dispatch
  from public.warehouse_dispatches
  where id = p_dispatch_id
  for update;

  if v_dispatch.dispatch_status = 'cancelled' then
    raise exception 'El despacho ya está cancelado.';
  end if;

  if v_dispatch.billing_status in ('invoiced', 'paid') then
    raise exception 'No se puede cancelar un despacho facturado o pagado.';
  end if;

  update public.warehouse_dispatches
  set dispatch_status = 'cancelled',
      billing_status = 'cancelled',
      updated_at = now()
  where id = v_dispatch.id
  returning * into v_dispatch;

  select greatest(
    coalesce(receipt.pieces, 0) - coalesce(sum(dispatch.pieces_dispatched), 0),
    0
  )
  into v_remaining
  from public.warehouse_receipts receipt
  left join public.warehouse_dispatches dispatch
    on dispatch.receipt_id = receipt.id
   and dispatch.dispatch_status in ('confirmed', 'delivered')
  where receipt.id = v_dispatch.receipt_id
  group by receipt.pieces;

  update public.warehouse_receipts
  set status = (
        case when v_remaining = 0 then 'dispatched' else 'available' end
      )::public.warehouse_receipt_status,
      updated_at = now()
  where id = v_dispatch.receipt_id;

  update public.warehouse_manifest_items
  set status = (
        case when v_remaining = 0 then 'dispatched' else 'ready_to_dispatch' end
      )::public.warehouse_manifest_item_status,
      updated_at = now()
  where id = v_dispatch.manifest_item_id;

  select count(*) into v_active_dispatches
  from public.warehouse_dispatches
  where manifest_id = v_dispatch.manifest_id
    and dispatch_status in ('confirmed', 'delivered');

  update public.warehouse_manifests
  set status = (
        case
          when v_active_dispatches = 0 then 'received'
          else 'partially_dispatched'
        end
      )::public.warehouse_manifest_status,
      updated_at = now()
  where id = v_dispatch.manifest_id;

  insert into public.warehouse_dispatch_events (
    dispatch_id, event_type, operator_name, notes
  ) values (
    v_dispatch.id, 'dispatch_cancelled', trim(p_operator_name), trim(p_reason)
  );

  return v_dispatch;
exception
  when no_data_found then
    raise exception 'No se encontró el despacho.';
end;
$$;

grant select on public.warehouse_dispatches to anon, authenticated;
grant select on public.warehouse_dispatch_charges to anon, authenticated;
grant select on public.warehouse_dispatch_events to anon, authenticated;

revoke all on function public.create_warehouse_bl_dispatch(
  uuid, numeric, numeric, text, text, text, text, text, text,
  text, text, text, text, text, numeric, numeric, jsonb
) from public;
grant execute on function public.create_warehouse_bl_dispatch(
  uuid, numeric, numeric, text, text, text, text, text, text,
  text, text, text, text, text, numeric, numeric, jsonb
) to anon, authenticated;

revoke all on function public.set_warehouse_dispatch_billing_status(
  uuid, text, text, text
) from public;
grant execute on function public.set_warehouse_dispatch_billing_status(
  uuid, text, text, text
) to anon, authenticated;

revoke all on function public.cancel_warehouse_bl_dispatch(
  uuid, text, text
) from public;
grant execute on function public.cancel_warehouse_bl_dispatch(
  uuid, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
