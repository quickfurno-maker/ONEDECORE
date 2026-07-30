-- ONEDECORE Phase 5B CRM Identity & Core Foundation pgTAP tests

begin;
select plan(37);

-- Schema objects
select has_table('public', 'lead_sources', 'lead_sources exists');
select has_table('public', 'lead_closure_reasons', 'lead_closure_reasons exists');
select has_table('public', 'lead_source_touchpoints', 'lead_source_touchpoints exists');
select has_table('public', 'lead_assignment_history', 'lead_assignment_history exists');
select has_table('public', 'lead_notes', 'lead_notes exists');
select has_table('public', 'lead_follow_ups', 'lead_follow_ups exists');
select has_table('public', 'lead_activities', 'lead_activities exists');

select results_eq(
  $$select count(*)::integer from public.lead_sources where is_active = true$$,
  array[21],
  '21 active seeded lead sources'
);

select results_eq(
  $$select count(*)::integer from public.roles where is_system = true and code in ('sales_manager','sales_executive','project_manager')$$,
  array[3],
  'three canonical Phase 5B roles exist'
);

-- Synthetic staff users
insert into auth.users (id, instance_id, email, aud, role) values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa@example.test', 'authenticated', 'authenticated'),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr@example.test', 'authenticated', 'authenticated'),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'execa@example.test', 'authenticated', 'authenticated'),
  ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'execb@example.test', 'authenticated', 'authenticated'),
  ('a5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'pm@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444',
  'a5555555-5555-5555-5555-555555555555'
);

insert into public.user_roles (user_id, role_id)
select 'a1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'a2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'a3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'a4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'a5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';

-- Create two leads via intake RPC
select * from public.submit_lead_intake(
  p_idempotency_key => 'b1111111-1111-1111-1111-111111111111'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Lead Alpha',
  p_phone_e164 => '+919111111111',
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
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select * from public.submit_lead_intake(
  p_idempotency_key => 'b2222222-2222-2222-2222-222222222222'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Lead Beta',
  p_phone_e164 => '+919222222222',
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
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

-- Manager sees all leads
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[2],
  'sales manager sees all leads including unassigned'
);

-- Executive cannot see unassigned leads
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[0],
  'sales executive sees zero unassigned leads'
);

-- PM denied general lead access
select set_config('request.jwt.claim.sub', 'a5555555-5555-5555-5555-555555555555', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[0],
  'project manager denied general CRM lead access'
);

-- Assign lead Alpha to executive A as manager
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select status::text from public.assign_lead(
    (select id from public.leads where submitted_name = 'Lead Alpha' limit 1),
    'a3333333-3333-3333-3333-333333333333'::uuid,
    'manager',
    'initial assignment'
  )$$,
  array['assigned'],
  'manager assigns lead to executive A and status becomes assigned'
);

select results_eq(
  $$select count(*)::integer from public.lead_assignment_history$$,
  array[1],
  'exactly one assignment history row after successful assign'
);

-- Executive A sees only assigned lead
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[1],
  'executive A sees only assigned lead'
);

-- Executive B cannot see A's lead
select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[0],
  'executive B cannot see executive A lead'
);

-- Executive cannot assign
select throws_ok(
  $$select public.assign_lead((select id from public.leads where submitted_name = 'Lead Beta' limit 1), 'a4444444-4444-4444-4444-444444444444'::uuid, 'manual', null)$$,
  '42501',
  null,
  'sales executive cannot assign leads'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.lead_assignment_history$$,
  array[1],
  'failed assign attempt records no additional history'
);

-- Executive A can transition assigned lead
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select status::text from public.transition_lead_status(
    (select id from public.leads where submitted_name = 'Lead Alpha' limit 1),
    'contacted',
    null,
    null
  )$$,
  array['contacted'],
  'executive can transition assigned lead to contacted'
);

-- Closed-won blocked
select throws_ok(
  $$select public.transition_lead_status((select id from public.leads where submitted_name = 'Lead Alpha' limit 1), 'closed_won', null, null)$$,
  'P0001',
  null,
  'closed_won blocked without quotation acceptance'
);

-- Closed-lost requires reason
select throws_ok(
  $$select public.transition_lead_status((select id from public.leads where submitted_name = 'Lead Alpha' limit 1), 'closed_lost', null, null)$$,
  '22023',
  null,
  'closed_lost requires reason note'
);

select results_eq(
  $$select status::text from public.transition_lead_status(
    (select id from public.leads where submitted_name = 'Lead Alpha' limit 1),
    'closed_lost',
    'Budget mismatch after consultation',
    'price'
  )$$,
  array['closed_lost'],
  'closed_lost succeeds with reason and code'
);

-- Direct status update denied on Beta
select throws_ok(
  $$update public.leads set status = 'new' where submitted_name = 'Lead Beta'$$,
  '42501',
  null,
  'direct status update bypass denied'
);

-- Super admin sees all
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[2],
  'super admin sees all leads'
);

-- Sources: manager cannot mutate
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$update public.lead_sources set display_name = 'Hacked' where code = 'website'$$,
  '42501',
  null,
  'sales manager cannot mutate lead sources'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select ok(
  (select public.authorize('sources.manage')) = true,
  'super admin authorized for sources.manage'
);

-- Executive can read active sources
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer from public.lead_sources where is_active = true$$,
  array[21],
  'sales executive can read active lead sources'
);

-- Notes on assigned lead (use Beta assigned first)
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select public.assign_lead(
  (select id from public.leads where submitted_name = 'Lead Beta' limit 1),
  'a3333333-3333-3333-3333-333333333333'::uuid,
  'manager',
  null
);

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

insert into public.lead_notes (lead_id, body)
select id, 'Follow-up call completed' from public.leads where submitted_name = 'Lead Beta' limit 1;

select results_eq(
  $$select count(*)::integer from public.lead_notes$$,
  array[1],
  'executive can insert note on assigned lead'
);

-- Cross-executive note denied (use session-stored lead id; subquery would return zero rows for B)
reset role;
select set_config(
  'test.lead_beta_id',
  (select id::text from public.leads where submitted_name = 'Lead Beta' limit 1),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$insert into public.lead_notes (lead_id, body) values (current_setting('test.lead_beta_id')::uuid, 'spy')$$,
  '42501',
  null,
  'executive B cannot insert note on A lead'
);

-- Anon denied CRM tables (no SELECT grant — must error, not return zero rows)
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select count(*)::integer from public.leads$$,
  '42501',
  null,
  'anon denied leads select'
);

select throws_ok(
  $$select count(*)::integer from public.lead_sources$$,
  '42501',
  null,
  'anon denied lead_sources select'
);

-- RPC exposure
reset role;

select results_eq(
  $$select has_function_privilege('authenticated', 'public.assign_lead(uuid,uuid,text,text)', 'execute')$$,
  array[true],
  'authenticated can execute assign_lead wrapper'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.assign_lead(uuid,uuid,text,text)', 'execute')$$,
  array[false],
  'anon cannot execute assign_lead'
);

select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'assign_lead'$$,
  array[false],
  'assign_lead public wrapper is SECURITY INVOKER'
);

select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'assign_lead_impl'$$,
  array[true],
  'assign_lead_impl is SECURITY DEFINER'
);

-- Legacy sales role retains assignment-scoped read (no leads.read)
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'sales' and p.code = 'leads.read'$$,
  array[0],
  'legacy sales role no longer has broad leads.read'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'super_admin' and p.code = 'portfolio.manage'$$,
  array[1],
  'portfolio permissions preserved for super_admin'
);

select * from finish();
rollback;
