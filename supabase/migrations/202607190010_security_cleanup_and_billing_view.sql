begin;

-- Reassert the production boundary even if an older development migration is
-- replayed later. The browser may use only an authenticated Supabase session.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

drop policy if exists warehouse_dispatches_read on public.warehouse_dispatches;
create policy warehouse_dispatches_authenticated_read
  on public.warehouse_dispatches for select to authenticated using (true);

drop policy if exists warehouse_dispatch_charges_read on public.warehouse_dispatch_charges;
create policy warehouse_dispatch_charges_authenticated_read
  on public.warehouse_dispatch_charges for select to authenticated using (true);

drop policy if exists warehouse_dispatch_events_read on public.warehouse_dispatch_events;
create policy warehouse_dispatch_events_authenticated_read
  on public.warehouse_dispatch_events for select to authenticated using (true);

drop policy if exists warehouse_locations_select_dev on public.warehouse_locations;
create policy warehouse_locations_authenticated_read
  on public.warehouse_locations for select to authenticated using (true);

drop policy if exists warehouse_movements_select_dev on public.warehouse_movements;
create policy warehouse_movements_authenticated_read
  on public.warehouse_movements for select to authenticated using (true);

drop policy if exists container_receipts_dev_access on public.warehouse_container_receipts;
create policy container_receipts_authenticated_access
  on public.warehouse_container_receipts for all to authenticated
  using (true) with check (true);

drop policy if exists container_receipt_items_dev_access on public.warehouse_container_receipt_items;
create policy container_receipt_items_authenticated_access
  on public.warehouse_container_receipt_items for all to authenticated
  using (true) with check (true);

alter table public.warehouse_receipt_confirmations enable row level security;
drop policy if exists warehouse_receipt_confirmations_authenticated_access
  on public.warehouse_receipt_confirmations;
create policy warehouse_receipt_confirmations_authenticated_access
  on public.warehouse_receipt_confirmations for all to authenticated
  using (true) with check (true);

-- Persist the internal observation shown by the customer-document form.
alter table public.customer_documents add column if not exists notes text;
alter table public.customer_documents enable row level security;
drop policy if exists customer_documents_authenticated_access
  on public.customer_documents;
create policy customer_documents_authenticated_access
  on public.customer_documents for all to authenticated
  using (true) with check (true);

-- Operators can prepare dispatches; only administrators may cancel them or
-- change their financial status. Service-role maintenance remains available.
create or replace function public.enforce_dispatch_sensitive_changes()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is not null
     and (
       new.billing_status is distinct from old.billing_status
       or new.dispatch_status is distinct from old.dispatch_status
     )
     and coalesce(public.current_system_role(), '') <> 'administrator'
  then
    raise exception 'Esta operación requiere permisos de administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_dispatch_sensitive_changes
  on public.warehouse_dispatches;
create trigger warehouse_dispatch_sensitive_changes
  before update of billing_status, dispatch_status
  on public.warehouse_dispatches
  for each row execute function public.enforce_dispatch_sensitive_changes();

revoke all on function public.enforce_dispatch_sensitive_changes() from public, anon;
grant execute on function public.enforce_dispatch_sensitive_changes() to authenticated;

-- A focused report avoids loading every receipt, customer, location and
-- dispatch into the browser merely to calculate invoiced totals.
create or replace view public.warehouse_billing_report
with (security_invoker = true)
as
select
  dispatch.id,
  dispatch.dispatch_number,
  dispatch.billing_status,
  dispatch.currency,
  dispatch.invoice_reference,
  dispatch.subtotal,
  dispatch.tax_amount,
  dispatch.discount_amount,
  dispatch.total_amount,
  receipt.wr_number,
  manifest.manifest_number,
  item.document_number,
  coalesce(customer.company_name, customer.legal_name, 'Cliente sin nombre')
    as customer_name,
  customer.customer_code,
  event_dates.invoiced_at,
  event_dates.paid_at,
  coalesce(
    event_dates.invoiced_at,
    event_dates.paid_at,
    dispatch.updated_at,
    dispatch.dispatched_at
  ) as billing_date
from public.warehouse_dispatches dispatch
join public.warehouse_receipts receipt on receipt.id = dispatch.receipt_id
join public.warehouse_manifests manifest on manifest.id = dispatch.manifest_id
join public.warehouse_manifest_items item on item.id = dispatch.manifest_item_id
join public.customers customer on customer.id = dispatch.customer_id
left join lateral (
  select
    min(event.created_at) filter (
      where event.metadata ->> 'billing_status' = 'invoiced'
    ) as invoiced_at,
    min(event.created_at) filter (
      where event.metadata ->> 'billing_status' = 'paid'
    ) as paid_at
  from public.warehouse_dispatch_events event
  where event.dispatch_id = dispatch.id
    and event.event_type = 'billing_status_changed'
) event_dates on true
where dispatch.dispatch_status <> 'cancelled'
  and dispatch.billing_status in ('invoiced', 'paid');

revoke all on public.warehouse_billing_report from public, anon;
grant select on public.warehouse_billing_report to authenticated;

notify pgrst, 'reload schema';

commit;
