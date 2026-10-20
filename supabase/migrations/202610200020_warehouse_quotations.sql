begin;

create table public.warehouse_quotations (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  operation text not null check (operation in ('cross_docking','deconsolidation','export')),
  presentation text not null check (presentation in ('palletized','loose','mixed')),
  currency text not null check (currency in ('USD','DOP')),
  valid_until text not null default '' check (valid_until = '' or valid_until ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  shipment jsonb not null check (jsonb_typeof(shipment) = 'object'),
  cargo jsonb not null check (jsonb_typeof(cargo) = 'array'),
  charges jsonb not null check (jsonb_typeof(charges) = 'array' and jsonb_array_length(charges) > 0),
  conditions text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every quotation belongs to an existing company. JSON retains the complete
-- commercial draft atomically, including explicitly unpriced (null) services.
create or replace function public.validate_warehouse_quotation()
returns trigger language plpgsql set search_path = public as $$
declare item jsonb; field text; value numeric;
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.number := old.number;
  else
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  if new.valid_until <> '' then perform new.valid_until::date; end if;
  new.updated_at := clock_timestamp();
  value := (new.shipment->>'dispatches')::numeric;
  if value is null or value < 0 or value::text in ('NaN','Infinity','-Infinity') or value <> trunc(value) then raise exception 'Invalid dispatch count'; end if;
  for item in select * from jsonb_array_elements(new.cargo) loop
    foreach field in array array['boxes','kg','m3','pallets'] loop
      value := (item->>field)::numeric;
      if value is null or value < 0 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid cargo quantity'; end if;
      if field in ('boxes','pallets') and value <> trunc(value) then raise exception 'Cargo count must be an integer'; end if;
    end loop;
  end loop;
  if exists (select 1 from jsonb_array_elements(new.cargo) c where btrim(c->>'hbl') <> '' group by upper(btrim(c->>'hbl')) having count(*) > 1) then raise exception 'Duplicate HBL'; end if;
  for item in select * from jsonb_array_elements(new.charges) loop
    if coalesce(btrim(item->>'name'),'') = '' or coalesce(item->>'basis','') not in ('container','hbl','boxes','kg','m3','pallets','dispatches','manual') then raise exception 'Invalid quotation charge'; end if;
    foreach field in array array['quantity','included','minimum','cost','price','tax'] loop
      value := (item->>field)::numeric;
      if value is null and field not in ('cost','price') then raise exception 'Missing charge quantity'; end if;
      if value < 0 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid charge amount'; end if;
      if field = 'tax' and value > 100 then raise exception 'Invalid tax rate'; end if;
    end loop;
  end loop;
  return new;
end $$;
create trigger validate_warehouse_quotation before insert or update on public.warehouse_quotations for each row execute function public.validate_warehouse_quotation();
create index warehouse_quotations_customer_idx on public.warehouse_quotations(customer_id, created_at desc);
alter table public.warehouse_quotations enable row level security;
create policy quotation_staff_read on public.warehouse_quotations for select to authenticated using (public.current_system_role() in ('administrator','operator'));
create policy quotation_staff_insert on public.warehouse_quotations for insert to authenticated with check (public.current_system_role() in ('administrator','operator') and created_by = auth.uid());
create policy quotation_staff_update on public.warehouse_quotations for update to authenticated using (public.current_system_role() in ('administrator','operator')) with check (public.current_system_role() in ('administrator','operator'));
grant select, insert, update on public.warehouse_quotations to authenticated;
grant usage, select on sequence public.warehouse_quotations_number_seq to authenticated;
commit;
notify pgrst, 'reload schema';
