-- Authentic communication timeline. Server dates are immutable and manual
-- entries always retain their real system creation timestamp.

create extension if not exists pgcrypto;

create table if not exists public.communication_records (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'phone', 'whatsapp', 'in_person', 'other')),
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  source text not null check (source in ('mail_server', 'manual', 'system')),
  subject text not null,
  sender text,
  recipients text[] not null default '{}',
  body_text text,
  message_id text,
  customer_reference text,
  document_reference text,
  sent_at timestamptz,
  received_at timestamptz,
  declared_at timestamptz,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint communication_email_message_unique unique nulls not distinct (message_id),
  constraint communication_source_dates check (
    (source = 'mail_server' and channel = 'email' and (sent_at is not null or received_at is not null))
    or (source = 'manual' and declared_at is not null)
    or source = 'system'
  )
);

create index if not exists communication_effective_date_idx on public.communication_records
  (coalesce(received_at, sent_at, declared_at, created_at) desc);
create index if not exists communication_customer_idx on public.communication_records(customer_reference);
create index if not exists communication_document_idx on public.communication_records(document_reference);

create table if not exists public.communication_audit_logs (
  id bigint generated always as identity primary key,
  communication_id uuid not null references public.communication_records(id) on delete restrict,
  action text not null check (action in ('created', 'updated')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_data jsonb,
  new_data jsonb not null
);

create or replace function public.protect_communication_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Communication evidence cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and (
    new.source is distinct from old.source or
    new.message_id is distinct from old.message_id or
    new.sent_at is distinct from old.sent_at or
    new.received_at is distinct from old.received_at or
    new.declared_at is distinct from old.declared_at or
    new.imported_at is distinct from old.imported_at or
    new.created_at is distinct from old.created_at or
    new.created_by is distinct from old.created_by
  ) then
    raise exception 'Evidence dates and origin are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_communication_evidence_trigger on public.communication_records;
create trigger protect_communication_evidence_trigger
  before update or delete on public.communication_records
  for each row execute function public.protect_communication_evidence();

create or replace function public.audit_communication_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.communication_audit_logs (
    communication_id, action, changed_by, previous_data, new_data
  ) values (
    new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists audit_communication_evidence_trigger on public.communication_records;
create trigger audit_communication_evidence_trigger
  after insert or update on public.communication_records
  for each row execute function public.audit_communication_evidence();

create or replace function public.record_manual_communication(
  p_channel text,
  p_direction text,
  p_subject text,
  p_counterpart text,
  p_body text,
  p_declared_at timestamptz,
  p_customer_reference text default null,
  p_document_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_channel not in ('phone', 'whatsapp', 'in_person', 'other') then raise exception 'Invalid manual channel'; end if;
  if p_direction not in ('inbound', 'outbound', 'internal') then raise exception 'Invalid direction'; end if;
  if nullif(trim(p_subject), '') is null then raise exception 'Subject is required'; end if;
  if p_declared_at > now() + interval '5 minutes' then raise exception 'Declared date cannot be in the future'; end if;

  insert into public.communication_records (
    channel, direction, source, subject, sender, recipients, body_text,
    declared_at, customer_reference, document_reference, created_by
  ) values (
    p_channel, p_direction, 'manual', trim(p_subject),
    case when p_direction = 'inbound' then nullif(trim(p_counterpart), '') else null end,
    case when p_direction = 'outbound' then array[trim(p_counterpart)] else '{}' end,
    nullif(trim(p_body), ''), p_declared_at,
    nullif(trim(p_customer_reference), ''), nullif(trim(p_document_reference), ''), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.communication_records_with_user
with (security_invoker = true)
as
select
  c.*,
  coalesce(c.received_at, c.sent_at, c.declared_at, c.created_at) as effective_at,
  p.full_name as created_by_name
from public.communication_records c
left join public.system_user_profiles p on p.id = c.created_by;

alter table public.communication_records enable row level security;
alter table public.communication_audit_logs enable row level security;

drop policy if exists communication_records_read on public.communication_records;
create policy communication_records_read on public.communication_records
  for select to authenticated using (true);

drop policy if exists communication_records_update_admin on public.communication_records;
create policy communication_records_update_admin on public.communication_records
  for update to authenticated
  using (public.current_system_role() = 'administrator')
  with check (public.current_system_role() = 'administrator');

drop policy if exists communication_audit_admin_read on public.communication_audit_logs;
create policy communication_audit_admin_read on public.communication_audit_logs
  for select to authenticated using (public.current_system_role() = 'administrator');

grant select, update on public.communication_records to authenticated;
grant select on public.communication_records_with_user to authenticated;
grant select on public.communication_audit_logs to authenticated;
grant execute on function public.record_manual_communication(text, text, text, text, text, timestamptz, text, text) to authenticated;

