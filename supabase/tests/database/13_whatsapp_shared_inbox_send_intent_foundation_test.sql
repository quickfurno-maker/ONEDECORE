-- ONEDECORE Phase 6B-B1 — Shared inbox authorization & send-intent foundation pgTAP tests

begin;
select plan(39);

-- Schema presence
select ok(to_regclass('public.whatsapp_send_intents') is not null, 'whatsapp_send_intents exists');
select ok(to_regclass('public.whatsapp_send_intent_events') is not null, 'whatsapp_send_intent_events exists');

-- Permissions seeded
select results_eq(
  $$select count(*)::integer from public.permissions where code like 'whatsapp.inbox.%'$$,
  array[3],
  'three whatsapp inbox permissions exist'
);

-- RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'whatsapp_send_intents'),
  'whatsapp_send_intents RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'whatsapp_send_intent_events'),
  'whatsapp_send_intent_events RLS enabled'
);

-- RPC security
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_whatsapp_service_send_intent'$$,
  array[false],
  'create_whatsapp_service_send_intent wrapper is SECURITY INVOKER'
);
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'create_whatsapp_service_send_intent_impl'$$,
  array[true],
  'create_whatsapp_service_send_intent_impl is SECURITY DEFINER'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.create_whatsapp_service_send_intent(uuid,text,text,text,uuid)', 'execute')$$,
  array[false],
  'anon cannot execute send-intent RPC'
);

-- Synthetic staff
insert into auth.users (id, instance_id, email, aud, role) values
  ('b1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa6b@example.test', 'authenticated', 'authenticated'),
  ('b2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm6b@example.test', 'authenticated', 'authenticated'),
  ('b3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'sea6b@example.test', 'authenticated', 'authenticated'),
  ('b4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'seb6b@example.test', 'authenticated', 'authenticated'),
  ('b5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'pm6b@example.test', 'authenticated', 'authenticated'),
  ('b6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'designer6b@example.test', 'authenticated', 'authenticated'),
  ('b7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'inactive6b@example.test', 'authenticated', 'authenticated'),
  ('b8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'read6b@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'b1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  'b3333333-3333-3333-3333-333333333333',
  'b4444444-4444-4444-4444-444444444444',
  'b5555555-5555-5555-5555-555555555555',
  'b6666666-6666-6666-6666-666666666666',
  'b8888888-8888-8888-8888-888888888888'
);

update public.profiles set status = 'suspended'
where id = 'b7777777-7777-7777-7777-777777777777';

insert into public.user_roles (user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'b2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'b3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'b4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'b5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'b6666666-6666-6666-6666-666666666666', id from public.roles where code = 'designer';
insert into public.user_roles (user_id, role_id)
select 'b7777777-7777-7777-7777-777777777777', id from public.roles where code = 'sales_executive';

insert into public.roles (code, name, description, is_system) values
  ('whatsapp_read_only_test', 'WhatsApp Read Only Test', 'Synthetic read/use separation role', false);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'whatsapp_read_only_test'
  and p.code = 'whatsapp.inbox.read';

insert into public.user_roles (user_id, role_id)
select 'b8888888-8888-8888-8888-888888888888', id from public.roles where code = 'whatsapp_read_only_test';

-- Role permission matrix
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'super_admin' and p.code like 'whatsapp.inbox.%'$$,
  array[3],
  'super_admin has read/use/manage'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'sales_manager' and p.code like 'whatsapp.inbox.%'$$,
  array[3],
  'sales_manager has read/use/manage'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'sales_executive' and p.code like 'whatsapp.inbox.%'$$,
  array[2],
  'sales_executive has read/use only'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'project_manager' and p.code like 'whatsapp.inbox.%'$$,
  array[0],
  'project_manager denied inbox permissions'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'designer' and p.code like 'whatsapp.inbox.%'$$,
  array[0],
  'designer denied inbox permissions'
);

-- Lead + contact with WhatsApp consent for +919333444555
select * from public.submit_lead_intake(
  p_idempotency_key => 'c1111111-1111-1111-1111-111111111111'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'WhatsApp Lead Alpha',
  p_phone_e164 => '+919333444555',
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

select * from public.submit_lead_intake(
  p_idempotency_key => 'c2222222-2222-2222-2222-222222222222'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'WhatsApp Lead Beta',
  p_phone_e164 => '+919444555666',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-3-months',
  p_room_codes => array['kitchen']::text[],
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

select set_config('test.lead_alpha_id', (select id::text from public.leads where submitted_name = 'WhatsApp Lead Alpha' limit 1), true);
select set_config('test.lead_beta_id', (select id::text from public.leads where submitted_name = 'WhatsApp Lead Beta' limit 1), true);
select set_config('test.contact_alpha_id', (select contact_id::text from public.leads where submitted_name = 'WhatsApp Lead Alpha' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_alpha_id')::uuid, 'b3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_beta_id')::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, null);

reset role;

-- Ingest linked + unlinked conversations
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:6b:1001:wamid.LINKED001',
  p_event_hash => repeat('1', 64),
  p_envelope_hash => repeat('2', 64),
  p_waba_id => '9101',
  p_phone_number_id => '1101',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.LINKED001',
  p_customer_e164 => '+919333444555',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Linked Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Linked inbound',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-05T10:00:00+00:00'::timestamptz
);

select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:6b:1001:wamid.UNLINKED001',
  p_event_hash => repeat('3', 64),
  p_envelope_hash => repeat('4', 64),
  p_waba_id => '9101',
  p_phone_number_id => '1101',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.UNLINKED001',
  p_customer_e164 => '+919999888777',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Unlinked Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Unlinked inbound',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-05T10:01:00+00:00'::timestamptz
);

update public.whatsapp_conversations
set lead_id = current_setting('test.lead_alpha_id')::uuid,
    contact_id = current_setting('test.contact_alpha_id')::uuid
where customer_e164 = '+919333444555';

select set_config('test.linked_conversation_id', (select id::text from public.whatsapp_conversations where customer_e164 = '+919333444555' limit 1), true);
select set_config('test.unlinked_conversation_id', (select id::text from public.whatsapp_conversations where customer_e164 = '+919999888777' limit 1), true);
select set_config('test.pre_outbound_count', (select count(*)::text from public.whatsapp_messages where direction = 'outbound'), true);
select set_config('test.pre_consent_count', (select count(*)::text from public.consent_events), true);

-- Access: assigned SE allowed linked read/use
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'read')$$,
  array[true],
  'assigned SE can read linked conversation'
);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'use')$$,
  array[true],
  'assigned SE can use linked conversation'
);

-- Cross-executive denied
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'use')$$,
  array[false],
  'other SE denied linked conversation use'
);

-- Reassignment removes old SE authority
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_alpha_id')::uuid, 'b4444444-4444-4444-4444-444444444444'::uuid, 'reassign for 6b test');
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'use')$$,
  array[false],
  'reassignment removes prior SE use authority'
);
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'use')$$,
  array[true],
  'new assignee gains use authority'
);

-- Unlinked: SE denied, SM allowed
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.unlinked_conversation_id')::uuid, 'read')$$,
  array[false],
  'SE denied unlinked read'
);
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.unlinked_conversation_id')::uuid, 'manage')$$,
  array[true],
  'SM allowed unlinked manage'
);

-- PM / designer denied
select set_config('request.jwt.claim.sub', 'b5555555-5555-5555-5555-555555555555', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'read')$$,
  array[false],
  'project manager denied inbox read'
);
select set_config('request.jwt.claim.sub', 'b6666666-6666-6666-6666-666666666666', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'read')$$,
  array[false],
  'designer denied inbox read'
);

-- Inactive staff denied
select set_config('request.jwt.claim.sub', 'b7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.linked_conversation_id')::uuid, 'read')$$,
  array[false],
  'inactive staff denied inbox read'
);

-- Read without use separation
select set_config('request.jwt.claim.sub', 'b8888888-8888-8888-8888-888888888888', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.unlinked_conversation_id')::uuid, 'read')$$,
  array[false],
  'read-only role cannot read unlinked without manage'
);
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'read-only-attempt',
    'WHATSAPP_SERVICE',
    'Should fail without use permission'
  )$$,
  '42501',
  null,
  'read-only role cannot create send intent'
);

-- Successful send intent by current assignee
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);

create temporary table _intent_ok as
select i.*
from public.create_whatsapp_service_send_intent(
  current_setting('test.linked_conversation_id')::uuid,
  'intent-key-001',
  'WHATSAPP_SERVICE',
  '  Hello   from   ONEDECORE  '
) as i;

select results_eq(
  $$select purpose_code, lifecycle_status, outbound_message_id is null from _intent_ok$$,
  $$values ('WHATSAPP_SERVICE'::text, 'eligible'::text, true)$$,
  'authorized WHATSAPP_SERVICE intent created without outbound message'
);
select results_eq(
  $$select body_text from _intent_ok$$,
  array['Hello from ONEDECORE'],
  'body text normalized'
);
reset role;
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where direction = 'outbound'$$,
  array[current_setting('test.pre_outbound_count')::integer],
  'no outbound whatsapp_messages row fabricated'
);
select results_eq(
  $$select count(*)::integer from public.consent_events$$,
  array[current_setting('test.pre_consent_count')::integer],
  'no consent rows inserted by intent creation'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);

-- MARKETING denied
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'intent-key-marketing',
    'MARKETING',
    'Marketing blocked'
  )$$,
  '22023',
  null,
  'MARKETING purpose denied'
);

-- Idempotency reuse
create temporary table _intent_reuse as
select i.*
from public.create_whatsapp_service_send_intent(
  current_setting('test.linked_conversation_id')::uuid,
  'intent-key-001',
  'WHATSAPP_SERVICE',
  '  Hello   from   ONEDECORE  '
) as i;

select results_eq(
  $$select id from _intent_reuse$$,
  $$select id from _intent_ok$$,
  'same idempotency key reuses same intent'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_send_intent_events where event_type = 'idempotency_reused'$$,
  array[1],
  'idempotency reuse event recorded'
);

-- Idempotency conflict
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'intent-key-001',
    'WHATSAPP_SERVICE',
    'Different body'
  )$$,
  '23505',
  null,
  'same idempotency key with different request conflicts'
);

-- Overlong text denied
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'intent-key-long',
    'WHATSAPP_SERVICE',
    repeat('x', 4097)
  )$$,
  '22023',
  null,
  'overlong text denied'
);

-- DNC denied
reset role;
update public.contacts set status = 'do_not_contact'
where id = current_setting('test.contact_alpha_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'intent-key-dnc',
    'WHATSAPP_SERVICE',
    'DNC should block'
  )$$,
  '22023',
  null,
  'DNC contact denied'
);

reset role;
update public.contacts set status = 'active'
where id = current_setting('test.contact_alpha_id')::uuid;

-- Suppressed channel denied
update public.contact_channels
set status = 'suppressed'
where contact_id = current_setting('test.contact_alpha_id')::uuid
  and channel_type = 'whatsapp';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.linked_conversation_id')::uuid,
    'intent-key-suppressed',
    'WHATSAPP_SERVICE',
    'Suppressed channel'
  )$$,
  '22023',
  null,
  'suppressed whatsapp channel denied'
);

-- Append-only events
reset role;
select throws_ok(
  $$update public.whatsapp_send_intent_events set event_type = 'created' where true$$,
  '55000',
  null,
  'send intent events are append-only (no update)'
);
select throws_ok(
  $$delete from public.whatsapp_send_intent_events where true$$,
  '55000',
  null,
  'send intent events are append-only (no delete)'
);

-- Lifecycle cannot claim provider delivery
select results_eq(
  $$select count(*)::integer from public.whatsapp_send_intents where lifecycle_status in ('sent', 'delivered', 'read')$$,
  array[0],
  'no provider delivery lifecycle statuses exist'
);

select * from finish();
rollback;
