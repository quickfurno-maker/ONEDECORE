-- ONEDECORE — WhatsApp <-> CRM lead-link repair pgTAP tests

begin;
select plan(65);

-- =============================================================================
-- 0. Surface, privilege and isolation
-- =============================================================================

select has_function(
  'private', 'crm_resolve_whatsapp_lead_link', array['text'],
  'lead-link resolver exists'
);
select has_function(
  'private', 'crm_apply_whatsapp_conversation_lead_link', array['uuid'],
  'lead-link applier exists'
);

-- SECURITY DEFINER was avoidable for both new functions.
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'crm_resolve_whatsapp_lead_link'$$,
  array[false],
  'resolver is not SECURITY DEFINER'
);
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'crm_apply_whatsapp_conversation_lead_link'$$,
  array[false],
  'applier is not SECURITY DEFINER'
);

-- search_path is pinned on both.
select results_eq(
  $$select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('crm_resolve_whatsapp_lead_link', 'crm_apply_whatsapp_conversation_lead_link')
      and array_to_string(p.proconfig, ',') like '%search_path=%'$$,
  array[2],
  'both new functions pin an empty search_path'
);

select results_eq(
  $$select has_function_privilege('anon', 'private.crm_resolve_whatsapp_lead_link(text)', 'execute')$$,
  array[false],
  'anon cannot execute the resolver'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'private.crm_resolve_whatsapp_lead_link(text)', 'execute')$$,
  array[false],
  'authenticated cannot execute the resolver'
);
select results_eq(
  $$select has_function_privilege('anon', 'private.crm_apply_whatsapp_conversation_lead_link(uuid)', 'execute')$$,
  array[false],
  'anon cannot execute the applier'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'private.crm_apply_whatsapp_conversation_lead_link(uuid)', 'execute')$$,
  array[false],
  'authenticated cannot execute the applier'
);

-- No RLS or table-privilege widening on the conversation table.
select results_eq(
  $$select has_table_privilege('authenticated', 'public.whatsapp_conversations', 'UPDATE')$$,
  array[false],
  'authenticated still cannot update whatsapp_conversations'
);
select results_eq(
  $$select has_table_privilege('anon', 'public.whatsapp_conversations', 'SELECT')$$,
  array[false],
  'anon still cannot select whatsapp_conversations'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'whatsapp_conversations'),
  'whatsapp_conversations RLS still enabled'
);

-- No new table was introduced by this repair.
select ok(
  to_regclass('public.whatsapp_lead_link_conflicts') is null,
  'repair introduced no conflict table'
);

-- Single authority: inbound ingest and the outbound governed-send authority
-- both call the one writer, and nothing else in the database writes lead_id.
select results_eq(
  $$select p.prosrc like '%crm_apply_whatsapp_conversation_lead_link%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ingest_meta_whatsapp_message'$$,
  array[true],
  'inbound webhook ingest calls the single lead-link writer'
);
select results_eq(
  $$select p.prosrc like '%crm_apply_whatsapp_conversation_lead_link%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'create_whatsapp_service_send_intent_impl_v2'$$,
  array[true],
  'outbound governed-send authority calls the same single lead-link writer'
);
select results_eq(
  $$select count(*)::integer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc ~ 'update\s+public\.whatsapp_conversations[^;]*\ylead_id\y'$$,
  array[1],
  'exactly one function writes whatsapp_conversations.lead_id'
);
select results_eq(
  $$select p.proname::text = 'crm_apply_whatsapp_conversation_lead_link'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc ~ 'update\s+public\.whatsapp_conversations[^;]*\ylead_id\y'$$,
  array[true],
  'that single writer is the lead-link applier'
);

-- =============================================================================
-- 1. Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'link-manager@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'link-owner@example.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'link-other@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333'
);

insert into public.user_roles (user_id, role_id)
select 'e1111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'e2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';

-- SINGLE: exactly one contact, exactly one lead -> must link.
select * from public.submit_lead_intake(
  p_idempotency_key => 'a1111111-1111-1111-1111-111111111111'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Single Lead',
  p_phone_e164 => '+919812300001',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
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

-- DOUBLE: one contact, two leads (legal in CRM) -> must stay unlinked.
select * from public.submit_lead_intake(
  p_idempotency_key => 'a2222222-2222-2222-2222-222222222222'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Double Lead',
  p_phone_e164 => '+919812300002',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
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

select * from public.submit_lead_intake(
  p_idempotency_key => 'a3333333-3333-3333-3333-333333333333'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Double Lead',
  p_phone_e164 => '+919812300002',
  p_submitted_email => null,
  p_service_code => 'custom-wardrobes',
  p_property_code => 'apartment-3bhk',
  p_timeline_code => 'within-2-months',
  p_room_codes => array['bedrooms']::text[],
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

-- CONFLICT donor: a separate identity whose single lead is deliberately
-- mis-linked to a foreign conversation later.
select * from public.submit_lead_intake(
  p_idempotency_key => 'a4444444-4444-4444-4444-444444444444'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Conflict Lead',
  p_phone_e164 => '+919812300004',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
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

-- THREE leads on one contact.
select * from public.submit_lead_intake(
  p_idempotency_key => 'a5555555-5555-5555-5555-555555555555'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Triple Lead',
  p_phone_e164 => '+919812300005',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
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
  p_idempotency_key => 'a6666666-6666-6666-6666-666666666666'::uuid,
  p_request_hash => repeat('0', 64),
  p_network_fingerprint_hash => repeat('1', 64),
  p_phone_fingerprint_hash => repeat('2', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Triple Lead',
  p_phone_e164 => '+919812300005',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-3bhk',
  p_timeline_code => 'within-2-months',
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
select * from public.submit_lead_intake(
  p_idempotency_key => 'a7777777-7777-7777-7777-777777777777'::uuid,
  p_request_hash => repeat('3', 64),
  p_network_fingerprint_hash => repeat('4', 64),
  p_phone_fingerprint_hash => repeat('5', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Link Triple Lead',
  p_phone_e164 => '+919812300005',
  p_submitted_email => null,
  p_service_code => 'custom-wardrobes',
  p_property_code => 'villa-rowhouse',
  p_timeline_code => 'within-2-months',
  p_room_codes => array['bedrooms']::text[],
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

select set_config('test.lead_single', (select id::text from public.leads where submitted_name = 'Link Single Lead' limit 1), true);
select set_config('test.lead_conflict', (select id::text from public.leads where submitted_name = 'Link Conflict Lead' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select public.assign_lead(current_setting('test.lead_single')::uuid, 'e2222222-2222-2222-2222-222222222222'::uuid, null);
reset role;

-- Stage snapshot taken before any linking happens.
select set_config(
  'test.lead_single_status_before',
  (select status from public.leads where id = current_setting('test.lead_single')::uuid),
  true
);

-- =============================================================================
-- 2. Resolver identity matrix
-- =============================================================================

select results_eq(
  $$select resolution_code, lead_id = current_setting('test.lead_single')::uuid
    from private.crm_resolve_whatsapp_lead_link('+919812300001')$$,
  $$values ('linked'::text, true)$$,
  'exactly one canonical match resolves to that lead'
);

select results_eq(
  $$select resolution_code, lead_id from private.crm_resolve_whatsapp_lead_link('+919812309999')$$,
  $$values ('no_identity_match'::text, null::uuid)$$,
  'zero matches resolve to NULL'
);

select results_eq(
  $$select resolution_code, lead_id, candidate_lead_count
    from private.crm_resolve_whatsapp_lead_link('+919812300002')$$,
  $$values ('ambiguous_lead'::text, null::uuid, 2)$$,
  'two candidate leads resolve to NULL'
);

select results_eq(
  $$select resolution_code, lead_id, candidate_lead_count
    from private.crm_resolve_whatsapp_lead_link('+919812300005')$$,
  $$values ('ambiguous_lead'::text, null::uuid, 3)$$,
  'three candidate leads resolve to NULL'
);

-- Non-canonical identity never guesses.
select results_eq(
  $$select resolution_code, lead_id from private.crm_resolve_whatsapp_lead_link('9812300001')$$,
  $$values ('invalid_identity'::text, null::uuid)$$,
  'bare 10-digit input is not canonical and never guesses a link'
);
select results_eq(
  $$select resolution_code from private.crm_resolve_whatsapp_lead_link('919812300001')$$,
  array['invalid_identity'],
  'plus-less 91-prefixed input never guesses a link'
);
select results_eq(
  $$select resolution_code from private.crm_resolve_whatsapp_lead_link(null)$$,
  array['invalid_identity'],
  'null identity never guesses a link'
);
select results_eq(
  $$select resolution_code from private.crm_resolve_whatsapp_lead_link('+91 98123 00001')$$,
  array['invalid_identity'],
  'spaced input is not canonical and never guesses a link'
);
-- No last-10-digit / substring matching: a different country code with the same
-- trailing ten digits must not match the Indian lead.
select results_eq(
  $$select resolution_code from private.crm_resolve_whatsapp_lead_link('+449812300001')$$,
  array['no_identity_match'],
  'same trailing ten digits under another country code does not match'
);
select results_eq(
  $$select resolution_code from private.crm_resolve_whatsapp_lead_link('+9198123000010')$$,
  array['no_identity_match'],
  'superstring of a known E.164 does not match'
);

-- =============================================================================
-- 3. Inbound webhook integration
-- =============================================================================

create temporary table _in_single as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:link:1201:wamid.SINGLE',
  p_event_hash => repeat('1', 64),
  p_envelope_hash => repeat('2', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.LINK.SINGLE',
  p_customer_e164 => '+919812300001',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Single Match',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'hello',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-09-02T10:00:00+00:00'::timestamptz
);

select results_eq(
  $$select outcome_code from _in_single$$,
  array['persisted'],
  'single-match inbound message persisted'
);
select results_eq(
  $$select c.lead_id = current_setting('test.lead_single')::uuid
    from public.whatsapp_conversations c
    join _in_single i on i.conversation_id = c.id$$,
  array[true],
  'inbound ingest wrote the deterministic lead link'
);

-- Ambiguous inbound must persist the message and stay unlinked.
create temporary table _in_ambiguous as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:link:1201:wamid.AMBIG',
  p_event_hash => repeat('3', 64),
  p_envelope_hash => repeat('4', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.LINK.AMBIG',
  p_customer_e164 => '+919812300002',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Ambiguous Match',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'hello',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-09-02T10:01:00+00:00'::timestamptz
);

select results_eq(
  $$select outcome_code from _in_ambiguous$$,
  array['persisted'],
  'ambiguous inbound message is still persisted, never dropped'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where provider_message_id = 'wamid.LINK.AMBIG'$$,
  array[1],
  'ambiguous inbound message row exists'
);
select results_eq(
  $$select c.lead_id from public.whatsapp_conversations c
    join _in_ambiguous i on i.conversation_id = c.id$$,
  array[null::uuid],
  'ambiguous inbound conversation stays unlinked'
);

-- Unmatched inbound.
create temporary table _in_unmatched as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:link:1201:wamid.NONE',
  p_event_hash => repeat('5', 64),
  p_envelope_hash => repeat('6', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.LINK.NONE',
  p_customer_e164 => '+919812309999',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'No Match',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'hello',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-09-02T10:02:00+00:00'::timestamptz
);

select results_eq(
  $$select outcome_code from _in_unmatched$$,
  array['persisted'],
  'unmatched inbound message persisted'
);
select results_eq(
  $$select c.lead_id from public.whatsapp_conversations c
    join _in_unmatched i on i.conversation_id = c.id$$,
  array[null::uuid],
  'unmatched inbound conversation stays unlinked'
);

-- Duplicate webhook delivery: same conversation, same link, no new conversation.
create temporary table _in_duplicate as
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:link:1201:wamid.SINGLE',
  p_event_hash => repeat('1', 64),
  p_envelope_hash => repeat('2', 64),
  p_waba_id => '9201',
  p_phone_number_id => '1201',
  p_display_phone_number => '+919876543210',
  p_provider_message_id => 'wamid.LINK.SINGLE',
  p_customer_e164 => '+919812300001',
  p_recipient_e164 => '+919876543210',
  p_display_name_snapshot => 'Single Match',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'hello',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-09-02T10:00:00+00:00'::timestamptz
);

select results_eq(
  $$select outcome_code, duplicate from _in_duplicate$$,
  $$values ('duplicate'::text, true)$$,
  'duplicate webhook delivery is idempotent'
);
select results_eq(
  $$select (select conversation_id from _in_duplicate) = (select conversation_id from _in_single)$$,
  array[true],
  'duplicate webhook resolves to the same conversation'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations where customer_e164 = '+919812300001'$$,
  array[1],
  'no duplicate conversation was created'
);

-- =============================================================================
-- 4. Applier semantics: idempotency, existing links, conflict
-- =============================================================================

select set_config('test.conv_single', (select conversation_id::text from _in_single), true);
select set_config('test.conv_ambiguous', (select conversation_id::text from _in_ambiguous), true);
select set_config('test.conv_unmatched', (select conversation_id::text from _in_unmatched), true);

select results_eq(
  $$select private.crm_apply_whatsapp_conversation_lead_link(current_setting('test.conv_single')::uuid)$$,
  array['existing_link_confirmed'],
  'repeat apply on a correctly linked conversation is idempotent'
);
select results_eq(
  $$select c.lead_id = current_setting('test.lead_single')::uuid
    from public.whatsapp_conversations c where c.id = current_setting('test.conv_single')::uuid$$,
  array[true],
  'repeat apply left the correct link unchanged'
);

select results_eq(
  $$select private.crm_apply_whatsapp_conversation_lead_link(current_setting('test.conv_ambiguous')::uuid)$$,
  array['ambiguous_lead'],
  'repeat apply on an ambiguous conversation stays unresolved'
);
select results_eq(
  $$select private.crm_apply_whatsapp_conversation_lead_link(current_setting('test.conv_unmatched')::uuid)$$,
  array['no_identity_match'],
  'repeat apply on an unmatched conversation stays unresolved'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations
    where id in (current_setting('test.conv_ambiguous')::uuid, current_setting('test.conv_unmatched')::uuid)
      and lead_id is not null$$,
  array[0],
  'unresolved conversations never gained a link'
);

-- Existing non-null link that contradicts the canonical identity: fail closed.
update public.whatsapp_conversations
set lead_id = current_setting('test.lead_conflict')::uuid
where id = current_setting('test.conv_single')::uuid;

select results_eq(
  $$select private.crm_apply_whatsapp_conversation_lead_link(current_setting('test.conv_single')::uuid)$$,
  array['existing_link_conflict'],
  'a conflicting existing link is reported, not overwritten'
);
select results_eq(
  $$select c.lead_id = current_setting('test.lead_conflict')::uuid
    from public.whatsapp_conversations c where c.id = current_setting('test.conv_single')::uuid$$,
  array[true],
  'the conflicting existing link is left exactly as it was'
);

-- An existing link on an otherwise unresolvable identity is preserved too.
update public.whatsapp_conversations
set lead_id = current_setting('test.lead_conflict')::uuid
where id = current_setting('test.conv_unmatched')::uuid;

select results_eq(
  $$select private.crm_apply_whatsapp_conversation_lead_link(current_setting('test.conv_unmatched')::uuid)$$,
  array['existing_link_preserved'],
  'an existing link on an unmatched identity is preserved'
);

-- Restore for the remaining assertions.
update public.whatsapp_conversations
set lead_id = current_setting('test.lead_single')::uuid
where id = current_setting('test.conv_single')::uuid;
update public.whatsapp_conversations
set lead_id = null
where id = current_setting('test.conv_unmatched')::uuid;

-- =============================================================================
-- 5. Backfill semantics — same writer, NULL-only, exact-match-only
-- =============================================================================

update public.whatsapp_conversations
set lead_id = null
where id = current_setting('test.conv_single')::uuid;

do $backfill$
declare
  v_row record;
begin
  for v_row in select id from public.whatsapp_conversations where lead_id is null order by created_at loop
    perform private.crm_apply_whatsapp_conversation_lead_link(v_row.id);
  end loop;
end;
$backfill$;

select results_eq(
  $$select c.lead_id = current_setting('test.lead_single')::uuid
    from public.whatsapp_conversations c where c.id = current_setting('test.conv_single')::uuid$$,
  array[true],
  'backfill links a NULL row with an exact single match'
);
select results_eq(
  $$select c.lead_id from public.whatsapp_conversations c
    where c.id = current_setting('test.conv_ambiguous')::uuid$$,
  array[null::uuid],
  'backfill leaves ambiguous history NULL'
);
select results_eq(
  $$select c.lead_id from public.whatsapp_conversations c
    where c.id = current_setting('test.conv_unmatched')::uuid$$,
  array[null::uuid],
  'backfill leaves unmatched history NULL'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages
    where provider_message_id in ('wamid.LINK.SINGLE', 'wamid.LINK.AMBIG', 'wamid.LINK.NONE')$$,
  array[3],
  'backfill dropped no messages'
);

-- =============================================================================
-- 6. Authorization — link changes visibility only through existing policy
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_single')::uuid, 'read')$$,
  array[true],
  'assigned sales executive reads the linked conversation through existing policy'
);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_single')::uuid, 'use')$$,
  array[true],
  'assigned sales executive may use the linked conversation'
);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_ambiguous')::uuid, 'read')$$,
  array[false],
  'unresolved conversation leaks nothing to a sales executive'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations
    where id = current_setting('test.conv_ambiguous')::uuid$$,
  array[0],
  'RLS hides the unresolved conversation row from a sales executive'
);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_single')::uuid, 'read')$$,
  array[false],
  'unrelated sales executive gains no access from the link'
);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_single')::uuid, 'use')$$,
  array[false],
  'unrelated sales executive cannot use the linked conversation'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations
    where id = current_setting('test.conv_single')::uuid$$,
  array[0],
  'RLS hides the linked conversation from an unrelated sales executive'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_single')::uuid, 'read')$$,
  array[true],
  'sales manager access is unchanged on a linked conversation'
);
select results_eq(
  $$select public.whatsapp_inbox_check_conversation_access(current_setting('test.conv_ambiguous')::uuid, 'read')$$,
  array[true],
  'sales manager access is unchanged on an unresolved conversation'
);
reset role;

-- =============================================================================
-- 7. Governance — link implies no consent, no stage change, no provider send
-- =============================================================================

select results_eq(
  $$select count(*)::integer from public.consent_events ce
    join public.leads l on l.id = ce.lead_id
    where l.id = current_setting('test.lead_single')::uuid
      and ce.purpose_code = 'MARKETING'$$,
  array[0],
  'linking fabricated no MARKETING consent'
);
select results_eq(
  $$select count(*)::integer from public.consent_events ce
    where ce.contact_id = (select contact_id from public.leads where id = current_setting('test.lead_single')::uuid)
      and ce.actor_type <> 'data-principal'$$,
  array[0],
  'linking recorded no synthetic consent actor'
);
select results_eq(
  $$select status = current_setting('test.lead_single_status_before')
    from public.leads where id = current_setting('test.lead_single')::uuid$$,
  array[true],
  'linking caused no lead stage transition'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_messages where direction = 'outbound'$$,
  array[0],
  'linking fabricated no outbound provider message'
);
select results_eq(
  $$select count(*)::integer from public.whatsapp_send_intents$$,
  array[0],
  'linking created no send intent'
);

-- =============================================================================
-- 8. Downstream reachability — governed first-contact evidence gate
-- =============================================================================

-- The CRM evidence validator requires conversation.lead_id to equal the lead.
-- Before this repair no writer ever set it, so the gate was unreachable. It is
-- now reachable, while every other evidence precondition still applies.
select throws_ok(
  $$select private.validate_crm_whatsapp_send_evidence(
      '00000000-0000-0000-0000-000000000000'::uuid,
      current_setting('test.lead_single')::uuid,
      null
    )$$,
  'P0001',
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'governed first-contact evidence still requires a real dispatched intent'
);

select results_eq(
  $$select count(*)::integer from public.whatsapp_conversations c
    where c.lead_id = current_setting('test.lead_single')::uuid$$,
  array[1],
  'the lead now has exactly one governed WhatsApp conversation to draw evidence from'
);

select * from finish();
rollback;
