-- El numero de manifiesto puede repetirse cuando pertenece a un Master BL
-- diferente. La combinacion numero de manifiesto + Master BL sigue siendo unica.
alter table public.warehouse_manifests
  drop constraint if exists warehouse_manifests_manifest_number_key;

alter table public.warehouse_manifests
  drop constraint if exists warehouse_manifests_unique_number_master_bl;

alter table public.warehouse_manifests
  add constraint warehouse_manifests_unique_number_master_bl
  unique (manifest_number, master_bl);
