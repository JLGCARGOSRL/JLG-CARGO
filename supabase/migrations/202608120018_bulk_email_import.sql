alter table public.communication_records
  add column if not exists source_file_name text,
  add column if not exists raw_sha256 text;

create unique index if not exists communication_raw_sha256_unique
  on public.communication_records (raw_sha256) where raw_sha256 is not null;

create or replace function public.import_email_communications(p_records jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare item jsonb; inserted_count integer := 0; duplicate_count integer := 0; mailbox_direction text; occurred_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_system_role() <> 'administrator' then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_records) <> 'array' then raise exception 'Records must be an array'; end if;
  if jsonb_array_length(p_records) > 250 then raise exception 'Maximum 250 emails per import'; end if;
  for item in select value from jsonb_array_elements(p_records) loop
    mailbox_direction := item->>'direction'; occurred_at := (item->>'occurredAt')::timestamptz;
    if mailbox_direction not in ('inbound', 'outbound') then raise exception 'Invalid email direction'; end if;
    if nullif(item->>'messageId', '') is null or occurred_at is null then raise exception 'Message ID and date are required'; end if;
    insert into public.communication_records (channel, direction, source, subject, sender, recipients, body_text, message_id, sent_at, received_at, created_by, source_file_name, raw_sha256)
    values ('email', mailbox_direction, 'mail_server', coalesce(nullif(item->>'subject', ''), '(Sin asunto)'), nullif(item->>'sender', ''),
      coalesce(array(select jsonb_array_elements_text(item->'recipients')), '{}'), nullif(item->>'bodyText', ''), item->>'messageId',
      case when mailbox_direction = 'outbound' then occurred_at else null end, case when mailbox_direction = 'inbound' then occurred_at else null end,
      auth.uid(), nullif(item->>'sourceFileName', ''), nullif(item->>'rawSha256', '')) on conflict do nothing;
    if found then inserted_count := inserted_count + 1; else duplicate_count := duplicate_count + 1; end if;
  end loop;
  return jsonb_build_object('inserted', inserted_count, 'duplicates', duplicate_count);
end; $$;
grant execute on function public.import_email_communications(jsonb) to authenticated;
