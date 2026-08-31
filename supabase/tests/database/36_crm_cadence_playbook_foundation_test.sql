-- CRM 2C — Sales Playbook + Cadences pgTAP
-- Stage gates at the canonical transition authority; one-step-at-a-time cadences
-- on lead_follow_ups. No scheduler, no parallel task table, no WhatsApp send.

begin;
select plan(85);

-- =============================================================================
-- Section 1: Schema, privileges, architecture (28)
-- =============================================================================

select has_table('public', 'crm_cadence_templates', 'crm_cadence_templates exists');
select has_table('public', 'crm_cadence_steps', 'crm_cadence_steps exists');
select has_table('public', 'crm_lead_cadence_enrollments', 'crm_lead_cadence_enrollments exists');
select has_table('public', 'crm_cadence_enrollment_events', 'crm_cadence_enrollment_events exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in (
     'public.crm_cadence_templates'::regclass,
     'public.crm_cadence_steps'::regclass,
     'public.crm_lead_cadence_enrollments'::regclass,
     'public.crm_cadence_enrollment_events'::regclass
   )),
  'RLS enabled on every cadence table'
);

select ok(
  exists (select 1 from public.permissions where code = 'crm.cadences.manage' and is_active),
  'crm.cadences.manage permission seeded'
);

select ok(
  exists (
    select 1 from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'crm.cadences.manage' and r.code = 'super_admin'
  ),
  'super_admin holds crm.cadences.manage'
);

select ok(
  exists (
    select 1 from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'crm.cadences.manage' and r.code = 'sales_manager'
  ),
  'sales_manager holds crm.cadences.manage (D3)'
);

select ok(
  not exists (
    select 1 from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'crm.cadences.manage' and r.code = 'sales_executive'
  ),
  'sales_executive never holds crm.cadences.manage'
);

select ok(
  (select pg_get_constraintdef(oid) like '%''cadence''%'
   from pg_constraint
   where conname = 'chk_lead_follow_ups_source'
     and conrelid = 'public.lead_follow_ups'::regclass),
  'lead_follow_ups.source allowlist includes cadence'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_cadence_provenance'
      and conrelid = 'public.lead_follow_ups'::regclass
  ),
  'cadence provenance consistency constraint exists'
);

select has_index(
  'public', 'lead_follow_ups', 'uq_lead_follow_ups_cadence_step',
  'replay/idempotency index on (cadence_enrollment_id, cadence_step_id)'
);

select has_index(
  'public', 'crm_lead_cadence_enrollments', 'uq_crm_lead_cadence_enrollments_one_live',
  'one active/paused cadence enrollment per lead (D5)'
);

select ok(
  (select pg_get_constraintdef(oid) like '%cadence.enrolled%'
      and pg_get_constraintdef(oid) like '%cadence.completed%'
      and pg_get_constraintdef(oid) like '%cadence.stopped%'
   from pg_constraint
   where conname = 'chk_lead_activities_type'
     and conrelid = 'public.lead_activities'::regclass),
  'lead_activities allowlists the three one-shot cadence summaries'
);

select ok(
  (select pg_get_functiondef('private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure)
     like '%CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED%'),
  'first-contact gate lives inside the canonical transition authority'
);

select ok(
  (select pg_get_functiondef('private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure)
     like '%CRM_STAGE_GATE_CONSULTATION_REQUIRED%'),
  'consultation gate lives inside the canonical transition authority'
);

select ok(
  (select pg_get_functiondef('private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure)
     like '%CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED%'),
  'proposal-delivery gate lives inside the canonical transition authority'
);

select ok(
  (select pg_get_functiondef('private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure)
     like '%CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE%'),
  'transition authority still refuses Closed Won'
);

select ok(
  (select pg_get_functiondef('private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure)
     like '%must be changed via assign_lead only%'),
  'transition authority still protects assignment-owned edges'
);

select ok(
  (select pg_get_functiondef(
     'private.complete_lead_activity_impl(uuid,text,text,text,text,text,timestamptz,text,integer,timestamptz,uuid,text,timestamptz,text,text,uuid)'::regprocedure
   ) like '%CADENCE_NEXT%'),
  'complete-with-next authority carries the CADENCE_NEXT resolution'
);

select ok(
  (select pg_get_functiondef(
     'private.accepted_quotation_close_won_impl(uuid,timestamptz,uuid,uuid)'::regprocedure
   ) like '%stop_lead_cadence_for_system%'),
  'Closed Won commercial authority stops any live cadence'
);

select ok(
  not exists (select 1 from pg_extension where extname in ('pg_cron', 'pgmq')),
  'no scheduler/queue extension is introduced by CRM 2C'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'private.materialize_cadence_step(uuid,uuid,uuid,uuid,timestamptz)', 'execute')$$,
  array[false],
  'authenticated cannot execute the cadence materializer directly'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'private.stop_lead_cadence_for_system(uuid,uuid,text)', 'execute')$$,
  array[false],
  'authenticated cannot execute the system stop helper directly'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.enroll_lead_in_cadence(uuid,uuid)', 'execute')$$,
  array[false],
  'anon cannot enroll leads in a cadence'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.enroll_lead_in_cadence(uuid,uuid)', 'execute')$$,
  array[true],
  'authenticated retains enroll_lead_in_cadence execute'
);

-- D8: the migration seeds nothing. Asserted against the migration's own
-- postcondition rather than a live row count, so QA fixtures cannot mask it.
select ok(
  (select pg_get_functiondef('private.materialize_cadence_step(uuid,uuid,uuid,uuid,timestamptz)'::regprocedure)
     not like '%insert into public.crm_cadence_templates%'),
  'no cadence template is ever created by the cadence engine (D8)'
);

select ok(
  (select count(*) = 2 from pg_trigger t
   where t.tgrelid = 'public.crm_cadence_enrollment_events'::regclass
     and t.tgname in (
       'trg_crm_cadence_enrollment_events_no_update',
       'trg_crm_cadence_enrollment_events_no_delete'
     )),
  'cadence enrollment events are append-only'
);

select ok(
  (select pg_get_functiondef('private.materialize_cadence_step(uuid,uuid,uuid,uuid,timestamptz)'::regprocedure)
     not like '%whatsapp%'),
  'the cadence materializer never touches WhatsApp transport'
);

-- =============================================================================
-- Section 2: Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '2c-sa@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '2c-mgr@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '2c-execa@example.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '2c-execb@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333',
  'c4444444-4444-4444-4444-444444444444'
);

insert into public.user_roles (user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'c2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'c3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';

create or replace function pg_temp.seed_lead(p_key uuid, p_name text, p_phone text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  perform public.submit_lead_intake(
    p_idempotency_key => p_key,
    p_request_hash => md5(p_name || 'r') || md5(p_name || 'q'),
    p_network_fingerprint_hash => md5(p_name || 'n') || md5(p_name || 'm'),
    p_phone_fingerprint_hash => md5(p_phone) || md5(p_phone || 'x'),
    p_planner_version => 'home-r4-v1',
    p_submitted_name => p_name,
    p_phone_e164 => p_phone,
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
    p_consent_whatsapp => false,
    p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
    p_copy_service_communication => 'service-communication-v0.1-draft',
    p_copy_whatsapp => null,
    p_notice_version => 'privacy-notice-v0.1-draft'
  );

  select id into v_id from public.leads where submitted_name = p_name limit 1;
  return v_id;
end;
$$;

select set_config('test.lead_cycle', pg_temp.seed_lead('c1111111-0000-0000-0000-000000000001', '2C Cadence Lifecycle', '+919511110001')::text, true);
select set_config('test.lead_hold', pg_temp.seed_lead('c1111111-0000-0000-0000-000000000002', '2C Cadence Hold', '+919511110002')::text, true);
select set_config('test.lead_gate', pg_temp.seed_lead('c1111111-0000-0000-0000-000000000003', '2C Stage Gates', '+919511110003')::text, true);
select set_config('test.lead_lost', pg_temp.seed_lead('c1111111-0000-0000-0000-000000000004', '2C Cadence Lost', '+919511110004')::text, true);
select set_config('test.lead_won', pg_temp.seed_lead('c1111111-0000-0000-0000-000000000005', '2C Cadence Won', '+919511110005')::text, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.assign_lead(current_setting('test.lead_cycle')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_hold')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_gate')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_lost')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_won')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);

-- =============================================================================
-- Section 3: Template lifecycle + authorization (11)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.create_cadence_template('Exec Attempt', null)$$,
  '42501',
  null,
  'sales executive cannot create a cadence template'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.tpl',
  (select (public.create_cadence_template('New Interior Enquiry Follow-up', 'Owner review draft')).id::text),
  true
);

select results_eq(
  $$select status from public.crm_cadence_templates where id = current_setting('test.tpl')::uuid$$,
  array['draft'::text],
  'manager creates a draft cadence template'
);

select throws_ok(
  $$select public.publish_cadence_template(current_setting('test.tpl')::uuid)$$,
  '22023',
  null,
  'a template without steps cannot be published'
);

select public.replace_cadence_template_steps(
  current_setting('test.tpl')::uuid,
  $json$[
    {"activityType":"call","title":"First contact call","priority":"urgent","delayHours":0},
    {"activityType":"whatsapp","title":"Send intro and portfolio","priority":"high","delayHours":4,"reminderOffsetMinutes":30},
    {"activityType":"call","title":"Second attempt","priority":"normal","delayHours":24,"durationMinutes":15}
  ]$json$::jsonb
);

select results_eq(
  $$select array_agg(step_order order by step_order)::text[]
    from public.crm_cadence_steps where template_id = current_setting('test.tpl')::uuid$$,
  $$values (array['1', '2', '3']::text[])$$,
  'steps are stored in deterministic contiguous order'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.replace_cadence_template_steps(current_setting('test.tpl')::uuid, '[]'::jsonb)$$,
  '42501',
  null,
  'sales executive cannot edit cadence steps'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select (public.publish_cadence_template(current_setting('test.tpl')::uuid)).status$$,
  array['published'::text],
  'manager publishes the cadence template'
);

select throws_ok(
  $$select public.replace_cadence_template_steps(current_setting('test.tpl')::uuid, '[]'::jsonb)$$,
  '22023',
  null,
  'published template steps cannot be replaced'
);

select set_config(
  'test.tpl_dup',
  (select (public.duplicate_cadence_template(current_setting('test.tpl')::uuid, 'Enquiry Follow-up v2')).id::text),
  true
);

select results_eq(
  $$select count(*)::bigint from public.crm_cadence_steps where template_id = current_setting('test.tpl_dup')::uuid$$,
  array[3::bigint],
  'duplicating a published template produces an editable draft with the same steps'
);

select set_config(
  'test.tpl_archived',
  (select (public.create_cadence_template('Archived Playbook', null)).id::text),
  true
);
select public.replace_cadence_template_steps(
  current_setting('test.tpl_archived')::uuid,
  $json$[{"activityType":"call","title":"Archived step","priority":"normal","delayHours":1}]$json$::jsonb
);
select public.publish_cadence_template(current_setting('test.tpl_archived')::uuid);

select results_eq(
  $$select (public.archive_cadence_template(current_setting('test.tpl_archived')::uuid)).status$$,
  array['archived'::text],
  'manager archives a published template'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.archive_cadence_template(current_setting('test.tpl')::uuid)$$,
  '42501',
  null,
  'sales executive cannot archive a cadence template'
);

-- =============================================================================
-- Section 4: Enrollment (8)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.enroll_lead_in_cadence(
    current_setting('test.lead_cycle')::uuid,
    current_setting('test.tpl_archived')::uuid
  )$$,
  '22023',
  null,
  'an archived template cannot receive new enrollments'
);

select throws_ok(
  $$select public.enroll_lead_in_cadence(
    current_setting('test.lead_cycle')::uuid,
    current_setting('test.tpl_dup')::uuid
  )$$,
  '22023',
  null,
  'a draft template cannot receive enrollments'
);

select set_config(
  'test.enr',
  (select (public.enroll_lead_in_cadence(
    current_setting('test.lead_cycle')::uuid,
    current_setting('test.tpl')::uuid
  )).id::text),
  true
);

select results_eq(
  $$select status, current_step_order from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr')::uuid$$,
  $$values ('active'::text, 1::smallint)$$,
  'enrollment starts active on step 1'
);

select results_eq(
  $$select source, is_primary_next_action, status, activity_type,
           cadence_enrollment_id = current_setting('test.enr')::uuid,
           cadence_step_id is not null
    from public.lead_follow_ups
    where lead_id = current_setting('test.lead_cycle')::uuid
      and source = 'cadence'$$,
  $$values ('cadence'::text, true, 'open'::text, 'call'::text, true, true)$$,
  'the first step is a canonical primary activity with cadence provenance'
);

select results_eq(
  $$select count(*)::bigint from public.lead_follow_ups
    where lead_id = current_setting('test.lead_cycle')::uuid
      and status = 'open' and is_primary_next_action$$,
  array[1::bigint],
  'exactly one open primary next action after enrollment'
);

select results_eq(
  $$select array_agg(distinct event_type)::text[]
    from public.crm_cadence_enrollment_events
    where enrollment_id = current_setting('test.enr')::uuid$$,
  $$values (array['enrolled', 'step_materialized']::text[])$$,
  'enrollment audit records both enrolled and step_materialized'
);

select ok(
  exists (
    select 1 from public.lead_activities
    where lead_id = current_setting('test.lead_cycle')::uuid
      and activity_type = 'cadence.enrolled'
      and reference_id = current_setting('test.enr')::uuid
  ),
  'cadence.enrolled summary lands on the lead timeline'
);

select throws_ok(
  $$select public.enroll_lead_in_cadence(
    current_setting('test.lead_cycle')::uuid,
    current_setting('test.tpl')::uuid
  )$$,
  '22023',
  null,
  'a lead cannot hold two live cadence enrollments (D5)'
);

select set_config('request.jwt.claim.sub', 'c4444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$select public.enroll_lead_in_cadence(
    current_setting('test.lead_hold')::uuid,
    current_setting('test.tpl')::uuid
  )$$,
  '42501',
  null,
  'an executive cannot enroll a lead assigned to someone else'
);

-- =============================================================================
-- Section 5: One-at-a-time progression, pause, resume, cancel (10)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config(
  'test.act1',
  (select id::text from public.lead_follow_ups
   where lead_id = current_setting('test.lead_cycle')::uuid
     and source = 'cadence' and status = 'open'),
  true
);

select public.complete_lead_activity(
  p_activity_id => current_setting('test.act1')::uuid,
  p_outcome_code => 'connected',
  p_resolution => 'CADENCE_NEXT'
);

select results_eq(
  $$select status, current_step_order from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr')::uuid$$,
  $$values ('active'::text, 2::smallint)$$,
  'CADENCE_NEXT advances the enrollment exactly one step'
);

select results_eq(
  $$select count(*)::bigint from public.lead_follow_ups
    where cadence_enrollment_id = current_setting('test.enr')::uuid and status = 'open'$$,
  array[1::bigint],
  'exactly one cadence step is open at any time'
);

select results_eq(
  $$select count(*)::bigint from public.lead_follow_ups
    where lead_id = current_setting('test.lead_cycle')::uuid
      and status = 'open' and is_primary_next_action$$,
  array[1::bigint],
  'primary-next-action invariant holds after progression'
);

select results_eq(
  $$select activity_type, title, is_primary_next_action, source from public.lead_follow_ups
    where cadence_enrollment_id = current_setting('test.enr')::uuid and status = 'open'$$,
  $$values ('whatsapp'::text, 'Send intro and portfolio'::text, true, 'cadence'::text)$$,
  'the materialized step is the template step 2 as an internal human task'
);

reset role;
set local role postgres;

select throws_ok(
  $$select private.materialize_cadence_step(
      current_setting('test.enr')::uuid,
      (select id from public.crm_cadence_steps
        where template_id = current_setting('test.tpl')::uuid and step_order = 2),
      'c3333333-3333-3333-3333-333333333333'::uuid,
      'c3333333-3333-3333-3333-333333333333'::uuid,
      clock_timestamp()
    )$$,
  '23505',
  null,
  'replaying a step materialization is refused by the idempotency index'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select (public.pause_lead_cadence(current_setting('test.enr')::uuid)).status$$,
  array['paused'::text],
  'an active enrollment can be paused'
);

select set_config(
  'test.act2',
  (select id::text from public.lead_follow_ups
   where cadence_enrollment_id = current_setting('test.enr')::uuid and status = 'open'),
  true
);

select throws_ok(
  $$select public.complete_lead_activity(
    p_activity_id => current_setting('test.act2')::uuid,
    p_outcome_code => 'whatsapp_sent',
    p_resolution => 'CADENCE_NEXT'
  )$$,
  '22023',
  null,
  'a paused enrollment never materializes another step'
);

select set_config(
  'test.activity_count_before_resume',
  (select count(*)::text from public.lead_follow_ups
   where lead_id = current_setting('test.lead_cycle')::uuid),
  true
);

select public.resume_lead_cadence(current_setting('test.enr')::uuid);

select results_eq(
  $$select (select status from public.crm_lead_cadence_enrollments where id = current_setting('test.enr')::uuid),
           (select count(*)::text from public.lead_follow_ups where lead_id = current_setting('test.lead_cycle')::uuid)$$,
  $$values ('active'::text, current_setting('test.activity_count_before_resume'))$$,
  'resume reactivates without duplicating the open cadence activity'
);

select results_eq(
  $$select status, stop_reason
      from public.cancel_lead_cadence(current_setting('test.enr')::uuid) as t$$,
  $$values ('stopped'::text, 'cancelled_by_user'::text)$$,
  'cancelling an enrollment stops it with an auditable reason'
);

select results_eq(
  $$select status, is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act2')::uuid$$,
  $$values ('open'::text, true)$$,
  'cancelling a cadence never removes the lead primary next action'
);

select throws_ok(
  $$select public.complete_lead_activity(
    p_activity_id => current_setting('test.act2')::uuid,
    p_outcome_code => 'completed',
    p_resolution => 'CADENCE_NEXT'
  )$$,
  '22023',
  null,
  'a cancelled enrollment cannot be advanced'
);

-- =============================================================================
-- Section 6: Mandatory stop conditions and reassignment (7)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.enr_hold',
  (select (public.enroll_lead_in_cadence(
    current_setting('test.lead_hold')::uuid,
    current_setting('test.tpl')::uuid
  )).id::text),
  true
);

select public.transition_lead_status(
  current_setting('test.lead_hold')::uuid, 'on_hold', 'Client travelling', null
);

select results_eq(
  $$select status from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr_hold')::uuid$$,
  array['paused'::text],
  'On Hold pauses the cadence instead of cancelling it (D6)'
);

select ok(
  exists (
    select 1 from public.crm_cadence_enrollment_events
    where enrollment_id = current_setting('test.enr_hold')::uuid
      and event_type = 'paused' and reason_code = 'lead_on_hold'
  ),
  'On Hold pause is audited with its reason'
);

select set_config(
  'test.enr_lost',
  (select (public.enroll_lead_in_cadence(
    current_setting('test.lead_lost')::uuid,
    current_setting('test.tpl')::uuid
  )).id::text),
  true
);

select public.transition_lead_status(
  current_setting('test.lead_lost')::uuid, 'closed_lost', 'Budget mismatch', null
);

select results_eq(
  $$select status, stop_reason from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr_lost')::uuid$$,
  $$values ('stopped'::text, 'lead_closed_lost'::text)$$,
  'Closed Lost stops the cadence through the canonical transition authority'
);

select throws_ok(
  $$select public.enroll_lead_in_cadence(
    current_setting('test.lead_lost')::uuid,
    current_setting('test.tpl')::uuid
  )$$,
  '22023',
  null,
  'a terminal lead can never be enrolled'
);

select set_config(
  'test.enr_won',
  (select (public.enroll_lead_in_cadence(
    current_setting('test.lead_won')::uuid,
    current_setting('test.tpl')::uuid
  )).id::text),
  true
);

reset role;
set local role postgres;

select private.accepted_quotation_close_won_impl(
  current_setting('test.lead_won')::uuid,
  now(),
  'c2222222-2222-2222-2222-222222222222'::uuid,
  null
);

select results_eq(
  $$select status, stop_reason from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr_won')::uuid$$,
  $$values ('stopped'::text, 'lead_closed_won'::text)$$,
  'Closed Won stops the cadence through commercial authority only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Reassignment: the open cadence activity follows the lead (D7).
select throws_ok(
  $$select public.resume_lead_cadence(current_setting('test.enr_hold')::uuid)$$,
  '22023',
  null,
  'a cadence cannot resume while the lead is still On Hold'
);

select public.transition_lead_status(
  current_setting('test.lead_hold')::uuid, 'assigned', null, null
);
select public.resume_lead_cadence(current_setting('test.enr_hold')::uuid);
select public.assign_lead(
  current_setting('test.lead_hold')::uuid,
  'c4444444-4444-4444-4444-444444444444'::uuid,
  'territory change'
);

select results_eq(
  $$select owner_id, is_primary_next_action, status from public.lead_follow_ups
    where cadence_enrollment_id = current_setting('test.enr_hold')::uuid and status = 'open'$$,
  $$values ('c4444444-4444-4444-4444-444444444444'::uuid, true, 'open'::text)$$,
  'reassignment transfers the open cadence activity with the lead (D7)'
);

select results_eq(
  $$select status from public.crm_lead_cadence_enrollments
    where id = current_setting('test.enr_hold')::uuid$$,
  array['active'::text],
  'reassignment never stops the cadence'
);

-- =============================================================================
-- Section 7: Stage gates (12)
-- =============================================================================

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'contacted', null, null)$$,
  '22023',
  null,
  'assigned -> contacted is refused without first-contact evidence'
);

select results_eq(
  $$select status from public.leads where id = current_setting('test.lead_gate')::uuid$$,
  array['assigned'::text],
  'a refused gate leaves the lead status untouched'
);

select results_eq(
  $$select count(*)::bigint from public.lead_events
    where lead_id = current_setting('test.lead_gate')::uuid
      and event_type = 'lead.status_changed'$$,
  array[0::bigint],
  'a refused gate writes no lifecycle event (no partial mutation)'
);

reset role;
set local role postgres;

update public.crm_sla_clocks
set first_contact_attempt_at = clock_timestamp()
where lead_id = current_setting('test.lead_gate')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select (public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'contacted', null, null)).status$$,
  array['contacted'::text],
  'assigned -> contacted succeeds on canonical first-contact attempt evidence'
);

select results_eq(
  $$select (public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'qualified', null, null)).status$$,
  array['qualified'::text],
  'contacted -> qualified is deliberately not gated'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'consultation_scheduled', null, null)$$,
  '22023',
  null,
  'qualified -> consultation_scheduled is refused without a consultation or site visit'
);

select public.create_lead_activity(
  current_setting('test.lead_gate')::uuid,
  'site_visit',
  'Measurement visit',
  now() + interval '3 days',
  'high',
  null,
  false,
  null,
  null,
  null
);

select results_eq(
  $$select (public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'consultation_scheduled', null, null)).status$$,
  array['consultation_scheduled'::text],
  'qualified -> consultation_scheduled succeeds on a canonical scheduled visit'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'proposal_sent', null, null)$$,
  '22023',
  null,
  'consultation_scheduled -> proposal_sent is refused without quotation evidence'
);

reset role;
set local role postgres;

insert into public.quotations (id, lead_id, quotation_number, created_by)
values (
  'cccc0001-0000-4000-8000-000000000001',
  current_setting('test.lead_gate')::uuid,
  'OD-Q-2026-000901',
  'c2222222-2222-2222-2222-222222222222'
);

insert into public.quotation_versions (
  id, quotation_id, version_number, status, is_current_draft, title, created_by
) values (
  'cccc0002-0000-4000-8000-000000000002',
  'cccc0001-0000-4000-8000-000000000001',
  1, 'finalized', false, 'Gate evidence version',
  'c2222222-2222-2222-2222-222222222222'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'proposal_sent', null, null)$$,
  '22023',
  null,
  'a finalized version alone is NOT sufficient evidence of delivery'
);

reset role;
set local role postgres;

insert into public.quotation_access_grants (
  id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash, revoked_at
) values (
  'cccc0003-0000-4000-8000-000000000003',
  'cccc0001-0000-4000-8000-000000000001',
  'cccc0002-0000-4000-8000-000000000002',
  repeat('a', 32), repeat('b', 64), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'proposal_sent', null, null)$$,
  '22023',
  null,
  'a revoked client access grant is not delivery evidence'
);

reset role;
set local role postgres;

insert into public.quotation_access_grants (
  id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash
) values (
  'cccc0004-0000-4000-8000-000000000004',
  'cccc0001-0000-4000-8000-000000000001',
  'cccc0002-0000-4000-8000-000000000002',
  repeat('c', 32), repeat('d', 64)
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select (public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'proposal_sent', null, null)).status$$,
  array['proposal_sent'::text],
  'consultation_scheduled -> proposal_sent succeeds on a live client access grant'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'closed_won', null, null)$$,
  'P0001',
  null,
  'Closed Won remains impossible through the transition authority'
);

select throws_ok(
  $$select public.transition_lead_status(current_setting('test.lead_gate')::uuid, 'assigned', null, null)$$,
  '22023',
  null,
  'assignment-owned edges remain protected'
);

-- =============================================================================
-- Section 8: RLS, audit, WhatsApp boundary (4)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::bigint from public.crm_lead_cadence_enrollments
    where lead_id = current_setting('test.lead_hold')::uuid$$,
  array[0::bigint],
  'RLS hides an enrollment on a lead reassigned away from the executive'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$update public.crm_cadence_enrollment_events set reason_code = 'tamper'
    where enrollment_id = current_setting('test.enr')::uuid$$,
  '42501',
  null,
  'authenticated holds no UPDATE privilege on cadence enrollment events'
);

reset role;
set local role postgres;

select throws_ok(
  $$update public.crm_cadence_enrollment_events set reason_code = 'tamper'
    where enrollment_id = current_setting('test.enr')::uuid$$,
  '55000',
  null,
  'the append-only trigger rejects updates even for a privileged role'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select count(*)::bigint from public.whatsapp_send_intents$$,
  array[0::bigint],
  'no cadence operation ever creates a WhatsApp send intent'
);

select results_eq(
  $$select count(*)::bigint from public.crm_sla_clocks where sla_due_at is not null$$,
  array[0::bigint],
  'CRM 2C leaves the first-contact SLA inactive'
);

select * from finish();
rollback;
