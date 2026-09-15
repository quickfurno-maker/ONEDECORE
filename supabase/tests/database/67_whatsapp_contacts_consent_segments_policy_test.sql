-- ONEDECORE WM-3 — contacts, MARKETING consent/preferences, restrictive opt-out,
-- allowlisted segments and versioned send policy, plus the WM-2/3/4 runtime
-- hardening, proved against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. The WM-0 matrix for WM-3 codes is granted exactly; legacy roles and
--    Project Manager hold nothing; Sales Executive holds only opt_out.record.
-- 2. Service consent never implies MARKETING consent.
-- 3. Opt-out is restrictive only: staff (in scope) and inbound STOP / Meta's
--    "Stop promotions" button withdraw; nothing here can grant. Inbound
--    classification is NFKC, whole-message, bounded and idempotent.
-- 4. Segments accept allowlisted fields/operators only; send policy is Super
--    Admin only, validated, versioned and append-only.
-- 5. No existence oracle: an out-of-scope executive gets the same refusal for
--    a real contact and a missing one.

begin;
select plan(41);

-- =============================================================================
-- Fixtures — a67 / b67 / c67 / d67 / e67 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6700001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '67-sa@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '67-sm@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '67-se@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '67-se-b@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', '67-mgmt@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', '67-sales@example.test', 'authenticated', 'authenticated'),
  ('a6700001-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', '67-pm@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active' where id::text like 'a6700001-%';

insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id
from (values
  ('a6700001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6700001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6700001-0000-4000-8000-000000000003', 'sales_executive'),
  ('a6700001-0000-4000-8000-000000000004', 'sales_executive'),
  ('a6700001-0000-4000-8000-000000000005', 'management'),
  ('a6700001-0000-4000-8000-000000000006', 'sales'),
  ('a6700001-0000-4000-8000-000000000007', 'project_manager')
) as v(user_id, role_code)
join public.roles r on r.code = v.role_code;

insert into public.contacts (id, display_name, status) values
  ('c6700000-0000-4000-8000-000000000001', 'Service Only 67', 'active'),
  ('c6700000-0000-4000-8000-000000000002', 'Marketing Yes 67', 'active'),
  ('c6700000-0000-4000-8000-000000000003', 'Percent_Name 67', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('c6700000-0000-4000-8000-000000000001', 'whatsapp', '+919767000001', true, 'active'),
  ('c6700000-0000-4000-8000-000000000002', 'whatsapp', '+919767000002', true, 'active'),
  ('c6700000-0000-4000-8000-000000000003', 'whatsapp', '+919767000003', true, 'active');

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source, primary_source_id, entry_method,
  service_code, property_code, timeline_code, planner_version, landing_path, locality, assigned_to
)
select v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, 'WM3 Lead', 'assigned', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake',
  'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner', 'whitefield',
  'a6700001-0000-4000-8000-000000000003'::uuid
from (values
  ('b6700000-0000-4000-8000-000000000001', 'c6700000-0000-4000-8000-000000000001'),
  ('b6700000-0000-4000-8000-000000000002', 'c6700000-0000-4000-8000-000000000002'),
  ('b6700000-0000-4000-8000-000000000003', 'c6700000-0000-4000-8000-000000000003')
) as v(lead_id, contact_id);

-- Service consent only for c1; MARKETING granted for c2.
insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at) values
  ('c6700000-0000-4000-8000-000000000001', 'SERVICE_COMMUNICATION', 'whatsapp', 'granted', 'service-v1', 'notice-v1', 'local-test', 'staff', now() - interval '5 days'),
  ('c6700000-0000-4000-8000-000000000002', 'MARKETING', 'whatsapp', 'granted', 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - interval '5 days'),
  ('c6700000-0000-4000-8000-000000000003', 'MARKETING', 'whatsapp', 'granted', 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - interval '5 days');

insert into public.whatsapp_business_accounts (id, waba_id, status) values ('d6700000-0000-4000-8000-000000000001', '900000000000671', 'active');
insert into public.whatsapp_phone_numbers (id, business_account_id, phone_number_id, display_phone_number, status)
values ('d6700000-0000-4000-8000-000000000002', 'd6700000-0000-4000-8000-000000000001', '900000000000672', '+919767000099', 'active');

insert into public.whatsapp_conversations (id, phone_number_id, customer_e164, contact_id, lead_id, last_message_at, last_inbound_at) values
  ('e6700000-0000-4000-8000-000000000001', 'd6700000-0000-4000-8000-000000000002', '+919767000001', 'c6700000-0000-4000-8000-000000000001', 'b6700000-0000-4000-8000-000000000001', now(), now()),
  ('e6700000-0000-4000-8000-000000000002', 'd6700000-0000-4000-8000-000000000002', '+919767000002', 'c6700000-0000-4000-8000-000000000002', 'b6700000-0000-4000-8000-000000000002', now(), now()),
  ('e6700000-0000-4000-8000-000000000003', 'd6700000-0000-4000-8000-000000000002', '+919767000003', 'c6700000-0000-4000-8000-000000000003', 'b6700000-0000-4000-8000-000000000003', now(), now());

insert into public.whatsapp_messages (id, conversation_id, provider_message_id, direction, provider_message_type, normalized_message_type, sender_e164, recipient_e164, body_text, content, provider_timestamp, latest_status) values
  ('e6700000-0000-4000-8000-000000000011', 'e6700000-0000-4000-8000-000000000002', 'wamid.67STOP', 'inbound', 'text', 'text', '+919767000002', '+919767000099', ' ＳＴＯＰ! ', '{"body":" ＳＴＯＰ! "}'::jsonb, now() - interval '1 minute', 'received'),
  ('e6700000-0000-4000-8000-000000000012', 'e6700000-0000-4000-8000-000000000003', 'wamid.67LONG', 'inbound', 'text', 'text', '+919767000003', '+919767000099', 'please stop sending me the old quotation pdf', '{}'::jsonb, now() - interval '2 minutes', 'received'),
  ('e6700000-0000-4000-8000-000000000013', 'e6700000-0000-4000-8000-000000000003', 'wamid.67BTN', 'inbound', 'button', 'button', '+919767000003', '+919767000099', null, '{"text":"Stop promotions","payload":"STOP"}'::jsonb, now() - interval '1 minute', 'received');

-- =============================================================================
-- 1. Matrix and catalogue
-- =============================================================================

select results_eq(
  $$select r.code || ':' || p.code from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
     where p.code in ('whatsapp.contacts.read','whatsapp.opt_out.record','whatsapp.segments.read','whatsapp.segments.manage','whatsapp.settings.read','whatsapp.settings.manage') order by 1$$,
  array[
    'sales_executive:whatsapp.opt_out.record',
    'sales_manager:whatsapp.contacts.read', 'sales_manager:whatsapp.opt_out.record', 'sales_manager:whatsapp.segments.manage',
    'sales_manager:whatsapp.segments.read', 'sales_manager:whatsapp.settings.read',
    'super_admin:whatsapp.contacts.read', 'super_admin:whatsapp.opt_out.record', 'super_admin:whatsapp.segments.manage',
    'super_admin:whatsapp.segments.read', 'super_admin:whatsapp.settings.manage', 'super_admin:whatsapp.settings.read'
  ],
  'MATRIX: WM-3 codes granted exactly; settings.manage Super Admin only; no legacy or PM grant'
);

select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c where c.oid in (
    'public.whatsapp_marketing_preference_events'::regclass, 'public.whatsapp_marketing_send_policies'::regclass, 'public.whatsapp_segments'::regclass)),
  'CATALOGUE: WM-3 tables have RLS enabled and forced'
);

select ok(
  not exists (select 1 from unnest(array['public.whatsapp_marketing_preference_events','public.whatsapp_marketing_send_policies','public.whatsapp_segments']) t(name)
    where has_table_privilege('authenticated', t.name, 'INSERT') or has_table_privilege('authenticated', t.name, 'UPDATE')
       or has_table_privilege('authenticated', t.name, 'DELETE') or has_table_privilege('anon', t.name, 'SELECT')),
  'CATALOGUE: no direct staff DML and no anon read on WM-3 tables'
);

-- =============================================================================
-- 2. Contacts workspace
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000003', true);
select throws_ok($$select public.list_whatsapp_contacts(null, 1, 25)$$, '42501', 'WHATSAPP_CONTACTS_DENIED', 'CONTACTS: a Sales Executive has no global contact list');
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000005', true);
select throws_ok($$select public.list_whatsapp_contacts(null, 1, 25)$$, '42501', 'WHATSAPP_CONTACTS_DENIED', 'CONTACTS: legacy management has no global contact list');
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000007', true);
select throws_ok($$select public.list_whatsapp_contacts(null, 1, 25)$$, '42501', 'WHATSAPP_CONTACTS_DENIED', 'CONTACTS: a Project Manager has no global contact list');

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000002', true);
select is((public.list_whatsapp_contacts('67', 1, 25) ->> 'total_count')::integer, 3, 'CONTACTS: a Sales Manager searches the workspace');
select is(
  (select jsonb_agg(i ->> 'marketing_consent' order by i ->> 'display_name') from jsonb_array_elements(public.list_whatsapp_contacts('67', 1, 25) -> 'items') i),
  '["granted", "granted", null]'::jsonb,
  'CONSENT: service consent is shown as NO marketing consent'
);
select is((public.list_whatsapp_contacts('%', 1, 25) ->> 'total_count')::integer, 0, 'HARDENING: a percent sign is a literal, not a wildcard, in the count');
select is(jsonb_array_length(public.list_whatsapp_contacts('_ervice', 1, 25) -> 'items'), 0, 'HARDENING: an underscore is a literal, not a wildcard, in the page');
select is((public.list_whatsapp_contacts('Percent_Name', 1, 25) ->> 'total_count')::integer, 1, 'HARDENING: an escaped literal still matches');

-- =============================================================================
-- 3. Segments
-- =============================================================================

select throws_ok(
  $$select public.save_whatsapp_segment(null, 'Bad field', null, '{"rules":[{"field":"phone","op":"equals","value":"x"}]}'::jsonb, true)$$,
  '22023', 'WHATSAPP_SEGMENT_VALIDATION', 'SEGMENTS: a non-allowlisted field is refused (no SQL from the UI)'
);
select throws_ok(
  $$select public.save_whatsapp_segment(null, 'Bad op', null, '{"rules":[{"field":"locality","op":"like","value":"%"}]}'::jsonb, true)$$,
  '22023', 'WHATSAPP_SEGMENT_VALIDATION', 'SEGMENTS: a non-allowlisted operator is refused'
);
select lives_ok(
  $$select set_config('test.seg', public.save_whatsapp_segment(null, 'Whitefield 67', null, '{"rules":[{"field":"locality","op":"equals","value":"whitefield"}]}'::jsonb, true) ->> 'segment_id', true)$$,
  'SEGMENTS: a Sales Manager saves an allowlisted segment'
);
select ok((public.preview_whatsapp_segment(current_setting('test.seg')::uuid) ->> 'no_marketing_consent')::integer >= 1, 'SEGMENTS: preview counts service-only contacts as lacking marketing consent');

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.save_whatsapp_segment(null, 'Exec segment', null, '{"rules":[{"field":"locality","op":"equals","value":"x"}]}'::jsonb, true)$$,
  '42501', 'WHATSAPP_SEGMENTS_DENIED', 'SEGMENTS: a Sales Executive cannot manage segments'
);
select throws_ok($$select public.preview_whatsapp_segment(current_setting('test.seg')::uuid)$$, '42501', 'WHATSAPP_SEGMENTS_DENIED', 'SEGMENTS: a Sales Executive cannot preview segments');

-- =============================================================================
-- 4. Send policy
-- =============================================================================

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.set_whatsapp_marketing_send_policy('[{"windowHours":24,"maxMessages":1}]'::jsonb, '{"startLocal":"21:00","endLocal":"09:00"}'::jsonb, 'Asia/Kolkata', true)$$,
  '42501', 'WHATSAPP_SETTINGS_DENIED', 'POLICY: a Sales Manager reads but cannot change the send policy'
);
select is(public.get_whatsapp_marketing_send_policy(), null::jsonb, 'POLICY: unconfigured reads as null (fail closed)');

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_whatsapp_marketing_send_policy('[{"windowHours":0,"maxMessages":1}]'::jsonb, '{"startLocal":"21:00","endLocal":"09:00"}'::jsonb)$$,
  '22023', 'WHATSAPP_POLICY_VALIDATION', 'POLICY: a zero-hour window is refused'
);
select throws_ok(
  $$select public.set_whatsapp_marketing_send_policy('[{"windowHours":24,"maxMessages":1}]'::jsonb, '{"startLocal":"21:00","endLocal":"21:00"}'::jsonb)$$,
  '22023', 'WHATSAPP_POLICY_VALIDATION', 'POLICY: an empty quiet window is refused'
);
select is(
  (public.set_whatsapp_marketing_send_policy('[{"windowHours":24,"maxMessages":1}]'::jsonb, '{"startLocal":"21:00","endLocal":"09:00"}'::jsonb) ->> 'version')::integer,
  1, 'POLICY: a Super Admin publishes version 1'
);
select is((select execution_enabled from public.whatsapp_marketing_send_policies where version = 1), false, 'POLICY: execution defaults off');
reset role;
select throws_ok($$update public.whatsapp_marketing_send_policies set execution_enabled = true$$, NULL, 'WHATSAPP_APPEND_ONLY', 'POLICY: versions are append-only even to the owner');

-- =============================================================================
-- 5. Restrictive opt-out
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', null, 'staff')$$,
  '42501', 'WHATSAPP_OPT_OUT_DENIED', 'OPT-OUT: an unassigned executive is refused for a real contact'
);
select throws_ok(
  $$select public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-00000000ffff', 'e6700000-0000-4000-8000-00000000ffff', null, 'staff')$$,
  '42501', 'WHATSAPP_OPT_OUT_DENIED', 'NO ORACLE: the same refusal for a contact that does not exist'
);
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000006', true);
select throws_ok(
  $$select public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', null, 'staff')$$,
  '42501', 'WHATSAPP_OPT_OUT_DENIED', 'OPT-OUT: legacy sales holds no opt-out authority'
);
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000011', 'staff')$$,
  '42501', 'WHATSAPP_OPT_OUT_DENIED', 'HARDENING: a message from another conversation cannot be cited as evidence'
);
select is(
  public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', null, 'staff') ->> 'outcome',
  'withdrawn', 'OPT-OUT: the assigned executive records a customer opt-out in scope'
);
select is(
  public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-000000000001', 'e6700000-0000-4000-8000-000000000001', null, 'staff') ->> 'outcome',
  'already_withdrawn', 'OPT-OUT: repeating it is a no-op'
);
select throws_ok(
  $$select public.record_whatsapp_marketing_preference('c6700000-0000-4000-8000-000000000002', 'offers', 'allowed', 'staff')$$,
  '42501', 'WHATSAPP_PREFERENCE_DENIED', 'PREFERENCE: an executive cannot change marketing preferences'
);
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.record_whatsapp_marketing_preference('c6700000-0000-4000-8000-000000000002', 'offers', 'allowed', 'staff')$$,
  '42501', 'WHATSAPP_PREFERENCE_DENIED', 'PREFERENCE: a Sales Manager (no marketing_consents.manage since the control-plane hardening) cannot change preferences'
);
select throws_ok(
  $$select public.record_whatsapp_customer_opt_out('c6700000-0000-4000-8000-00000000ffff', null, null, 'staff')$$,
  'P0002', 'WHATSAPP_CONTACT_NOT_FOUND', 'HARDENING: a manager gets not-found, not a foreign-key error, for a missing contact'
);
select set_config('request.jwt.claim.sub', 'a6700001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.record_whatsapp_marketing_preference('c6700000-0000-4000-8000-000000000002', 'offers', 'opted_out', 'staff')$$,
  'PREFERENCE: a Super Admin records a category opt-out'
);

select throws_ok($$select public.record_whatsapp_inbound_opt_out('e6700000-0000-4000-8000-000000000011')$$, '42501', NULL, 'INBOUND: staff sessions cannot even execute the webhook opt-out RPC');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(public.record_whatsapp_inbound_opt_out('e6700000-0000-4000-8000-000000000011') ->> 'outcome', 'withdrawn', 'INBOUND: a full-width "ＳＴＯＰ!" normalises (NFKC) to an opt-out');
select is(public.record_whatsapp_inbound_opt_out('e6700000-0000-4000-8000-000000000011') ->> 'outcome', 'already_recorded', 'INBOUND: a replayed webhook records nothing twice');
select is(public.record_whatsapp_inbound_opt_out('e6700000-0000-4000-8000-000000000012') ->> 'outcome', 'not_opt_out', 'INBOUND: a longer sentence containing "stop" is left to a human');
select is(public.record_whatsapp_inbound_opt_out('e6700000-0000-4000-8000-000000000013') ->> 'outcome', 'withdrawn', 'INBOUND: Meta''s "Stop promotions" quick reply is an opt-out');
reset role;

select is(
  (select count(*)::integer from public.consent_events where contact_id::text like 'c6700000-%' and event_type = 'granted' and purpose_code = 'MARKETING'),
  2, 'RESTRICTIVE: no path in this suite created a MARKETING grant'
);
select is(
  (select string_agg(distinct purpose_code, ',') from public.consent_events where contact_id::text like 'c6700000-%' and event_type = 'withdrawn'),
  'MARKETING', 'RESTRICTIVE: withdrawals touch MARKETING only; service consent is untouched'
);

select * from finish();
rollback;
