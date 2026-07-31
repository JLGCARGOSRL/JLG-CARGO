-- Public business-associate onboarding based on form GS-AN-08-001.
-- Submissions remain separate from the customer master until reviewed.

begin;

create table if not exists public.business_associate_applications (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected')),
  associate_type text[] not null default '{}',
  company_name text not null,
  tax_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  form_data jsonb not null default '{}'::jsonb,
  customer_id uuid references public.customers(id) on delete set null,
  internal_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_associate_applications_status_idx
  on public.business_associate_applications(status, submitted_at desc);
create index if not exists business_associate_applications_tax_id_idx
  on public.business_associate_applications(tax_id)
  where tax_id is not null;
create index if not exists business_associate_applications_email_idx
  on public.business_associate_applications(lower(contact_email))
  where contact_email is not null;

create table if not exists public.business_associate_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.business_associate_applications(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  content_type text,
  file_size bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists business_associate_documents_application_idx
  on public.business_associate_application_documents(application_id, created_at);

alter table public.business_associate_applications enable row level security;
alter table public.business_associate_application_documents enable row level security;

drop policy if exists business_associate_applications_authenticated_read
  on public.business_associate_applications;
create policy business_associate_applications_authenticated_read
  on public.business_associate_applications
  for select to authenticated
  using (true);

drop policy if exists business_associate_applications_authenticated_update
  on public.business_associate_applications;
create policy business_associate_applications_authenticated_update
  on public.business_associate_applications
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists business_associate_documents_authenticated_read
  on public.business_associate_application_documents;
create policy business_associate_documents_authenticated_read
  on public.business_associate_application_documents
  for select to authenticated
  using (true);

grant select, update on public.business_associate_applications to authenticated;
grant select on public.business_associate_application_documents to authenticated;
revoke all on public.business_associate_applications from anon;
revoke all on public.business_associate_application_documents from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-associate-documents',
  'business-associate-documents',
  false,
  8388608,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_associate_storage_authenticated_read
  on storage.objects;
create policy business_associate_storage_authenticated_read
  on storage.objects
  for select to authenticated
  using (bucket_id = 'business-associate-documents');

commit;

notify pgrst, 'reload schema';
