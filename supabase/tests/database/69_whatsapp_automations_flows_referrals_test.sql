-- ONEDECORE WM-6 — governed automations, official Flows and CTWA referral
-- capture, proved against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. automations.read/manage and flows.read/manage are Super Admin + Sales
--    Manager only; every new table is RLS-forced with no direct DML.
-- 2. A Flow's provider id and status are written only by the service-role
--    outcome path; publish needs JSON Meta accepted; an unanswered mutation
--    blocks the next one.
-- 3. Flow replies are matched by an opaque token, reduced to the mapping, and
--    fill only EMPTY CRM fields on a live lead.
-- 4. Automations bind to approved campaign versions; activation needs the
--    execution gate; activated journeys are immutable; enrollment is
--    idempotent; every send is re-proved just in time (consent, reply, lead
--    tombstone); ambiguous outcomes park for a Super Admin decision; caps count
--    automation sends; pause and archive are never gated.
-- 5. CTWA referral context is sanitised attribution evidence only.

begin;
select plan(66);

-- =============================================================================
-- Fixtures — a69 / b69 / c69 / d69 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6900001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '69-sa@example.test', 'authenticated', 'authenticated'),
  ('a6900001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '69-sm@example.test', 'authenticated', 'authenticated'),
  ('a6900001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '69-se@example.test', 'authenticated', 'authenticated'),
  ('a6900001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '69-mgmt@example.test', 'authenticated', 'authenticated'),
  ('a6900001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', '69-designer@example.test', 'authenticated', 'authenticated');
update public.profiles set status = 'active' where id::text like 'a6900001-%';
insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id from (values
  ('a6900001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6900001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6900001-0000-4000-8000-000000000003', 'sales_executive'),
  ('a6900001-0000-4000-8000-000000000004', 'management'),
  ('a6900001-0000-4000-8000-000000000005', 'designer')
) as v(user_id, role_code) join public.roles r on r.code = v.role_code;

-- Asha eligible · Ravi replies first · Meera no consent · Kiran ambiguous · Tara tombstoned
insert into public.contacts (id, display_name, status) values
  ('c6900000-0000-4000-8000-000000000001', 'Asha Rao', 'active'),
  ('c6900000-0000-4000-8000-000000000002', 'Ravi Kumar', 'active'),
  ('c6900000-0000-4000-8000-000000000003', 'Meera Nair', 'active'),
  ('c6900000-0000-4000-8000-000000000004', 'Kiran Das', 'active'),
  ('c6900000-0000-4000-8000-000000000005', 'Tara Singh', 'active');
insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status)
select v.contact_id::uuid, 'whatsapp', v.e164, true, 'active' from (values
  ('c6900000-0000-4000-8000-000000000001', '+919769000001'), ('c6900000-0000-4000-8000-000000000002', '+919769000002'),
  ('c6900000-0000-4000-8000-000000000003', '+919769000003'), ('c6900000-0000-4000-8000-000000000004', '+919769000004'),
  ('c6900000-0000-4000-8000-000000000005', '+919769000005')) v(contact_id, e164);
-- The CRM lead-link writer proves identity through the phone channel too.
insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status)
values ('c6900000-0000-4000-8000-000000000001', 'phone', '+919769000001', true, 'active');
insert into public.leads (id, submission_reference, contact_id, submitted_name, status, source, primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality)
select v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, 'WM6 Lead', 'qualified', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner', 'whitefield'
from (values
  ('b6900000-0000-4000-8000-000000000001', 'c6900000-0000-4000-8000-000000000001'), ('b6900000-0000-4000-8000-000000000002', 'c6900000-0000-4000-8000-000000000002'),
  ('b6900000-0000-4000-8000-000000000003', 'c6900000-0000-4000-8000-000000000003'), ('b6900000-0000-4000-8000-000000000004', 'c6900000-0000-4000-8000-000000000004'),
  ('b6900000-0000-4000-8000-000000000005', 'c6900000-0000-4000-8000-000000000005')) as v(lead_id, contact_id);
insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at)
select v.contact_id::uuid, 'MARKETING', 'whatsapp', 'granted', 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - interval '10 days'
from (values ('c6900000-0000-4000-8000-000000000001'), ('c6900000-0000-4000-8000-000000000002'), ('c6900000-0000-4000-8000-000000000004'), ('c6900000-0000-4000-8000-000000000005')) v(contact_id);

insert into public.whatsapp_business_accounts (id, waba_id, status) values ('d6900000-0000-4000-8000-000000000001', '900000000000691', 'active');
insert into public.whatsapp_phone_numbers (id, business_account_id, phone_number_id, display_phone_number, status)
values ('d6900000-0000-4000-8000-000000000002', 'd6900000-0000-4000-8000-000000000001', '900000000000692', '+919769000099', 'active');
insert into public.whatsapp_templates (id, business_account_id, provider_template_id, name, language, category, status, parameter_format, components) values
  ('d6900000-0000-4000-8000-000000000011', 'd6900000-0000-4000-8000-000000000001', '169000000000001', 'consult_tips', 'en', 'MARKETING', 'APPROVED', 'POSITIONAL',
   '[{"type":"BODY","text":"Hi {{1}}, here is how to prepare for your consultation."}]'::jsonb);
insert into public.whatsapp_template_snapshots (id, template_id, business_account_id, provider_template_id, name, language, category, parameter_format, components, content_hash, observed_status)
select 'd6900000-0000-4000-8000-000000000021', t.id, t.business_account_id, t.provider_template_id, t.name, t.language, t.category, t.parameter_format, t.components, t.content_hash, 'APPROVED'
from public.whatsapp_templates t where t.id = 'd6900000-0000-4000-8000-000000000011';

insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by)
values (1, false, '[{"windowHours":24,"maxMessages":1}]'::jsonb,
  jsonb_build_object('startLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '2 hours', 'HH24:MI'), 'endLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '3 hours', 'HH24:MI')),
  'Asia/Kolkata', now() - interval '2 days', 'a6900001-0000-4000-8000-000000000001');

-- An approved WhatsApp campaign version whose frozen spec the automation sends.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000001', true);
select set_config('test.v', (public.create_campaign_draft(
  'WM6 Consult', 'Consultation tips', 'direct_or_custom', array['whatsapp'], null,
  '{"currency":"INR","daily_budget_paise":0,"total_budget_paise":null}'::jsonb,
  '{"headline":"Tips","primary_text":"WhatsApp","call_to_action":"Reply","media_references":[]}'::jsonb,
  jsonb_build_object('start_date', to_char(now(), 'YYYY-MM-DD'), 'end_date', null),
  '{"logic":"and","rules":[{"field":"locality","operator":"equals","values":["whitefield"]}]}'::jsonb,
  gen_random_uuid()) ->> 'campaign_version_id'), true);
select public.save_whatsapp_campaign_spec(current_setting('test.v')::uuid, 'd6900000-0000-4000-8000-000000000021', 'project_updates', '{}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb);
select public.request_campaign_approval(current_setting('test.v')::uuid, (select lock_version from public.campaign_versions where id = current_setting('test.v')::uuid), gen_random_uuid());
select public.decide_campaign_version(current_setting('test.v')::uuid, 'approved', 'Compliant', gen_random_uuid());
reset role;

-- =============================================================================
-- 1. Matrix and catalogue
-- =============================================================================

select results_eq(
  $$select r.code || ':' || p.code from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
     where p.code like 'whatsapp.automations.%' or p.code like 'whatsapp.flows.%' order by 1$$,
  array['sales_manager:whatsapp.automations.manage', 'sales_manager:whatsapp.automations.read', 'sales_manager:whatsapp.flows.manage', 'sales_manager:whatsapp.flows.read',
        'super_admin:whatsapp.automations.manage', 'super_admin:whatsapp.automations.read', 'super_admin:whatsapp.flows.manage', 'super_admin:whatsapp.flows.read'],
  'MATRIX: automations and Flows are Super Admin + Sales Manager only; no executive, legacy, designer or Kriti path'
);
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in (
    'whatsapp_automations','whatsapp_automation_enrollments','whatsapp_automation_events','whatsapp_message_automation_attributions','whatsapp_flows',
    'whatsapp_flow_provider_requests','whatsapp_flow_provider_events','whatsapp_flow_tokens','whatsapp_flow_responses','whatsapp_referral_contexts')),
  'CATALOGUE: every WM-6 table has RLS enabled and forced'
);
select ok(
  not exists (select 1 from unnest(array['whatsapp_automations','whatsapp_automation_enrollments','whatsapp_automation_events','whatsapp_message_automation_attributions','whatsapp_flows',
      'whatsapp_flow_provider_requests','whatsapp_flow_provider_events','whatsapp_flow_tokens','whatsapp_flow_responses','whatsapp_referral_contexts']) t(name)
    where has_table_privilege('authenticated', 'public.' || t.name, 'INSERT') or has_table_privilege('authenticated', 'public.' || t.name, 'UPDATE')
       or has_table_privilege('service_role', 'public.' || t.name, 'INSERT') or has_table_privilege('anon', 'public.' || t.name, 'SELECT'))
  and not has_table_privilege('authenticated', 'public.whatsapp_flow_tokens', 'SELECT'),
  'CATALOGUE: no direct DML; Flow token hashes are closed to staff'
);
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and (p.proname like 'whatsapp_automation%' or p.proname like 'whatsapp_flow%' or p.proname like 'whatsapp_mint_%' or p.proname = 'whatsapp_capture_flow_response')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'CATALOGUE: no private WM-6 helper is executable by authenticated'
);

-- =============================================================================
-- 2. Flows: provider truth
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000003', true);
select throws_ok($$select public.list_whatsapp_flows()$$, '42501', 'WHATSAPP_FLOWS_DENIED', 'FLOWS: a Sales Executive has no Flow registry');
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000005', true);
select throws_ok($$select public.list_whatsapp_automations()$$, '42501', 'WHATSAPP_AUTOMATIONS_DENIED', 'AUTOMATIONS: a Designer has no automations');

select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.save_whatsapp_flow_draft('Qualifier', array['MAGIC'], 'lead_qualification', '{}'::jsonb, null, null, '900000000000691')$$,
  '22023', 'WHATSAPP_FLOW_VALIDATION', 'FLOWS: a non-Meta category is refused'
);
select throws_ok(
  $$select public.save_whatsapp_flow_draft('Qualifier', array['LEAD_GENERATION'], 'lead_qualification', '{"phone":"assigned_to"}'::jsonb, null, null, '900000000000691')$$,
  '22023', 'WHATSAPP_FLOW_VALIDATION', 'FLOWS: an answer can never map to a non-allowlisted CRM field'
);
select throws_ok(
  $$select public.save_whatsapp_flow_draft('Qualifier', array['LEAD_GENERATION'], 'lead_qualification', '{}'::jsonb, '{"screens":"nope"}'::jsonb, null, '900000000000691')$$,
  '22023', 'WHATSAPP_FLOW_JSON_INVALID', 'FLOWS: a document without version and screens is refused'
);
select lives_ok(
  $$select set_config('test.flow', public.save_whatsapp_flow_draft('Qualifier', array['LEAD_GENERATION'], 'lead_qualification', '{"budget":"budget","locality":"locality"}'::jsonb,
      '{"version":"7.0","screens":[{"id":"QUALIFY","title":"Tell us"}]}'::jsonb, null, '900000000000691') ->> 'flow_id', true)$$,
  'FLOWS: a Sales Manager creates a local draft'
);
select is((select provider_status from public.whatsapp_flows where id = current_setting('test.flow')::uuid), 'local_draft', 'FLOWS: nothing claims to exist at Meta yet');
select throws_ok(
  $$select public.request_whatsapp_flow_provider_action(current_setting('test.flow')::uuid, 'publish', gen_random_uuid())$$,
  '22023', 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED', 'FLOWS: a local draft cannot be published'
);
select lives_ok(
  $$select set_config('test.req_create', public.request_whatsapp_flow_provider_action(current_setting('test.flow')::uuid, 'create', 'a6900000-0000-4000-8000-0000000000c1') ->> 'request_id', true)$$,
  'FLOWS: the create decision is recorded'
);
select is(
  public.request_whatsapp_flow_provider_action(current_setting('test.flow')::uuid, 'create', 'a6900000-0000-4000-8000-0000000000c1') ->> 'reused', 'true',
  'FLOWS: the same idempotency key replays the recorded decision'
);
select throws_ok(
  $$select public.request_whatsapp_flow_provider_action(current_setting('test.flow')::uuid, 'create', gen_random_uuid())$$,
  '22023', 'WHATSAPP_FLOW_REQUEST_UNRESOLVED', 'FLOWS: an unanswered mutation blocks the next one'
);
select throws_ok(
  $$select public.record_whatsapp_flow_provider_outcome(current_setting('test.req_create')::uuid, 'accepted', '169000000000999', 'PUBLISHED', null, null)$$,
  '42501', NULL, 'FLOWS: no staff session can write provider truth'
);
reset role;
select throws_ok(
  $$update public.whatsapp_flows set provider_status = 'PUBLISHED', provider_flow_id = '1' where id = current_setting('test.flow')::uuid$$,
  '42501', 'WHATSAPP_FLOW_PROVIDER_TRUTH_FORBIDDEN', 'FLOWS: not even the table owner can fake a provider status'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.record_whatsapp_flow_provider_outcome(current_setting('test.req_create')::uuid, 'accepted', '169000000000999', null, null, '[]'::jsonb) ->> 'provider_status',
  'DRAFT', 'FLOWS: Meta''s create answer sets the provider id and DRAFT'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select set_config('test.req_pub', public.request_whatsapp_flow_provider_action(current_setting('test.flow')::uuid, 'publish', gen_random_uuid()) ->> 'request_id', true);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.record_whatsapp_flow_provider_outcome(current_setting('test.req_pub')::uuid, 'accepted', null, 'SOMETHING_NEW', null, null) ->> 'provider_status',
  'unknown', 'FLOWS: an unrecognised provider status stays unknown, never PUBLISHED'
);
reset role;
select is((select count(*)::integer from public.whatsapp_flow_provider_events where flow_id = current_setting('test.flow')::uuid), 2, 'FLOWS: every provider answer is append-only evidence');

-- =============================================================================
-- 3. Automations: draft, gates, immutability
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.save_whatsapp_automation('Exec journey', 'lead_created', '{}'::jsonb, current_setting('test.v')::uuid, 0, array[]::text[], true)$$,
  '42501', 'WHATSAPP_AUTOMATIONS_DENIED', 'AUTOMATIONS: a Sales Executive cannot draft automations'
);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.save_whatsapp_automation('Legacy journey', 'lead_created', '{}'::jsonb, current_setting('test.v')::uuid, 0, array[]::text[], true)$$,
  '42501', 'WHATSAPP_AUTOMATIONS_DENIED', 'AUTOMATIONS: legacy management cannot draft automations'
);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.save_whatsapp_automation('Bad key', 'lead_stage_changed', '{"to_stage":"qualified","sql":"drop"}'::jsonb, current_setting('test.v')::uuid, 0, array[]::text[], true)$$,
  '22023', 'WHATSAPP_AUTOMATION_INVALID: trigger_config_unexpected_key', 'AUTOMATIONS: trigger config is allowlisted'
);
select throws_ok(
  $$select public.save_whatsapp_automation('Ghost version', 'lead_created', '{}'::jsonb, gen_random_uuid(), 0, array[]::text[], true)$$,
  'P0002', 'WHATSAPP_CAMPAIGN_NOT_FOUND', 'NO ORACLE: a missing campaign version answers not-found'
);
select lives_ok(
  $$select set_config('test.a', public.save_whatsapp_automation('Consultation prep', 'lead_stage_changed', '{"to_stage":"consultation_scheduled"}'::jsonb,
      current_setting('test.v')::uuid, 0, array['closed_won','closed_lost']::text[], true) ->> 'automation_id', true)$$,
  'AUTOMATIONS: a Sales Manager drafts a journey bound to the approved version'
);
select throws_ok(
  $$select public.set_whatsapp_automation_status(current_setting('test.a')::uuid, 'activate', 1)$$,
  '42501', 'WHATSAPP_MARKETING_EXECUTION_DISABLED', 'GATE: activation needs the marketing execution gate open'
);
reset role;
insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by)
select 2, true, frequency_rules, quiet_hours, timezone, now() - interval '1 day', set_by from public.whatsapp_marketing_send_policies where version = 1;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.set_whatsapp_automation_status(current_setting('test.a')::uuid, 'activate', 99)$$,
  '40001', 'WHATSAPP_AUTOMATION_STALE', 'LOCK: a stale form cannot change status'
);
select is(
  public.set_whatsapp_automation_status(current_setting('test.a')::uuid, 'activate', (select lock_version from public.whatsapp_automations where id = current_setting('test.a')::uuid)) ->> 'status',
  'active', 'GATE: an independent Sales Manager activates with every gate open'
);
select throws_ok(
  $$select public.save_whatsapp_automation('Consultation prep', 'lead_created', '{}'::jsonb, current_setting('test.v')::uuid, 0, array[]::text[], true, null, current_setting('test.a')::uuid)$$,
  '22023', 'WHATSAPP_AUTOMATION_NOT_DRAFT', 'IMMUTABLE: an activated journey cannot be edited'
);
reset role;
select throws_ok(
  $$update public.whatsapp_automations set delay_minutes = 5 where id = current_setting('test.a')::uuid$$,
  '22023', 'WHATSAPP_AUTOMATION_IMMUTABLE', 'IMMUTABLE: not even the table owner changes an activated journey'
);

-- =============================================================================
-- 4. Trigger scan, JIT claim, provider evidence
-- =============================================================================

insert into public.lead_events (lead_id, event_type, actor_type, event_data, occurred_at, created_at)
select v.lead_id::uuid, 'lead.status_changed', 'staff', '{"from":"qualified","to":"consultation_scheduled"}'::jsonb, clock_timestamp(), clock_timestamp() + interval '1 second'
from (values ('b6900000-0000-4000-8000-000000000001'), ('b6900000-0000-4000-8000-000000000002'), ('b6900000-0000-4000-8000-000000000003'),
             ('b6900000-0000-4000-8000-000000000004'), ('b6900000-0000-4000-8000-000000000005')) v(lead_id);
insert into public.lead_events (lead_id, event_type, actor_type, event_data, occurred_at, created_at)
values ('b6900000-0000-4000-8000-000000000001', 'lead.status_changed', 'staff', '{"from":"qualified","to":"negotiation"}'::jsonb, clock_timestamp(), clock_timestamp() + interval '1 second');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000001', true);
select throws_ok($$select public.enroll_whatsapp_automation_triggers(100)$$, '42501', NULL, 'WORKER: even a Super Admin session cannot drive the trigger scan');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is((public.enroll_whatsapp_automation_triggers(100) -> 0 ->> 'enrolled')::integer, 5, 'SCAN: every matching stage change enrolls its contact once; the other stage does not');
select is(coalesce((public.enroll_whatsapp_automation_triggers(100) -> 0 ->> 'enrolled')::integer, 0), 0, 'SCAN: a second scan enrolls nobody twice');
reset role;

-- Ravi replies after enrolling; Tara's lead is tombstoned before the claim.
insert into public.whatsapp_conversations (id, phone_number_id, customer_e164, contact_id, lead_id, last_message_at, last_inbound_at)
values ('e6900000-0000-4000-8000-000000000002', 'd6900000-0000-4000-8000-000000000002', '+919769000002', 'c6900000-0000-4000-8000-000000000002', 'b6900000-0000-4000-8000-000000000002', now(), now());
insert into public.whatsapp_messages (id, conversation_id, provider_message_id, direction, provider_message_type, normalized_message_type, sender_e164, recipient_e164, body_text, content, provider_timestamp, latest_status)
values ('e6900000-0000-4000-8000-000000000012', 'e6900000-0000-4000-8000-000000000002', 'wamid.69RAVI', 'inbound', 'text', 'text', '+919769000002', '+919769000099', 'Already booked, thanks', '{}'::jsonb, clock_timestamp() + interval '1 minute', 'received');
select set_config('onedecore.crm_transition', '1', true);
update public.leads set deleted_at = now(), deleted_by = 'a6900001-0000-4000-8000-000000000001', delete_reason = 'WM6 tombstone proof', deletion_reference = gen_random_uuid()
where id = 'b6900000-0000-4000-8000-000000000005';
select set_config('onedecore.crm_transition', '0', true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('test.claim', public.claim_whatsapp_automation_enrollments('pgtap-69', 10)::text, true);
reset role;

select is(
  (select jsonb_agg(c.display_name order by c.display_name) from jsonb_array_elements(current_setting('test.claim')::jsonb) e
     join public.whatsapp_automation_enrollments en on en.id = (e ->> 'enrollment_id')::uuid join public.contacts c on c.id = en.contact_id),
  '["Asha Rao", "Kiran Das"]'::jsonb, 'JIT: only still-eligible contacts are claimed'
);
select results_eq(
  $$select c.display_name || ':' || e.state || ':' || coalesce(e.reason_code, '-') from public.whatsapp_automation_enrollments e join public.contacts c on c.id = e.contact_id
     where e.automation_id = current_setting('test.a')::uuid and e.state = 'skipped' order by c.display_name$$,
  array['Meera Nair:skipped:marketing_consent_missing', 'Ravi Kumar:skipped:customer_replied', 'Tara Singh:skipped:lead_tombstoned'],
  'JIT: missing MARKETING consent, a customer reply and a tombstoned lead each stop the send'
);
select is(
  (select e -> 'template_components' from jsonb_array_elements(current_setting('test.claim')::jsonb) e join public.whatsapp_automation_enrollments en on en.id = (e ->> 'enrollment_id')::uuid
    where en.contact_id = 'c6900000-0000-4000-8000-000000000001'),
  '[{"type":"body","parameters":[{"type":"text","text":"Asha"}]}]'::jsonb, 'CLAIM: type=template components come from the frozen spec'
);

select set_config('test.e_asha', (select en.id::text from public.whatsapp_automation_enrollments en where en.automation_id = current_setting('test.a')::uuid and en.contact_id = 'c6900000-0000-4000-8000-000000000001'), true);
select set_config('test.e_kiran', (select en.id::text from public.whatsapp_automation_enrollments en where en.automation_id = current_setting('test.a')::uuid and en.contact_id = 'c6900000-0000-4000-8000-000000000004'), true);
select set_config('test.tok_asha', (select e ->> 'claim_token' from jsonb_array_elements(current_setting('test.claim')::jsonb) e where e ->> 'enrollment_id' = current_setting('test.e_asha')), true);
select set_config('test.tok_kiran', (select e ->> 'claim_token' from jsonb_array_elements(current_setting('test.claim')::jsonb) e where e ->> 'enrollment_id' = current_setting('test.e_kiran')), true);

set local role service_role;
select throws_ok(
  $$select public.complete_whatsapp_automation_dispatch_success(current_setting('test.e_asha')::uuid, current_setting('test.tok_asha')::uuid, 'wamid.69ASHA', now(), '{}'::jsonb)$$,
  'P0002', 'WHATSAPP_AUTOMATION_ENROLLMENT_NOT_COMPLETABLE', 'EVIDENCE: success cannot bind before provider request-start is recorded'
);
select lives_ok($$
  select public.mark_whatsapp_automation_provider_request_started(current_setting('test.e_asha')::uuid, current_setting('test.tok_asha')::uuid);
  select public.complete_whatsapp_automation_dispatch_success(current_setting('test.e_asha')::uuid, current_setting('test.tok_asha')::uuid, 'wamid.69ASHA', now(), '{"provider":"meta"}'::jsonb);
  select public.mark_whatsapp_automation_provider_request_started(current_setting('test.e_kiran')::uuid, current_setting('test.tok_kiran')::uuid);
$$, 'BIND: Asha''s send binds; Kiran''s provider request starts');
select is(
  public.complete_whatsapp_automation_dispatch_failure(current_setting('test.e_kiran')::uuid, current_setting('test.tok_kiran')::uuid, 'ambiguous', 'timeout', '{}'::jsonb) ->> 'outcome',
  'needs_reconcile', 'AMBIGUITY: an unclear provider answer parks the send'
);
select is(jsonb_array_length(public.claim_whatsapp_automation_enrollments('pgtap-69', 10)), 0, 'AMBIGUITY: a parked send is never re-claimed');
reset role;

select is(
  (select m.direction || ':' || m.provider_message_type || ':' || (m.content -> 'automation' ->> 'enrollment_id')
     from public.whatsapp_messages m where m.provider_message_id = 'wamid.69ASHA'),
  'outbound:template:' || current_setting('test.e_asha'), 'BIND: the send is canonical outbound history with its automation origin'
);
select is((select count(*)::integer from public.whatsapp_message_automation_attributions where enrollment_id = current_setting('test.e_asha')::uuid), 1, 'BIND: attributed exactly once');
select ok(
  private.whatsapp_campaign_frequency_capped('c6900000-0000-4000-8000-000000000001', (select p from public.whatsapp_marketing_send_policies p where version = 2), clock_timestamp()),
  'CAPS: an automation send counts against the contact''s marketing frequency cap'
);
select ok(
  private.whatsapp_campaign_frequency_capped('c6900000-0000-4000-8000-000000000004', (select p from public.whatsapp_marketing_send_policies p where version = 2), clock_timestamp()),
  'CAPS: an in-flight ambiguous automation send also counts'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.resolve_whatsapp_automation_reconcile(current_setting('test.e_kiran')::uuid, 'not_sent', 'Checked Meta, nothing delivered')$$,
  '42501', 'WHATSAPP_AUTOMATION_RECONCILE_DENIED', 'RECONCILE: a Sales Manager cannot resolve ambiguity'
);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000001', true);
select is(
  public.resolve_whatsapp_automation_reconcile(current_setting('test.e_kiran')::uuid, 'not_sent', 'Checked Meta, nothing delivered') ->> 'outcome',
  'failed', 'RECONCILE: a Super Admin records an audited decision; nothing is re-queued'
);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select is(
  public.set_whatsapp_automation_status(current_setting('test.a')::uuid, 'pause', (select lock_version from public.whatsapp_automations where id = current_setting('test.a')::uuid)) ->> 'status',
  'paused', 'PAUSE: pausing is never gated'
);
select is(
  public.set_whatsapp_automation_status(current_setting('test.a')::uuid, 'archive', (select lock_version from public.whatsapp_automations where id = current_setting('test.a')::uuid)) ->> 'status',
  'archived', 'ARCHIVE: archiving is never gated'
);
reset role;
select throws_ok($$update public.whatsapp_automation_events set event_type = 'rewritten'$$, NULL, 'WHATSAPP_APPEND_ONLY', 'EVIDENCE: automation events are append-only');

-- =============================================================================
-- 5. Replies to automation sends, Flow responses, CTWA referrals
-- =============================================================================

select set_config('test.conv_asha', (select conversation_id::text from public.whatsapp_messages where provider_message_id = 'wamid.69ASHA'), true);
select set_config('test.flow_token', private.whatsapp_mint_flow_token(current_setting('test.flow')::uuid, 'automation', null, null, null,
  (select id from public.whatsapp_automation_enrollments where automation_id = current_setting('test.a')::uuid and contact_id = 'c6900000-0000-4000-8000-000000000001'), 0), true);
insert into public.whatsapp_messages (id, conversation_id, provider_message_id, direction, provider_message_type, normalized_message_type, sender_e164, recipient_e164, body_text, content, context_provider_message_id, provider_timestamp, latest_status) values
  ('e6900000-0000-4000-8000-000000000021', current_setting('test.conv_asha')::uuid, 'wamid.69ASHA-R', 'inbound', 'text', 'text', '+919769000001', '+919769000099', 'Thank you', '{}'::jsonb, 'wamid.69ASHA', clock_timestamp() + interval '2 minutes', 'received'),
  ('e6900000-0000-4000-8000-000000000022', current_setting('test.conv_asha')::uuid, 'wamid.69FLOW', 'inbound', 'interactive', 'interactive', '+919769000001', '+919769000099', null,
    jsonb_build_object('type', 'nfm_reply', 'nfm_reply', jsonb_build_object('name', 'flow', 'body', 'Sent',
      'response_json', jsonb_build_object('flow_token', current_setting('test.flow_token'), 'budget', '6-12l', 'locality', 'Indiranagar', 'notes', 'private note')::text)),
    null, clock_timestamp() + interval '3 minutes', 'received'),
  ('e6900000-0000-4000-8000-000000000023', current_setting('test.conv_asha')::uuid, 'wamid.69FLOWX', 'inbound', 'interactive', 'interactive', '+919769000001', '+919769000099', null,
    jsonb_build_object('type', 'nfm_reply', 'nfm_reply', jsonb_build_object('name', 'flow', 'body', 'Sent', 'response_json', '{"flow_token":"unused","budget":"30l-plus"}')),
    null, clock_timestamp() + interval '4 minutes', 'received');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(public.record_whatsapp_inbound_evidence('e6900000-0000-4000-8000-000000000021') ->> 'reply', 'exact_context', 'REPLY: a reply to an automation send is attributed exactly');
select is(public.record_whatsapp_inbound_evidence('e6900000-0000-4000-8000-000000000022') ->> 'flow_response', 'applied', 'FLOW: a completed Flow with a known token is captured and applied');
select is(public.record_whatsapp_inbound_evidence('e6900000-0000-4000-8000-000000000023') ->> 'flow_response', 'unmatched_flow', 'FLOW: an unknown token is kept as unmatched evidence only');
reset role;

select is((select source_kind || ':' || enrollment_id::text from public.whatsapp_reply_attributions where inbound_message_id = 'e6900000-0000-4000-8000-000000000021'),
  'automation:' || current_setting('test.e_asha'), 'REPLY: the attribution names the automation enrollment');
select is(
  (select response_fields::text || '|' || unmapped_key_count || '|' || array_to_string(crm_applied_fields, ',') from public.whatsapp_flow_responses where message_id = 'e6900000-0000-4000-8000-000000000022'),
  '{"budget": "6-12l", "locality": "Indiranagar"}|1|budget_comfort_code', 'FLOW: only mapped answers are stored; an unmapped free-text answer is counted, not kept'
);
select is(
  (select locality || '|' || budget_comfort_code from public.leads where id = 'b6900000-0000-4000-8000-000000000001'),
  'whitefield|6-12l', 'CRM: an empty budget band is filled; the existing locality is never overwritten'
);
select is((select response_fields from public.whatsapp_flow_responses where message_id = 'e6900000-0000-4000-8000-000000000023'), '{}'::jsonb, 'FLOW: unmatched responses keep no answers');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok($$select public.record_whatsapp_referral_context('e6900000-0000-4000-8000-000000000012', '{}'::jsonb)$$, '42501', NULL, 'CTWA: staff sessions cannot write referral context');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.record_whatsapp_referral_context('e6900000-0000-4000-8000-000000000012',
    '{"source_type":"ad","source_id":"120210000000001","source_url":"https://fb.me/abcXYZ?x=1","headline":"Modular kitchens","body":"Book a visit","media_type":"image","image_url":"https://scontent.xx.fbcdn.net/secret","ctwa_clid":"ARAkLx_1-2.3"}'::jsonb) ->> 'outcome',
  'recorded', 'CTWA: referral metadata beside an inbound message is recorded'
);
select is(public.record_whatsapp_referral_context('e6900000-0000-4000-8000-000000000012', '{"source_type":"ad"}'::jsonb) ->> 'outcome', 'already_recorded', 'CTWA: replays record once');
reset role;
select is(
  (select source_type || '|' || source_id || '|' || source_url_host || '|' || (source_url_hash ~ '^[0-9a-f]{64}$')::text || '|' || ctwa_clid || '|' || (lead_id is not null)::text
     from public.whatsapp_referral_contexts where message_id = 'e6900000-0000-4000-8000-000000000012'),
  'ad|120210000000001|fb.me|true|ARAkLx_1-2.3|true', 'CTWA: host and hash only, click id kept, lead joined through the existing conversation link'
);
select ok(
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_referral_contexts' and column_name in ('source_url', 'image_url', 'video_url', 'thumbnail_url')),
  'CTWA: no column can hold a raw source URL or Meta CDN media URL'
);
select is(
  (select count(*)::integer from public.consent_events where contact_id = 'c6900000-0000-4000-8000-000000000002' and event_type = 'granted'),
  1, 'CTWA: ad metadata never creates consent'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000002', true);
select is(
  (public.get_whatsapp_automation_analytics(null, null) -> 'automations' -> 0 ->> 'sent')::integer,
  1, 'ANALYTICS: the automation funnel counts the one bound send'
);
select is((public.get_whatsapp_referral_analytics(null, null) ->> 'total_referrals')::integer, 1, 'ANALYTICS: CTWA referrals are aggregated');
select set_config('request.jwt.claim.sub', 'a6900001-0000-4000-8000-000000000003', true);
select throws_ok($$select public.get_whatsapp_referral_analytics(null, null)$$, '42501', 'WHATSAPP_ANALYTICS_DENIED', 'ANALYTICS: a Sales Executive sees no referral analytics');
select is((select count(*)::integer from public.whatsapp_referral_contexts), 0, 'RLS: a Sales Executive reads no referral rows');
reset role;

select * from finish();
rollback;
