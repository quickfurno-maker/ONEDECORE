-- ONEDECORE Phase 6B-B2 — Shared inbox read model pgTAP tests

begin;
select plan(11);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_conversations'
      and policyname = 'whatsapp_conversations_select_scoped'
  ),
  'conversation select policy exists'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_messages'
      and policyname = 'whatsapp_messages_select_scoped'
  ),
  'message select policy exists'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_conversations', 'SELECT')$$,
  array[true],
  'authenticated can select whatsapp_conversations'
);
select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_messages', 'SELECT')$$,
  array[true],
  'authenticated can select whatsapp_messages'
);
select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_conversations', 'INSERT')$$,
  array[false],
  'authenticated cannot insert whatsapp_conversations'
);
select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_messages', 'INSERT')$$,
  array[false],
  'authenticated cannot insert whatsapp_messages'
);

-- Synthetic staff (reuse B1 pattern ids)
insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sm-b2@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se-b2@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('c1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333');

insert into public.user_roles (user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'c3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';

-- Seed conversation via service ingest
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:b2:1001:wamid.B2READ001',
  p_event_hash => repeat('a', 64),
  p_envelope_hash => repeat('b', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.B2READ001',
  p_customer_e164 => '+919555666777',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'B2 Read Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'B2 read model hello',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-07T10:00:00+00:00'::timestamptz
);

select set_config('test.conv_id', (select id::text from public.whatsapp_conversations where customer_e164 = '+919555666777' limit 1), true);

-- SM can read conversation + messages via RLS
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations where customer_e164 = '+919555666777'$$,
  array[1],
  'sales manager can read conversation via RLS'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where body_text = 'B2 read model hello'$$,
  array[1],
  'sales manager can read messages via RLS'
);

-- SE denied unlinked conversation
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations where customer_e164 = '+919555666777'$$,
  array[0],
  'sales executive denied unlinked conversation read'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where body_text = 'B2 read model hello'$$,
  array[0],
  'sales executive denied unlinked message read'
);

-- PM denied (no inbox permissions)
reset role;
insert into auth.users (id, instance_id, email, aud, role) values
  ('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'pm-b2@example.test', 'authenticated', 'authenticated');
update public.profiles set status = 'active' where id = 'c5555555-5555-5555-5555-555555555555';
insert into public.user_roles (user_id, role_id)
select 'c5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c5555555-5555-5555-5555-555555555555', true);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations$$,
  array[0],
  'project manager denied all conversation reads'
);

select * from finish();
rollback;
