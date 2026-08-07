-- ONEDECORE Phase 6B-B4 — Provider dispatch foundation pgTAP tests

begin;
select plan(12);

select ok(
  to_regclass('public.whatsapp_provider_dispatch_attempts') is not null,
  'whatsapp_provider_dispatch_attempts exists'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.claim_whatsapp_send_intent_for_dispatch(uuid,text,text)', 'execute')$$,
  array[false],
  'authenticated cannot claim dispatch'
);

select results_eq(
  $$select has_function_privilege('service_role', 'public.claim_whatsapp_send_intent_for_dispatch(uuid,text,text)', 'execute')$$,
  array[true],
  'service_role can claim dispatch'
);

-- Synthetic staff + lead + conversation with open service window
insert into auth.users (id, instance_id, email, aud, role) values
  ('d1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'seb4@example.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'smb4@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222');

insert into public.user_roles (user_id, role_id)
select 'd1111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'd2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';

select * from public.submit_lead_intake(
  p_idempotency_key => 'd3333333-3333-3333-3333-333333333333'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Dispatch Lead',
  p_phone_e164 => '+919555666777',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-3-months',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => true,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => 'whatsapp-service-v0.1-draft',
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select set_config('test.b4_lead_id', (select id::text from public.leads where submitted_name = 'Dispatch Lead' limit 1), true);
select set_config('test.b4_contact_id', (select contact_id::text from public.leads where submitted_name = 'Dispatch Lead' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.b4_lead_id')::uuid, 'd1111111-1111-1111-1111-111111111111'::uuid, null);
reset role;

select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:b4:1102:wamid.B4INBOUND001',
  p_event_hash => repeat('1', 64),
  p_envelope_hash => repeat('2', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543211',
  p_provider_message_id => 'wamid.B4INBOUND001',
  p_customer_e164 => '+919555666777',
  p_recipient_e164 => '+919876543211',
  p_display_name_snapshot => 'Dispatch Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Inbound for dispatch',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => now() - interval '1 hour'
);

update public.whatsapp_conversations
set lead_id = current_setting('test.b4_lead_id')::uuid,
    contact_id = current_setting('test.b4_contact_id')::uuid,
    last_inbound_at = now() - interval '1 hour'
where customer_e164 = '+919555666777';

select set_config('test.b4_conversation_id', (select id::text from public.whatsapp_conversations where customer_e164 = '+919555666777' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select set_config(
  'test.b4_intent_id',
  (
    select id::text
    from public.create_whatsapp_service_send_intent(
      current_setting('test.b4_conversation_id')::uuid,
      'b4-dispatch-intent-001',
      'WHATSAPP_SERVICE',
      'Service reply body',
      null
    )
  ),
  true
);
reset role;

select results_eq(
  $$select lifecycle_status from public.whatsapp_send_intents where id = current_setting('test.b4_intent_id')::uuid$$,
  array['eligible'::text],
  'send intent starts eligible'
);

set local role service_role;

select results_eq(
  $$select outcome_code from public.claim_whatsapp_send_intent_for_dispatch(
    current_setting('test.b4_intent_id')::uuid,
    'fake',
    'fake-attempt-b4-001'
  )$$,
  array['claimed'::text],
  'service_role can claim eligible intent'
);

reset role;

select set_config(
  'test.b4_attempt_id',
  (
    select id::text
    from public.whatsapp_provider_dispatch_attempts
    where provider_attempt_key = 'fake-attempt-b4-001'
    limit 1
  ),
  true
);

select results_eq(
  $$select lifecycle_status from public.whatsapp_send_intents where id = current_setting('test.b4_intent_id')::uuid$$,
  array['dispatch_pending'::text],
  'claim moves intent to dispatch_pending'
);

set local role service_role;

select results_eq(
  $$select outcome_code from public.bind_whatsapp_send_intent_dispatch(
    current_setting('test.b4_attempt_id')::uuid,
    'wamid.B4OUTBOUND001',
    now()
  )$$,
  array['bound'::text],
  'bind creates outbound evidence binding'
);

reset role;

select results_eq(
  $$select lifecycle_status from public.whatsapp_send_intents where id = current_setting('test.b4_intent_id')::uuid$$,
  array['dispatch_bound'::text],
  'bind moves intent to dispatch_bound'
);

select ok(
  (
    select outbound_message_id is not null
    from public.whatsapp_send_intents
    where id = current_setting('test.b4_intent_id')::uuid
  ),
  'outbound_message_id populated after bind'
);

select results_eq(
  $$select provider_message_id from public.whatsapp_messages where provider_message_id = 'wamid.B4OUTBOUND001'$$,
  array['wamid.B4OUTBOUND001'::text],
  'outbound message row stores provider evidence id'
);

select results_eq(
  $$select latest_status is null from public.whatsapp_messages where provider_message_id = 'wamid.B4OUTBOUND001'$$,
  array[true],
  'latest_status remains null until webhook evidence'
);

-- Closed service window denies claim on fresh intent
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select set_config(
  'test.b4_closed_intent_id',
  (
    select id::text
    from public.create_whatsapp_service_send_intent(
      current_setting('test.b4_conversation_id')::uuid,
      'b4-dispatch-intent-closed',
      'WHATSAPP_SERVICE',
      'Closed window body',
      null
    )
  ),
  true
);
reset role;

update public.whatsapp_conversations
set last_inbound_at = now() - interval '30 hours'
where id = current_setting('test.b4_conversation_id')::uuid;

set local role service_role;

select throws_ok(
  $$select * from public.claim_whatsapp_send_intent_for_dispatch(
    current_setting('test.b4_closed_intent_id')::uuid,
    'fake',
    'fake-attempt-b4-closed'
  )$$,
  'denied_service_window_closed',
  'closed service window denies dispatch claim'
);

reset role;

select * from finish();
rollback;
