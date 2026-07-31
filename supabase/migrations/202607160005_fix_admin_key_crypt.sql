begin;

alter function public.update_warehouse_bl_dispatch(
  uuid, text, boolean, numeric, numeric, text, text, text, text,
  text, text, text, text, numeric, numeric, text, text, jsonb
) set search_path = public, extensions, pg_temp;

notify pgrst, 'reload schema';

commit;
