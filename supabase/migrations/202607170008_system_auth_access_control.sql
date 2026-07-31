-- Authentication, role-based access and login auditing for JLG Cargo Net.

create table if not exists public.system_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  "role" text not null default 'operator'
    check ("role" in ('administrator', 'operator')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  event_type text not null
    check (event_type in ('login', 'logout', 'password_changed')),
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists system_access_logs_user_idx
  on public.system_access_logs(user_id, created_at desc);
create index if not exists system_access_logs_created_idx
  on public.system_access_logs(created_at desc);

create or replace function public.current_system_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select "role"
  from public.system_user_profiles
  where id = auth.uid() and is_active = true
$$;

create or replace function public.handle_system_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.system_user_profiles (
    id, email, full_name, "role", is_active, must_change_password
  ) values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'administrator' then 'administrator' else 'operator' end,
    true,
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), public.system_user_profiles.full_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_system_profile on auth.users;
create trigger on_auth_user_created_system_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_system_user_created();

insert into public.system_user_profiles (id, email, full_name, "role", is_active, must_change_password)
select
  id,
  lower(coalesce(email, '')),
  coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1)),
  case when raw_user_meta_data ->> 'role' = 'administrator' then 'administrator' else 'operator' end,
  true,
  coalesce((raw_user_meta_data ->> 'must_change_password')::boolean, true)
from auth.users
where email is not null
on conflict (id) do nothing;

create or replace function public.record_system_access_event(
  p_event_type text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_active boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_event_type not in ('login', 'logout', 'password_changed') then
    raise exception 'Invalid access event';
  end if;

  select email, is_active into v_email, v_active
  from public.system_user_profiles
  where id = v_user_id;

  if coalesce(v_active, false) = false then
    raise exception 'User is inactive';
  end if;

  insert into public.system_access_logs(user_id, email, event_type, user_agent)
  values (v_user_id, coalesce(v_email, ''), p_event_type, left(p_user_agent, 500));

  if p_event_type = 'login' then
    update public.system_user_profiles
    set last_login_at = now(), updated_at = now()
    where id = v_user_id;
  elsif p_event_type = 'password_changed' then
    update public.system_user_profiles
    set must_change_password = false, updated_at = now()
    where id = v_user_id;
  end if;
end;
$$;

alter table public.system_user_profiles enable row level security;
alter table public.system_access_logs enable row level security;

drop policy if exists system_profiles_read on public.system_user_profiles;
create policy system_profiles_read on public.system_user_profiles
  for select to authenticated
  using (id = auth.uid() or public.current_system_role() = 'administrator');

drop policy if exists system_profiles_admin_update on public.system_user_profiles;
create policy system_profiles_admin_update on public.system_user_profiles
  for update to authenticated
  using (public.current_system_role() = 'administrator')
  with check (public.current_system_role() = 'administrator');

drop policy if exists system_access_logs_admin_read on public.system_access_logs;
create policy system_access_logs_admin_read on public.system_access_logs
  for select to authenticated
  using (public.current_system_role() = 'administrator');

-- Remove the development-era anonymous access across the public schema.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- Authenticated operational users retain the existing application capabilities.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant select, update on public.system_user_profiles to authenticated;
grant select on public.system_access_logs to authenticated;
grant execute on function public.current_system_role() to authenticated;
grant execute on function public.record_system_access_event(text, text) to authenticated;

-- Storage evidence must also require a valid session.
drop policy if exists container_reception_documents_dev on storage.objects;
drop policy if exists container_reception_documents_authenticated on storage.objects;
create policy container_reception_documents_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'container-reception-documents')
  with check (bucket_id = 'container-reception-documents');

-- Assign the requested initial roles when the accounts already exist.
update public.system_user_profiles
set "role" = 'administrator', full_name = 'Pedro Hernández', is_active = true,
    must_change_password = true, updated_at = now()
where email = 'pjhernandez@jlgcargo.com';

update public.system_user_profiles
set "role" = 'operator', full_name = 'Yasser Ulloa', is_active = true,
    must_change_password = true, updated_at = now()
where email = 'yulloa@jlgcargo.com';
