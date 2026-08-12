alter table public.communication_records
  drop constraint if exists communication_email_message_unique;

create unique index if not exists communication_email_message_unique
  on public.communication_records (message_id)
  where message_id is not null;
