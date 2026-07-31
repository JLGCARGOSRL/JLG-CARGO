-- Ensure signed-in operational users can access customer records.
-- Anonymous access remains revoked by the system access-control migration.

begin;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customers to authenticated;

alter table public.customers enable row level security;

drop policy if exists customers_authenticated_access on public.customers;
create policy customers_authenticated_access
  on public.customers
  for all
  to authenticated
  using (true)
  with check (true);

commit;

notify pgrst, 'reload schema';
