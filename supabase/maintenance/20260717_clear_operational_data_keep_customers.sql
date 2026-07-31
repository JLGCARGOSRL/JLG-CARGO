-- One-time cleanup before production data entry.
-- Preserves customers, customer documents, users, access logs, roles,
-- countries, warehouse locations and administrative configuration.

begin;

create temp table cleanup_report (
  table_name text primary key,
  deleted_rows bigint not null
) on commit preserve rows;

with deleted as (delete from public.warehouse_dispatch_charges returning 1)
insert into cleanup_report select 'warehouse_dispatch_charges', count(*) from deleted;
with deleted as (delete from public.warehouse_dispatch_events returning 1)
insert into cleanup_report select 'warehouse_dispatch_events', count(*) from deleted;
with deleted as (delete from public.warehouse_dispatches returning 1)
insert into cleanup_report select 'warehouse_dispatches', count(*) from deleted;

with deleted as (delete from public.warehouse_container_receipt_items returning 1)
insert into cleanup_report select 'warehouse_container_receipt_items', count(*) from deleted;
with deleted as (delete from public.warehouse_container_receipts returning 1)
insert into cleanup_report select 'warehouse_container_receipts', count(*) from deleted;

with deleted as (delete from public.warehouse_movements returning 1)
insert into cleanup_report select 'warehouse_movements', count(*) from deleted;
with deleted as (delete from public.warehouse_receipt_items returning 1)
insert into cleanup_report select 'warehouse_receipt_items', count(*) from deleted;
with deleted as (delete from public.warehouse_receipt_documents returning 1)
insert into cleanup_report select 'warehouse_receipt_documents', count(*) from deleted;
with deleted as (delete from public.warehouse_receipt_confirmations returning 1)
insert into cleanup_report select 'warehouse_receipt_confirmations', count(*) from deleted;
with deleted as (delete from public.warehouse_receipts returning 1)
insert into cleanup_report select 'warehouse_receipts', count(*) from deleted;

with deleted as (delete from public.warehouse_manifest_items returning 1)
insert into cleanup_report select 'warehouse_manifest_items', count(*) from deleted;
with deleted as (delete from public.warehouse_manifests returning 1)
insert into cleanup_report select 'warehouse_manifests', count(*) from deleted;

with deleted as (delete from public.cargo_items returning 1)
insert into cleanup_report select 'cargo_items', count(*) from deleted;
with deleted as (delete from public.bills_of_lading returning 1)
insert into cleanup_report select 'bills_of_lading', count(*) from deleted;
with deleted as (delete from public.shipments returning 1)
insert into cleanup_report select 'shipments', count(*) from deleted;
with deleted as (delete from public.documents returning 1)
insert into cleanup_report select 'documents', count(*) from deleted;

alter sequence public.warehouse_dispatch_number_seq restart with 1;
alter sequence public.container_receipt_number_seq restart with 1;

commit;

select table_name, deleted_rows
from cleanup_report
order by table_name;
