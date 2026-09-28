begin;
select plan(5);
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='whatsapp_messages'),'messages are published to Supabase Realtime');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='whatsapp_message_status_events'),'status events are published to Supabase Realtime');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='whatsapp_conversations'),'conversations are published to Supabase Realtime');
select ok(to_regclass('public.whatsapp_messages') is not null and to_regclass('public.whatsapp_conversations') is not null,'Realtime reuses canonical inbox tables');
select ok(not exists(select 1 from pg_namespace where nspname='onedecore_realtime'),'migration creates no competing realtime schema');
select * from finish();
rollback;
