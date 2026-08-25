-- ONEDECORE Phase 5F-B — Controlled Public Lead Activation Hardening pgTAP tests

begin;
select plan(24);

-- M17 helper security
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'resolve_lead_intake_contact_by_phone'$$,
  array[true],
  'resolve_lead_intake_contact_by_phone is SECURITY DEFINER'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'resolve_lead_intake_contact_by_phone'
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ),
  'resolve_lead_intake_contact_by_phone has empty search_path'
);
select results_eq(
  $$select has_function_privilege('anon', 'private.resolve_lead_intake_contact_by_phone(text)', 'execute')$$,
  array[false],
  'anon cannot execute resolve_lead_intake_contact_by_phone'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'private.resolve_lead_intake_contact_by_phone(text)', 'execute')$$,
  array[false],
  'authenticated cannot execute resolve_lead_intake_contact_by_phone'
);
select results_eq(
  $$select has_function_privilege('service_role', 'private.resolve_lead_intake_contact_by_phone(text)', 'execute')$$,
  array[false],
  'service_role cannot execute private helper directly'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'contact_channels'
      and indexname = 'uq_contact_channels_active_phone_global'
  ),
  'active phone global uniqueness index exists'
);

-- Fixture: DNC contact with suppressed phone channel
insert into public.contacts (id, display_name, status)
values (
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'Synthetic DNC Contact',
  'do_not_contact'
);

insert into public.contact_channels (
  contact_id,
  channel_type,
  address_normalized,
  status,
  is_primary
) values (
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'phone',
  '+919911122233',
  'suppressed',
  true
);

create temporary table _rpc_dnc as
select * from public.submit_lead_intake(
  p_idempotency_key => '5f5f5f5f-5f5f-45f5-8f5f-5f5f5f5f5f5f'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'New Enquiry Name',
  p_phone_e164 => '+919911122233',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'immediate',
  p_room_codes => array['kitchen']::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => 'DNC re-enquiry synthetic',
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq($$select outcome from _rpc_dnc$$, array['created'], 'DNC re-enquiry accepted');
select results_eq(
  $$select count(*)::integer from public.contacts where id = 'a1111111-1111-4111-8111-111111111111'::uuid$$,
  array[1],
  'no duplicate contact for suppressed DNC phone'
);
select results_eq(
  $$select status::text from public.contacts where id = 'a1111111-1111-4111-8111-111111111111'::uuid$$,
  array['do_not_contact'],
  'DNC status preserved'
);
select results_eq(
  $$select status::text from public.contact_channels where contact_id = 'a1111111-1111-4111-8111-111111111111'::uuid and channel_type = 'phone'$$,
  array['suppressed'],
  'phone channel remains suppressed'
);
select results_eq(
  $$select contact_id from public.leads where contact_id = 'a1111111-1111-4111-8111-111111111111'::uuid$$,
  array['a1111111-1111-4111-8111-111111111111'::uuid],
  'lead associated with existing DNC contact'
);
select results_eq(
  $$select status::text, assigned_to is null from public.leads where contact_id = 'a1111111-1111-4111-8111-111111111111'::uuid$$,
  $$values ('new'::text, true)$$,
  'lead is new and unassigned'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where purpose_code = 'MARKETING'$$,
  array[0],
  'no MARKETING consent fabricated'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where contact_id = 'a1111111-1111-4111-8111-111111111111'::uuid and purpose_code = 'SERVICE_ENQUIRY'$$,
  array[1],
  'SERVICE_ENQUIRY consent recorded'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where contact_id = 'a1111111-1111-4111-8111-111111111111'::uuid and purpose_code = 'SERVICE_COMMUNICATION' and channel = 'phone'$$,
  array[1],
  'SERVICE_COMMUNICATION phone consent recorded'
);

create temporary table _rpc_active as
select * from public.submit_lead_intake(
  p_idempotency_key => '6f6f6f6f-6f6f-46f6-8f6f-6f6f6f6f6f6f'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Active Phone Person',
  p_phone_e164 => '+919922233344',
  p_submitted_email => null,
  p_service_code => 'custom-wardrobes',
  p_property_code => 'single-room',
  p_timeline_code => 'after-2-months',
  p_room_codes => '{}'::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq($$select outcome from _rpc_active$$, array['created'], 'active phone intake created');

create temporary table _rpc_active_reuse as
select * from public.submit_lead_intake(
  p_idempotency_key => '7f7f7f7f-7f7f-47f7-8f7f-7f7f7f7f7f7f'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Should Not Overwrite',
  p_phone_e164 => '+919922233344',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-1bhk',
  p_timeline_code => 'immediate',
  p_room_codes => array['kitchen']::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select count(*)::integer from public.contacts where id in (select contact_id from public.contact_channels where address_normalized = '+919922233344')$$,
  array[1],
  'active phone reuses single contact'
);
select results_eq(
  $$select count(*)::integer from public.leads where contact_id in (select contact_id from public.contact_channels where address_normalized = '+919922233344')$$,
  array[2],
  'legitimate repeat enquiry creates second lead'
);

create temporary table _rpc_dnc_replay as
select * from public.submit_lead_intake(
  p_idempotency_key => '5f5f5f5f-5f5f-45f5-8f5f-5f5f5f5f5f5f'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'New Enquiry Name',
  p_phone_e164 => '+919911122233',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'immediate',
  p_room_codes => array['kitchen']::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => 'DNC re-enquiry synthetic',
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome, duplicate from _rpc_dnc_replay$$,
  $$values ('idempotent_replay'::text, true)$$,
  'DNC intake replay is idempotent'
);

create temporary table _rpc_new_phone as
select * from public.submit_lead_intake(
  p_idempotency_key => '8f8f8f8f-8f8f-48f8-8f8f-8f8f8f8f8f8f'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Brand New Contact',
  p_phone_e164 => '+919933344455',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-3bhk',
  p_timeline_code => 'within-2-months',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq($$select outcome from _rpc_new_phone$$, array['created'], 'new phone creates lead');
select results_eq(
  $$select count(*)::integer from public.contacts c join public.contact_channels ch on ch.contact_id = c.id where ch.address_normalized = '+919933344455' and ch.status = 'active'$$,
  array[1],
  'new phone creates active contact channel'
);

insert into public.contacts (id, display_name, status) values
  ('b1111111-1111-4111-8111-111111111111'::uuid, 'Ambiguous A', 'active'),
  ('b2222222-2222-4222-8222-222222222222'::uuid, 'Ambiguous B', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
values
  ('b1111111-1111-4111-8111-111111111111'::uuid, 'phone', '+919944455566', 'suppressed', true),
  ('b2222222-2222-4222-8222-222222222222'::uuid, 'phone', '+919944455566', 'suppressed', true);

create temporary table _rpc_ambiguous as
select * from public.submit_lead_intake(
  p_idempotency_key => '9f9f9f9f-9f9f-49f9-8f9f-9f9f9f9f9f9f'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Ambiguous Submit',
  p_phone_e164 => '+919944455566',
  p_submitted_email => null,
  p_service_code => 'modular-kitchens',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'immediate',
  p_room_codes => array['kitchen']::text[],
  p_budget_comfort_code => null,
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select results_eq($$select outcome from _rpc_ambiguous$$, array['contact_identity_conflict'], 'ambiguous phone fails safely');
select results_eq(
  $$select count(*)::integer from public.leads where submitted_name = 'Ambiguous Submit'$$,
  array[0],
  'ambiguous phone creates no lead'
);

select ok(
  (
    select position('CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'transition_lead_status_impl'
  ),
  'closed_won remains blocked without quotation acceptance'
);

select * from finish();
rollback;
