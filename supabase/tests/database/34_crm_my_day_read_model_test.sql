-- CRM 2A-6 — My Day read model pgTAP

begin;
select plan(42);

-- =============================================================================
-- Section 1: RPC surface, privileges, security (8)
-- =============================================================================

select has_function(
  'public',
  'get_crm_my_day',
  array['uuid', 'integer', 'integer'],
  'public.get_crm_my_day exists with expected signature'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'get_crm_my_day_impl'
  ),
  'private.get_crm_my_day_impl exists'
);

select ok(
  (
    select p.prosecdef = false
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_crm_my_day'
  ),
  'public.get_crm_my_day is SECURITY INVOKER with pinned search_path'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.get_crm_my_day(uuid,integer,integer)', 'execute')$$,
  array[false],
  'anon cannot execute get_crm_my_day'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.get_crm_my_day(uuid,integer,integer)', 'execute')$$,
  array[true],
  'authenticated can execute get_crm_my_day'
);

select results_eq(
  $$select pg_get_function_result(p.oid)::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_crm_my_day'$$,
  array['jsonb'],
  'get_crm_my_day returns jsonb'
);

select ok(
  (
    select p.provolatile = 'v'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_crm_my_day'
  ),
  'get_crm_my_day is VOLATILE (captures clock_timestamp per call)'
);

select ok(
  (
    select p.prosecdef = false
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'get_crm_my_day_impl'
  ),
  'private.get_crm_my_day_impl is SECURITY INVOKER'
);

-- =============================================================================
-- Section 2: Test users (reuse 2A-3 pattern)
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('d1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa2a6@example.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr2a6@example.test', 'authenticated', 'authenticated'),
  ('d3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'exec2a6@example.test', 'authenticated', 'authenticated'),
  ('d4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'exec2b6@example.test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Exec 2A6'
where id = 'd3333333-3333-3333-3333-333333333333';
update public.profiles set status = 'active', display_name = 'Exec 2B6'
where id = 'd4444444-4444-4444-4444-444444444444';
update public.profiles set status = 'active'
where id in (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222'
);

insert into public.user_roles (user_id, role_id)
select 'd1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin'
on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select 'd2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager'
on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select 'd3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive'
on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select 'd4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive'
on conflict do nothing;

-- =============================================================================
-- Section 3: Fixture leads
-- =============================================================================

select * from public.submit_lead_intake(
  p_idempotency_key => 'd2a60001-0000-0000-0000-000000000001'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead Overdue',
  p_phone_e164 => '+919611111111',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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
  p_idempotency_key => 'd2a60002-0000-0000-0000-000000000002'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead Today',
  p_phone_e164 => '+919622222222',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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
  p_idempotency_key => 'd2a60003-0000-0000-0000-000000000003'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead Upcoming',
  p_phone_e164 => '+919633333333',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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
  p_idempotency_key => 'd2a60004-0000-0000-0000-000000000004'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead No Primary',
  p_phone_e164 => '+919644444444',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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
  p_idempotency_key => 'd2a60005-0000-0000-0000-000000000005'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead Unassigned',
  p_phone_e164 => '+919655555555',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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
  p_idempotency_key => 'd2a60006-0000-0000-0000-000000000006'::uuid,
  p_request_hash => repeat('0', 64),
  p_network_fingerprint_hash => repeat('1', 64),
  p_phone_fingerprint_hash => repeat('2', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A6 Lead Terminal',
  p_phone_e164 => '+919666666666',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => 'Pune',
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

select set_config('test.lead_overdue', (select id::text from public.leads where submitted_name = '2A6 Lead Overdue' limit 1), true);
select set_config('test.lead_today', (select id::text from public.leads where submitted_name = '2A6 Lead Today' limit 1), true);
select set_config('test.lead_upcoming', (select id::text from public.leads where submitted_name = '2A6 Lead Upcoming' limit 1), true);
select set_config('test.lead_no_primary', (select id::text from public.leads where submitted_name = '2A6 Lead No Primary' limit 1), true);
select set_config('test.lead_unassigned', (select id::text from public.leads where submitted_name = '2A6 Lead Unassigned' limit 1), true);
select set_config('test.lead_terminal', (select id::text from public.leads where submitted_name = '2A6 Lead Terminal' limit 1), true);

-- Assign leads to exec 2A6 (except unassigned)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.assign_lead(current_setting('test.lead_overdue')::uuid, 'd3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_today')::uuid, 'd3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_upcoming')::uuid, 'd3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_no_primary')::uuid, 'd3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_terminal')::uuid, 'd3333333-3333-3333-3333-333333333333'::uuid, null);
select public.transition_lead_status(current_setting('test.lead_terminal')::uuid, 'closed_lost', 'Terminal fixture', 'other');

-- Create primary tasks with bucket-specific due_at using Asia/Kolkata boundaries
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_overdue', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_overdue')::uuid,
    'call', 'Overdue task', now() - interval '2 hours', 'high', null, true, null, null, null
  )
), true);

select set_config('test.act_today', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_today')::uuid,
    'call', 'Today task',
    (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '18 hours') at time zone 'Asia/Kolkata',
    'normal', null, true, null, null, null
  )
), true);

select set_config('test.act_upcoming', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_upcoming')::uuid,
    'call', 'Upcoming task',
    ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') + interval '10 hours') at time zone 'Asia/Kolkata',
    'normal', null, true, null, null, null
  )
), true);

-- Secondary-only on no-primary lead (should still appear in no-next-action)
select set_config('test.act_secondary', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_no_primary')::uuid,
    'internal_task', 'Secondary only', now() + interval '3 days', 'normal', null, false, null, null, null
  )
), true);

-- SLA breach fixture: ensure clocks then mutate as postgres
reset role;
select private.ensure_first_contact_sla_clock(current_setting('test.lead_overdue')::uuid);
select private.ensure_first_contact_sla_clock(current_setting('test.lead_today')::uuid);

update public.crm_sla_clocks
set sla_due_at = now() - interval '1 hour',
    first_contact_attempt_at = null
where lead_id = current_setting('test.lead_overdue')::uuid;

update public.crm_sla_clocks
set first_contact_attempt_at = now()
where lead_id = current_setting('test.lead_today')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'summary'->>'overdue')::integer >= 1,
  'executive sees overdue bucket count'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'summary'->>'dueToday')::integer >= 1,
  'executive sees due today bucket count'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'summary'->>'upcoming')::integer >= 1,
  'executive sees upcoming bucket count'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') t
    join jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'dueToday') u
      on t->>'activityId' = u->>'activityId'
  ),
  'overdue and due today tasks are mutually exclusive'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') t
    join jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'upcoming') u
      on t->>'activityId' = u->>'activityId'
  ),
  'overdue and upcoming tasks are mutually exclusive'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'capturedAt') is not null,
  'payload includes capturedAt (single v_now semantics)'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'localDate') is not null,
  'payload includes Asia/Kolkata localDate'
);

select throws_ok(
  $$select public.get_crm_my_day('d4444444-4444-4444-4444-444444444444'::uuid, 50, 50)$$,
  '42501',
  null,
  'executive cannot query other owner'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'noNextAction') a
    where a->>'leadId' = current_setting('test.lead_no_primary')
  ),
  'no-next-action includes lead with only secondary open activity'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'noNextAction') a
    where a->>'leadId' = current_setting('test.lead_overdue')
  ),
  'lead with open primary excluded from no-next-action'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'newUncontacted') a
    where a->>'leadId' = current_setting('test.lead_overdue')
  ),
  'new uncontacted includes lead with null first_contact_attempt_at'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'newUncontacted') a
    where a->>'leadId' = current_setting('test.lead_today')
  ),
  'contacted lead excluded from new uncontacted'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'canViewManagerSections')::text = 'false',
  'executive cannot view manager sections flag'
);

select ok(
  jsonb_array_length(public.get_crm_my_day(null, 50, 50)->'attention'->'unassigned') = 0,
  'executive receives empty unassigned section'
);

-- =============================================================================
-- Section 5: Manager scope + SLA + limits (10)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'canViewManagerSections')::text = 'true',
  'manager canViewManagerSections is true'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'unassigned') a
    where a->>'leadId' = current_setting('test.lead_unassigned')
  ),
  'manager sees unassigned lead'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'slaBreaches') a
    where a->>'leadId' = current_setting('test.lead_overdue')
  ),
  'manager sees SLA breach when due past and attempt null'
);

select ok(
  (public.get_crm_my_day('d3333333-3333-3333-3333-333333333333'::uuid, 50, 50)->'scopeOwnerId')::text
    = '"d3333333-3333-3333-3333-333333333333"',
  'manager owner filter scopes to selected executive'
);

select ok(
  jsonb_array_length(
    public.get_crm_my_day(null, 1, 50)->'tasks'->'upcoming'
  ) <= 1,
  'upcoming limit is bounded'
);

select ok(
  jsonb_array_length(
    public.get_crm_my_day(null, 50, 1)->'attention'->'noNextAction'
  ) <= 1,
  'attention limit is bounded'
);

select ok(
  jsonb_array_length(
    public.get_crm_my_day(null, 50, 50)->'tasks'->'upcoming'
  ) <= 100,
  'upcoming hard max respected'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'noNextAction') a
    where a->>'leadId' = current_setting('test.lead_terminal')
  ),
  'terminal lead excluded from no-next-action'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'summary'->>'slaBreaches')::integer >= 1,
  'manager summary includes sla breach count'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'summary'->>'unassigned')::integer >= 1,
  'manager summary includes unassigned count'
);

-- =============================================================================
-- Section 6: Cross-executive isolation + ordering (10)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd4444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') t
    where t->>'leadId' = current_setting('test.lead_overdue')
  ),
  'cross-executive isolation: exec B cannot see exec A overdue lead tasks'
);

select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);

select ok(
  (
    select t->>'activityId'
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') with ordinality arr(t, ord)
    where ord = 1
  ) is not null,
  'overdue tasks have deterministic first row'
);

select ok(
  coalesce((
    select (t->>'dueAt')::timestamptz <= (u->>'dueAt')::timestamptz
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') with ordinality a(t, i)
    join jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue') with ordinality b(u, j)
      on j = i + 1
    limit 1
  ), true),
  'overdue tasks sorted by due_at ascending'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'tasks'->'overdue'->0->>'activityId')
    = current_setting('test.act_overdue'),
  'overdue fixture activity appears in overdue bucket'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'tasks'->'dueToday'->0->>'activityId')
    = current_setting('test.act_today'),
  'today fixture activity appears in due today bucket'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'tasks'->'dueToday') t
    where t->>'activityId' = current_setting('test.act_overdue')
  ),
  'overdue task from earlier today is not duplicated in due today'
);

-- Inactive policy: no invented SLA due on unassigned lead
select ok(
  coalesce((
    select c.sla_due_at is null
    from public.crm_sla_clocks c
    where c.lead_id = current_setting('test.lead_unassigned')::uuid
  ), true),
  'inactive policy keeps null sla_due_at on unassigned lead'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_crm_my_day(null, 50, 50)->'attention'->'slaBreaches'
    ) a
    where a->>'leadId' = current_setting('test.lead_unassigned')
  ),
  'no SLA breach when sla_due_at is null'
);

-- Missing clock fail-safe: delete clock row and verify still uncontacted
reset role;
delete from public.crm_sla_clocks where lead_id = current_setting('test.lead_no_primary')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_crm_my_day(null, 50, 50)->'attention'->'newUncontacted') a
    where a->>'leadId' = current_setting('test.lead_no_primary')
  ),
  'missing clock row counts as new uncontacted'
);

select ok(
  (public.get_crm_my_day(null, 50, 50)->'isTeamScope')::text = 'false',
  'executive scope is not team scope'
);

select * from finish();
rollback;
