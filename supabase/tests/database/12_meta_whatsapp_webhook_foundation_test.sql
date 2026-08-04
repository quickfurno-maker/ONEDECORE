-- ONEDECORE Phase 6A — Meta WhatsApp webhook foundation pgTAP tests

begin;
select plan(39);

-- Schema presence
select ok(
  to_regclass('public.whatsapp_business_accounts') is not null,
  'whatsapp_business_accounts exists'
);
select ok(
  to_regclass('public.whatsapp_phone_numbers') is not null,
  'whatsapp_phone_numbers exists'
);
select ok(
  to_regclass('public.whatsapp_conversations') is not null,
  'whatsapp_conversations exists'
);
select ok(
  to_regclass('public.whatsapp_messages') is not null,
  'whatsapp_messages exists'
);
select ok(
  to_regclass('public.whatsapp_message_status_events') is not null,
  'whatsapp_message_status_events exists'
);
select ok(
  to_regclass('public.whatsapp_webhook_events') is not null,
  'whatsapp_webhook_events exists'
);
select ok(
  to_regclass('public.whatsapp_templates') is not null,
  'whatsapp_templates exists'
);

-- RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'whatsapp_webhook_events'),
  'whatsapp_webhook_events RLS enabled'
);

-- Grants: no anon/authenticated table writes
select results_eq(
  $$select has_table_privilege('anon', 'public.whatsapp_messages', 'INSERT')$$,
  array[false],
  'anon cannot insert whatsapp_messages'
);
select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_messages', 'INSERT')$$,
  array[false],
  'authenticated cannot insert whatsapp_messages'
);

-- RPC security
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ingest_meta_whatsapp_message'$$,
  array[true],
  'ingest_meta_whatsapp_message is SECURITY DEFINER'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.ingest_meta_whatsapp_message(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,timestamptz)', 'execute')$$,
  array[false],
  'anon cannot execute message ingest RPC'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.ingest_meta_whatsapp_message(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,timestamptz)', 'execute')$$,
  array[false],
  'authenticated cannot execute message ingest RPC'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.ingest_meta_whatsapp_message(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,timestamptz)', 'execute')$$,
  array[true],
  'service_role can execute message ingest RPC'
);
select results_eq(
  $$select has_function_privilege('service_role', 'private.whatsapp_upsert_waba_phone(text,text,text)', 'execute')$$,
  array[false],
  'private whatsapp helper not publicly executable'
);

-- Baseline CRM/consent counts
create temporary table _baseline as
select
  (select count(*)::integer from public.contacts) as contacts_count,
  (select count(*)::integer from public.leads) as leads_count,
  (select count(*)::integer from public.consent_events) as consent_count;

-- Message ingest
create temporary table _msg_ingest as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:1001:wamid.TEST001',
  p_event_hash => repeat('a', 64),
  p_envelope_hash => repeat('b', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.TEST001',
  p_customer_e164 => '+919111222333',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Synthetic Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Hello ONEDECORE',
  p_content => '{"body":"Hello ONEDECORE"}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-04T10:00:00+00:00'::timestamptz
);

select results_eq($$select outcome_code from _msg_ingest$$, array['persisted'], 'message ingest persisted');
select results_eq(
  $$select count(*)::integer from public.whatsapp_business_accounts where waba_id = '9001'$$,
  array[1],
  'WABA upserted'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_phone_numbers where phone_number_id = '1001'$$,
  array[1],
  'phone number upserted'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations where customer_e164 = '+919111222333'$$,
  array[1],
  'conversation created'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where provider_message_id = 'wamid.TEST001'$$,
  array[1],
  'inbound message persisted'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_webhook_events where event_key = 'msg:1001:wamid.TEST001'$$,
  array[1],
  'webhook ledger persisted'
);

-- Idempotent duplicate
create temporary table _msg_dup as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:1001:wamid.TEST001',
  p_event_hash => repeat('a', 64),
  p_envelope_hash => repeat('b', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.TEST001',
  p_customer_e164 => '+919111222333',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Synthetic Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Hello ONEDECORE',
  p_content => '{"body":"Hello ONEDECORE"}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-04T10:00:00+00:00'::timestamptz
);

select results_eq($$select outcome_code, duplicate from _msg_dup$$, $$values ('duplicate'::text, true)$$, 'duplicate event_key returns duplicate');
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where provider_message_id = 'wamid.TEST001'$$,
  array[1],
  'no duplicate message rows'
);

-- Conflict same event_key different hash
select throws_ok(
  $$select * from public.ingest_meta_whatsapp_message(
    p_event_key => 'msg:1001:wamid.TEST001',
    p_event_hash => repeat('c', 64),
    p_envelope_hash => repeat('d', 64),
    p_waba_id => '9001',
    p_phone_number_id => '1001',
    p_display_phone_number => '+919876543210',
    p_provider_message_id => 'wamid.TEST002',
    p_customer_e164 => '+919111222333',
    p_recipient_e164 => '+919876543210',
    p_display_name_snapshot => null,
    p_provider_message_type => 'text',
    p_normalized_message_type => 'text',
    p_body_text => 'Different',
    p_content => '{}'::jsonb,
    p_context_provider_message_id => null,
    p_provider_timestamp => '2026-08-04T10:01:00+00:00'::timestamptz
  )$$,
  '23505',
  'webhook:conflict event_key replay with different hash',
  'event_key hash conflict is deterministic'
);

-- Second unique inbound message same conversation
create temporary table _msg_second as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:1001:wamid.TEST003',
  p_event_hash => repeat('e', 64),
  p_envelope_hash => repeat('f', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.TEST003',
  p_customer_e164 => '+919111222333',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => null,
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Second message',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-04T10:02:00+00:00'::timestamptz
);

select results_eq($$select outcome_code from _msg_second$$, array['persisted'], 'second inbound message persisted');
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations where customer_e164 = '+919111222333'$$,
  array[1],
  'same conversation reused'
);

-- Status without message
create temporary table _status_orphan as
select * from public.ingest_meta_whatsapp_status(
  p_event_key => 'status:1001:wamid.ORPHAN:delivered:2026-08-04T10:03:00+00:00',
  p_event_hash => repeat('1', 64),
  p_envelope_hash => repeat('2', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.ORPHAN',
  p_status => 'delivered',
  p_provider_timestamp => '2026-08-04T10:03:00+00:00'::timestamptz,
  p_details => '{"recipient_id":"919111222333"}'::jsonb
);

select results_eq($$select outcome_code from _status_orphan$$, array['persisted'], 'status without message persisted');
select results_eq(
  $$select count(*)::integer from public.whatsapp_message_status_events where provider_message_id = 'wamid.ORPHAN'$$,
  array[1],
  'orphan status event stored'
);

-- Status with message updates latest_status
create temporary table _status_linked as
select * from public.ingest_meta_whatsapp_status(
  p_event_key => 'status:1001:wamid.TEST001:read:2026-08-04T10:04:00+00:00',
  p_event_hash => repeat('3', 64),
  p_envelope_hash => repeat('4', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.TEST001',
  p_status => 'read',
  p_provider_timestamp => '2026-08-04T10:04:00+00:00'::timestamptz,
  p_details => '{}'::jsonb
);

select results_eq($$select outcome_code from _status_linked$$, array['persisted'], 'linked status persisted');
select results_eq(
  $$select latest_status from public.whatsapp_messages where provider_message_id = 'wamid.TEST001'$$,
  array['read'],
  'message latest_status updated'
);

-- Status duplicate idempotent
create temporary table _status_dup as
select * from public.ingest_meta_whatsapp_status(
  p_event_key => 'status:1001:wamid.TEST001:read:2026-08-04T10:04:00+00:00',
  p_event_hash => repeat('3', 64),
  p_envelope_hash => repeat('4', 64),
  p_waba_id => '9001',
  p_phone_number_id => '1001',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.TEST001',
  p_status => 'read',
  p_provider_timestamp => '2026-08-04T10:04:00+00:00'::timestamptz,
  p_details => '{}'::jsonb
);

select results_eq($$select outcome_code, duplicate from _status_dup$$, $$values ('duplicate'::text, true)$$, 'status duplicate idempotent');

-- Privacy: no CRM/contact/consent mutation
select results_eq(
  $$select contacts_count from _baseline$$,
  $$select count(*)::integer from public.contacts$$,
  'contacts count unchanged'
);
select results_eq(
  $$select leads_count from _baseline$$,
  $$select count(*)::integer from public.leads$$,
  'leads count unchanged'
);
select results_eq(
  $$select consent_count from _baseline$$,
  $$select count(*)::integer from public.consent_events$$,
  'consent_events count unchanged'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where purpose_code = 'MARKETING'$$,
  array[0],
  'no MARKETING consent fabricated'
);

-- Append-only enforcement
select throws_ok(
  $$update public.whatsapp_webhook_events set outcome_code = 'ignored' where event_key = 'msg:1001:wamid.TEST001'$$,
  '55000',
  'whatsapp_webhook_events is append-only',
  'webhook ledger update rejected'
);
select throws_ok(
  $$delete from public.whatsapp_message_status_events where provider_message_id = 'wamid.ORPHAN'$$,
  '55000',
  'whatsapp_message_status_events is append-only',
  'status event delete rejected'
);

-- Regression: M17 resolver remains
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'resolve_lead_intake_contact_by_phone'
  ),
  'M17 resolve_lead_intake_contact_by_phone remains'
);

-- Regression: closed-won quotation gate remains in schema
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'transition_lead_status'
  ),
  'transition_lead_status RPC remains'
);

select * from finish();
rollback;
