-- ONEDECORE Phase 5B CRM Identity & Core Foundation pgTAP tests (final hardening)

begin;
select plan(77);

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
  $$select count(*)::integer from public.leads where status <> 'new' or assigned_to is not null$$,
  array[0],
  'post-migration leads remain ordinary unassigned new rows'
);

-- Synthetic staff users
insert into auth.users (id, instance_id, email, aud, role) values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa@example.test', 'authenticated', 'authenticated'),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr@example.test', 'authenticated', 'authenticated'),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'execa@example.test', 'authenticated', 'authenticated'),
  ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'execb@example.test', 'authenticated', 'authenticated'),
  ('a5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'pm@example.test', 'authenticated', 'authenticated'),
  ('a6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'notes@example.test', 'authenticated', 'authenticated'),
  ('a7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'designer@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444',
  'a5555555-5555-5555-5555-555555555555',
  'a6666666-6666-6666-6666-666666666666',
  'a7777777-7777-7777-7777-777777777777'
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
insert into public.user_roles (user_id, role_id)
select 'a7777777-7777-7777-7777-777777777777', id from public.roles where code = 'designer';

insert into public.roles (code, name, description, is_system) values
  ('crm_notes_only_test', 'CRM Notes Only Test Role', 'Synthetic Phase 5B permission-separation role', false);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'crm_notes_only_test'
  and p.code in (
    'leads.read_assigned', 'leads.transition', 'crm.notes.manage',
    'crm.activities.read', 'sources.read', 'consents.read'
  );

insert into public.user_roles (user_id, role_id)
select 'a6666666-6666-6666-6666-666666666666', id from public.roles where code = 'crm_notes_only_test';

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

reset role;
select set_config('test.lead_alpha_id', (select id::text from public.leads where submitted_name = 'Lead Alpha' limit 1), true);
select set_config('test.lead_beta_id', (select id::text from public.leads where submitted_name = 'Lead Beta' limit 1), true);
select set_config('test.pre_intake_lead_count', (select count(*)::text from public.leads), true);
select set_config('test.pre_intake_contact_count', (select count(*)::text from public.contacts), true);

-- Assign Alpha -> Exec A, Beta -> Exec B
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select public.assign_lead(current_setting('test.lead_alpha_id')::uuid, 'a3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_beta_id')::uuid, 'a4444444-4444-4444-4444-444444444444'::uuid, null);

select results_eq(
  $$select assignment_method from public.lead_assignment_history order by occurred_at desc limit 1$$,
  array['manager'],
  'manager assignment method derived server-side'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities la join public.lead_assignment_history lah on lah.id = la.reference_id where la.activity_type = 'assignment.changed'$$,
  array[2],
  'assignment activities reference exact history rows'
);

-- Executive A mutates own lead
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

insert into public.lead_notes (lead_id, body)
values (current_setting('test.lead_alpha_id')::uuid, 'Own lead note');

select results_eq(
  $$select count(*)::integer from public.lead_activities where activity_type = 'note.created'$$,
  array[1],
  'note creation writes exactly one note.created activity'
);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_alpha_id')::uuid, 'contacted', null, null)$$,
  array['contacted'],
  'executive A transitions own assigned lead to contacted'
);

-- Cross-executive note while attacker owns another lead
select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$insert into public.lead_notes (lead_id, body) values (current_setting('test.lead_alpha_id')::uuid, 'spy note')$$,
  '42501',
  null,
  'executive B cannot note executive A lead while owning Beta'
);

select results_eq(
  $$select count(*)::integer from public.lead_notes where body = 'spy note'$$,
  array[0],
  'failed cross-executive note leaves no row'
);

-- Cross-executive status transition
select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_alpha_id')::uuid, 'qualified', null, null)$$,
  '42501',
  null,
  'executive B cannot transition executive A lead'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select status::text from public.leads where id = current_setting('test.lead_alpha_id')::uuid$$,
  array['contacted'],
  'failed cross-executive transition leaves status unchanged'
);

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

-- Cross-executive follow-up create
select throws_ok(
  $$select public.create_lead_follow_up(current_setting('test.lead_alpha_id')::uuid, now() + interval '1 day', null)$$,
  '42501',
  null,
  'executive B cannot create follow-up on A lead'
);

-- Executive B follow-up lifecycle on own lead
select results_eq(
  $$select status::text from public.create_lead_follow_up(current_setting('test.lead_beta_id')::uuid, now() + interval '2 days', null)$$,
  array['open'],
  'executive B creates follow-up on own lead'
);

reset role;
select set_config('test.follow_up_beta_id', (select id::text from public.lead_follow_ups order by created_at desc limit 1), true);

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set local role authenticated;

select throws_ok(
  $$select public.complete_lead_follow_up(current_setting('test.follow_up_beta_id')::uuid, 'stolen')$$,
  '42501',
  null,
  'executive A cannot complete executive B follow-up'
);

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

select results_eq(
  $$select status::text from public.complete_lead_follow_up(current_setting('test.follow_up_beta_id')::uuid, 'Reached client')$$,
  array['completed'],
  'executive B completes own follow-up'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities where activity_type = 'follow_up.completed'$$,
  array[1],
  'follow-up completion writes exactly one completed activity'
);

select throws_ok(
  $$select public.cancel_lead_follow_up(current_setting('test.follow_up_beta_id')::uuid, 'too late')$$,
  '22023',
  null,
  'completed follow-up cannot be cancelled'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_ups', 'UPDATE')$$,
  array[false],
  'authenticated has no direct UPDATE on lead_follow_ups'
);

-- new/assigned invariants via transition_lead_status
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'assigned', null, null)$$,
  '22023',
  null,
  'transition_lead_status cannot set assigned'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'new', null, null)$$,
  '22023',
  null,
  'transition_lead_status cannot set new'
);

select public.assign_lead(current_setting('test.lead_beta_id')::uuid, null, 'prep for new contacted rejection');

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'contacted', null, null)$$,
  '22023',
  null,
  'direct new to contacted rejected before assignment'
);

-- assign_lead owns new <-> assigned sync

select results_eq(
  $$select status::text, assigned_to is null from public.leads where id = current_setting('test.lead_beta_id')::uuid$$,
  $$values ('new'::text, true)$$,
  'unassigning assigned lead returns new with null assignee'
);

select public.assign_lead(current_setting('test.lead_beta_id')::uuid, 'a4444444-4444-4444-4444-444444444444'::uuid, 'reassign');

select results_eq(
  $$select status::text from public.leads where id = current_setting('test.lead_beta_id')::uuid$$,
  array['assigned'],
  'assign_lead sets assigned from new'
);

-- On-hold previous-stage resume matrix
select public.assign_lead(current_setting('test.lead_beta_id')::uuid, null, 'hold prep unassign');

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'on_hold', 'Client requested pause', null)$$,
  array['on_hold'],
  'new to on hold records pause'
);

select results_eq(
  $$select on_hold_previous_status::text from public.leads where id = current_setting('test.lead_beta_id')::uuid$$,
  array['new'],
  'on hold records previous new stage'
);

select set_config('test.pre_resume_event_count', (select count(*)::text from public.lead_events where lead_id = current_setting('test.lead_beta_id')::uuid), true);
select set_config('test.pre_resume_activity_count', (select count(*)::text from public.lead_activities where lead_id = current_setting('test.lead_beta_id')::uuid and activity_type = 'status.changed'), true);
select set_config('test.expected_resume_event_count', (current_setting('test.pre_resume_event_count')::integer + 1)::text, true);
select set_config('test.expected_resume_activity_count', (current_setting('test.pre_resume_activity_count')::integer + 1)::text, true);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'new', null, null)$$,
  array['new'],
  'new on hold resumes to new'
);

select results_eq(
  $$select count(*)::integer from public.lead_events where lead_id = current_setting('test.lead_beta_id')::uuid$$,
  ARRAY[current_setting('test.expected_resume_event_count')::integer],
  'successful on hold resume writes exactly one event'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities where lead_id = current_setting('test.lead_beta_id')::uuid and activity_type = 'status.changed'$$,
  ARRAY[current_setting('test.expected_resume_activity_count')::integer],
  'successful on hold resume writes exactly one activity'
);

select public.assign_lead(current_setting('test.lead_beta_id')::uuid, 'a4444444-4444-4444-4444-444444444444'::uuid, 'hold assigned prep');

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'on_hold', 'Assigned pause', null)$$,
  array['on_hold'],
  'assigned to on hold'
);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'assigned', null, null)$$,
  array['assigned'],
  'assigned on hold resumes to assigned'
);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_alpha_id')::uuid, 'on_hold', 'Contacted pause', null)$$,
  array['on_hold'],
  'contacted to on hold'
);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_alpha_id')::uuid, 'contacted', null, null)$$,
  array['contacted'],
  'contacted on hold resumes to contacted'
);

select public.assign_lead(current_setting('test.lead_beta_id')::uuid, null, 'new hold prep');

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'on_hold', 'Skip attempt', null)$$,
  array['on_hold'],
  'new on hold before skip test'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'negotiation', null, null)$$,
  '22023',
  null,
  'new on hold cannot resume to negotiation'
);

select set_config('test.pre_failed_resume_event_count', (select count(*)::text from public.lead_events where lead_id = current_setting('test.lead_beta_id')::uuid and event_type = 'lead.resumed'), true);

select results_eq(
  $$select count(*)::integer from public.lead_events where lead_id = current_setting('test.lead_beta_id')::uuid and event_type = 'lead.resumed'$$,
  ARRAY[current_setting('test.pre_failed_resume_event_count')::integer],
  'failed resume writes no additional resumed event'
);

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'new', null, null)$$,
  array['new'],
  'new on hold resumes to new before assigned hold prep'
);

select public.assign_lead(current_setting('test.lead_beta_id')::uuid, 'a4444444-4444-4444-4444-444444444444'::uuid, 'assigned hold prep');

select results_eq(
  $$select status::text from public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'on_hold', 'Assigned skip', null)$$,
  array['on_hold'],
  'assigned on hold before skip test'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'contacted', null, null)$$,
  '22023',
  null,
  'assigned on hold cannot resume to contacted without prior contacted stage'
);

-- Progressed-stage unassignment is rejected in Phase 5C2A
select throws_ok(
  $$select public.assign_lead(current_setting('test.lead_alpha_id')::uuid, null, 'manager unassign contacted')$$,
  '22023',
  null,
  'unassigning contacted lead is rejected'
);

-- Follow-up permission separation (notes-only synthetic role)
reset role;
select set_config('onedecore.crm_transition', '1', true);
update public.leads
set assigned_to = 'a6666666-6666-6666-6666-666666666666'::uuid,
    status = 'assigned',
    on_hold_reason = null,
    on_hold_since = null,
    on_hold_previous_status = null
where id = current_setting('test.lead_beta_id')::uuid;
select set_config('onedecore.crm_transition', '0', true);

select set_config('request.jwt.claim.sub', 'a6666666-6666-6666-6666-666666666666', true);
set local role authenticated;

insert into public.lead_notes (lead_id, body)
values (current_setting('test.lead_beta_id')::uuid, 'notes-only allowed note');

select throws_ok(
  $$select public.create_lead_follow_up(current_setting('test.lead_beta_id')::uuid, now() + interval '1 day', null)$$,
  '42501',
  null,
  'notes-only role cannot create follow-up without crm.follow_ups.manage'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

create temporary table _perm_follow_up as
select id, status::text as status
from public.create_lead_follow_up(
  current_setting('test.lead_alpha_id')::uuid,
  now() + interval '3 days',
  'a3333333-3333-3333-3333-333333333333'::uuid
);

select results_eq(
  $$select status from _perm_follow_up$$,
  array['open'],
  'manager creates follow-up for permission separation test'
);

select set_config('test.follow_up_mgr_id', (select id::text from _perm_follow_up), true);

select set_config('request.jwt.claim.sub', 'a6666666-6666-6666-6666-666666666666', true);
set local role authenticated;

select throws_ok(
  $$select public.complete_lead_follow_up(current_setting('test.follow_up_mgr_id')::uuid, 'blocked')$$,
  '42501',
  null,
  'notes-only role cannot complete follow-up'
);

select throws_ok(
  $$select public.cancel_lead_follow_up(current_setting('test.follow_up_mgr_id')::uuid, 'blocked')$$,
  '42501',
  null,
  'notes-only role cannot cancel follow-up'
);

reset role;

select results_eq(
  $$select status::text from public.lead_follow_ups where id = current_setting('test.follow_up_mgr_id')::uuid$$,
  array['open'],
  'follow-up permission denial leaves follow-up unchanged'
);

-- Follow-up owner eligibility
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select owner_id from public.create_lead_follow_up(current_setting('test.lead_alpha_id')::uuid, now() + interval '4 days', null)$$,
  array['a2222222-2222-2222-2222-222222222222'::uuid],
  'manager default self-owned follow-up creation succeeds'
);

select throws_ok(
  $$select public.create_lead_follow_up(current_setting('test.lead_alpha_id')::uuid, now() + interval '5 days', 'a5555555-5555-5555-5555-555555555555'::uuid)$$,
  '22023',
  null,
  'project manager rejected as follow-up owner'
);

select throws_ok(
  $$select public.create_lead_follow_up(current_setting('test.lead_alpha_id')::uuid, now() + interval '5 days', 'a7777777-7777-7777-7777-777777777777'::uuid)$$,
  '22023',
  null,
  'designer rejected as follow-up owner'
);

-- Closed-Lost table invariant
reset role;

select throws_ok(
  $$
    select set_config('onedecore.crm_transition', '1', true);
    update public.leads
    set status = 'closed_lost', closed_lost_reason_id = null, closed_lost_note = null
    where id = current_setting('test.lead_beta_id')::uuid
  $$,
  '23514',
  null,
  'closed_lost table constraint rejects missing reason/note bypass'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_beta_id')::uuid, 'closed_lost', 'ab', null)$$,
  '22023',
  null,
  'closed_lost RPC rejects note shorter than minimum'
);

-- Note column privilege hardening
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select has_column_privilege('authenticated', 'public.lead_notes', 'lead_id', 'INSERT')
     and has_column_privilege('authenticated', 'public.lead_notes', 'body', 'INSERT')
     and not has_column_privilege('authenticated', 'public.lead_notes', 'created_by', 'INSERT')
     and not has_column_privilege('authenticated', 'public.lead_notes', 'created_at', 'INSERT')
     and not has_column_privilege('authenticated', 'public.lead_notes', 'id', 'INSERT')$$,
  array[true],
  'lead_notes INSERT limited to lead_id and body columns'
);

select throws_ok(
  $$insert into public.lead_notes (lead_id, body, created_at) values (current_setting('test.lead_alpha_id')::uuid, 'spoof time', now() - interval '1 year')$$,
  '42501',
  null,
  'caller cannot spoof created_at on lead_notes'
);

-- Source catalogue: inactive historical resolution + write rejection
reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select results_eq(
  $$select is_active from public.update_lead_source((select id from public.lead_sources where code = 'website'), null, null, null, false)$$,
  array[false],
  'super admin deactivates source via RPC'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.lead_sources where code = 'website' and is_active = false$$,
  array[1],
  'manager can resolve inactive source catalogue row'
);

select throws_ok(
  $$select public.update_lead_source((select id from public.lead_sources where code = 'website'), 'Hacked', null, null, true)$$,
  '42501',
  null,
  'manager cannot mutate sources via RPC'
);

select throws_ok(
  $$delete from public.lead_sources where code = 'website'$$,
  '42501',
  null,
  'hard delete on lead_sources denied'
);

-- Inactive website_planner blocks new intake atomically
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$select is_active from public.update_lead_source((select id from public.lead_sources where code = 'website_planner'), null, null, null, false)$$,
  array[false],
  'super admin deactivates website_planner intake source'
);

reset role;
select set_config('test.pre_intake_touchpoint_count', (select count(*)::text from public.lead_source_touchpoints), true);

select throws_ok(
  $$select public.submit_lead_intake(
    p_idempotency_key => 'b3333333-3333-3333-3333-333333333333'::uuid,
    p_request_hash => repeat('a', 64),
    p_network_fingerprint_hash => repeat('b', 64),
    p_phone_fingerprint_hash => repeat('c', 64),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => 'Lead Gamma',
    p_phone_e164 => '+919333333333',
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
  )$$,
  '22023',
  null,
  'inactive website_planner rejects new intake atomically'
);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[current_setting('test.pre_intake_lead_count')::integer],
  'failed inactive intake creates no lead row'
);

select results_eq(
  $$select count(*)::integer from public.contacts$$,
  array[current_setting('test.pre_intake_contact_count')::integer],
  'failed inactive intake creates no contact row'
);

select results_eq(
  $$select count(*)::integer from public.lead_source_touchpoints$$,
  array[current_setting('test.pre_intake_touchpoint_count')::integer],
  'failed inactive intake creates no touchpoint row'
);

select results_eq(
  $$select count(*)::integer from public.leads where submitted_name = 'Lead Gamma'$$,
  array[0],
  'failed inactive intake leaves no partial lead'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select results_eq(
  $$select is_active from public.update_lead_source((select id from public.lead_sources where code = 'website_planner'), null, null, null, true)$$,
  array[true],
  'super admin reactivates website_planner'
);

reset role;

select results_eq(
  $$select outcome::text from public.submit_lead_intake(
    p_idempotency_key => 'b3333333-3333-3333-3333-333333333333'::uuid,
    p_request_hash => repeat('a', 64),
    p_network_fingerprint_hash => repeat('b', 64),
    p_phone_fingerprint_hash => repeat('c', 64),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => 'Lead Gamma',
    p_phone_e164 => '+919333333333',
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
  )$$,
  array['created'],
  'reactivated website_planner permits intake again'
);

-- Super admin reactivates website catalogue row
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select results_eq(
  $$select is_active from public.update_lead_source((select id from public.lead_sources where code = 'website'), 'Website', null, null, true)$$,
  array[true],
  'super admin reactivates source'
);

select results_eq(
  $$select updated_by from public.lead_sources where code = 'website'$$,
  array['a1111111-1111-1111-1111-111111111111'::uuid],
  'source updated_by derived from auth.uid()'
);

-- PM, Designer and anon denial unchanged
select set_config('request.jwt.claim.sub', 'a5555555-5555-5555-5555-555555555555', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[0],
  'project manager denied general CRM lead access'
);

select set_config('request.jwt.claim.sub', 'a7777777-7777-7777-7777-777777777777', true);

select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[0],
  'designer denied general CRM lead access'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select count(*)::integer from public.leads$$,
  '42501',
  null,
  'anon denied leads select'
);

-- RPC exposure
reset role;

select results_eq(
  $$select has_function_privilege('authenticated', 'public.assign_lead(uuid,uuid,text,uuid,timestamptz,boolean)', 'execute')$$,
  array[true],
  'authenticated can execute assign_lead wrapper'
);

select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'assign_lead'$$,
  array[false],
  'assign_lead public wrapper is SECURITY INVOKER'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'super_admin' and p.code = 'portfolio.manage'$$,
  array[1],
  'portfolio permissions preserved for super_admin'
);

select * from finish();
rollback;
