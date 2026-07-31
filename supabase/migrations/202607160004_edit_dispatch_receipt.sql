begin;

create table if not exists public.warehouse_dispatch_admin_settings (
  singleton boolean primary key default true check (singleton),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.warehouse_dispatch_admin_settings enable row level security;
revoke all on public.warehouse_dispatch_admin_settings from public, anon, authenticated;

create or replace function public.update_warehouse_bl_dispatch(
  p_dispatch_id uuid,
  p_igra_number text,
  p_igra_approved boolean,
  p_liquidation_amount numeric,
  p_insurance_rate numeric,
  p_recipient_name text,
  p_recipient_identification text,
  p_recipient_phone text,
  p_carrier_name text,
  p_driver_name text,
  p_vehicle_plate text,
  p_delivery_notes text,
  p_currency text,
  p_tax_rate numeric,
  p_discount_amount numeric,
  p_edited_by text,
  p_admin_key text,
  p_charges jsonb
)
returns public.warehouse_dispatches
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_dispatch public.warehouse_dispatches%rowtype;
  v_password_hash text;
  v_insurance_amount numeric;
  v_subtotal numeric;
  v_tax_rate numeric;
  v_discount numeric;
  v_previous_total numeric;
  v_previous_igra text;
begin
  select * into strict v_dispatch
  from public.warehouse_dispatches
  where id = p_dispatch_id
  for update;

  if v_dispatch.dispatch_status = 'cancelled' then
    raise exception 'Un comprobante cancelado no puede editarse.';
  end if;

  if v_dispatch.billing_status in ('invoiced', 'paid') then
    select password_hash into v_password_hash
    from public.warehouse_dispatch_admin_settings
    where singleton = true;

    if v_password_hash is null or
       extensions.crypt(coalesce(p_admin_key, ''), v_password_hash) <> v_password_hash then
      raise exception 'Clave administrativa incorrecta.';
    end if;
  end if;

  if nullif(trim(coalesce(p_edited_by, '')), '') is null then
    raise exception 'Debes indicar quién realiza la corrección.';
  end if;
  if nullif(trim(coalesce(p_igra_number, '')), '') is null or coalesce(p_igra_approved, false) is not true then
    raise exception 'El IGRA debe estar indicado y aprobado.';
  end if;
  if coalesce(p_liquidation_amount, 0) <= 0 then
    raise exception 'El monto de liquidación debe ser mayor que cero.';
  end if;
  if coalesce(p_insurance_rate, 0) <= 0 or p_insurance_rate > 100 then
    raise exception 'La tasa de seguro debe ser mayor que cero y no mayor de 100%%.';
  end if;
  if nullif(trim(coalesce(p_recipient_name, '')), '') is null then
    raise exception 'Debes indicar la persona autorizada a retirar.';
  end if;
  if upper(coalesce(p_currency, '')) not in ('DOP', 'USD') then
    raise exception 'La moneda debe ser DOP o USD.';
  end if;

  v_previous_total := v_dispatch.total_amount;
  v_previous_igra := v_dispatch.igra_number;
  v_insurance_amount := round(p_liquidation_amount * p_insurance_rate / 100, 2);

  delete from public.warehouse_dispatch_charges where dispatch_id = v_dispatch.id;

  insert into public.warehouse_dispatch_charges (
    dispatch_id, sort_order, charge_code, description, quantity, unit, unit_rate, amount
  )
  select
    v_dispatch.id,
    charge.ordinality::integer,
    coalesce(nullif(trim(charge.value->>'code'), ''), 'service'),
    trim(charge.value->>'description'),
    (charge.value->>'quantity')::numeric,
    coalesce(nullif(trim(charge.value->>'unit'), ''), 'servicio'),
    (charge.value->>'unit_rate')::numeric,
    round((charge.value->>'quantity')::numeric * (charge.value->>'unit_rate')::numeric, 2)
  from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) with ordinality as charge(value, ordinality)
  where nullif(trim(charge.value->>'description'), '') is not null
    and coalesce(charge.value->>'code', '') <> 'cargo_insurance'
    and (charge.value->>'quantity')::numeric > 0
    and (charge.value->>'unit_rate')::numeric >= 0;

  insert into public.warehouse_dispatch_charges (
    dispatch_id, sort_order, charge_code, description, quantity, unit, unit_rate, amount
  ) values (
    v_dispatch.id, 10000, 'cargo_insurance', 'Seguro de carga', 1, 'servicio',
    v_insurance_amount, v_insurance_amount
  );

  select coalesce(sum(amount), 0) into v_subtotal
  from public.warehouse_dispatch_charges
  where dispatch_id = v_dispatch.id;

  v_tax_rate := least(greatest(coalesce(p_tax_rate, 0), 0), 100);
  v_discount := least(
    greatest(coalesce(p_discount_amount, 0), 0),
    v_subtotal + round(v_subtotal * v_tax_rate / 100, 2)
  );

  update public.warehouse_dispatches
  set igra_number = upper(trim(p_igra_number)),
      igra_approved = true,
      liquidation_amount = round(p_liquidation_amount, 2),
      insurance_rate = round(p_insurance_rate, 4),
      insurance_amount = v_insurance_amount,
      recipient_name = trim(p_recipient_name),
      recipient_identification = nullif(trim(coalesce(p_recipient_identification, '')), ''),
      recipient_phone = nullif(trim(coalesce(p_recipient_phone, '')), ''),
      carrier_name = nullif(trim(coalesce(p_carrier_name, '')), ''),
      driver_name = nullif(trim(coalesce(p_driver_name, '')), ''),
      vehicle_plate = nullif(upper(trim(coalesce(p_vehicle_plate, ''))), ''),
      delivery_notes = nullif(trim(coalesce(p_delivery_notes, '')), ''),
      currency = upper(p_currency),
      subtotal = v_subtotal,
      tax_rate = v_tax_rate,
      tax_amount = round(v_subtotal * v_tax_rate / 100, 2),
      discount_amount = v_discount,
      total_amount = v_subtotal + round(v_subtotal * v_tax_rate / 100, 2) - v_discount,
      updated_at = now()
  where id = v_dispatch.id
  returning * into v_dispatch;

  insert into public.warehouse_dispatch_events (
    dispatch_id, event_type, operator_name, notes, metadata
  ) values (
    v_dispatch.id,
    'dispatch_edited',
    trim(p_edited_by),
    'Comprobante de despacho corregido',
    jsonb_build_object(
      'previous_igra', v_previous_igra,
      'new_igra', v_dispatch.igra_number,
      'previous_total', v_previous_total,
      'new_total', v_dispatch.total_amount,
      'admin_override', v_dispatch.billing_status in ('invoiced', 'paid')
    )
  );

  return v_dispatch;
exception
  when no_data_found then
    raise exception 'No se encontró el comprobante de despacho.';
end;
$$;

revoke all on function public.update_warehouse_bl_dispatch(
  uuid, text, boolean, numeric, numeric, text, text, text, text,
  text, text, text, text, numeric, numeric, text, text, jsonb
) from public;

grant execute on function public.update_warehouse_bl_dispatch(
  uuid, text, boolean, numeric, numeric, text, text, text, text,
  text, text, text, text, numeric, numeric, text, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
