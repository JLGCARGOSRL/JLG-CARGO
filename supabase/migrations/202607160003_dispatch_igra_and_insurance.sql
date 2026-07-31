begin;

alter table public.warehouse_dispatches
  add column if not exists igra_number text,
  add column if not exists igra_approved boolean not null default false,
  add column if not exists liquidation_amount numeric not null default 0,
  add column if not exists insurance_rate numeric not null default 0,
  add column if not exists insurance_amount numeric not null default 0;

alter table public.warehouse_dispatches
  add constraint warehouse_dispatches_igra_insurance_amounts_check
  check (
    liquidation_amount >= 0 and
    insurance_rate >= 0 and insurance_rate <= 100 and
    insurance_amount >= 0
  );

-- Conserva la implementación transaccional existente y la envuelve con los
-- nuevos controles obligatorios de IGRA y seguro.
alter function public.create_warehouse_bl_dispatch(
  uuid, numeric, numeric, text, text, text, text, text, text,
  text, text, text, text, text, numeric, numeric, jsonb
) rename to create_warehouse_bl_dispatch_legacy;

revoke all on function public.create_warehouse_bl_dispatch_legacy(
  uuid, numeric, numeric, text, text, text, text, text, text,
  text, text, text, text, text, numeric, numeric, jsonb
) from public, anon, authenticated;

create function public.create_warehouse_bl_dispatch(
  p_receipt_id uuid,
  p_pieces_dispatched numeric,
  p_weight_dispatched_kg numeric,
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
  v_dispatch public.warehouse_dispatches%rowtype;
  v_insurance_amount numeric;
  v_charges jsonb;
begin
  if nullif(trim(coalesce(p_igra_number, '')), '') is null then
    raise exception 'Debes indicar el número de IGRA aprobado.';
  end if;

  if coalesce(p_igra_approved, false) is not true then
    raise exception 'El IGRA debe estar aprobado antes de confirmar el despacho.';
  end if;

  if coalesce(p_liquidation_amount, 0) <= 0 then
    raise exception 'El monto de la liquidación debe ser mayor que cero.';
  end if;

  if coalesce(p_insurance_rate, 0) <= 0 or p_insurance_rate > 100 then
    raise exception 'El porcentaje del seguro debe ser mayor que cero y no mayor de 100%%.';
  end if;

  v_insurance_amount := round(p_liquidation_amount * p_insurance_rate / 100, 2);
  v_charges := coalesce(p_charges, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'code', 'cargo_insurance',
      'description', 'Seguro de carga',
      'quantity', 1,
      'unit', 'servicio',
      'unit_rate', v_insurance_amount
    )
  );

  v_dispatch := public.create_warehouse_bl_dispatch_legacy(
    p_receipt_id,
    p_pieces_dispatched,
    p_weight_dispatched_kg,
    p_recipient_name,
    p_recipient_identification,
    p_recipient_phone,
    p_carrier_name,
    p_driver_name,
    p_vehicle_plate,
    p_delivery_address,
    p_authorization_reference,
    p_operator_name,
    p_delivery_notes,
    p_currency,
    p_tax_rate,
    p_discount_amount,
    v_charges
  );

  update public.warehouse_dispatches
  set igra_number = upper(trim(p_igra_number)),
      igra_approved = true,
      liquidation_amount = round(p_liquidation_amount, 2),
      insurance_rate = round(p_insurance_rate, 4),
      insurance_amount = v_insurance_amount,
      updated_at = now()
  where id = v_dispatch.id
  returning * into v_dispatch;

  update public.warehouse_dispatch_events
  set metadata = metadata || jsonb_build_object(
        'igra_number', v_dispatch.igra_number,
        'igra_approved', v_dispatch.igra_approved,
        'liquidation_amount', v_dispatch.liquidation_amount,
        'insurance_rate', v_dispatch.insurance_rate,
        'insurance_amount', v_dispatch.insurance_amount
      )
  where dispatch_id = v_dispatch.id
    and event_type = 'dispatch_confirmed';

  return v_dispatch;
end;
$$;

revoke all on function public.create_warehouse_bl_dispatch(
  uuid, numeric, numeric, text, boolean, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text,
  text, numeric, numeric, jsonb
) from public;

grant execute on function public.create_warehouse_bl_dispatch(
  uuid, numeric, numeric, text, boolean, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text,
  text, numeric, numeric, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
