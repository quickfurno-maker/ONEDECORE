-- Phase 3 closeout: inbox Realtime publication only.
-- The 13 Utility journey definitions remain in the governed application/template
-- registry. No provider gate, role grant, RLS policy or Meta activation changes here.
begin;

do $$
declare
  v_table text;
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    raise exception 'SUPABASE_REALTIME_PUBLICATION_MISSING';
  end if;

  foreach v_table in array array[
    'whatsapp_messages',
    'whatsapp_message_status_events',
    'whatsapp_conversations'
  ] loop
    if not exists(
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end;
$$;

commit;
