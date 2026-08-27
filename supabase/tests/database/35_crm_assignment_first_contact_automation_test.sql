-- CRM 2A-7 — Assignment + First Contact automation pgTAP

begin;
select plan(29);

-- =============================================================================
-- Helpers / architecture
-- =============================================================================

select has_function(
  'private',
  'ensure_sla_first_contact_primary',
  array['uuid', 'uuid', 'uuid'],
  'ensure_sla_first_contact_primary exists'
);

select has_function(
  'private',
  'sync_open_activities_on_assignment',
  array['uuid', 'uuid', 'uuid'],
  'sync_open_activities_on_assignment exists'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'leads'
      and t.tgname = 'trg_leads_after_insert_sla_receipt'
  ),
  'lead receipt SLA trigger exists on public.leads'
);

select ok(
  (
    select pg_get_functiondef(
      'private.assign_lead_impl(uuid,uuid,text,uuid,timestamptz,boolean)'::regprocedure
    ) like '%sync_open_activities_on_assignment%'
  ),
  'assign_lead_impl wires sync_open_activities_on_assignment'
);

select ok(
  (
    select pg_get_functiondef(
      'private.assign_lead_impl(uuid,uuid,text,uuid,timestamptz,boolean)'::regprocedure
    ) like '%ensure_sla_first_contact_primary%'
  ),
  'assign_lead_impl wires ensure_sla_first_contact_primary'
);

select ok(
  (
    select pg_get_functiondef(
      'private.assign_lead_impl(uuid,uuid,text,uuid,timestamptz,boolean)'::regprocedure
    ) ~ 'from public\.leads where id = p_lead_id for update'
  ),
  'assign_lead_impl locks lead FOR UPDATE before activity mutation'
);

-- follow_up.auto_created allowlisted
select ok(
  (
    select pg_get_constraintdef(oid) like '%follow_up.auto_created%'
    from pg_constraint
    where conname = 'chk_lead_activities_type'
      and conrelid = 'public.lead_activities'::regclass
  ),
  'follow_up.auto_created in lead_activities type check'
);

-- =============================================================================
-- Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('f1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '2a7-sa@example.test', 'authenticated', 'authenticated'),
  ('f2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '2a7-mgr@example.test', 'authenticated', 'authenticated'),
  ('f3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '2a7-execa@example.test', 'authenticated', 'authenticated'),
  ('f4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '2a7-execb@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'f1111111-1111-1111-1111-111111111111',
  'f2222222-2222-2222-2222-222222222222',
  'f3333333-3333-3333-3333-333333333333',
  'f4444444-4444-4444-4444-444444444444'
);

insert into public.user_roles (user_id, role_id)
select 'f1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'f2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'f3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'f4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';

-- Inactive SLA lead (public intake)
select * from public.submit_lead_intake(
  p_idempotency_key => 'f1111111-1111-1111-1111-111111111111'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A7 Inactive SLA Lead',
  p_phone_e164 => '+919511111111',
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

select set_config(
  'test.lead_inactive',
  (select id::text from public.leads where submitted_name = '2A7 Inactive SLA Lead' limit 1),
  true
);

-- Active SLA lead
select * from public.submit_lead_intake(
  p_idempotency_key => 'f2222222-2222-2222-2222-222222222222'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A7 Active SLA Lead',
  p_phone_e164 => '+919522222222',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
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
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select set_config(
  'test.lead_active',
  (select id::text from public.leads where submitted_name = '2A7 Active SLA Lead' limit 1),
  true
);

reset role;
set local role postgres;

update public.leads
set created_at = timezone('Asia/Kolkata', timestamp '2026-06-02 10:00:00')
where id = current_setting('test.lead_active')::uuid;

-- Synthetic active policy for test transaction only
update public.crm_sla_policies
set is_active = true,
    business_hours_enabled = true,
    effective_from = timezone('Asia/Kolkata', timestamp '2026-06-01 00:00:00'),
    activated_at = timezone('Asia/Kolkata', timestamp '2026-06-01 00:00:00'),
    target_business_minutes = 60,
    business_hours_config = '{
      "monday":{"start":"09:00","end":"18:00"},
      "tuesday":{"start":"09:00","end":"18:00"},
      "wednesday":{"start":"09:00","end":"18:00"},
      "thursday":{"start":"09:00","end":"18:00"},
      "friday":{"start":"09:00","end":"18:00"}
    }'::jsonb
where policy_code = 'first_contact';

-- Recreate active clock with due (trigger created NULL due under inactive policy at insert)
delete from public.crm_sla_clocks where lead_id = current_setting('test.lead_active')::uuid;
select private.ensure_first_contact_sla_clock(current_setting('test.lead_active')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'test.due_active',
  (select sla_due_at::text from public.crm_sla_clocks where lead_id = current_setting('test.lead_active')::uuid),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- =============================================================================
-- ASSIGN inactive SLA — no First Contact, clock at receipt
-- =============================================================================

select public.assign_lead(
  current_setting('test.lead_inactive')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select results_eq(
  $$
  select sla_due_at is null,
         first_contact_attempt_at is null
  from public.crm_sla_clocks
  where lead_id = current_setting('test.lead_inactive')::uuid
  $$,
  $$values (true, true)$$,
  'inactive SLA: clock ensured with NULL due at assign'
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_ups
  where lead_id = current_setting('test.lead_inactive')::uuid
    and status = 'open'
    and source = 'sla_auto'
  $$,
  array[0],
  'inactive SLA: no First Contact auto-created on assign'
);

-- =============================================================================
-- ASSIGN active SLA — First Contact primary
-- =============================================================================

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select set_config(
  'test.fc_id',
  (select id::text from public.lead_follow_ups
   where lead_id = current_setting('test.lead_active')::uuid
     and source = 'sla_auto' and title = 'First Contact' and status = 'open'
   limit 1),
  true
);

select results_eq(
  $$
  select activity_type, title, source, priority, is_primary_next_action,
         owner_id::text, due_at::text
  from public.lead_follow_ups
  where id = current_setting('test.fc_id')::uuid
  $$,
  $$
  values (
    'call'::text,
    'First Contact'::text,
    'sla_auto'::text,
    'high'::text,
    true,
    'f3333333-3333-3333-3333-333333333333'::text,
    current_setting('test.due_active')
  )
  $$,
  'active SLA: First Contact row fields match spec'
);

select results_eq(
  $$
  select count(*)::integer from public.lead_activities
  where lead_id = current_setting('test.lead_active')::uuid
    and activity_type = 'follow_up.auto_created'
    and reference_id = current_setting('test.fc_id')::uuid
  $$,
  array[1],
  'active SLA: follow_up.auto_created summary emitted'
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_up_events
  where follow_up_id = current_setting('test.fc_id')::uuid
    and event_type in ('created', 'primary_designated')
  $$,
  array[2],
  'active SLA: created and primary_designated events'
);

select results_eq(
  $$
  select first_contact_attempt_at is null
  from public.crm_sla_clocks
  where lead_id = current_setting('test.lead_active')::uuid
  $$,
  array[true],
  'task creation does not mark first_contact_attempt_at'
);

select results_eq(
  $$
  select clock_started_at = l.created_at
  from public.crm_sla_clocks c
  join public.leads l on l.id = c.lead_id
  where c.lead_id = current_setting('test.lead_active')::uuid
  $$,
  array[true],
  'clock_started_at remains lead receipt time'
);

-- =============================================================================
-- IDEMPOTENCY — same assignee retry
-- =============================================================================

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  null,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
  true
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_ups
  where lead_id = current_setting('test.lead_active')::uuid
    and source = 'sla_auto' and status = 'open'
  $$,
  array[1],
  'idempotent assign: no duplicate SLA First Contact'
);

-- =============================================================================
-- REASSIGN PRIMARY — owner follows new assignee
-- =============================================================================

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f4444444-4444-4444-4444-444444444444'::uuid,
  'Reassigning active SLA lead to executive B',
  'f3333333-3333-3333-3333-333333333333'::uuid,
  (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
  true
);

select results_eq(
  $$
  select owner_id::text, is_primary_next_action
  from public.lead_follow_ups
  where id = current_setting('test.fc_id')::uuid
  $$,
  $$values ('f4444444-4444-4444-4444-444444444444'::text, true)$$,
  'reassign: SLA First Contact primary follows new assignee'
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_up_events
  where follow_up_id = current_setting('test.fc_id')::uuid
    and event_type = 'ownership_transferred'
  $$,
  array[1],
  'reassign primary: ownership_transferred audit'
);

-- =============================================================================
-- REASSIGN SECONDARY — manager retains when authorized
-- =============================================================================

select public.create_lead_follow_up(
  current_setting('test.lead_active')::uuid,
  now() + interval '2 days',
  'f2222222-2222-2222-2222-222222222222'::uuid
);

select set_config(
  'test.mgr_fu',
  (select id::text from public.lead_follow_ups
   where lead_id = current_setting('test.lead_active')::uuid
     and owner_id = 'f2222222-2222-2222-2222-222222222222'::uuid
     and status = 'open'
   order by id desc limit 1),
  true
);

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  'Reassign back to executive A for secondary retain test',
  'f4444444-4444-4444-4444-444444444444'::uuid,
  (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
  true
);

select results_eq(
  $$
  select owner_id::text from public.lead_follow_ups
  where id = current_setting('test.mgr_fu')::uuid
  $$,
  array['f2222222-2222-2222-2222-222222222222'::text],
  'reassign secondary: authorized manager owner retained'
);

-- =============================================================================
-- REASSIGN SECONDARY — exec-scoped owner transfers
-- =============================================================================

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f4444444-4444-4444-4444-444444444444'::uuid,
  'Reassign to executive B before scoped secondary transfer test',
  'f3333333-3333-3333-3333-333333333333'::uuid,
  (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
  true
);

select public.create_lead_follow_up(
  current_setting('test.lead_active')::uuid,
  now() + interval '3 days',
  'f4444444-4444-4444-4444-444444444444'::uuid
);

select set_config(
  'test.exec_fu',
  (select id::text from public.lead_follow_ups
   where lead_id = current_setting('test.lead_active')::uuid
     and owner_id = 'f4444444-4444-4444-4444-444444444444'::uuid
     and status = 'open'
     and id <> current_setting('test.fc_id')::uuid
   order by id desc limit 1),
  true
);

select public.assign_lead(
  current_setting('test.lead_active')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  'Reassign to exec A transfers scoped secondary',
  'f4444444-4444-4444-4444-444444444444'::uuid,
  (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
  true
);

select results_eq(
  $$
  select owner_id::text from public.lead_follow_ups
  where id = current_setting('test.exec_fu')::uuid
  $$,
  array['f3333333-3333-3333-3333-333333333333'::text],
  'reassign secondary: unauthorized scoped owner transferred'
);

-- =============================================================================
-- UNASSIGN — fail closed on open activities
-- =============================================================================

select throws_ok(
  $$
  select public.assign_lead(
    current_setting('test.lead_active')::uuid,
    null,
    'Attempting unassign while open activities remain',
    'f3333333-3333-3333-3333-333333333333'::uuid,
    (select updated_at from public.leads where id = current_setting('test.lead_active')::uuid),
    true
  )
  $$,
  '22023',
  null,
  'unassign blocked by open follow-ups'
);

-- =============================================================================
-- EXISTING PRIMARY replacement when First Contact required
-- =============================================================================

reset role;
set local role service_role;

select * from public.submit_lead_intake(
  p_idempotency_key => 'f3333333-3333-3333-3333-333333333333'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A7 Primary Replace Lead',
  p_phone_e164 => '+919533333333',
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

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'test.lead_primary',
  (select id::text from public.leads where submitted_name = '2A7 Primary Replace Lead' limit 1),
  true
);

reset role;
set local role postgres;

update public.leads
set created_at = timezone('Asia/Kolkata', timestamp '2026-06-02 11:00:00')
where id = current_setting('test.lead_primary')::uuid;

delete from public.crm_sla_clocks where lead_id = current_setting('test.lead_primary')::uuid;
select private.ensure_first_contact_sla_clock(current_setting('test.lead_primary')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_lead_activity(
  current_setting('test.lead_primary')::uuid,
  'internal_task',
  'Existing manual primary',
  now() + interval '1 day',
  'normal',
  'f2222222-2222-2222-2222-222222222222'::uuid,
  true,
  null, null, null
);

select public.assign_lead(
  current_setting('test.lead_primary')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_ups
  where lead_id = current_setting('test.lead_primary')::uuid
    and status = 'open'
    and is_primary_next_action = true
  $$,
  array[1],
  'existing primary replace: at most one open primary'
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_ups
  where lead_id = current_setting('test.lead_primary')::uuid
    and source = 'sla_auto'
    and is_primary_next_action = true
    and status = 'open'
  $$,
  array[1],
  'existing primary replace: SLA First Contact becomes primary'
);

-- =============================================================================
-- FIRST CONTACT ALREADY ATTEMPTED — no auto task
-- =============================================================================

reset role;
set local role service_role;

select * from public.submit_lead_intake(
  p_idempotency_key => 'f4444444-4444-4444-4444-444444444444'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A7 Attempted Lead',
  p_phone_e164 => '+919544444444',
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

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'test.lead_attempted',
  (select id::text from public.leads where submitted_name = '2A7 Attempted Lead' limit 1),
  true
);

reset role;
set local role postgres;

update public.leads
set created_at = timezone('Asia/Kolkata', timestamp '2026-06-02 12:00:00')
where id = current_setting('test.lead_attempted')::uuid;

delete from public.crm_sla_clocks where lead_id = current_setting('test.lead_attempted')::uuid;
select private.ensure_first_contact_sla_clock(current_setting('test.lead_attempted')::uuid);

update public.crm_sla_clocks
set first_contact_attempt_at = timezone('Asia/Kolkata', timestamp '2026-06-02 12:30:00')
where lead_id = current_setting('test.lead_attempted')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.assign_lead(
  current_setting('test.lead_attempted')::uuid,
  'f3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select results_eq(
  $$
  select count(*)::integer from public.lead_follow_ups
  where lead_id = current_setting('test.lead_attempted')::uuid
    and source = 'sla_auto' and status = 'open'
  $$,
  array[0],
  'attempted contact: no SLA First Contact auto-created'
);

-- =============================================================================
-- CREATION PATHS — public intake clock; import opt-out
-- =============================================================================

select results_eq(
  $$
  select exists (
    select 1 from public.crm_sla_clocks
    where lead_id = current_setting('test.lead_inactive')::uuid
  )
  $$,
  array[true],
  'public intake creates SLA clock row at receipt'
);

select results_eq(
  $$
  select count(*)::integer from public.crm_sla_clocks c
  join public.leads l on l.id = c.lead_id
  where l.entry_method = 'import'
  $$,
  array[0],
  'bulk import path has no SLA clocks (opt-out)'
);

-- =============================================================================
-- TERMINAL — no auto First Contact
-- =============================================================================

reset role;
set local role service_role;

select * from public.submit_lead_intake(
  p_idempotency_key => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A7 Terminal Lead',
  p_phone_e164 => '+919555555555',
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

reset role;
set local role postgres;

select set_config(
  'test.lead_terminal',
  (select id::text from public.leads where submitted_name = '2A7 Terminal Lead' limit 1),
  true
);

select set_config('onedecore.crm_transition', '1', true);
update public.leads
set status = 'closed_lost',
    closed_lost_reason_id = (select id from public.lead_closure_reasons where is_active = true limit 1),
    closed_lost_note = '2A7 terminal test note'
where id = current_setting('test.lead_terminal')::uuid;
select set_config('onedecore.crm_transition', '0', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.assign_lead(current_setting('test.lead_terminal')::uuid, 'f3333333-3333-3333-3333-333333333333'::uuid, null)$$,
  '22023',
  null,
  'terminal lead assignment rejected'
);

-- =============================================================================
-- SECURITY — RPC signature / privileges unchanged
-- =============================================================================

select results_eq(
  $$select has_function_privilege('authenticated', 'public.assign_lead(uuid,uuid,text,uuid,timestamptz,boolean)', 'execute')$$,
  array[true],
  'authenticated retains assign_lead execute'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.assign_lead(uuid,uuid,text,uuid,timestamptz,boolean)', 'execute')$$,
  array[false],
  'anon cannot execute assign_lead'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'private.ensure_sla_first_contact_primary(uuid,uuid,uuid)', 'execute')$$,
  array[false],
  'authenticated cannot execute ensure_sla_first_contact_primary directly'
);

select * from finish();
rollback;
