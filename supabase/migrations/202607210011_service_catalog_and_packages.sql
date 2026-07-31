begin;

create table if not exists public.warehouse_service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null default 'servicio',
  standard_price numeric(14, 2) not null default 0 check (standard_price >= 0),
  minimum_quantity numeric(12, 3) not null default 1 check (minimum_quantity > 0),
  quantity_mode text not null default 'fixed'
    check (quantity_mode in ('fixed', 'storage_days', 'pieces')),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_service_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_service_package_items (
  package_id uuid not null references public.warehouse_service_packages(id) on delete cascade,
  service_id uuid not null references public.warehouse_service_catalog(id) on delete cascade,
  quantity_override numeric(12, 3) check (quantity_override is null or quantity_override > 0),
  sort_order integer not null default 0,
  primary key (package_id, service_id)
);

create index if not exists warehouse_service_catalog_active_idx
  on public.warehouse_service_catalog (active, currency, sort_order);
create index if not exists warehouse_service_packages_active_idx
  on public.warehouse_service_packages (active, currency, sort_order);

alter table public.warehouse_service_catalog enable row level security;
alter table public.warehouse_service_packages enable row level security;
alter table public.warehouse_service_package_items enable row level security;

create policy warehouse_service_catalog_authenticated_read
  on public.warehouse_service_catalog for select to authenticated using (true);
create policy warehouse_service_packages_authenticated_read
  on public.warehouse_service_packages for select to authenticated using (true);
create policy warehouse_service_package_items_authenticated_read
  on public.warehouse_service_package_items for select to authenticated using (true);

create policy warehouse_service_catalog_admin_write
  on public.warehouse_service_catalog for all to authenticated
  using (public.current_system_role() = 'administrator')
  with check (public.current_system_role() = 'administrator');
create policy warehouse_service_packages_admin_write
  on public.warehouse_service_packages for all to authenticated
  using (public.current_system_role() = 'administrator')
  with check (public.current_system_role() = 'administrator');
create policy warehouse_service_package_items_admin_write
  on public.warehouse_service_package_items for all to authenticated
  using (public.current_system_role() = 'administrator')
  with check (public.current_system_role() = 'administrator');

grant select on public.warehouse_service_catalog,
  public.warehouse_service_packages,
  public.warehouse_service_package_items to authenticated;
grant insert, update, delete on public.warehouse_service_catalog,
  public.warehouse_service_packages,
  public.warehouse_service_package_items to authenticated;

insert into public.warehouse_service_catalog (
  code, name, unit, standard_price, minimum_quantity, quantity_mode, currency, sort_order
) values
  ('cargo_receipt_control', 'Recepción y control de carga', 'servicio', 1240, 1, 'fixed', 'DOP', 10),
  ('storage', 'Almacenaje', 'día', 720, 7, 'storage_days', 'DOP', 20)
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  standard_price = excluded.standard_price,
  minimum_quantity = excluded.minimum_quantity,
  quantity_mode = excluded.quantity_mode,
  currency = excluded.currency,
  updated_at = now();

insert into public.warehouse_service_packages (
  code, name, description, currency, sort_order
) values (
  'storage_dispatch',
  'Almacenaje y despacho',
  'Recepción, control de carga y almacenaje con un mínimo de 7 días.',
  'DOP',
  10
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  currency = excluded.currency,
  updated_at = now();

insert into public.warehouse_service_package_items (package_id, service_id, sort_order)
select package.id, service.id, seed.sort_order
from (values
  ('cargo_receipt_control', 10),
  ('storage', 20)
) as seed(service_code, sort_order)
join public.warehouse_service_packages package on package.code = 'storage_dispatch'
join public.warehouse_service_catalog service on service.code = seed.service_code
on conflict (package_id, service_id) do update set sort_order = excluded.sort_order;

notify pgrst, 'reload schema';

commit;
