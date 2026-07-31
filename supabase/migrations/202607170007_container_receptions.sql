-- Container reception, reconciliation by BL and signed paper evidence.

create sequence if not exists public.container_receipt_number_seq start 1;

create table if not exists public.warehouse_container_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default (
    'CTR-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.container_receipt_number_seq')::text, 6, '0')
  ),
  manifest_id uuid references public.warehouse_manifests(id) on delete restrict,
  container_number text not null,
  container_type text not null default '40 HC',
  equipment_owner text,
  customs_administration text,
  transfer_type text,
  seal_declared text,
  seal_found text,
  seal_status text not null default 'pending'
    check (seal_status in ('pending','correct','different','broken','missing')),
  exterior_condition text not null default 'pending'
    check (exterior_condition in ('pending','good','damaged','critical')),
  has_dents boolean not null default false,
  has_holes boolean not null default false,
  has_rust boolean not null default false,
  has_water boolean not null default false,
  has_door_damage boolean not null default false,
  temperature_c numeric,
  carrier_name text,
  driver_name text not null,
  driver_identification text,
  driver_phone text,
  truck_plate text,
  chassis_plate text,
  gate_number text,
  dock_number text,
  arrived_at timestamptz not null default now(),
  unloading_started_at timestamptz,
  unloading_finished_at timestamptz,
  departed_at timestamptz,
  reception_operator text not null,
  security_operator text,
  unloading_supervisor text,
  equipment_used text[] not null default '{}',
  pallet_quantity integer not null default 0 check (pallet_quantity >= 0),
  incident_notes text,
  general_notes text,
  status text not null default 'at_gate'
    check (status in ('scheduled','at_gate','seal_verified','unloading','with_differences','quarantine','reconciled','closed','cancelled')),
  paper_document_path text,
  paper_document_name text,
  paper_document_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_container_receipt_items (
  id uuid primary key default gen_random_uuid(),
  container_receipt_id uuid not null references public.warehouse_container_receipts(id) on delete cascade,
  manifest_item_id uuid references public.warehouse_manifest_items(id) on delete set null,
  warehouse_receipt_id uuid references public.warehouse_receipts(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  line_number integer not null,
  document_number text,
  house_bl text,
  customer_name text,
  cargo_description text,
  package_type text not null default 'BULTOS',
  expected_packages integer not null default 0,
  received_packages integer not null default 0,
  damaged_packages integer not null default 0,
  expected_weight_kg numeric not null default 0,
  received_weight_kg numeric not null default 0,
  difference_packages integer generated always as (received_packages - expected_packages) stored,
  condition text not null default 'pending'
    check (condition in ('pending','good','damaged','wet','open','missing')),
  location_id uuid references public.warehouse_locations(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (container_receipt_id, line_number)
);

create index if not exists container_receipts_manifest_idx on public.warehouse_container_receipts(manifest_id);
create index if not exists container_receipts_container_idx on public.warehouse_container_receipts(container_number);
create index if not exists container_receipt_items_receipt_idx on public.warehouse_container_receipt_items(container_receipt_id);

alter table public.warehouse_container_receipts enable row level security;
alter table public.warehouse_container_receipt_items enable row level security;

drop policy if exists container_receipts_dev_access on public.warehouse_container_receipts;
create policy container_receipts_dev_access on public.warehouse_container_receipts
  for all to anon, authenticated using (true) with check (true);
drop policy if exists container_receipt_items_dev_access on public.warehouse_container_receipt_items;
create policy container_receipt_items_dev_access on public.warehouse_container_receipt_items
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.warehouse_container_receipts to anon, authenticated;
grant select, insert, update, delete on public.warehouse_container_receipt_items to anon, authenticated;
grant usage, select on sequence public.container_receipt_number_seq to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'container-reception-documents', 'container-reception-documents', false,
  10485760, array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists container_reception_documents_dev on storage.objects;
create policy container_reception_documents_dev on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'container-reception-documents')
  with check (bucket_id = 'container-reception-documents');
