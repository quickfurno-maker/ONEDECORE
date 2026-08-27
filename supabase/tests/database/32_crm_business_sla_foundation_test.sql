-- CRM 2A-2 — Business SLA foundation pgTAP

begin;
select plan(80);

-- =============================================================================
-- Schema / permission / seed
-- =============================================================================

select has_table('public', 'crm_sla_policies', 'crm_sla_policies exists');
select has_table('public', 'crm_sla_clocks', 'crm_sla_clocks exists');

select has_column('public', 'crm_sla_policies', 'policy_code', 'policy_code');
select has_column('public', 'crm_sla_policies', 'target_business_minutes', 'target_business_minutes');
select has_column('public', 'crm_sla_policies', 'timezone', 'timezone');
select has_column('public', 'crm_sla_policies', 'business_hours_enabled', 'business_hours_enabled');
select has_column('public', 'crm_sla_policies', 'business_hours_config', 'business_hours_config');
select has_column('public', 'crm_sla_policies', 'is_active', 'is_active');
select has_column('public', 'crm_sla_policies', 'effective_from', 'effective_from');
select has_column('public', 'crm_sla_policies', 'activated_at', 'activated_at');
select has_column('public', 'crm_sla_policies', 'updated_by', 'updated_by');

select has_column('public', 'crm_sla_clocks', 'lead_id', 'clock lead_id');
select has_column('public', 'crm_sla_clocks', 'policy_code', 'clock policy_code');
select has_column('public', 'crm_sla_clocks', 'clock_started_at', 'clock_started_at');
select has_column('public', 'crm_sla_clocks', 'sla_due_at', 'sla_due_at');
select has_column('public', 'crm_sla_clocks', 'first_contact_attempt_at', 'first_contact_attempt_at');
select has_column('public', 'crm_sla_clocks', 'breached_at', 'breached_at');

select has_index(
  'public',
  'crm_sla_clocks',
  'idx_crm_sla_clocks_unsatisfied_due',
  'partial unsatisfied due index'
);

select has_function(
  'private',
  'compute_business_sla_due_at',
  array['timestamptz', 'integer', 'text', 'jsonb'],
  'compute_business_sla_due_at exists'
);

select has_function(
  'private',
  'ensure_first_contact_sla_clock',
  array['uuid'],
  'ensure_first_contact_sla_clock exists'
);

-- New-clock path: FOR SHARE on policy before due compute / insert (serialize vs update FOR UPDATE).
-- Existing-clock early return must precede the policy lock.
select results_eq(
  $$
  with def as (
    select pg_get_functiondef(
      'private.ensure_first_contact_sla_clock(uuid)'::regprocedure
    ) as src
  )
  select
    position('for share' in lower(src)) > 0
    and position('return v_row' in lower(src))
      < position('for share' in lower(src))
    and position('for share' in lower(src))
      < position('compute_business_sla_due_at' in lower(src))
    and position('for share' in lower(src))
      < position('insert into public.crm_sla_clocks' in lower(src))
  from def
  $$,
  array[true],
  'ensure locks policy FOR SHARE before due compute/insert; after existing-clock return'
);

select results_eq(
  $$
  with def as (
    select pg_get_functiondef(
      'private.update_crm_sla_policy_impl(text,integer,text,boolean,jsonb,boolean,boolean)'::regprocedure
    ) as src
  )
  select position('for update' in lower(src)) > 0 from def
  $$,
  array[true],
  'update_crm_sla_policy_impl locks policy FOR UPDATE'
);

-- Operation timestamp must be one clock_timestamp() AFTER FOR UPDATE (not now() before lock).
select results_eq(
  $$
  with def as (
    select pg_get_functiondef(
      'private.update_crm_sla_policy_impl(text,integer,text,boolean,jsonb,boolean,boolean)'::regprocedure
    ) as src
  )
  select
    position('for update' in lower(src)) > 0
    and position('v_now := clock_timestamp()' in lower(src)) > 0
    and position('for update' in lower(src))
      < position('v_now := clock_timestamp()' in lower(src))
    and position('v_now := clock_timestamp()' in lower(src))
      < position('activated_at = case' in lower(src))
    and position('v_now := clock_timestamp()' in lower(src))
      < position('effective_from = case' in lower(src))
    and position(':= now()' in lower(src)) = 0
  from def
  $$,
  array[true],
  'update captures one clock_timestamp() after FOR UPDATE for activated_at/effective_from'
);

select has_function(
  'public',
  'update_crm_sla_policy',
  array['text', 'integer', 'text', 'boolean', 'jsonb', 'boolean', 'boolean'],
  'update_crm_sla_policy exists'
);

select results_eq(
  $$select count(*)::integer from public.permissions where code = 'crm.sla.manage' and is_system$$,
  array[1],
  'crm.sla.manage permission exists'
);

select results_eq(
  $$
  select count(*)::integer
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where p.code = 'crm.sla.manage' and r.code = 'super_admin'
  $$,
  array[1],
  'super_admin has crm.sla.manage'
);

select results_eq(
  $$
  select count(*)::integer
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where p.code = 'crm.sla.manage' and r.code in ('sales_manager', 'management', 'sales_executive', 'sales')
  $$,
  array[0],
  'managers/executives do not have crm.sla.manage'
);

select results_eq(
  $$
  select policy_code, target_business_minutes, timezone,
         business_hours_enabled, business_hours_config is null, is_active,
         effective_from is null, activated_at is null
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  $$values ('first_contact', 60, 'Asia/Kolkata', false, true, false, true, true)$$,
  'first_contact seed inactive / unconfigured'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.crm_sla_policies', 'INSERT')$$,
  array[false],
  'authenticated cannot INSERT crm_sla_policies'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.crm_sla_policies', 'UPDATE')$$,
  array[false],
  'authenticated cannot UPDATE crm_sla_policies'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.crm_sla_clocks', 'INSERT')$$,
  array[false],
  'authenticated cannot INSERT crm_sla_clocks'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.crm_sla_clocks', 'UPDATE')$$,
  array[false],
  'authenticated cannot UPDATE crm_sla_clocks'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.crm_sla_clocks', 'DELETE')$$,
  array[false],
  'authenticated cannot DELETE crm_sla_clocks'
);

select results_eq(
  $$select has_function_privilege('anon', 'private.ensure_first_contact_sla_clock(uuid)', 'execute')$$,
  array[false],
  'anon cannot execute ensure_first_contact_sla_clock'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'private.ensure_first_contact_sla_clock(uuid)', 'execute')$$,
  array[false],
  'authenticated cannot execute ensure_first_contact_sla_clock'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.update_crm_sla_policy(text,integer,text,boolean,jsonb,boolean,boolean)', 'execute')$$,
  array[false],
  'anon cannot execute update_crm_sla_policy'
);

-- =============================================================================
-- Config validation + business window (postgres)
-- =============================================================================

select results_eq(
  $$select private.validate_crm_sla_business_hours_config('{"monday":{"start":"09:00","end":"18:00"}}'::jsonb)$$,
  array[true],
  'valid synthetic hours accepted'
);

select results_eq(
  $$select private.validate_crm_sla_business_hours_config('{"moon":{"start":"09:00","end":"18:00"}}'::jsonb)$$,
  array[false],
  'unknown weekday rejected'
);

select results_eq(
  $$select private.validate_crm_sla_business_hours_config('{"monday":{"start":"9:00","end":"18:00"}}'::jsonb)$$,
  array[false],
  'malformed HH:MM rejected'
);

select results_eq(
  $$select private.validate_crm_sla_business_hours_config('{"monday":{"start":"18:00","end":"09:00"}}'::jsonb)$$,
  array[false],
  'start >= end rejected'
);

select results_eq(
  $$select private.validate_crm_sla_business_hours_config('{}'::jsonb)$$,
  array[false],
  'empty enabled-day config rejected'
);

select results_eq(
  $$select private.crm_sla_timezone_is_valid('Asia/Kolkata')$$,
  array[true],
  'Asia/Kolkata valid'
);

select results_eq(
  $$select private.crm_sla_timezone_is_valid('Not/AZone')$$,
  array[false],
  'invalid timezone rejected'
);

-- Synthetic Mon–Fri 09:00–18:00 Asia/Kolkata
select set_config('test.hours', '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":{"start":"09:00","end":"18:00"},"thursday":{"start":"09:00","end":"18:00"},"friday":{"start":"09:00","end":"18:00"}}', true);

-- Inside window: Tue 2026-03-10 10:00 IST + 60 => 11:00 IST
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 10:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-10 11:00:00'],
  'inside window adds business minutes'
);

-- Sub-minute precision: 10:00:30 + 60 => 11:00:30 (no whole-minute rounding)
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 10:00:30'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-10 11:00:30'],
  'inside window preserves receipt seconds (10:00:30 + 60 => 11:00:30)'
);

-- Near close: 17:59:30 + 1 business minute => next open + 30s
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 17:59:30'),
    1,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-11 09:00:30'],
  'near close carries remaining sub-minute into next opening'
);

-- Before open: 08:00 => start 09:00 + 60 => 10:00
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 08:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-10 10:00:00'],
  'before open starts at opening'
);

-- Exact open
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 09:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-10 10:00:00'],
  'exact open counts immediately'
);

-- Exact close => next open + 60
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 18:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-11 10:00:00'],
  'exact close moves to next opening'
);

-- After close
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 19:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-11 10:00:00'],
  'after close moves to next opening'
);

-- Sunday (disabled) => Monday 10:00
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-08 12:00:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-09 10:00:00'],
  'disabled day moves to next enabled opening'
);

-- Cross closing: 17:30 + 60 => Wed 09:30
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-10 17:30:00'),
    60,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-11 09:30:00'],
  'crossing one closing boundary carries remainder'
);

-- Multi-day: Fri 17:00 + 120 => Mon 10:00 (60 Fri + weekend skip + 60 Mon)
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-13 17:00:00'),
    120,
    'Asia/Kolkata',
    current_setting('test.hours')::jsonb
  ))::text
  $$,
  array['2026-03-16 10:00:00'],
  'crossing weekend carries remaining minutes'
);

-- Inactive / invalid => NULL (fail closed)
select results_eq(
  $$select private.compute_business_sla_due_at(now(), 60, 'Asia/Kolkata', null) is null$$,
  array[true],
  'invalid/missing config => NULL fail-closed'
);

-- Sparse-but-valid: Mon-only 09:00–09:01, target 60 — old fixed 400-day guard would fail
select results_eq(
  $$
  select timezone('Asia/Kolkata', private.compute_business_sla_due_at(
    timezone('Asia/Kolkata', timestamp '2026-03-09 09:00:00'),
    60,
    'Asia/Kolkata',
    '{"monday":{"start":"09:00","end":"09:01"}}'::jsonb
  ))::text
  $$,
  array['2027-04-26 09:01:00'],
  'sparse weekly 1-minute window + target 60 computes without CRM_SLA_COMPUTE_GUARD'
);

-- =============================================================================
-- Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa2a2@example.test', 'authenticated', 'authenticated'),
  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr2a2@example.test', 'authenticated', 'authenticated'),
  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'execa2a2@example.test', 'authenticated', 'authenticated'),
  ('a4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'execb2a2@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444'
);

insert into public.user_roles (user_id, role_id)
select 'a1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'a2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'a3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'a4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';

select * from public.submit_lead_intake(
  p_idempotency_key => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A2 Lead A',
  p_phone_e164 => '+919411111111',
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

select * from public.submit_lead_intake(
  p_idempotency_key => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A2 Lead B',
  p_phone_e164 => '+919422222222',
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

select set_config('test.lead_a', (select id::text from public.leads where submitted_name = '2A2 Lead A' limit 1), true);
select set_config('test.lead_b', (select id::text from public.leads where submitted_name = '2A2 Lead B' limit 1), true);

-- Ensure clocks under inactive policy (NULL due; no attempt inference)
select private.ensure_first_contact_sla_clock(current_setting('test.lead_a')::uuid);
select private.ensure_first_contact_sla_clock(current_setting('test.lead_b')::uuid);

select results_eq(
  $$
  select clock_started_at = l.created_at,
         sla_due_at is null,
         first_contact_attempt_at is null,
         breached_at is null,
         policy_code
  from public.crm_sla_clocks c
  join public.leads l on l.id = c.lead_id
  where c.lead_id = current_setting('test.lead_a')::uuid
  $$,
  $$values (true, true, true, true, 'first_contact')$$,
  'inactive ensure: started_at=receipt, dues/attempts null'
);

select results_eq(
  $$
  select count(*)::integer from public.crm_sla_clocks
  where lead_id in (current_setting('test.lead_a')::uuid, current_setting('test.lead_b')::uuid)
    and sla_due_at is null
    and first_contact_attempt_at is null
  $$,
  array[2],
  'fixture clocks due NULL with no historical attempt inference'
);

-- =============================================================================
-- Activation / edit / deactivate / reactivate
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.update_crm_sla_policy('first_contact', null, null, true, null, false, true)$$,
  '22023',
  'CRM_SLA_ACTIVATION_REQUIRES_HOURS',
  'activation without config rejected'
);

select throws_ok(
  $$select public.update_crm_sla_policy('first_contact', null, 'Not/AZone', null, null, false, null)$$,
  '22023',
  'CRM_SLA_TIMEZONE_INVALID',
  'invalid timezone rejected by RPC'
);

select lives_ok(
  $$
  select public.update_crm_sla_policy(
    'first_contact',
    60,
    'Asia/Kolkata',
    true,
    current_setting('test.hours')::jsonb,
    false,
    true
  )
  $$,
  'first activation with synthetic hours succeeds'
);

select results_eq(
  $$
  select is_active, business_hours_enabled, business_hours_config is not null,
         activated_at is not null, effective_from is not null,
         activated_at = effective_from
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  $$values (true, true, true, true, true, true)$$,
  'first activation sets activated_at = effective_from'
);

select set_config('test.activated_at', (
  select activated_at::text from public.crm_sla_policies where policy_code = 'first_contact'
), true);
select set_config('test.effective_from', (
  select effective_from::text from public.crm_sla_policies where policy_code = 'first_contact'
), true);

-- Normal edit while active preserves activation timestamps
select public.update_crm_sla_policy('first_contact', 90, null, null, null, false, null);

select results_eq(
  $$
  select target_business_minutes,
         activated_at::text = current_setting('test.activated_at'),
         effective_from::text = current_setting('test.effective_from')
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  $$values (90, true, true)$$,
  'normal edit preserves activated_at/effective_from'
);

-- Existing NULL due must NOT be filled by ensure after activation
reset role;
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  $$select (private.ensure_first_contact_sla_clock(current_setting('test.lead_a')::uuid)).sla_due_at is null$$,
  array[true],
  'ensure does not silently fill existing NULL due after activation'
);

-- Force lead.created_at after effective_from by inserting via intake then bumping created_at
select * from public.submit_lead_intake(
  p_idempotency_key => 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A2 Lead C',
  p_phone_e164 => '+919433333333',
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

select set_config('test.lead_c', (select id::text from public.leads where submitted_name = '2A2 Lead C' limit 1), true);

-- Place receipt inside a known window after effective_from
update public.leads
set created_at = timezone('Asia/Kolkata', timestamp '2026-06-02 10:00:00')
where id = current_setting('test.lead_c')::uuid;

-- Also bump effective_from earlier so in-scope
update public.crm_sla_policies
set effective_from = timezone('Asia/Kolkata', timestamp '2026-06-01 00:00:00'),
    activated_at = timezone('Asia/Kolkata', timestamp '2026-06-01 00:00:00')
where policy_code = 'first_contact';

-- CRM 2A-7 receipt trigger may have created a snapshot clock at insert; delete to
-- exercise the new-clock path with corrected receipt time + active policy.
delete from public.crm_sla_clocks
where lead_id = current_setting('test.lead_c')::uuid;

select private.ensure_first_contact_sla_clock(current_setting('test.lead_c')::uuid);

select results_eq(
  $$select sla_due_at is not null from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid$$,
  array[true],
  'active in-scope newly created clock gets due'
);

select set_config('test.due_c', (
  select sla_due_at::text from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.update_crm_sla_policy('first_contact', 30, null, null, null, false, null);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  $$
  select sla_due_at::text = current_setting('test.due_c'),
         (private.ensure_first_contact_sla_clock(current_setting('test.lead_c')::uuid)).sla_due_at::text
           = current_setting('test.due_c')
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid
  $$,
  $$values (true, true)$$,
  'existing non-NULL due unchanged after target edit / ensure'
);

-- Pre-effective clock remains NULL
select * from public.submit_lead_intake(
  p_idempotency_key => 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A2 Lead D',
  p_phone_e164 => '+919444444444',
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

select set_config('test.lead_d', (select id::text from public.leads where submitted_name = '2A2 Lead D' limit 1), true);

update public.leads
set created_at = timezone('Asia/Kolkata', timestamp '2026-05-01 10:00:00')
where id = current_setting('test.lead_d')::uuid;

delete from public.crm_sla_clocks
where lead_id = current_setting('test.lead_d')::uuid;

select results_eq(
  $$select (private.ensure_first_contact_sla_clock(current_setting('test.lead_d')::uuid)).sla_due_at is null$$,
  array[true],
  'pre-effective clock remains due NULL'
);

-- Deactivate / reactivate preserve timestamps
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('test.activated_at', (
  select activated_at::text from public.crm_sla_policies where policy_code = 'first_contact'
), true);
select set_config('test.effective_from', (
  select effective_from::text from public.crm_sla_policies where policy_code = 'first_contact'
), true);

select public.update_crm_sla_policy('first_contact', null, null, null, null, false, false);

select results_eq(
  $$
  select is_active = false,
         activated_at::text = current_setting('test.activated_at'),
         effective_from::text = current_setting('test.effective_from')
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  $$values (true, true, true)$$,
  'deactivation preserves activated_at/effective_from'
);

select public.update_crm_sla_policy('first_contact', null, null, null, null, false, true);

select results_eq(
  $$
  select is_active = true,
         activated_at::text = current_setting('test.activated_at'),
         effective_from::text = current_setting('test.effective_from')
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  $$values (true, true, true)$$,
  'reactivation preserves original activation timestamps'
);

-- Manager / executive mutation denied
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.update_crm_sla_policy('first_contact', 45, null, null, null, false, null)$$,
  '42501',
  'Permission denied to manage CRM SLA policy',
  'manager cannot mutate SLA policy'
);

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.update_crm_sla_policy('first_contact', 45, null, null, null, false, null)$$,
  '42501',
  'Permission denied to manage CRM SLA policy',
  'executive cannot mutate SLA policy'
);

-- =============================================================================
-- Clock SELECT visibility + direct DML blocked
-- =============================================================================

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.assign_lead(
  current_setting('test.lead_a')::uuid,
  'a3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select count(*)::integer from public.crm_sla_clocks where lead_id = current_setting('test.lead_a')::uuid$$,
  array[1],
  'assignee can SELECT own lead clock'
);

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);
select results_eq(
  $$select count(*)::integer from public.crm_sla_clocks where lead_id = current_setting('test.lead_a')::uuid$$,
  array[0],
  'other executive cannot SELECT non-visible lead clock'
);

select throws_ok(
  $$
  insert into public.crm_sla_clocks (lead_id, policy_code, clock_started_at)
  values (current_setting('test.lead_b')::uuid, 'first_contact', now())
  $$,
  '42501',
  null,
  'direct authenticated insert blocked'
);

select throws_ok(
  $$
  update public.crm_sla_clocks
  set breached_at = now()
  where lead_id = current_setting('test.lead_a')::uuid
  $$,
  '42501',
  null,
  'direct authenticated update blocked'
);

select throws_ok(
  $$delete from public.crm_sla_clocks where lead_id = current_setting('test.lead_a')::uuid$$,
  '42501',
  null,
  'direct authenticated delete blocked'
);

-- =============================================================================
-- Breach foundation (query-derived)
-- =============================================================================

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Use lead_c (has due); set due in past for breach predicate
update public.crm_sla_clocks
set sla_due_at = now() - interval '1 hour',
    first_contact_attempt_at = null
where lead_id = current_setting('test.lead_c')::uuid;

select results_eq(
  $$
  select (sla_due_at is not null
      and first_contact_attempt_at is null
      and now() > sla_due_at)
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid
  $$,
  array[true],
  'due past + attempt NULL => query-derived breach true'
);

update public.crm_sla_clocks
set sla_due_at = now() + interval '1 hour'
where lead_id = current_setting('test.lead_c')::uuid;

select results_eq(
  $$
  select (sla_due_at is not null
      and first_contact_attempt_at is null
      and now() > sla_due_at)
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid
  $$,
  array[false],
  'due future => breach false'
);

update public.crm_sla_clocks
set sla_due_at = now() - interval '1 hour',
    first_contact_attempt_at = now()
where lead_id = current_setting('test.lead_c')::uuid;

select results_eq(
  $$
  select (sla_due_at is not null
      and first_contact_attempt_at is null
      and now() > sla_due_at)
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_c')::uuid
  $$,
  array[false],
  'attempt present => breach false'
);

select results_eq(
  $$
  select (sla_due_at is not null
      and first_contact_attempt_at is null
      and now() > sla_due_at)
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_a')::uuid
  $$,
  array[false],
  'due NULL => breach false'
);

-- Leave production-like inactive seed for other suites? This test transaction rolls back.
-- Restore inactive semantics within txn for clarity
update public.crm_sla_policies
set is_active = false,
    business_hours_enabled = false,
    business_hours_config = null,
    effective_from = null,
    activated_at = null,
    target_business_minutes = 60
where policy_code = 'first_contact';

select results_eq(
  $$
  select is_active = false and business_hours_config is null
  from public.crm_sla_policies where policy_code = 'first_contact'
  $$,
  array[true],
  'test leaves policy inactive (txn rollback still applies)'
);

select * from finish();
rollback;
