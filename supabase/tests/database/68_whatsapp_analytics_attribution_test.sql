-- ONEDECORE WM-5 — analytics and attribution from canonical evidence, proved
-- against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. whatsapp.analytics.read is Super Admin + Sales Manager; export is Super
--    Admin only; tokens and click events are closed to every staff session.
-- 2. Tracked URL buttons: the spec cannot freeze until every dynamic button is
--    bound to an allowlisted https destination; claims mint one opaque token per
--    recipient and store only its hash; the redirect RPC is service-role only
--    and answers unknown tokens exactly like malformed ones.
-- 3. Reply attribution is exact by inbound context first; inference is limited
--    to the first reply within 72 hours of a governed send, and labelled.
-- 4. The funnel counts only evidence: status events, non-bot clicks, reply
--    attributions, CRM lead events; export is minimised and audited.

begin;
select plan(47);

-- =============================================================================
-- Fixtures — a68 / b68 / c68 / d68 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6800001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '68-sa@example.test', 'authenticated', 'authenticated'),
  ('a6800001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '68-sm@example.test', 'authenticated', 'authenticated'),
  ('a6800001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '68-se@example.test', 'authenticated', 'authenticated'),
  ('a6800001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '68-mgmt@example.test', 'authenticated', 'authenticated');
update public.profiles set status = 'active' where id::text like 'a6800001-%';
insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id from (values
  ('a6800001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6800001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6800001-0000-4000-8000-000000000003', 'sales_executive'),
  ('a6800001-0000-4000-8000-000000000004', 'management')
) as v(user_id, role_code) join public.roles r on r.code = v.role_code;

insert into public.contacts (id, display_name, status) values
  ('c6800000-0000-4000-8000-000000000001', 'Asha Rao', 'active'),
  ('c6800000-0000-4000-8000-000000000002', 'Ravi Kumar', 'active');
insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('c6800000-0000-4000-8000-000000000001', 'whatsapp', '+919768000001', true, 'active'),
  ('c6800000-0000-4000-8000-000000000002', 'whatsapp', '+919768000002', true, 'active');
insert into public.leads (id, submission_reference, contact_id, submitted_name, status, source, primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality)
select v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, 'WM5 Lead', 'qualified', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner', 'whitefield'
from (values
  ('b6800000-0000-4000-8000-000000000001', 'c6800000-0000-4000-8000-000000000001'),
  ('b6800000-0000-4000-8000-000000000002', 'c6800000-0000-4000-8000-000000000002')
) as v(lead_id, contact_id);
insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at)
select v.contact_id::uuid, 'MARKETING', 'whatsapp', 'granted', 'marketing-v1', 'notice-v1', 'local-test', 'staff', now() - interval '10 days'
from (values ('c6800000-0000-4000-8000-000000000001'), ('c6800000-0000-4000-8000-000000000002')) v(contact_id);

insert into public.whatsapp_business_accounts (id, waba_id, status) values ('d6800000-0000-4000-8000-000000000001', '900000000000681', 'active');
insert into public.whatsapp_phone_numbers (id, business_account_id, phone_number_id, display_phone_number, status)
values ('d6800000-0000-4000-8000-000000000002', 'd6800000-0000-4000-8000-000000000001', '900000000000682', '+91 97680 00099', 'active');
insert into public.whatsapp_templates (id, business_account_id, provider_template_id, name, language, category, status, parameter_format, components) values
  ('d6800000-0000-4000-8000-000000000011', 'd6800000-0000-4000-8000-000000000001', '168000000000001', 'designs_offer', 'en', 'MARKETING', 'APPROVED', 'POSITIONAL',
   '[{"type":"BODY","text":"Hi {{1}}, new kitchen designs are live."},{"type":"BUTTONS","buttons":[{"type":"QUICK_REPLY","text":"Stop promotions"},{"type":"URL","text":"See designs","url":"https://onedecore.in/w/c/{{1}}"}]}]'::jsonb),
  ('d6800000-0000-4000-8000-000000000012', 'd6800000-0000-4000-8000-000000000001', '168000000000002', 'bad_button', 'en', 'MARKETING', 'APPROVED', 'POSITIONAL',
   '[{"type":"BODY","text":"Hi"},{"type":"BUTTONS","buttons":[{"type":"URL","text":"Go","url":"https://onedecore.in/{{1}}/x"}]}]'::jsonb);
insert into public.whatsapp_template_snapshots (id, template_id, business_account_id, provider_template_id, name, language, category, parameter_format, components, content_hash, observed_status)
select v.id::uuid, t.id, t.business_account_id, t.provider_template_id, t.name, t.language, t.category, t.parameter_format, t.components, t.content_hash, 'APPROVED'
from (values ('d6800000-0000-4000-8000-000000000021', 'd6800000-0000-4000-8000-000000000011'), ('d6800000-0000-4000-8000-000000000022', 'd6800000-0000-4000-8000-000000000012')) v(id, template_id)
join public.whatsapp_templates t on t.id = v.template_id::uuid;

insert into public.whatsapp_marketing_send_policies (version, execution_enabled, frequency_rules, quiet_hours, timezone, effective_from, set_by)
values (1, true, '[{"windowHours":24,"maxMessages":3}]'::jsonb,
  jsonb_build_object('startLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '2 hours', 'HH24:MI'), 'endLocal', to_char((now() at time zone 'Asia/Kolkata') + interval '3 hours', 'HH24:MI')),
  'Asia/Kolkata', now() - interval '1 day', 'a6800001-0000-4000-8000-000000000001');

-- =============================================================================
-- 1. Matrix and catalogue
-- =============================================================================

select results_eq(
  $$select r.code || ':' || p.code from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id
     where p.code in ('whatsapp.analytics.read', 'whatsapp.reports.export') order by 1$$,
  array['sales_manager:whatsapp.analytics.read', 'super_admin:whatsapp.analytics.read', 'super_admin:whatsapp.reports.export'],
  'MATRIX: analytics SA+SM, export Super Admin only, no executive or legacy grant'
);
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c where c.oid in (
    'public.whatsapp_click_destinations'::regclass, 'public.whatsapp_click_tokens'::regclass, 'public.whatsapp_click_events'::regclass,
    'public.whatsapp_reply_attributions'::regclass, 'public.whatsapp_report_exports'::regclass)),
  'CATALOGUE: WM-5 tables have RLS enabled and forced'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_click_tokens', 'SELECT') and not has_table_privilege('authenticated', 'public.whatsapp_click_events', 'SELECT')
  and not has_table_privilege('anon', 'public.whatsapp_click_destinations', 'SELECT'),
  'CATALOGUE: token hashes and click events are closed to every staff session and anon'
);
select ok(
  not exists (select 1 from unnest(array['public.whatsapp_click_destinations','public.whatsapp_click_tokens','public.whatsapp_click_events','public.whatsapp_reply_attributions','public.whatsapp_report_exports']) t(name)
    where has_table_privilege('authenticated', t.name, 'INSERT') or has_table_privilege('authenticated', t.name, 'UPDATE') or has_table_privilege('service_role', t.name, 'INSERT')),
  'CATALOGUE: no direct DML; every write is an RPC'
);
select is(private.whatsapp_marketing_template_send_problem((select components from public.whatsapp_template_snapshots where id = 'd6800000-0000-4000-8000-000000000021'), 'POSITIONAL'), null, 'TEMPLATE: a URL button ending in {{1}} is a governed marketing send');
select is(private.whatsapp_marketing_template_send_problem((select components from public.whatsapp_template_snapshots where id = 'd6800000-0000-4000-8000-000000000022'), 'POSITIONAL'), 'button_parameters_unsupported', 'TEMPLATE: a variable anywhere but the URL suffix is refused');
select is(private.whatsapp_template_staff_send_problem((select components from public.whatsapp_template_snapshots where id = 'd6800000-0000-4000-8000-000000000021'), 'POSITIONAL'), 'button_parameters_unsupported', 'TEMPLATE: the one-to-one staff lane still refuses dynamic buttons');

-- =============================================================================
-- 2. Destinations, spec binding and freeze
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000002', true);
select throws_ok($$select public.save_whatsapp_click_destination(null, 'Kitchens', 'https://onedecore.in/kitchens', true)$$, '42501', 'WHATSAPP_SETTINGS_DENIED', 'DESTINATION: a Sales Manager cannot allowlist a redirect');
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000001', true);
select throws_ok($$select public.save_whatsapp_click_destination(null, 'Plain http', 'http://onedecore.in/kitchens', true)$$, '22023', 'WHATSAPP_CLICK_DESTINATION_VALIDATION', 'DESTINATION: http is refused');
select throws_ok($$select public.save_whatsapp_click_destination(null, 'Credentials', 'https://user@evil.example/x', true)$$, '22023', 'WHATSAPP_CLICK_DESTINATION_VALIDATION', 'DESTINATION: userinfo is refused');
select throws_ok($$select public.save_whatsapp_click_destination(null, 'Ip literal', 'https://127.0.0.1/x', true)$$, '22023', 'WHATSAPP_CLICK_DESTINATION_VALIDATION', 'DESTINATION: an IP literal is refused');
select lives_ok(
  $$select set_config('test.dest', public.save_whatsapp_click_destination(null, 'Kitchens', 'https://onedecore.in/kitchens?utm_source=whatsapp', true) ->> 'destination_id', true)$$,
  'DESTINATION: a Super Admin allowlists an https destination'
);

select lives_ok($$
  select set_config('test.v', (public.create_campaign_draft(
    'WM5 Designs', 'Kitchen designs', 'direct_or_custom', array['whatsapp'], null,
    '{"currency":"INR","daily_budget_paise":0,"total_budget_paise":null}'::jsonb,
    '{"headline":"Designs","primary_text":"WhatsApp","call_to_action":"See designs","media_references":[]}'::jsonb,
    jsonb_build_object('start_date', to_char(now(), 'YYYY-MM-DD'), 'end_date', null),
    '{"logic":"and","rules":[{"field":"locality","operator":"equals","values":["whitefield"]}]}'::jsonb,
    gen_random_uuid()) ->> 'campaign_version_id'), true);
  select public.save_whatsapp_campaign_spec(current_setting('test.v')::uuid, 'd6800000-0000-4000-8000-000000000021', 'design_inspiration', '{}'::jsonb, '{"body":{"1":"contact_first_name"}}'::jsonb);
$$, 'SPEC: a Super Admin drafts a WhatsApp version with a tracked-link template');

select throws_ok(
  $$select public.request_campaign_approval(current_setting('test.v')::uuid, (select lock_version from public.campaign_versions where id = current_setting('test.v')::uuid), gen_random_uuid())$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_INVALID: button_binding_missing', 'FREEZE: a spec with an unmapped tracked button cannot be submitted'
);
select throws_ok(
  $$select public.set_whatsapp_campaign_spec_button_bindings(current_setting('test.v')::uuid, '{"0":{"kind":"click_destination","destination_id":"00000000-0000-4000-8000-000000000000"}}'::jsonb)$$,
  '22023', 'WHATSAPP_CAMPAIGN_SPEC_INVALID: button_binding_unexpected', 'BINDING: only the template''s dynamic buttons can be bound'
);
select is(
  public.set_whatsapp_campaign_spec_button_bindings(current_setting('test.v')::uuid, jsonb_build_object('1', jsonb_build_object('kind', 'click_destination', 'destination_id', current_setting('test.dest')))) ->> 'complete',
  'true', 'BINDING: the URL button is bound to the allowlisted destination'
);
select lives_ok($$
  select public.request_campaign_approval(current_setting('test.v')::uuid, (select lock_version from public.campaign_versions where id = current_setting('test.v')::uuid), gen_random_uuid());
  select public.decide_campaign_version(current_setting('test.v')::uuid, 'approved', 'Compliant', gen_random_uuid());
$$, 'FREEZE: submission freezes the bound spec and the version is approved');

select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000002', true);
select lives_ok($$select set_config('test.r', public.create_whatsapp_campaign_run(current_setting('test.v')::uuid) ->> 'run_id', true)$$, 'RUN: the independent Sales Manager schedules the run');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('test.mat', public.materialize_due_whatsapp_campaign_runs(10)::text, true);
select set_config('test.claim', public.claim_whatsapp_campaign_dispatch_jobs('pgtap-68', 10)::text, true);
reset role;

select is(jsonb_array_length(current_setting('test.claim')::jsonb), 2, 'CLAIM: both recipients are claimed');
select ok(
  (select bool_and(
     e -> 'template_components' -> 1 ->> 'type' = 'button' and e -> 'template_components' -> 1 ->> 'sub_type' = 'url'
     and e -> 'template_components' -> 1 ->> 'index' = '1'
     and (e -> 'template_components' -> 1 -> 'parameters' -> 0 ->> 'text') ~ '^[A-Za-z0-9_-]{43}$')
   from jsonb_array_elements(current_setting('test.claim')::jsonb) e),
  'CLAIM: each send carries an opaque 43-character token as the URL button parameter'
);
select is(
  (select count(*)::integer from public.whatsapp_click_tokens t join jsonb_array_elements(current_setting('test.claim')::jsonb) e
     on t.token_hash = e -> 'template_components' -> 1 -> 'parameters' -> 0 ->> 'text'),
  0, 'CLAIM: the raw token is never stored'
);
select is(
  (select count(distinct t.recipient_id)::integer from public.whatsapp_click_tokens t where t.run_id = current_setting('test.r')::uuid and t.purpose = 'campaign'),
  2, 'CLAIM: one hashed token per recipient, bound to the run and recipient'
);

select set_config('test.job_a', (select e ->> 'job_id' from jsonb_array_elements(current_setting('test.claim')::jsonb) e join public.whatsapp_campaign_recipients r on r.id = (e ->> 'recipient_id')::uuid where r.contact_id = 'c6800000-0000-4000-8000-000000000001'), true);
select set_config('test.job_b', (select e ->> 'job_id' from jsonb_array_elements(current_setting('test.claim')::jsonb) e join public.whatsapp_campaign_recipients r on r.id = (e ->> 'recipient_id')::uuid where r.contact_id = 'c6800000-0000-4000-8000-000000000002'), true);
select set_config('test.token_a', (select e -> 'template_components' -> 1 -> 'parameters' -> 0 ->> 'text' from jsonb_array_elements(current_setting('test.claim')::jsonb) e where e ->> 'job_id' = current_setting('test.job_a')), true);

set local role service_role;
select lives_ok($$
  select public.mark_whatsapp_campaign_provider_request_started(e.job_id, e.tok) from (
    select (x ->> 'job_id')::uuid job_id, (x ->> 'claim_token')::uuid tok from jsonb_array_elements(current_setting('test.claim')::jsonb) x) e;
  select public.complete_whatsapp_campaign_dispatch_success(current_setting('test.job_a')::uuid,
    (select (x ->> 'claim_token')::uuid from jsonb_array_elements(current_setting('test.claim')::jsonb) x where x ->> 'job_id' = current_setting('test.job_a')), 'wamid.68A', now() - interval '2 hours', '{}'::jsonb);
  select public.complete_whatsapp_campaign_dispatch_success(current_setting('test.job_b')::uuid,
    (select (x ->> 'claim_token')::uuid from jsonb_array_elements(current_setting('test.claim')::jsonb) x where x ->> 'job_id' = current_setting('test.job_b')), 'wamid.68B', now() - interval '2 hours', '{}'::jsonb);
$$, 'BIND: both sends bind into canonical history');
reset role;

-- =============================================================================
-- 3. Clicks
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000001', true);
select throws_ok($$select public.record_whatsapp_click(current_setting('test.token_a'), 'browser')$$, '42501', NULL, 'CLICK: no staff session can record or resolve a click');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(public.record_whatsapp_click(current_setting('test.token_a'), 'browser') ->> 'destination_url', 'https://onedecore.in/kitchens?utm_source=whatsapp', 'CLICK: a valid token resolves to its allowlisted destination');
select is(public.record_whatsapp_click(current_setting('test.token_a'), 'bot') ->> 'destination_url', 'https://onedecore.in/kitchens?utm_source=whatsapp', 'CLICK: a link-preview fetch still redirects');
select is(public.record_whatsapp_click('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'browser'), '{"destination_url": null}'::jsonb, 'NO ORACLE: an unknown well-formed token answers null');
select is(public.record_whatsapp_click('not-a-token', 'browser'), '{"destination_url": null}'::jsonb, 'NO ORACLE: a malformed token answers exactly the same');
reset role;

-- =============================================================================
-- 4. Delivery evidence, replies, CRM conversion, opt-out
-- =============================================================================

insert into public.whatsapp_message_status_events (event_key, event_hash, envelope_hash, provider_message_id, message_id, status, provider_timestamp)
select 'status:68:' || v.pmid || ':' || v.status, md5(v.pmid || v.status) || md5(v.status || v.pmid), md5('env' || v.pmid) || md5(v.status), v.pmid,
  (select id from public.whatsapp_messages where provider_message_id = v.pmid), v.status, now() - v.age
from (values ('wamid.68A', 'sent', interval '119 minutes'), ('wamid.68A', 'delivered', interval '118 minutes'), ('wamid.68A', 'read', interval '117 minutes'), ('wamid.68B', 'sent', interval '119 minutes')) v(pmid, status, age);

select set_config('test.conv_a', (select conversation_id::text from public.whatsapp_messages where provider_message_id = 'wamid.68A'), true);
select set_config('test.conv_b', (select conversation_id::text from public.whatsapp_messages where provider_message_id = 'wamid.68B'), true);

insert into public.whatsapp_messages (id, conversation_id, provider_message_id, direction, provider_message_type, normalized_message_type, sender_e164, recipient_e164, body_text, content, context_provider_message_id, provider_timestamp, latest_status) values
  ('e6800000-0000-4000-8000-000000000001', current_setting('test.conv_a')::uuid, 'wamid.68A-R1', 'inbound', 'text', 'text', '+919768000001', '+919768000099', 'Love these', '{}'::jsonb, 'wamid.68A', now() - interval '100 minutes', 'received'),
  ('e6800000-0000-4000-8000-000000000002', current_setting('test.conv_a')::uuid, 'wamid.68A-R2', 'inbound', 'text', 'text', '+919768000001', '+919768000099', 'Also price?', '{}'::jsonb, null, now() - interval '90 minutes', 'received'),
  ('e6800000-0000-4000-8000-000000000003', current_setting('test.conv_b')::uuid, 'wamid.68B-R1', 'inbound', 'text', 'text', '+919768000002', '+919768000099', 'Call me', '{}'::jsonb, null, now() - interval '60 minutes', 'received'),
  ('e6800000-0000-4000-8000-000000000004', current_setting('test.conv_b')::uuid, 'wamid.68B-R2', 'inbound', 'text', 'text', '+919768000002', '+919768000099', 'Re: old', '{}'::jsonb, 'wamid.UNRELATED', now() - interval '50 minutes', 'received');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok($$select public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000001')$$, '42501', NULL, 'REPLY: staff sessions cannot write attribution');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000001') ->> 'reply', 'exact_context', 'REPLY: a reply to the campaign message itself is exact');
select is(public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000001') ->> 'reply', 'already_attributed', 'REPLY: attribution is idempotent under webhook replay');
select is(public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000002') ->> 'reply', 'not_first_reply', 'INFERENCE: a later message in the same conversation is conversation, not response');
select is(public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000003') ->> 'reply', 'inferred_window', 'INFERENCE: the first reply within 72h of a governed send is attributed and labelled inferred');
select is(public.record_whatsapp_inbound_evidence('e6800000-0000-4000-8000-000000000004') ->> 'reply', 'context_not_attributable', 'INFERENCE: a context id pointing elsewhere is never re-inferred');
reset role;

insert into public.lead_events (lead_id, event_type, actor_type, event_data, occurred_at)
values ('b6800000-0000-4000-8000-000000000001', 'lead.status_changed', 'system', '{"from":"qualified","to":"consultation_scheduled"}'::jsonb, now() - interval '30 minutes');
insert into public.consent_events (contact_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type, occurred_at)
values ('c6800000-0000-4000-8000-000000000002', 'MARKETING', 'whatsapp', 'withdrawn', 'customer-opt-out-v1', 'customer-opt-out-v1', 'local-test', 'system', now() - interval '20 minutes');

-- =============================================================================
-- 5. Read models and export
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000003', true);
select throws_ok($$select public.get_whatsapp_analytics_overview(null, null)$$, '42501', 'WHATSAPP_ANALYTICS_DENIED', 'ANALYTICS: a Sales Executive has no analytics');
select is((select count(*)::integer from public.whatsapp_reply_attributions), 0, 'RLS: a Sales Executive reads no reply attribution rows');
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000004', true);
select throws_ok($$select public.get_whatsapp_campaign_run_analytics(current_setting('test.r')::uuid)$$, '42501', 'WHATSAPP_ANALYTICS_DENIED', 'ANALYTICS: legacy management has no analytics');

select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000002', true);
select set_config('test.funnel', (public.get_whatsapp_analytics_overview(null, null) -> 'campaign_funnel')::text, true);
select is(
  (select jsonb_build_object('sent', f -> 'sent', 'delivered', f -> 'delivered', 'read', f -> 'read', 'clicked', f -> 'clicked', 'replied', f -> 'replied',
     'replied_exact', f -> 'replied_exact', 'replied_inferred', f -> 'replied_inferred', 'consultation', f -> 'consultation', 'quotation', f -> 'quotation',
     'booking', f -> 'booking', 'opted_out', f -> 'opted_out') from (select current_setting('test.funnel')::jsonb f) x),
  '{"sent":2,"delivered":1,"read":1,"clicked":1,"replied":2,"replied_exact":1,"replied_inferred":1,"consultation":1,"quotation":0,"booking":0,"opted_out":1}'::jsonb,
  'FUNNEL: a Sales Manager sees only evidence-backed counts (no status invented for the unread send, bot click excluded)'
);
select is(
  (public.get_whatsapp_campaign_run_analytics(current_setting('test.r')::uuid) -> 'clicks_by_destination' -> 0 ->> 'recipients')::integer,
  1, 'RUN: clicks are grouped by destination with distinct recipients'
);
select is((public.get_whatsapp_campaign_run_analytics(current_setting('test.r')::uuid) ->> 'bot_clicks')::integer, 1, 'RUN: link-preview clicks are counted separately');
select throws_ok($$select public.export_whatsapp_campaign_run_report(current_setting('test.r')::uuid)$$, '42501', 'WHATSAPP_REPORT_EXPORT_DENIED', 'EXPORT: a Sales Manager cannot export per-recipient rows');

select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000001', true);
select set_config('test.export', public.export_whatsapp_campaign_run_report(current_setting('test.r')::uuid)::text, true);
select is(jsonb_array_length(current_setting('test.export')::jsonb -> 'rows'), 2, 'EXPORT: a Super Admin exports one row per recipient');
select ok(
  (select bool_and(not (r ? 'recipient_e164') and not (r ? 'display_name') and length(r ->> 'phone_last4') = 4) from jsonb_array_elements(current_setting('test.export')::jsonb -> 'rows') r),
  'EXPORT: rows are minimised: no name, no full number'
);
reset role;
select is((select count(*)::integer from public.whatsapp_report_exports where run_id = current_setting('test.r')::uuid and exported_by = 'a6800001-0000-4000-8000-000000000001'), 1, 'EXPORT: every export is audited');

select throws_ok($$update public.whatsapp_reply_attributions set method = 'exact_context'$$, NULL, 'WHATSAPP_APPEND_ONLY', 'EVIDENCE: reply attributions are append-only');
select throws_ok($$delete from public.whatsapp_click_tokens$$, NULL, 'WHATSAPP_APPEND_ONLY', 'EVIDENCE: click tokens are append-only');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a6800001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.save_whatsapp_click_destination(current_setting('test.dest')::uuid, 'Kitchens', 'https://onedecore.in/elsewhere', true)$$,
  '22023', 'WHATSAPP_CLICK_DESTINATION_IN_USE', 'DESTINATION: a link already sent never changes where it goes'
);
reset role;

select * from finish();
rollback;
