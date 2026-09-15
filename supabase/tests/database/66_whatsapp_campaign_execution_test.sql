-- ONEDECORE WM-4 — governed WhatsApp marketing campaign execution, proved
-- against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. The WM-0 permission matrix for campaigns is granted exactly; Sales
--    Executive and legacy roles hold no bulk authority.
-- 2. A WhatsApp spec is edited only while its generic version is draft, is
--    frozen by generic approval submission, and is immutable afterwards.
-- 3. Generic approval stays the only approval truth: self-approval is denied,
--    and a Sales Manager never operates a version they approved.
-- 4. The worker path is service_role only: materialise, auto-start, claim,
--    request-start evidence, bind success into canonical history, bounded
--    transient retry, TTL sweep to needs_reconcile, audited human resolution.
-- 5. JIT eligibility: DNC, consent, preference, suppression, frequency caps,
--    and quiet hours that DEFER rather than skip.
-- 6. Test sends reach registered internal staff only.

begin;
select plan(94);

-- =============================================================================
-- Fixtures — a66 / b66 / c66 / d66 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6600001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '66-sa@example.test', 'authenticated', 'authenticated'),
  ('a6600001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '66-sm-a@example.test', 'authenticated', 'authenticated'),
  ('a6600001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '66-sm-b@example.test', 'authenticated', 'authenticated'),
  ('a6600001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '66-se@example.test', 'authenticated', 'authenticated'),
  ('a6600001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', '66-mgmt@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active' where id::text like 'a6600001-%';
update public.profiles set phone_e164 = '+919766000091', display_name = 'Admin Tester' where id = 'a6600001-0000-4000-8000-000000000001';
update public.profiles set phone_e164 = '+919766000094', display_name = 'Exec Tester' where id = 'a6600001-0000-4000-8000-000000000004';

insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id
from (values
  ('a6600001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6600001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6600001-0000-4000-8000-000000000003', 'sales_manager'),
  ('a6600001-0000-4000-8000-000000000004', 'sales_executive'),
  ('a6600001-0000-4000-8000-000000000005', 'management')
) as v(user_id, role_code)
join public.roles r on r.code = v.role_code;

-- c1 eligible · c2 DNC · c3 no consent · c4 withdrawn · c5 opted out of offers
-- c6 suppressed channel · c7 no WhatsApp channel · c8 eligible (contacted)
insert into public.contacts (id, display_name, status) values
  ('c6600000-0000-4000-8000-000000000001', 'Asha Rao', 'active'),
  ('c6600000-0000-4000-8000-000000000002', 'Dnc Person', 'do_not_contact'),
  ('c6600000-0000-4000-8000-000000000003', 'No Consent', 'active'),
  ('c6600000-0000-4000-8000-000000000004', 'Withdrawn Person', 'active'),
  ('c6600000-0000-4000-8000-000000000005', 'Opted Out', 'active'),
  ('c6600000-0000-4000-8000-000000000006', 'Suppressed Person', 'active'),
  ('c6600000-0000-4000-8000-000000000007', 'No Whatsapp', 'active'),
  ('c6600000-0000-4000-8000-000000000008', 'Ravi Kumar', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('c6600000-0000-4000-8000-000000000001', 'whatsapp', '+919766000001', true, 'active'),
  ('c6600000-0000-4000-8000-000000000001', 'phone', '+919766000001', true, 'active'),
  ('c6600000-0000-4000-8000-000000000002', 'whatsapp', '+919766000002', true, 'active'),
  ('c6600000-0000-4000-8000-000000000003', 'whatsapp', '+919766000003', true, 'active'),
  ('c6600000-0000-4000-8000-000000000004', 'whatsapp', '+919766000004', true, 'active'),
  ('c6600000-0000-4000-8000-000000000005', 'whatsapp', '+919766000005', true, 'active'),
  ('c6600000-0000-4000-8000-000000000006', 'whatsapp', '+919766000006', true, 'suppressed'),
  ('c6600000-0000-4000-8000-000000000008', 'whatsapp', '+919766000008', true, 'active');

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path, locality
)
select
  v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, 'WM4 Lead', v.status, 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake',
  'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner', 'whitefield'
from (values
  ('b6600000-0000-4000-8000-000000000001', 'c6600000-0000-4000-8000-000000000001', 'qualified'),
  ('b6600000-0000-4000-8000-000000000002', 'c6600000-0000-4000-8000-000000000002', 'qualified'),
  ('b6600000-0000-4000-8000-000000000003', 'c6600000-0000-4000-8000-000000000003', 'qualified'),
  ('b6600000-0000-4000-8000-000000000004', 'c6600000-0000-4000-8000-000000000004', 'qualified'),
  ('b6600000-0000-4000-8000-000000000005', 'c6600000-0000-4000-8000-000000000005', 'qualified'),
  ('b6600000-0000-4000-8000-000000000006', 'c6600000-0000-4000-8000-000000000006', 'qualified'),
  ('b6600000-0000-4000-8000-000000000007', 'c6600000-0000-4000-8000-000000000007', 'qualified'),
  ('b6600000-0000-4000-8000-000000000008', 'c6600000-0000-4000-8000-000000000008', 'contacted')
) as v(lead_id, contact_id, status);

insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at)
select v.contact_id::uuid, 'MARKETING', 'whatsapp', v.event_type, 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - v.age
from (values
  ('c6600000-0000-4000-8000-000000000001', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000002', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000004', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000004', 'withdrawn', interval '2 days'),
  ('c6600000-0000-4000-8000-000000000005', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000006', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000007', 'granted', interval '10 days'),
  ('c6600000-0000-4000-8000-000000000008', 'granted', interval '10 days')
) as v(contact_id, event_type, age);

insert into public.whatsapp_marketing_preference_events (contact_id, category, event_type, source)
values ('c6600000-0000-4000-8000-000000000005', 'offers', 'opted_out', 'local-test');

insert into public.whatsapp_business_accounts (id, waba_id, status) values
  ('d6600000-0000-4000-8000-000000000001', '900000000000661', 'active');
insert into public.whatsapp_phone_numbers (id, business_account_id, phone_number_id, display_phone_number, status) values
  ('d6600000-0000-4000-8000-000000000002', 'd6600000-0000-4000-8000-000000000001', '900000000000662', '+91 97660 00099', 'active');

insert into public.whatsapp_templates (id, business_account_id, provider_template_id, name, language, category, status, parameter_format, components) values
  ('d6600000-0000-4000-8000-000000000011', 'd6600000-0000-4000-8000-000000000001', '166000000000001', 'festive_offer', 'en', 'MARKETING', 'APPROVED', 'POSITIONAL',
   '[{"type":"BODY","text":"Hi {{1}}, festive offers on {{2}} are live."},{"type":"FOOTER","text":"Reply STOP to opt out"}]'::jsonb),
  ('d6600000-0000-4000-8000-000000000012', 'd6600000-0000-4000-8000-000000000001', '166000000000002', 'visit_update', 'en', 'UTILITY', 'APPROVED', 'POSITIONAL',
   '[{"type":"BODY","text":"Your visit is confirmed for {{1}}."}]'::jsonb);
insert into public.whatsapp_template_snapshots (id, template_id, business_account_id, provider_template_id, name, language, category, parameter_format, components, content_hash, observed_status)
select v.id::uuid, t.id, t.business_account_id, t.provider_template_id, t.name, t.language, t.category, t.parameter_format, t.components, t.content_hash, 'APPROVED'
from (values
  ('d6600000-0000-4000-8000-000000000021', 'd6600000-0000-4000-8000-000000000011'),
  ('d6600000-0000-4000-8000-000000000022', 'd6600000-0000-4000-8000-000000000012')
) v(id, template_id)
join public.whatsapp_templates t on t.id = v.template_id::uuid;

insert into public.whatsapp_segments (id, name, rule_group, created_by, updated_by) values
  ('d6600000-0000-4000-8000-000000000031', 'WM4 qualified only', '{"rules":[{"field":"lead_stage","op":"equals","value":"qualified"}]}'::jsonb,
   'a6600001-0000-4000-8000-000000000002', 'a6600001-0000-4000-8000-000000000002');

-- v1 closed gate, then v2 open with a quiet window that excludes now.
insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by) values
  (1, false, '[{"windowHours":24,"maxMessages":1}]'::jsonb, '{"startLocal":"21:00","endLocal":"09:00"}'::jsonb, 'Asia/Kolkata', now() - interval '2 days', 'a6600001-0000-4000-8000-000000000001');

-- =============================================================================
-- 1. Permission matrix and catalogue
-- =============================================================================

select results_eq(
  $$select r.code || ':' || p.code from public.role_permissions rp
      join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
     where p.code like 'whatsapp.campaigns.%' order by 1$$,
  array[
    'sales_manager:whatsapp.campaigns.execute',
    'sales_manager:whatsapp.campaigns.test_send',
    'super_admin:whatsapp.campaigns.cancel',
    'super_admin:whatsapp.campaigns.execute',
    'super_admin:whatsapp.campaigns.test_send'
  ],
  'MATRIX: campaign codes granted exactly; cancel is Super Admin only; no executive or legacy grant'
);

select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c where c.oid in (
    'public.whatsapp_campaign_specs'::regclass, 'public.whatsapp_campaign_runs'::regclass,
    'public.whatsapp_campaign_recipients'::regclass, 'public.whatsapp_campaign_dispatch_jobs'::regclass,
    'public.whatsapp_campaign_dispatch_events'::regclass, 'public.whatsapp_message_campaign_attributions'::regclass,
    'public.whatsapp_campaign_test_sends'::regclass)),
  'CATALOGUE: every WM-4 table has RLS enabled and forced'
);

select ok(
  not exists (
    select 1 from unnest(array['public.whatsapp_campaign_specs','public.whatsapp_campaign_runs','public.whatsapp_campaign_recipients',
      'public.whatsapp_campaign_dispatch_jobs','public.whatsapp_campaign_dispatch_events','public.whatsapp_message_campaign_attributions',
      'public.whatsapp_campaign_test_sends']) t(name)
    where has_table_privilege('authenticated', t.name, 'INSERT') or has_table_privilege('authenticated', t.name, 'UPDATE')
       or has_table_privilege('authenticated', t.name, 'DELETE') or has_table_privilege('anon', t.name, 'SELECT')
       or has_table_privilege('service_role', t.name, 'INSERT') or has_table_privilege('service_role', t.name, 'UPDATE')
       or has_table_privilege('service_role', t.name, 'DELETE')),
  'CATALOGUE: no direct DML for staff or worker; every write is an RPC'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'materialize_due_whatsapp_campaign_runs', 'claim_whatsapp_campaign_dispatch_jobs', 'mark_whatsapp_campaign_provider_request_started',
      'complete_whatsapp_campaign_dispatch_success', 'complete_whatsapp_campaign_dispatch_failure', 'resolve_whatsapp_campaign_dispatch_reconcile',
      'claim_whatsapp_campaign_test_sends', 'mark_whatsapp_campaign_test_send_started', 'complete_whatsapp_campaign_test_send')
      and p.prosecdef and 'search_path=""' = any(p.proconfig)
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')),
  9, 'CATALOGUE: the nine worker RPCs are definer, search_path empty, service_role only'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'save_whatsapp_campaign_spec', 'list_whatsapp_campaign_template_options', 'preview_whatsapp_campaign_audience',
      'create_whatsapp_campaign_run', 'start_whatsapp_campaign_run', 'pause_whatsapp_campaign_run', 'resume_whatsapp_campaign_run',
      'cancel_whatsapp_campaign_run', 'get_whatsapp_campaign_run_breakdown', 'resolve_whatsapp_campaign_reconcile',
      'list_whatsapp_campaign_test_destinations', 'create_whatsapp_campaign_test_send')
      and p.prosecdef and 'search_path=""' = any(p.proconfig)
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')),
  12, 'CATALOGUE: the twelve staff RPCs are definer, search_path empty, closed to anon'
);

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname like 'whatsapp_campaign%' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'CATALOGUE: no private WM-4 helper is executable by authenticated'
);

-- The Sales Manager control-plane hardening revoked every generic campaigns.*
-- code from sales_manager, so in the shipped grants a Sales Manager can never
-- draft, submit or approve a campaign version at all.
select ok(
  not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
    where r.code = 'sales_manager' and p.code like 'campaigns.%'),
  'MATRIX: shipped grants give sales_manager no generic campaigns.* code'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.list_whatsapp_campaign_template_options()$$,
  '42501', 'WHATSAPP_CAMPAIGN_DENIED', 'MATRIX: with shipped grants a Sales Manager cannot author campaign specs'
);
select is(public.list_whatsapp_campaign_versions(), '[]'::jsonb, 'VISIBILITY: a Sales Manager sees no non-approved WhatsApp version');
reset role;

-- The WhatsApp operator rule must hold even if a Sales Manager ever regains
-- generic drafting and approval. Re-grant inside this rolled-back transaction
-- so independent approval is exercised end to end.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.code in ('campaigns.read', 'campaigns.draft', 'campaigns.request_approval', 'campaigns.approve')
where r.code = 'sales_manager'
on conflict do nothing;

-- =============================================================================
-- 2. Generic draft + WhatsApp spec
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);

select lives_ok($$
  select set_config('test.v1', (public.create_campaign_draft(
    'WM4 Diwali', 'Diwali offers', 'direct_or_custom', array['whatsapp'], null,
    '{"currency":"INR","daily_budget_paise":0,"total_budget_paise":null}'::jsonb,
    '{"headline":"Diwali offers","primary_text":"WhatsApp template campaign","call_to_action":"Reply on WhatsApp","media_references":[]}'::jsonb,
    jsonb_build_object('start_date', to_char(now(), 'YYYY-MM-DD'), 'end_date', null),
    '{"logic":"and","rules":[{"field":"lead_stage","operator":"in","values":["qualified","contacted"]},{"field":"locality","operator":"equals","values":["whitefield"]}]}'::jsonb,
    gen_random_uuid()) ->> 'campaign_version_id'), true)
$$, 'DRAFT: Sales Manager A creates a WhatsApp-only generic campaign draft');

select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Diwali"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb)$$,
  '42501', 'WHATSAPP_CAMPAIGN_SPEC_DENIED', 'SPEC: a Sales Executive cannot author a campaign spec'
);
select throws_ok(
  $$select public.preview_whatsapp_campaign_audience(current_setting('test.v1')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_DENIED', 'PREVIEW: a Sales Executive cannot preview a campaign audience'
);
select throws_ok(
  $$select public.list_whatsapp_campaign_test_destinations()$$,
  '42501', 'WHATSAPP_CAMPAIGN_TEST_DENIED', 'TEST SEND: a Sales Executive holds no test-send authority'
);

select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{}'::jsonb, '{}'::jsonb)$$,
  '42501', 'WHATSAPP_CAMPAIGN_SPEC_DENIED', 'SPEC: legacy management cannot author a campaign spec'
);

select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000022', 'offers', '{"body":{"1":"Monday"}}'::jsonb, '{}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_INVALID: template_category_not_marketing', 'SPEC: a UTILITY template can never become a campaign template'
);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"1":"Asha"}}'::jsonb, '{}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_INVALID: parameters_missing', 'SPEC: every template variable must be mapped'
);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Diwali"}}'::jsonb, '{"body":{"1":"contact_phone"}}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_INVALID: bindings_invalid', 'SPEC: only allowlisted CRM bindings are accepted'
);
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'everything', '{"body":{"2":"Diwali"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_VALIDATION', 'SPEC: the preference category is allowlisted'
);
select lives_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Diwali"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb, 'd6600000-0000-4000-8000-000000000031')$$,
  'SPEC: Sales Manager A saves an approved MARKETING spec narrowed by a saved segment'
);

select is(
  (public.preview_whatsapp_campaign_audience(current_setting('test.v1')::uuid) ->> 'total_matched')::integer,
  7, 'PREVIEW: the segment narrows the campaign rule (the contacted lead drops out)'
);

select lives_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Diwali"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb)$$,
  'SPEC: a draft spec can be re-saved without the segment'
);

select set_config('test.preview', public.preview_whatsapp_campaign_audience(current_setting('test.v1')::uuid)::text, true);
select is((current_setting('test.preview')::jsonb ->> 'total_matched')::integer, 8, 'PREVIEW: eight contacts match the frozen rule');
select is((current_setting('test.preview')::jsonb ->> 'eligible')::integer, 0, 'PREVIEW: nobody is eligible while no execution-enabled policy exists');
select is(
  current_setting('test.preview')::jsonb -> 'reasons',
  '{"contact_do_not_contact":1,"marketing_consent_missing":1,"marketing_consent_withdrawn":1,"preference_opted_out":1,"channel_suppressed":1,"whatsapp_channel_missing":1,"send_policy_unconfigured":2}'::jsonb,
  'PREVIEW: every matched contact lands in exactly one first-failing bucket'
);

-- =============================================================================
-- 3. Test sends: internal destinations only, worker-dispatched
-- =============================================================================

select is(
  (select jsonb_agg(d ->> 'label' order by d ->> 'label') from jsonb_array_elements(public.list_whatsapp_campaign_test_destinations()) d),
  '["Admin Tester"]'::jsonb,
  'TEST SEND: only active Super Admin / Sales Manager profiles with a phone are destinations'
);
select throws_ok(
  $$select public.create_whatsapp_campaign_test_send(current_setting('test.v1')::uuid, 'a6600001-0000-4000-8000-000000000004')$$,
  '42501', 'WHATSAPP_CAMPAIGN_TEST_DESTINATION_NOT_REGISTERED', 'TEST SEND: a Sales Executive phone is not a registered test destination'
);
select lives_ok(
  $$select set_config('test.t1', public.create_whatsapp_campaign_test_send(current_setting('test.v1')::uuid, 'a6600001-0000-4000-8000-000000000001') ->> 'test_send_id', true)$$,
  'TEST SEND: Sales Manager A queues a test to the Super Admin phone'
);
select is(
  (select template_parameters from public.whatsapp_campaign_test_sends where id = current_setting('test.t1')::uuid),
  '{"body":{"1":"Admin","2":"Diwali"}}'::jsonb,
  'TEST SEND: bound variables resolve from the staff destination, never from a customer'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('test.tclaim', public.claim_whatsapp_campaign_test_sends('pgtap-worker', 5)::text, true);
select is(jsonb_array_length(current_setting('test.tclaim')::jsonb), 1, 'TEST SEND: the worker claims the pending test');
select is(
  current_setting('test.tclaim')::jsonb -> 0 -> 'template_components',
  '[{"type":"body","parameters":[{"type":"text","text":"Admin"},{"type":"text","text":"Diwali"}]}]'::jsonb,
  'TEST SEND: the claim carries type=template components built in SQL'
);
select throws_ok(
  $$select public.complete_whatsapp_campaign_test_send(current_setting('test.t1')::uuid, (current_setting('test.tclaim')::jsonb -> 0 ->> 'claim_token')::uuid, 'succeeded', 'wamid.TEST66')$$,
  'P0002', 'WHATSAPP_CAMPAIGN_TEST_NOT_PENDING', 'TEST SEND: completion requires recorded provider request-start evidence'
);
select lives_ok($$
  select public.mark_whatsapp_campaign_test_send_started(current_setting('test.t1')::uuid, (current_setting('test.tclaim')::jsonb -> 0 ->> 'claim_token')::uuid);
  select public.complete_whatsapp_campaign_test_send(current_setting('test.t1')::uuid, (current_setting('test.tclaim')::jsonb -> 0 ->> 'claim_token')::uuid, 'succeeded', 'wamid.TEST66');
$$, 'TEST SEND: request start then success completes the test');
reset role;
select is((select outcome from public.whatsapp_campaign_test_sends where id = current_setting('test.t1')::uuid), 'succeeded', 'TEST SEND: outcome recorded');
select is((select count(*)::integer from public.whatsapp_messages where provider_message_id = 'wamid.TEST66'), 0, 'TEST SEND: a test never enters customer conversation history');

-- =============================================================================
-- 4. Generic approval freezes the spec; self-approval denied
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.request_campaign_approval(current_setting('test.v1')::uuid, (select lock_version from public.campaign_versions where id = current_setting('test.v1')::uuid), gen_random_uuid())$$,
  'APPROVAL: Sales Manager A submits through generic governance'
);
select is((select state from public.whatsapp_campaign_specs where campaign_version_id = current_setting('test.v1')::uuid), 'frozen', 'APPROVAL: submission froze the WhatsApp spec');
select throws_ok(
  $$select public.save_whatsapp_campaign_spec(current_setting('test.v1')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Holi"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_FROZEN', 'APPROVAL: a submitted spec cannot be edited'
);
select throws_ok(
  $$select public.decide_campaign_version(current_setting('test.v1')::uuid, 'approved', null, gen_random_uuid())$$,
  '42501', 'CAMPAIGN_SELF_APPROVAL_DENIED', 'APPROVAL: Sales Manager self-approval remains denied'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000003', true);
select lives_ok(
  $$select public.decide_campaign_version(current_setting('test.v1')::uuid, 'approved', 'Looks compliant', gen_random_uuid())$$,
  'APPROVAL: Sales Manager B independently approves'
);
reset role;
select throws_ok(
  $$update public.whatsapp_campaign_specs set preference_category = 'referral' where campaign_version_id = current_setting('test.v1')::uuid$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_IMMUTABLE', 'APPROVAL: a frozen spec is immutable even to the table owner'
);

-- =============================================================================
-- 5. Run creation: independent operator, gates open, one delivery per version
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED', 'RUN: a Sales Executive has no bulk authority'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE', 'RUN: the approving Sales Manager cannot execute'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid)$$,
  '42501', 'WHATSAPP_MARKETING_EXECUTION_DISABLED', 'RUN: the Super Admin execution gate is closed'
);
reset role;

insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by)
values (2, true, '[{"windowHours":24,"maxMessages":1}]'::jsonb,
  jsonb_build_object('startLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '2 hours', 'HH24:MI'),
                     'endLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '3 hours', 'HH24:MI')),
  'Asia/Kolkata', now() - interval '1 day', 'a6600001-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid, now() - interval '1 hour')$$,
  '22023', 'WHATSAPP_CAMPAIGN_SCHEDULE_INVALID', 'RUN: a schedule in the past is refused'
);
select lives_ok(
  $$select set_config('test.r1', public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid) ->> 'run_id', true)$$,
  'RUN: Sales Manager A (not the approver) schedules the approved version now'
);
select throws_ok(
  $$select public.create_whatsapp_campaign_run(current_setting('test.v1')::uuid)$$,
  '22023', 'WHATSAPP_CAMPAIGN_VERSION_ALREADY_EXECUTED', 'RUN: one approval authorises one delivery'
);
select throws_ok(
  $$select public.materialize_due_whatsapp_campaign_runs(10)$$,
  '42501', NULL, 'WORKER: authenticated cannot drive the queue'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.claim_whatsapp_campaign_dispatch_jobs('staff', 5)$$,
  '42501', NULL, 'WORKER: even a Super Admin session cannot claim jobs'
);
reset role;

-- =============================================================================
-- 6. Worker: materialise, auto-start, claim, evidence, bind, retry, sweep
-- =============================================================================

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('test.mat', public.materialize_due_whatsapp_campaign_runs(10)::text, true);
reset role;

select is((select status from public.whatsapp_campaign_runs where id = current_setting('test.r1')::uuid), 'dispatching', 'WORKER: a due run materialises and auto-starts under its requester''s re-proved authority');
select results_eq(
  $$select c.display_name || ':' || r.state || ':' || coalesce(r.reason_code, '-')
      from public.whatsapp_campaign_recipients r join public.contacts c on c.id = r.contact_id
     where r.run_id = current_setting('test.r1')::uuid order by c.display_name$$,
  array[
    'Asha Rao:queued:-',
    'Dnc Person:excluded:contact_do_not_contact',
    'No Consent:excluded:marketing_consent_missing',
    'No Whatsapp:excluded:whatsapp_channel_missing',
    'Opted Out:excluded:preference_opted_out',
    'Ravi Kumar:queued:-',
    'Suppressed Person:excluded:channel_suppressed',
    'Withdrawn Person:excluded:marketing_consent_withdrawn'
  ],
  'WORKER: the frozen recipient snapshot records a first-failing reason per excluded contact'
);
select is(
  (select count(*)::integer from public.whatsapp_campaign_recipients where run_id = current_setting('test.r1')::uuid and state = 'excluded' and recipient_e164 is not null),
  0, 'WORKER: excluded recipients keep no phone number'
);
select is((select eligible_count from public.whatsapp_campaign_runs where id = current_setting('test.r1')::uuid), 2, 'WORKER: two recipients are queued');


set local role service_role;
select set_config('test.claim1', public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)::text, true);
reset role;
select is(jsonb_array_length(current_setting('test.claim1')::jsonb), 2, 'CLAIM: both eligible jobs are claimed');
select set_config('test.job_asha', (select j.id::text from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_recipients r on r.id = j.recipient_id where r.contact_id = 'c6600000-0000-4000-8000-000000000001' and j.run_id = current_setting('test.r1')::uuid), true);
select set_config('test.job_ravi', (select j.id::text from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_recipients r on r.id = j.recipient_id where r.contact_id = 'c6600000-0000-4000-8000-000000000008' and j.run_id = current_setting('test.r1')::uuid), true);
select set_config('test.tok_asha', (select e ->> 'claim_token' from jsonb_array_elements(current_setting('test.claim1')::jsonb) e where e ->> 'job_id' = current_setting('test.job_asha')), true);
select set_config('test.tok_ravi', (select e ->> 'claim_token' from jsonb_array_elements(current_setting('test.claim1')::jsonb) e where e ->> 'job_id' = current_setting('test.job_ravi')), true);
select is(
  (select e -> 'template_components' from jsonb_array_elements(current_setting('test.claim1')::jsonb) e where e ->> 'job_id' = current_setting('test.job_asha')),
  '[{"type":"body","parameters":[{"type":"text","text":"Asha"},{"type":"text","text":"Diwali"}]}]'::jsonb,
  'CLAIM: per-recipient parameters resolve from the CRM contact name'
);
select is(
  (select e ->> 'phone_number_id' from jsonb_array_elements(current_setting('test.claim1')::jsonb) e where e ->> 'job_id' = current_setting('test.job_asha')),
  '900000000000662', 'CLAIM: the claim carries the Meta phone number id of an active business number'
);

set local role service_role;
select throws_ok(
  $$select public.complete_whatsapp_campaign_dispatch_success(current_setting('test.job_asha')::uuid, current_setting('test.tok_asha')::uuid, 'wamid.ASHA66', now(), '{}'::jsonb)$$,
  'P0002', 'WHATSAPP_CAMPAIGN_JOB_NOT_COMPLETABLE', 'EVIDENCE: success cannot bind before provider request-start is recorded'
);
select throws_ok(
  $$select public.mark_whatsapp_campaign_provider_request_started(current_setting('test.job_asha')::uuid, gen_random_uuid())$$,
  'P0002', 'WHATSAPP_CAMPAIGN_JOB_NOT_CLAIMED', 'EVIDENCE: a wrong claim token is refused'
);
select lives_ok($$
  select public.mark_whatsapp_campaign_provider_request_started(current_setting('test.job_asha')::uuid, current_setting('test.tok_asha')::uuid);
  select public.complete_whatsapp_campaign_dispatch_success(current_setting('test.job_asha')::uuid, current_setting('test.tok_asha')::uuid, 'wamid.ASHA66', now(), '{"provider":"meta","httpStatus":200}'::jsonb);
$$, 'BIND: request start then provider success binds');
select is(
  (public.complete_whatsapp_campaign_dispatch_success(current_setting('test.job_asha')::uuid, current_setting('test.tok_asha')::uuid, 'wamid.ASHA66', now(), '{}'::jsonb) ->> 'outcome'),
  'already_bound', 'BIND: a replayed success is idempotent'
);
reset role;

select is(
  (select m.direction || ':' || m.provider_message_type || ':' || m.body_text from public.whatsapp_messages m where m.provider_message_id = 'wamid.ASHA66'),
  'outbound:template:Hi Asha, festive offers on Diwali are live.' || E'\n\n' || 'Reply STOP to opt out',
  'BIND: the send is canonical outbound template history'
);
select is(
  (select c.lead_id::text from public.whatsapp_conversations c join public.whatsapp_messages m on m.conversation_id = c.id where m.provider_message_id = 'wamid.ASHA66'),
  'b6600000-0000-4000-8000-000000000001', 'BIND: the conversation is lead-linked by the single CRM link writer, so replies reach the owner'
);
select is(
  (select count(*)::integer from public.whatsapp_message_campaign_attributions where run_id = current_setting('test.r1')::uuid),
  1, 'BIND: the message is attributed to the run exactly once'
);

-- Ravi: definite transient failure -> bounded retry -> reclaim -> TTL sweep after request start.
set local role service_role;
select throws_ok(
  $$select public.complete_whatsapp_campaign_dispatch_failure(current_setting('test.job_ravi')::uuid, current_setting('test.tok_ravi')::uuid, 'transient', 'http_429', '{}'::jsonb)$$,
  'P0002', 'WHATSAPP_CAMPAIGN_JOB_NOT_COMPLETABLE', 'RETRY: a failure without request-start evidence is refused'
);
select lives_ok(
  $$select public.mark_whatsapp_campaign_provider_request_started(current_setting('test.job_ravi')::uuid, current_setting('test.tok_ravi')::uuid)$$,
  'RETRY: request start recorded for the second job'
);
select is(
  (public.complete_whatsapp_campaign_dispatch_failure(current_setting('test.job_ravi')::uuid, current_setting('test.tok_ravi')::uuid, 'transient', 'http_429', '{"httpStatus":429}'::jsonb) ->> 'outcome'),
  'retry_scheduled', 'RETRY: a definite transient failure schedules a bounded retry'
);
reset role;
select ok(
  (select state = 'pending' and attempt_count = 1 and not_before > now() and provider_request_started_at is null
     from public.whatsapp_campaign_dispatch_jobs where id = current_setting('test.job_ravi')::uuid),
  'RETRY: the job is pending with backoff and no stale request-start evidence'
);
set local role service_role;
select is(jsonb_array_length(public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)), 0, 'RETRY: a backed-off job is not claimable early');
reset role;
update public.whatsapp_campaign_dispatch_jobs set not_before = now() - interval '1 minute' where id = current_setting('test.job_ravi')::uuid;
set local role service_role;
select set_config('test.claim2', public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)::text, true);
select is((current_setting('test.claim2')::jsonb -> 0 ->> 'attempt')::integer, 2, 'RETRY: the reclaim is attempt two');
select lives_ok(
  $$select public.mark_whatsapp_campaign_provider_request_started(current_setting('test.job_ravi')::uuid, (current_setting('test.claim2')::jsonb -> 0 ->> 'claim_token')::uuid)$$,
  'SWEEP: request start recorded, then the worker dies'
);
reset role;
update public.whatsapp_campaign_dispatch_jobs set claimed_at = clock_timestamp() - interval '10 minutes', claim_expires_at = clock_timestamp() - interval '5 minutes'
where id = current_setting('test.job_ravi')::uuid;
set local role service_role;
select is(jsonb_array_length(public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)), 0, 'SWEEP: the next tick claims nothing new');
reset role;
select is(
  (select j.state || ':' || r.state || ':' || cr.status from public.whatsapp_campaign_dispatch_jobs j
     join public.whatsapp_campaign_recipients r on r.id = j.recipient_id join public.whatsapp_campaign_runs cr on cr.id = j.run_id
    where j.id = current_setting('test.job_ravi')::uuid),
  'needs_reconcile:needs_reconcile:reconciling',
  'SWEEP: an expired claim after request start is ambiguous, never re-queued; the run reconciles'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.cancel_whatsapp_campaign_run(current_setting('test.r1')::uuid)$$,
  '22023', 'WHATSAPP_CAMPAIGN_CANCEL_UNSAFE', 'RECONCILE: cancelling cannot make an ambiguous outcome go away'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.resolve_whatsapp_campaign_reconcile(current_setting('test.job_ravi')::uuid, 'not_sent', 'Checked Meta manager, nothing delivered')$$,
  '42501', 'WHATSAPP_CAMPAIGN_RECONCILE_DENIED', 'RECONCILE: a Sales Manager cannot resolve ambiguity'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.resolve_whatsapp_campaign_reconcile(current_setting('test.job_ravi')::uuid, 'not_sent', 'short')$$,
  '22023', 'WHATSAPP_RECONCILE_NOTE_REQUIRED', 'RECONCILE: a human decision needs a written note'
);
select is(
  (public.resolve_whatsapp_campaign_reconcile(current_setting('test.job_ravi')::uuid, 'sent', 'Delivered per Meta business manager', 'wamid.RAVI66') ->> 'outcome'),
  'bound', 'RECONCILE: Super Admin binds provider evidence without a provider call'
);
select is(
  (select status || ':' || sent_count || ':' || excluded_count || ':' || reconcile_count from public.whatsapp_campaign_runs where id = current_setting('test.r1')::uuid),
  'completed:2:6:0', 'RECONCILE: the run completes once every job is resolved'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select is(
  public.get_whatsapp_campaign_run_breakdown(current_setting('test.r1')::uuid) -> 'recipient_states',
  '{"sent":2,"excluded":6}'::jsonb, 'BREAKDOWN: counts only, readable with campaigns.read'
);
reset role;
select is(
  (select actor_type || ':' || actor_id::text from public.whatsapp_campaign_dispatch_events where job_id = current_setting('test.job_ravi')::uuid and event_type = 'provider_bound'),
  'staff:a6600001-0000-4000-8000-000000000001', 'RECONCILE: the human decision is attributed in append-only evidence'
);
select throws_ok(
  $$update public.whatsapp_campaign_dispatch_events set event_type = 'rewritten' where run_id = current_setting('test.r1')::uuid$$,
  NULL, 'WHATSAPP_APPEND_ONLY', 'EVIDENCE: dispatch events are append-only'
);

-- =============================================================================
-- 7. Second version: frequency caps skip, quiet hours defer, pause/resume/cancel
-- =============================================================================

insert into public.contacts (id, display_name, status) values ('c6600000-0000-4000-8000-000000000009', 'Meera Nair', 'active');
insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('c6600000-0000-4000-8000-000000000009', 'whatsapp', '+919766000009', true, 'active');
insert into public.leads (id, submission_reference, contact_id, submitted_name, status, source, primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality)
values ('b6600000-0000-4000-8000-000000000009', 'b6600000-0000-4000-8000-000000000009', 'c6600000-0000-4000-8000-000000000009', 'WM4 Lead', 'qualified', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner', 'whitefield');
insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at)
values ('c6600000-0000-4000-8000-000000000009', 'MARKETING', 'whatsapp', 'granted', 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - interval '3 days');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000003', true);
select lives_ok($$
  select set_config('test.v2', (public.create_next_campaign_version((select campaign_id from public.campaign_versions where id = current_setting('test.v1')::uuid), gen_random_uuid()) ->> 'campaign_version_id'), true);
  select public.save_whatsapp_campaign_spec(current_setting('test.v2')::uuid, 'd6600000-0000-4000-8000-000000000021', 'offers', '{"body":{"2":"Christmas"}}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb);
  select public.request_campaign_approval(current_setting('test.v2')::uuid, (select lock_version from public.campaign_versions where id = current_setting('test.v2')::uuid), gen_random_uuid());
$$, 'V2: Sales Manager B drafts, specs and submits the next version');
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.decide_campaign_version(current_setting('test.v2')::uuid, 'approved', null, gen_random_uuid())$$,
  'V2: Sales Manager A independently approves'
);
reset role;

insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by)
values (3, true, '[{"windowHours":24,"maxMessages":1}]'::jsonb,
  jsonb_build_object('startLocal', to_char((now() at time zone 'Asia/Kolkata') - interval '1 hour', 'HH24:MI'),
                     'endLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '1 hour', 'HH24:MI')),
  'Asia/Kolkata', now() - interval '1 hour', 'a6600001-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000003', true);
select lives_ok(
  $$select set_config('test.r2', public.create_whatsapp_campaign_run(current_setting('test.v2')::uuid) ->> 'run_id', true)$$,
  'V2: Sales Manager B (not the v2 approver) schedules it'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok($$select public.materialize_due_whatsapp_campaign_runs(10)$$, 'V2: the worker materialises and starts the run');
select is(jsonb_array_length(public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)), 0, 'V2: nothing is claimed inside quiet hours or over the cap');
reset role;
select results_eq(
  $$select c.display_name || ':' || j.state || ':' || coalesce(j.last_error_code, '-') || ':' || (j.not_before > now())::text
      from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_recipients r on r.id = j.recipient_id join public.contacts c on c.id = r.contact_id
     where j.run_id = current_setting('test.r2')::uuid order by c.display_name$$,
  array['Asha Rao:skipped:frequency_capped:false', 'Meera Nair:pending:quiet_hours:true', 'Ravi Kumar:skipped:frequency_capped:false'],
  'JIT: frequency caps skip; quiet hours defer to the end of the window instead of skipping'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.pause_whatsapp_campaign_run(current_setting('test.r2')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE', 'PAUSE: the approving Sales Manager cannot operate the run'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.pause_whatsapp_campaign_run(current_setting('test.r2')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_PAUSE_DENIED', 'PAUSE: a Sales Executive cannot pause'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000003', true);
select is((public.pause_whatsapp_campaign_run(current_setting('test.r2')::uuid) ->> 'status'), 'paused', 'PAUSE: Sales Manager B pauses');
reset role;
update public.whatsapp_campaign_dispatch_jobs set not_before = now() - interval '1 minute' where run_id = current_setting('test.r2')::uuid and state = 'pending';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(jsonb_array_length(public.claim_whatsapp_campaign_dispatch_jobs('pgtap-worker', 10)), 0, 'PAUSE: a paused run claims nothing');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((public.resume_whatsapp_campaign_run(current_setting('test.r2')::uuid) ->> 'status'), 'dispatching', 'RESUME: Sales Manager B resumes');
select throws_ok(
  $$select public.cancel_whatsapp_campaign_run(current_setting('test.r2')::uuid)$$,
  '42501', 'WHATSAPP_CAMPAIGN_CANCEL_DENIED', 'CANCEL: a Sales Manager cannot cancel'
);
select set_config('request.jwt.claim.sub', 'a6600001-0000-4000-8000-000000000001', true);
select is((public.cancel_whatsapp_campaign_run(current_setting('test.r2')::uuid) ->> 'status'), 'cancelled', 'CANCEL: Super Admin cancels a run with only pending jobs');
reset role;
select is(
  (select j.state || ':' || r.state from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_recipients r on r.id = j.recipient_id
    where r.contact_id = 'c6600000-0000-4000-8000-000000000009' and j.run_id = current_setting('test.r2')::uuid),
  'cancelled:cancelled', 'CANCEL: pending work is cancelled with its recipient'
);
select throws_ok(
  $$update public.whatsapp_campaign_runs set status = 'dispatching' where id = current_setting('test.r2')::uuid$$,
  '22023', 'WHATSAPP_CAMPAIGN_RUN_TERMINAL', 'CANCEL: a terminal run never reopens'
);

select * from finish();
rollback;
