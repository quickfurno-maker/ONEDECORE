-- ONEDECORE Phase 5C2A CRM assignment mutations pgTAP tests

begin;
select plan(16);

insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '5c2a-sa@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '5c2a-mgr@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '5c2a-execa@example.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '5c2a-execb@example.test', 'authenticated', 'authenticated'),
  ('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '5c2a-pm@example.test', 'authenticated', 'authenticated'),
  ('c7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', '5c2a-mgmt@example.test', 'authenticated', 'authenticated'),
  ('c9999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', '5c2a-scoped@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333',
  'c4444444-4444-4444-4444-444444444444',
  'c5555555-5555-5555-5555-555555555555',
  'c7777777-7777-7777-7777-777777777777',
  'c9999999-9999-9999-9999-999999999999'
);

insert into public.user_roles (user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'c2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'c3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'c7777777-7777-7777-7777-777777777777', id from public.roles where code = 'management';

insert into public.roles (code, name, description, is_system) values
  ('crm_assign_scoped_test', 'CRM Assign Scoped Test', 'Synthetic Phase 5C2A visibility role', false);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'crm_assign_scoped_test'
  and p.code in ('leads.assign', 'leads.read_assigned');

insert into public.user_roles (user_id, role_id)
select 'c9999999-9999-9999-9999-999999999999', id from public.roles where code = 'crm_assign_scoped_test';

select * from public.submit_lead_intake(
  p_idempotency_key => 'c1111111-1111-1111-1111-111111111111'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '5C2A Lead One',
  p_phone_e164 => '+919333333331',
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
  p_idempotency_key => 'c2222222-2222-2222-2222-222222222222'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '5C2A Lead Two',
  p_phone_e164 => '+919333333332',
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

select set_config('test.phase5c2a_lead_one', (select id::text from public.leads where submitted_name = '5C2A Lead One' limit 1), true);
select set_config('test.phase5c2a_lead_two', (select id::text from public.leads where submitted_name = '5C2A Lead Two' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_one')::uuid,
  'c3333333-3333-3333-3333-333333333333'::uuid,
  'Initial assignment note'
);

select results_eq(
  $$select status::text, assigned_to::text from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid$$,
  $$values ('assigned'::text, 'c3333333-3333-3333-3333-333333333333'::text)$$,
  'manager initial assignment sets assigned status'
);

select set_config('test.phase5c2a_updated_at', (select updated_at::text from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid), true);

select throws_ok(
  $$select public.assign_lead('00000000-0000-4000-8000-000000000001'::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null)$$,
  'P0002',
  null,
  'missing lead returns not-found signal'
);

select set_config('request.jwt.claim.sub', 'c9999999-9999-9999-9999-999999999999', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_one')::uuid, 'c4444444-4444-4444-4444-444444444444'::uuid, null)$$,
  'P0002',
  null,
  'inaccessible lead returns same not-found signal'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_two')::uuid, 'c4444444-4444-4444-4444-444444444444'::uuid, null)$$,
  '42501',
  null,
  'sales executive denied assignment operator permission'
);

select set_config('request.jwt.claim.sub', 'c5555555-5555-5555-5555-555555555555', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_two')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null)$$,
  '42501',
  null,
  'project manager denied assignment'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_two')::uuid, 'c2222222-2222-2222-2222-222222222222'::uuid, null)$$,
  '22023',
  null,
  'sales manager target rejected'
);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_one')::uuid,
  'c3333333-3333-3333-3333-333333333333'::uuid,
  null,
  'c3333333-3333-3333-3333-333333333333'::uuid,
  current_setting('test.phase5c2a_updated_at')::timestamptz,
  true
);

select results_eq(
  $$select count(*)::integer from public.lead_assignment_history where lead_id = current_setting('test.phase5c2a_lead_one')::uuid$$,
  array[1],
  'idempotent same assignee writes no new history'
);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_one')::uuid,
  'c4444444-4444-4444-4444-444444444444'::uuid,
  'Reassigning to executive B for workload balance',
  'c3333333-3333-3333-3333-333333333333'::uuid,
  current_setting('test.phase5c2a_updated_at')::timestamptz,
  true
);

select results_eq(
  $$select assigned_to::text, status::text from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid$$,
  $$values ('c4444444-4444-4444-4444-444444444444'::text, 'assigned'::text)$$,
  'reassignment preserves assigned status'
);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_one')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, 'short', null, null, false)$$,
  '22023',
  null,
  'reassignment short reason rejected'
);

select public.create_lead_follow_up(
  current_setting('test.phase5c2a_lead_one')::uuid,
  now() + interval '1 day',
  'c4444444-4444-4444-4444-444444444444'::uuid
);

select throws_ok(
  $$select public.assign_lead(
    current_setting('test.phase5c2a_lead_one')::uuid,
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'Attempting blocked reassignment due follow-up',
    'c4444444-4444-4444-4444-444444444444'::uuid,
    (select updated_at from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid),
    true
  )$$,
  '22023',
  null,
  'reassignment blocked by open follow-up owned by different user'
);

select public.complete_lead_follow_up(
  (select id from public.lead_follow_ups where lead_id = current_setting('test.phase5c2a_lead_one')::uuid and status = 'open' limit 1),
  'Completed before follow-up aligned reassignment'
);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_one')::uuid,
  'c3333333-3333-3333-3333-333333333333'::uuid,
  'Reassigning back to executive A after follow-up completion',
  'c4444444-4444-4444-4444-444444444444'::uuid,
  (select updated_at from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid),
  true
);

select public.create_lead_follow_up(
  current_setting('test.phase5c2a_lead_one')::uuid,
  now() + interval '2 day',
  'c3333333-3333-3333-3333-333333333333'::uuid
);

select throws_ok(
  $$select public.assign_lead(
    current_setting('test.phase5c2a_lead_one')::uuid,
    null,
    'Attempting unassign while follow-up remains open',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    (select updated_at from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid),
    true
  )$$,
  '22023',
  null,
  'unassign blocked by open follow-up'
);

select public.complete_lead_follow_up(
  (select id from public.lead_follow_ups where lead_id = current_setting('test.phase5c2a_lead_one')::uuid and status = 'open' limit 1),
  'Completed before unassign'
);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_one')::uuid,
  null,
  'Returning lead to new queue after review',
  'c3333333-3333-3333-3333-333333333333'::uuid,
  (select updated_at from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid),
  true
);

select results_eq(
  $$select status::text, assigned_to is null from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid$$,
  $$values ('new'::text, true)$$,
  'safe unassign returns lead to new'
);

select set_config('request.jwt.claim.sub', 'c7777777-7777-7777-7777-777777777777', true);

select public.assign_lead(
  current_setting('test.phase5c2a_lead_two')::uuid,
  'c4444444-4444-4444-4444-444444444444'::uuid,
  'Legacy management assignment'
);

select results_eq(
  $$select assigned_to::text from public.leads where id = current_setting('test.phase5c2a_lead_two')::uuid$$,
  array['c4444444-4444-4444-4444-444444444444'::text],
  'legacy management can assign'
);

reset role;
set local role postgres;
select set_config('onedecore.crm_transition', '1', true);
update public.leads
set status = 'closed_lost',
    closed_lost_reason_id = (select id from public.lead_closure_reasons where is_active = true limit 1),
    closed_lost_note = 'Test terminal guard note'
where id = current_setting('test.phase5c2a_lead_two')::uuid;
select set_config('onedecore.crm_transition', '0', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c7777777-7777-7777-7777-777777777777', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.phase5c2a_lead_two')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, 'Terminal reassignment attempt')$$,
  '22023',
  null,
  'terminal closed_lost assignment rejected'
);

select throws_ok(
  $$select public.assign_lead(
    current_setting('test.phase5c2a_lead_one')::uuid,
    'c4444444-4444-4444-4444-444444444444'::uuid,
    'Initial assignment after unassign conflict',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    (select updated_at from public.leads where id = current_setting('test.phase5c2a_lead_one')::uuid),
    true
  )$$,
  'P0001',
  null,
  'stale expected assignee conflicts'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.assign_lead(uuid,uuid,text,uuid,timestamptz,boolean)', 'execute')$$,
  array[true],
  'migration 13 grants authenticated execute on hardened assign_lead'
);

select * from finish();
rollback;
