-- CRM 2A-3 — Activity RPC workflows pgTAP (complete-with-next, On Hold, Closed Lost,
-- Call + governed-WhatsApp attempt marking, structured outcome enforcement, legacy compat)

begin;
select plan(129);

-- =============================================================================
-- Section 1: Schema / RPC surface, privileges, lock-order architecture (27)
-- =============================================================================

-- Public wrappers (SECURITY INVOKER) — full typed signatures per plan §6.1
select has_function(
  'public',
  'create_lead_activity',
  array['uuid','text','text','timestamptz','text','uuid','boolean','integer','timestamptz','uuid'],
  'public.create_lead_activity exists with 10-arg typed signature'
);

select has_function(
  'public',
  'reschedule_lead_activity',
  array['uuid','timestamptz','timestamptz','boolean'],
  'public.reschedule_lead_activity exists with 4-arg typed signature'
);

select has_function(
  'public',
  'transfer_activity_ownership',
  array['uuid','uuid'],
  'public.transfer_activity_ownership exists with 2-arg typed signature'
);

select has_function(
  'public',
  'designate_primary_next_action',
  array['uuid'],
  'public.designate_primary_next_action exists with 1-arg typed signature'
);

select has_function(
  'public',
  'complete_lead_activity',
  array['uuid','text','text','text','text','text','timestamptz','text','integer','timestamptz','uuid','text','timestamptz','text','text','uuid'],
  'public.complete_lead_activity exists with 16-arg typed signature'
);

-- Private helpers — use overload-agnostic checks so plan-locked signatures may evolve safely
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'mark_first_contact_attempt_if_qualifying'
  ),
  'private.mark_first_contact_attempt_if_qualifying exists'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'validate_crm_whatsapp_send_evidence'
  ),
  'private.validate_crm_whatsapp_send_evidence exists'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'clear_open_primary_for_lead'
  ),
  'private.clear_open_primary_for_lead exists'
);

-- All new 2A-3 private impls must be SECURITY DEFINER with pinned empty search_path
select ok(
  (
    select bool_and(
      p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'create_lead_activity_impl',
        'reschedule_lead_activity_impl',
        'transfer_activity_ownership_impl',
        'designate_primary_next_action_impl',
        'complete_lead_activity_impl',
        'mark_first_contact_attempt_if_qualifying',
        'validate_crm_whatsapp_send_evidence',
        'clear_open_primary_for_lead'
      )
  ),
  'all 2A-3 private impls are SECURITY DEFINER with pinned search_path'
);

-- anon cannot execute any public RPC
select results_eq(
  $$select has_function_privilege('anon', 'public.create_lead_activity(uuid,text,text,timestamptz,text,uuid,boolean,integer,timestamptz,uuid)', 'execute')$$,
  array[false],
  'anon cannot execute create_lead_activity'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.reschedule_lead_activity(uuid,timestamptz,timestamptz,boolean)', 'execute')$$,
  array[false],
  'anon cannot execute reschedule_lead_activity'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.transfer_activity_ownership(uuid,uuid)', 'execute')$$,
  array[false],
  'anon cannot execute transfer_activity_ownership'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.designate_primary_next_action(uuid)', 'execute')$$,
  array[false],
  'anon cannot execute designate_primary_next_action'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.complete_lead_activity(uuid,text,text,text,text,text,timestamptz,text,integer,timestamptz,uuid,text,timestamptz,text,text,uuid)', 'execute')$$,
  array[false],
  'anon cannot execute complete_lead_activity'
);

-- authenticated can execute all public RPCs
select results_eq(
  $$select has_function_privilege('authenticated', 'public.create_lead_activity(uuid,text,text,timestamptz,text,uuid,boolean,integer,timestamptz,uuid)', 'execute')$$,
  array[true],
  'authenticated can execute create_lead_activity'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.reschedule_lead_activity(uuid,timestamptz,timestamptz,boolean)', 'execute')$$,
  array[true],
  'authenticated can execute reschedule_lead_activity'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.transfer_activity_ownership(uuid,uuid)', 'execute')$$,
  array[true],
  'authenticated can execute transfer_activity_ownership'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.designate_primary_next_action(uuid)', 'execute')$$,
  array[true],
  'authenticated can execute designate_primary_next_action'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.complete_lead_activity(uuid,text,text,text,text,text,timestamptz,text,integer,timestamptz,uuid,text,timestamptz,text,text,uuid)', 'execute')$$,
  array[true],
  'authenticated can execute complete_lead_activity'
);

-- Private helpers are locked away from anon+authenticated (called only from DEFINER impls)
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'mark_first_contact_attempt_if_qualifying'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'anon cannot execute private.mark_first_contact_attempt_if_qualifying'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'mark_first_contact_attempt_if_qualifying'
      and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  'authenticated cannot execute private.mark_first_contact_attempt_if_qualifying'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'validate_crm_whatsapp_send_evidence'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'anon cannot execute private.validate_crm_whatsapp_send_evidence'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'validate_crm_whatsapp_send_evidence'
      and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  'authenticated cannot execute private.validate_crm_whatsapp_send_evidence'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'clear_open_primary_for_lead'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'anon cannot execute private.clear_open_primary_for_lead'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'clear_open_primary_for_lead'
      and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  'authenticated cannot execute private.clear_open_primary_for_lead'
);

-- Lock-order architecture: create_lead_activity_impl must SELECT lead FOR UPDATE
-- before evaluating crm_can_mutate_lead / any primary-decision path (matches test 31 style).
select results_eq(
  $$
  with def as (
    select pg_get_functiondef(p.oid) as src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'create_lead_activity_impl'
    limit 1
  )
  select
    position('for update' in lower(src)) > 0
    and position('for update' in lower(src))
      < position('crm_can_mutate_lead' in lower(src))
  from def
  $$,
  array[true],
  'create_lead_activity_impl locks lead FOR UPDATE before crm_can_mutate_lead'
);

-- Same lock discipline for complete_lead_activity_impl (complete-with-next racing).
select results_eq(
  $$
  with def as (
    select pg_get_functiondef(p.oid) as src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'complete_lead_activity_impl'
    limit 1
  )
  select
    position('for update' in lower(src)) > 0
    and position('for update' in lower(src))
      < position('crm_can_mutate_lead' in lower(src))
  from def
  $$,
  array[true],
  'complete_lead_activity_impl locks lead FOR UPDATE before crm_can_mutate_lead'
);

-- Qualifying Call/WhatsApp clock lock must precede v_now := clock_timestamp().
select results_eq(
  $$
  with def as (
    select pg_get_functiondef(p.oid) as src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'complete_lead_activity_impl'
    limit 1
  )
  select
    position('from public.crm_sla_clocks' in lower(src)) > 0
    and position('for update' in lower(substr(
      src,
      position('from public.crm_sla_clocks' in lower(src))
    ))) > 0
    and position('from public.crm_sla_clocks' in lower(src))
      < position('v_now := clock_timestamp()' in lower(src))
  from def
  $$,
  array[true],
  'complete locks crm_sla_clocks FOR UPDATE before capturing v_now'
);

-- =============================================================================
-- Fixtures: 4 staff, 4 leads (active exec-a; on_hold; closed_lost; whatsapp)
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa2a3@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr2a3@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'execa2a3@example.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'execb2a3@example.test', 'authenticated', 'authenticated');

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

-- Four leads via canonical intake path
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead X',
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

select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Hold',
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

select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Terminal',
  p_phone_e164 => '+919533333333',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
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
  p_idempotency_key => 'cbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead WA',
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
  p_consent_whatsapp => true,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => 'whatsapp-service-v0.1-draft',
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select set_config('test.lead_x', (select id::text from public.leads where submitted_name = '2A3 Lead X' limit 1), true);
select set_config('test.lead_hold', (select id::text from public.leads where submitted_name = '2A3 Lead Hold' limit 1), true);
select set_config('test.lead_term', (select id::text from public.leads where submitted_name = '2A3 Lead Terminal' limit 1), true);
select set_config('test.lead_wa', (select id::text from public.leads where submitted_name = '2A3 Lead WA' limit 1), true);
select set_config('test.wa_contact_id', (select contact_id::text from public.leads where submitted_name = '2A3 Lead WA' limit 1), true);

-- Assign leads via manager
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.assign_lead(current_setting('test.lead_x')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_hold')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_term')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_wa')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);

-- Transition hold + terminal leads to their target states (before running 2A-3 tests)
select public.transition_lead_status(current_setting('test.lead_hold')::uuid, 'on_hold', 'Hold for budget review');
select public.transition_lead_status(current_setting('test.lead_term')::uuid, 'closed_lost', 'Closed for terminal fixture', 'other');

-- =============================================================================
-- Section 2: CREATE — happy + deny + delegation + terminal / on_hold guards (12)
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Secondary create (owner defaults to auth.uid())
select set_config('test.act_sec_x', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Discovery call',
    now() + interval '2 days',
    'normal',
    null,
    false,
    null,
    null,
    null
  )
), true);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_sec_x')::uuid$$,
  array[false],
  'secondary create returns non-primary row'
);

select results_eq(
  $$select source from public.lead_follow_ups
    where id = current_setting('test.act_sec_x')::uuid$$,
  array['manual'::text],
  'public create forces source=manual'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_sec_x')::uuid
      and event_type = 'created'$$,
  array[1],
  'secondary create emits exactly one created event'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where reference_id = current_setting('test.act_sec_x')::uuid
      and activity_type = 'follow_up.scheduled'$$,
  array[1],
  'secondary create writes follow_up.scheduled summary'
);

-- Prime a primary via legacy path so we can test that a NEW primary demotes the old one
select set_config('test.act_prev_primary', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_x')::uuid,
    now() + interval '3 days',
    'c3333333-3333-3333-3333-333333333333'::uuid
  )
), true);

select set_config('test.act_new_primary', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'consultation',
    'Design consultation',
    now() + interval '4 days',
    'high',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    true,
    60,
    null,
    null
  )
), true);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_new_primary')::uuid
      and event_type = 'primary_designated'$$,
  array[1],
  'primary create emits primary_designated for new row'
);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_prev_primary')::uuid$$,
  array[false],
  'primary create demotes previous open primary flag'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_prev_primary')::uuid
      and event_type = 'primary_cleared'$$,
  array[1],
  'demoted primary receives primary_cleared event'
);

select results_eq(
  $$select status from public.lead_follow_ups
    where id = current_setting('test.act_prev_primary')::uuid$$,
  array['open'::text],
  'demoted primary row preserved (still open, never deleted)'
);

-- Manager delegation: owner may differ from actor IFF target passes crm_user_can_operate_lead.
-- Lead X is assigned to exec A (c3333); exec B (c4444) is assignment-scoped and NOT authorized.
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Unauthorized target owner',
    now() + interval '5 days',
    'normal',
    'c4444444-4444-4444-4444-444444444444'::uuid,
    false,
    null,
    null,
    null
  )$$,
  '42501',
  null,
  'manager cannot delegate to operator who fails crm_user_can_operate_lead for the lead'
);

-- Authorized delegation: manager creates secondary owned by the lead assignee (not the manager)
select set_config('test.act_delegated', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Delegated follow-up',
    now() + interval '5 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);

select results_eq(
  $$select owner_id::text, created_by::text from public.lead_follow_ups
    where id = current_setting('test.act_delegated')::uuid$$,
  $$values (
    'c3333333-3333-3333-3333-333333333333'::text,
    'c2222222-2222-2222-2222-222222222222'::text
  )$$,
  'manager may create activity owned by authorized assignee (actor ≠ owner)'
);

-- Sales exec cannot delegate to another exec (self-only)
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Cross-owner attempt',
    now() + interval '6 days',
    'normal',
    'c4444444-4444-4444-4444-444444444444'::uuid,
    false,
    null,
    null,
    null
  )$$,
  '42501',
  null,
  'sales executive cannot delegate follow-up to another owner'
);

-- Terminal lead rejects any primary create
select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_term')::uuid,
    'call',
    'Post-close primary attempt',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    true,
    null,
    null,
    null
  )$$,
  null,
  null,
  'terminal (closed_lost) lead rejects primary create'
);

-- On Hold lead rejects a manual primary create (only on_hold_review source may be primary)
select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_hold')::uuid,
    'call',
    'Manual primary while held',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    true,
    null,
    null,
    null
  )$$,
  null,
  null,
  'on_hold lead rejects manual (non-review) primary create'
);

-- =============================================================================
-- Section 3: RESCHEDULE — future-due invariant + reminder events + no-op (6)
-- =============================================================================

select set_config('test.act_rs', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Reschedulable',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    now() + interval '1 day',
    null
  )
), true);

-- Success future due
select ok(
  (
    select (public.reschedule_lead_activity(
      current_setting('test.act_rs')::uuid,
      now() + interval '5 days',
      null,
      false
    )).due_at > now() + interval '4 days'
  ),
  'reschedule to future due succeeds and returns updated row'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_rs')::uuid
      and event_type = 'rescheduled'$$,
  array[1],
  'reschedule emits rescheduled event'
);

-- Past due rejected
select throws_ok(
  $$select public.reschedule_lead_activity(
    current_setting('test.act_rs')::uuid,
    now() - interval '1 hour',
    null,
    false
  )$$,
  null,
  'ACTIVITY_DUE_MUST_BE_FUTURE',
  'past due rejected with ACTIVITY_DUE_MUST_BE_FUTURE'
);

-- Same-value no-op (no new rescheduled event)
select public.reschedule_lead_activity(
  current_setting('test.act_rs')::uuid,
  (select due_at from public.lead_follow_ups where id = current_setting('test.act_rs')::uuid),
  null,
  false
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_rs')::uuid
      and event_type = 'rescheduled'$$,
  array[1],
  'same-value reschedule is a no-op (no new rescheduled event)'
);

-- Reminder change emits reminder_changed
select public.reschedule_lead_activity(
  current_setting('test.act_rs')::uuid,
  (select due_at from public.lead_follow_ups where id = current_setting('test.act_rs')::uuid),
  now() + interval '2 days',
  false
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_rs')::uuid
      and event_type = 'reminder_changed'$$,
  array[1],
  'reminder change emits reminder_changed event'
);

-- Non-open (cancelled) rejected. Use legacy cancel to make it non-open.
select public.cancel_lead_follow_up(current_setting('test.act_rs')::uuid, 'client cancelled');
select throws_ok(
  $$select public.reschedule_lead_activity(
    current_setting('test.act_rs')::uuid,
    now() + interval '10 days',
    null,
    false
  )$$,
  null,
  'ACTIVITY_NOT_OPEN',
  'non-open activity rejects reschedule with ACTIVITY_NOT_OPEN'
);

-- =============================================================================
-- Section 4: TRANSFER — secondary only, primary reassignment guard, no-op (4)
-- =============================================================================

select set_config('test.act_xfer', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'Transferable',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

-- Target must pass crm_user_can_operate_lead: exec B cannot operate lead assigned to exec A.
select throws_ok(
  $$select public.transfer_activity_ownership(
    current_setting('test.act_xfer')::uuid,
    'c4444444-4444-4444-4444-444444444444'::uuid
  )$$,
  '42501',
  null,
  'transfer rejects unauthorized target owner'
);

-- Authorized transfer: secondary → manager (broad-scope, eligible for this lead)
select public.transfer_activity_ownership(
  current_setting('test.act_xfer')::uuid,
  'c2222222-2222-2222-2222-222222222222'::uuid
);

select results_eq(
  $$select owner_id::text from public.lead_follow_ups
    where id = current_setting('test.act_xfer')::uuid$$,
  array['c2222222-2222-2222-2222-222222222222'::text],
  'secondary transfer updates owner to authorized operator'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_xfer')::uuid
      and event_type = 'ownership_transferred'$$,
  array[1],
  'secondary transfer emits ownership_transferred event'
);

-- Same owner => stable no-op (no new event)
select public.transfer_activity_ownership(
  current_setting('test.act_xfer')::uuid,
  'c2222222-2222-2222-2222-222222222222'::uuid
);
select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_xfer')::uuid
      and event_type = 'ownership_transferred'$$,
  array[1],
  'same-owner transfer is stable no-op (no new event)'
);

-- Primary transfer must be blocked (use whole-lead reassignment instead)
select throws_ok(
  $$select public.transfer_activity_ownership(
    current_setting('test.act_new_primary')::uuid,
    'c4444444-4444-4444-4444-444444444444'::uuid
  )$$,
  null,
  'PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT',
  'primary transfer rejected with PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT'
);

-- =============================================================================
-- Section 5: DESIGNATE — switch primary, non-open + terminal guards, no-op (6)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
-- Create a new secondary we can designate
select set_config('test.act_desig', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'call',
    'To be designated',
    now() + interval '6 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.designate_primary_next_action(current_setting('test.act_desig')::uuid);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_desig')::uuid$$,
  array[true],
  'designate flips target to primary'
);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_new_primary')::uuid$$,
  array[false],
  'designate demotes previously open primary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_desig')::uuid
      and event_type = 'primary_designated'$$,
  array[1],
  'designate emits primary_designated on target'
);

-- Idempotent no-op (already primary => stable)
select public.designate_primary_next_action(current_setting('test.act_desig')::uuid);
select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_desig')::uuid
      and event_type = 'primary_designated'$$,
  array[1],
  'already-primary designate is stable no-op (no duplicate event)'
);

-- Non-open designate rejected
select throws_ok(
  $$select public.designate_primary_next_action(current_setting('test.act_rs')::uuid)$$,
  null,
  'ACTIVITY_NOT_OPEN',
  'designate on cancelled activity rejected with ACTIVITY_NOT_OPEN'
);

-- Terminal-lead designate rejected. Create an activity on terminal lead first
select set_config('test.act_term', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_term')::uuid,
    'internal_task',
    'Post-close housekeeping',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);
select throws_ok(
  $$select public.designate_primary_next_action(current_setting('test.act_term')::uuid)$$,
  null,
  null,
  'terminal lead rejects primary designation'
);

-- =============================================================================
-- Section 6: OUTCOME / COMPLETE — validation + NEXT_PRIMARY + CLOSED_WON guard (14)
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

-- Missing outcome
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_desig')::uuid,
    null,
    null,
    'NEXT_PRIMARY',
    'call',
    'Next round',
    now() + interval '3 days',
    'normal',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )$$,
  null,
  'ACTIVITY_OUTCOME_REQUIRED',
  'missing outcome_code rejects with ACTIVITY_OUTCOME_REQUIRED'
);

-- Invalid outcome
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_desig')::uuid,
    'never_exists_code_xyz',
    null,
    'NEXT_PRIMARY',
    'call',
    'Next round',
    now() + interval '3 days',
    'normal',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )$$,
  null,
  'ACTIVITY_OUTCOME_INVALID',
  'unknown outcome_code rejects with ACTIVITY_OUTCOME_INVALID'
);

-- Primary complete without any resolution
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_desig')::uuid,
    'connected',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )$$,
  null,
  'NEXT_ACTION_REQUIRED',
  'primary complete without resolution rejects NEXT_ACTION_REQUIRED'
);

-- Primary NEXT_PRIMARY happy path: creates a chained primary
select public.complete_lead_activity(
  current_setting('test.act_desig')::uuid,
  'connected',
  'Reached the client',
  'NEXT_PRIMARY',
  'call',
  'Second call',
  now() + interval '3 days',
  'normal',
  30,
  null,
  null,
  null,
  null,
  null,
  null,
  null
);

select set_config('test.act_next_primary', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_x')::uuid
    and is_primary_next_action
    and source = 'completion_chain'
  order by created_at desc limit 1
), true);

select results_eq(
  $$select source from public.lead_follow_ups
    where id = current_setting('test.act_next_primary')::uuid$$,
  array['completion_chain'::text],
  'NEXT_PRIMARY chained activity has source=completion_chain'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_x')::uuid
      and status = 'open'
      and is_primary_next_action$$,
  array[1],
  'exactly one open primary after NEXT_PRIMARY chain'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_desig')::uuid
      and event_type = 'completed'$$,
  array[1],
  'complete emits completed event'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_desig')::uuid
      and event_type = 'outcome_recorded'$$,
  array[1],
  'complete emits outcome_recorded event'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_desig')::uuid
      and event_type = 'primary_cleared'$$,
  array[1],
  'completing primary emits primary_cleared for old row'
);

select results_eq(
  $$select status from public.lead_follow_ups
    where id = current_setting('test.act_desig')::uuid$$,
  array['completed'::text],
  'completed activity status becomes completed'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where reference_id = current_setting('test.act_desig')::uuid
      and activity_type = 'follow_up.completed'$$,
  array[1],
  'complete writes follow_up.completed summary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_next_primary')::uuid
      and event_type = 'primary_designated'$$,
  array[1],
  'chained NEXT_PRIMARY row receives primary_designated event'
);

-- Secondary complete with surviving primary + NONE succeeds
select set_config('test.act_sec_ok', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_x')::uuid,
    'internal_task',
    'Ad-hoc task',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);
select lives_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_sec_ok')::uuid,
    'completed',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null, null
  )$$,
  'secondary complete NONE with surviving primary succeeds'
);

-- Complete surviving primary, then a further secondary NONE with no primary must fail
select public.complete_lead_activity(
  current_setting('test.act_next_primary')::uuid,
  'connected',
  null,
  'CLOSED_LOST',
  null, null, null, null, null, null, null,
  null, null,
  'Not proceeding for now',
  'other',
  null
);
-- Create a fresh activity on that (now closed_lost) lead? Section 11 covers that.
-- For NONE-without-primary we need a different active lead.
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5'::uuid,
  p_request_hash => repeat('e', 64),
  p_network_fingerprint_hash => repeat('f', 64),
  p_phone_fingerprint_hash => repeat('0', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead NoPrim',
  p_phone_e164 => '+919555555555',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_noprim', (
  select id::text from public.leads where submitted_name = '2A3 Lead NoPrim' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_noprim')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

-- Create a secondary on active lead with NO open primary
select set_config('test.act_sec_nop', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_noprim')::uuid,
    'internal_task',
    'Solo secondary',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_sec_nop')::uuid,
    'completed',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null, null
  )$$,
  null,
  'NEXT_ACTION_REQUIRED',
  'secondary NONE without surviving primary rejects NEXT_ACTION_REQUIRED on active lead'
);

-- CLOSED_WON resolution token must be rejected on any active-lead complete path
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_sec_nop')::uuid,
    'connected',
    null,
    'CLOSED_WON',
    null, null, null, null, null, null, null, null, null, null, null, null
  )$$,
  null,
  'CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE',
  'CLOSED_WON resolution token rejected — only accepted-quotation path may close_won'
);

-- =============================================================================
-- Section 7: Call SLA first-contact attempt marking (4)
-- =============================================================================

-- Fresh active lead for call-attempt marking
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Call',
  p_phone_e164 => '+919566666666',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_call', (
  select id::text from public.leads where submitted_name = '2A3 Lead Call' limit 1
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_call')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

-- Create + complete a call with connected (closes_contact_attempt = true)
select set_config('test.act_call1', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_call')::uuid,
    'call',
    'First outreach',
    now() + interval '1 day',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);
select public.complete_lead_activity(
  current_setting('test.act_call1')::uuid,
  'connected',
  null,
  'NEXT_PRIMARY',
  'call', 'Second call', now() + interval '2 days', 'normal',
  null, null, null, null, null, null, null, null
);

select results_eq(
  $$select first_contact_attempt_at is not null
      from public.crm_sla_clocks
     where lead_id = current_setting('test.lead_call')::uuid$$,
  array[true],
  'call with connected outcome marks first_contact_attempt_at'
);

select results_eq(
  $$select c.first_contact_attempt_at = f.completed_at
      from public.crm_sla_clocks c
      join public.lead_follow_ups f on f.id = current_setting('test.act_call1')::uuid
     where c.lead_id = current_setting('test.lead_call')::uuid$$,
  array[true],
  'first qualifying Call attempt timestamp equals completed_at (post-lock v_now)'
);

select set_config('test.attempt_call', (
  select first_contact_attempt_at::text
  from public.crm_sla_clocks where lead_id = current_setting('test.lead_call')::uuid
), true);

-- Second qualifying call must NOT rewrite the attempt
select set_config('test.act_call2', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_call')::uuid
    and is_primary_next_action
    and source = 'completion_chain'
  order by created_at desc limit 1
), true);
select public.complete_lead_activity(
  current_setting('test.act_call2')::uuid,
  'no_answer',
  null,
  'NEXT_PRIMARY',
  'call', 'Third call', now() + interval '3 days', 'normal',
  null, null, null, null, null, null, null, null
);

select results_eq(
  $$select first_contact_attempt_at::text
      from public.crm_sla_clocks
     where lead_id = current_setting('test.lead_call')::uuid$$,
  array[current_setting('test.attempt_call')],
  'second qualifying complete does not rewrite first_contact_attempt_at (immutable)'
);

-- Non-call activity with catalogue-qualifying outcome must NOT mark attempt on a *different* lead
-- Fresh lead so we can distinguish attempt state cleanly.
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead NonCall',
  p_phone_e164 => '+919577777777',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_noncall', (
  select id::text from public.leads where submitted_name = '2A3 Lead NonCall' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_noncall')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_sitevisit', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_noncall')::uuid,
    'site_visit',
    'On-site walk-through',
    now() + interval '2 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);
select public.complete_lead_activity(
  current_setting('test.act_sitevisit')::uuid,
  'no_answer',
  null,
  'NEXT_PRIMARY',
  'call', 'Follow-up call', now() + interval '3 days', 'normal',
  null, null, null, null, null, null, null, null
);

select results_eq(
  $$select not exists (
      select 1 from public.crm_sla_clocks
      where lead_id = current_setting('test.lead_noncall')::uuid
        and first_contact_attempt_at is not null
    )$$,
  array[true],
  'non-call activity with catalogue-qualifying outcome does NOT mark first_contact_attempt_at (activity_type gate)'
);

-- Legacy complete_lead_follow_up path must NOT mark first_contact_attempt_at.
-- Fresh lead + legacy create/complete cycle to isolate attempt state.
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Legacy',
  p_phone_e164 => '+919588888888',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_legacy', (
  select id::text from public.leads where submitted_name = '2A3 Lead Legacy' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_legacy')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_legacy', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_legacy')::uuid,
    now() + interval '2 days',
    'c3333333-3333-3333-3333-333333333333'::uuid
  )
), true);
select public.complete_lead_follow_up(current_setting('test.act_legacy')::uuid, 'Legacy free-text outcome');

select results_eq(
  $$select not exists (
      select 1 from public.crm_sla_clocks
      where lead_id = current_setting('test.lead_legacy')::uuid
        and first_contact_attempt_at is not null
    )$$,
  array[true],
  'legacy complete_lead_follow_up does NOT mark first_contact_attempt_at'
);

-- =============================================================================
-- Section 8: WhatsApp governed-send evidence (10 including provider_timestamp assert)
-- =============================================================================

-- Prepare bound WhatsApp fixtures for lead_wa: ingest inbound, bind conversation, claim + bind outbound
reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:2a3:1102:wamid.WA2A3INBOUND001',
  p_event_hash => repeat('7', 64),
  p_envelope_hash => repeat('8', 64),
  p_waba_id => '9202',
  p_phone_number_id => '1202',
  p_display_phone_number => '+919876543212',
  p_provider_message_id => 'wamid.WA2A3INBOUND001',
  p_customer_e164 => '+919544444444',
  p_recipient_e164 => '+919876543212',
  p_display_name_snapshot => '2A3 WA Customer',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Inbound for 2a3',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => now() - interval '1 hour'
);

update public.whatsapp_conversations
set lead_id = current_setting('test.lead_wa')::uuid,
    contact_id = current_setting('test.wa_contact_id')::uuid,
    last_inbound_at = now() - interval '1 hour'
where customer_e164 = '+919544444444';

select set_config('test.wa_conv_id', (
  select id::text from public.whatsapp_conversations where customer_e164 = '+919544444444' limit 1
), true);

-- Create + claim + bind an intent (dispatch_bound, succeeded attempt, outbound message present)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('test.wa_intent_ok', (
  select id::text from public.create_whatsapp_service_send_intent(
    current_setting('test.wa_conv_id')::uuid,
    '2a3-intent-ok',
    'WHATSAPP_SERVICE',
    'Governed reply body',
    null
  )
), true);
reset role;
set local role service_role;
select public.claim_whatsapp_send_intent_for_dispatch(
  current_setting('test.wa_intent_ok')::uuid,
  'fake',
  'fake-attempt-2a3-ok'
);
select set_config('test.wa_attempt_ok', (
  select id::text from public.whatsapp_provider_dispatch_attempts
   where provider_attempt_key = 'fake-attempt-2a3-ok' limit 1
), true);
-- Bind with a provider_timestamp in the past so we can distinguish it from message.created_at (now())
select public.bind_whatsapp_send_intent_dispatch(
  current_setting('test.wa_attempt_ok')::uuid,
  'wamid.WA2A3OUTBOUND001',
  now() - interval '30 minutes'
);
reset role;

-- Also create a fully unrelated conversation + intent on ANOTHER lead for cross-lead test
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead WA Other',
  p_phone_e164 => '+919599999999',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => true,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => 'whatsapp-service-v0.1-draft',
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_wa_other', (
  select id::text from public.leads where submitted_name = '2A3 Lead WA Other' limit 1
), true);
select set_config('test.wa_other_contact_id', (
  select contact_id::text from public.leads where submitted_name = '2A3 Lead WA Other' limit 1
), true);
select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:2a3:1102:wamid.WAOTHER001',
  p_event_hash => repeat('c', 64),
  p_envelope_hash => repeat('d', 64),
  p_waba_id => '9202',
  p_phone_number_id => '1202',
  p_display_phone_number => '+919876543212',
  p_provider_message_id => 'wamid.WAOTHER001',
  p_customer_e164 => '+919599999999',
  p_recipient_e164 => '+919876543212',
  p_display_name_snapshot => 'WA Other',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Other inbound',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => now() - interval '1 hour'
);
update public.whatsapp_conversations
set lead_id = current_setting('test.lead_wa_other')::uuid,
    contact_id = current_setting('test.wa_other_contact_id')::uuid,
    last_inbound_at = now() - interval '1 hour'
where customer_e164 = '+919599999999';
select set_config('test.wa_other_conv_id', (
  select id::text from public.whatsapp_conversations where customer_e164 = '+919599999999' limit 1
), true);

-- Assign before send-intent so assignment-scoped exec can use the conversation.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.assign_lead(current_setting('test.lead_wa_other')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('test.wa_intent_other', (
  select id::text from public.create_whatsapp_service_send_intent(
    current_setting('test.wa_other_conv_id')::uuid,
    '2a3-intent-other',
    'WHATSAPP_SERVICE',
    'Cross-lead intent body',
    null
  )
), true);
reset role;
set local role service_role;
select public.claim_whatsapp_send_intent_for_dispatch(
  current_setting('test.wa_intent_other')::uuid, 'fake', 'fake-attempt-2a3-other'
);
select set_config('test.wa_attempt_other', (
  select id::text from public.whatsapp_provider_dispatch_attempts
   where provider_attempt_key = 'fake-attempt-2a3-other' limit 1
), true);
select public.bind_whatsapp_send_intent_dispatch(
  current_setting('test.wa_attempt_other')::uuid, 'wamid.WAOTHER_OUT_001', now() - interval '20 minutes'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Ensure an open primary remains so secondary WhatsApp completes may use resolution NONE.
select public.create_lead_activity(
  current_setting('test.lead_wa')::uuid,
  'call',
  'WA lead primary keeper',
  now() + interval '7 days',
  'normal',
  'c3333333-3333-3333-3333-333333333333'::uuid,
  true,
  null,
  null,
  null
);

-- Create a whatsapp activity on lead_wa
select set_config('test.act_wa', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_wa')::uuid,
    'whatsapp',
    'Governed WhatsApp send',
    now() + interval '1 day',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);

-- (1) whatsapp_sent without intent id => REQUIRED
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    null
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_REQUIRED',
  'whatsapp_sent without p_whatsapp_send_intent_id rejects with WHATSAPP_SEND_EVIDENCE_REQUIRED'
);

-- (2) Missing/nonexistent intent => INVALID
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    '00000000-0000-4000-8000-000000000000'::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'unknown intent id rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);

-- (3) Intent belongs to wrong lead => INVALID
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    current_setting('test.wa_intent_other')::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'intent from different lead conversation rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);

-- (4) Non dispatch_bound intent => INVALID. Craft a fresh intent, leave as 'eligible'.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('test.wa_intent_eligible', (
  select id::text from public.create_whatsapp_service_send_intent(
    current_setting('test.wa_conv_id')::uuid,
    '2a3-intent-eligible',
    'WHATSAPP_SERVICE',
    'Never dispatched',
    null
  )
), true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    current_setting('test.wa_intent_eligible')::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'non dispatch_bound intent rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);

-- (5) No succeeded dispatch attempt: forge intent w/ lifecycle_status='dispatch_bound' but zero
-- provider dispatch attempts (no succeeded row bound to intent).
-- Backdoor: reset role + direct UPDATE (test transaction rolls back).
-- Must also satisfy chk_whatsapp_send_intents_dispatch_binding by setting outbound_message_id.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.whatsapp_send_intents
   set lifecycle_status = 'dispatch_bound',
       outbound_message_id = (
         select id from public.whatsapp_messages
          where provider_message_id = 'wamid.WA2A3OUTBOUND001' limit 1
       )
 where id = current_setting('test.wa_intent_eligible')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    current_setting('test.wa_intent_eligible')::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'no succeeded provider dispatch attempt rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);

-- (6) provider_message_id mismatch: bind message id != attempt.provider_message_id.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.whatsapp_provider_dispatch_attempts
   set provider_message_id = 'wamid.MISMATCH_INJECT_001'
 where id = current_setting('test.wa_attempt_ok')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    current_setting('test.wa_intent_ok')::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'provider_message_id mismatch between attempt + outbound message rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);
-- Restore correct binding for subsequent tests
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.whatsapp_provider_dispatch_attempts
   set provider_message_id = 'wamid.WA2A3OUTBOUND001'
 where id = current_setting('test.wa_attempt_ok')::uuid;

-- (7) provider_timestamp of outbound message BEFORE clock.clock_started_at => INVALID
-- Force message.provider_timestamp far into the past (< lead.created_at / clock start).
update public.whatsapp_messages
   set provider_timestamp = timestamp with time zone '1990-01-01 00:00:00Z'
 where provider_message_id = 'wamid.WA2A3OUTBOUND001';
-- Ensure clock exists so it has a clock_started_at reference
select private.ensure_first_contact_sla_clock(current_setting('test.lead_wa')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_wa')::uuid,
    'whatsapp_sent',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null,
    current_setting('test.wa_intent_ok')::uuid
  )$$,
  null,
  'WHATSAPP_SEND_EVIDENCE_INVALID',
  'outbound provider_timestamp before clock_started_at rejects with WHATSAPP_SEND_EVIDENCE_INVALID'
);

-- (8) Valid evidence path: restore provider_timestamp to a distinct past instant
-- (deliberately different from row.created_at which is now()) then complete.
-- Back-date clock_started_at so provider_timestamp still lands AFTER clock start.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_sla_clocks
   set clock_started_at = now() - interval '2 hours'
 where lead_id = current_setting('test.lead_wa')::uuid;
update public.whatsapp_messages
   set provider_timestamp = now() - interval '15 minutes'
 where provider_message_id = 'wamid.WA2A3OUTBOUND001';
select set_config('test.wa_msg_provider_ts', (
  select provider_timestamp::text from public.whatsapp_messages
   where provider_message_id = 'wamid.WA2A3OUTBOUND001'
), true);
select set_config('test.wa_msg_created_at', (
  select created_at::text from public.whatsapp_messages
   where provider_message_id = 'wamid.WA2A3OUTBOUND001'
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
-- Ensure the WA activity is still open by recreating a fresh one — previous throws left row untouched
-- but we haven't completed it, so it's still open.
select public.complete_lead_activity(
  current_setting('test.act_wa')::uuid,
  'whatsapp_sent',
  'Governed WA reply delivered',
  'NEXT_PRIMARY',
  'call', 'Next call outreach', now() + interval '2 days', 'normal',
  null, null, null, null, null, null, null,
  current_setting('test.wa_intent_ok')::uuid
);

select results_eq(
  $$select first_contact_attempt_at::text
      from public.crm_sla_clocks
     where lead_id = current_setting('test.lead_wa')::uuid$$,
  array[current_setting('test.wa_msg_provider_ts')],
  'valid WhatsApp evidence sets first_contact_attempt_at = message.provider_timestamp'
);

-- (9) Attempt IS DISTINCT FROM message.created_at (we deliberately set provider_timestamp != created_at)
select results_eq(
  $$select first_contact_attempt_at::text is distinct from current_setting('test.wa_msg_created_at')
      from public.crm_sla_clocks
     where lead_id = current_setting('test.lead_wa')::uuid$$,
  array[true],
  'first_contact_attempt_at is provider_timestamp, NOT message.created_at (distinct when they differ)'
);

-- (10) After a valid governed WA send, the source WA activity is completed.
select results_eq(
  $$select status from public.lead_follow_ups
     where id = current_setting('test.act_wa')::uuid$$,
  array['completed'::text],
  'WA activity is completed after valid governed-evidence complete'
);

-- =============================================================================
-- Section 9: On Hold via complete — creates review primary + status transition (6)
-- =============================================================================

-- Fresh active lead for On Hold path (avoid interfering with 2A3 Lead Hold fixture)
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbba-bbbb-bbbb-bbbb-bbbbbbbbbbba'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead OnHold',
  p_phone_e164 => '+919511112222',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_onhold', (
  select id::text from public.leads where submitted_name = '2A3 Lead OnHold' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_onhold')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_onhold', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_onhold')::uuid,
    'call',
    'Pre-hold call',
    now() + interval '1 day',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    true,
    null,
    null,
    null
  )
), true);

-- Missing review_at rejects
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_onhold')::uuid,
    'callback_requested',
    null,
    'ON_HOLD',
    null, null, null, null, null, null, null,
    'Pending budget review', null,
    null, null, null
  )$$,
  null,
  'ON_HOLD_REVIEW_REQUIRED',
  'ON_HOLD without review date rejects with ON_HOLD_REVIEW_REQUIRED'
);

-- Past review_at rejects
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_onhold')::uuid,
    'callback_requested',
    null,
    'ON_HOLD',
    null, null, null, null, null, null, null,
    'Pending budget review', now() - interval '1 day',
    null, null, null
  )$$,
  null,
  null,
  'ON_HOLD with past review date rejected'
);

-- Happy path: creates internal_task review primary source=on_hold_review + lead on_hold
select public.complete_lead_activity(
  current_setting('test.act_onhold')::uuid,
  'callback_requested',
  null,
  'ON_HOLD',
  null, null, null, null, null, null, null,
  'Pending budget review', now() + interval '7 days',
  null, null, null
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
     where lead_id = current_setting('test.lead_onhold')::uuid
       and status = 'open'
       and is_primary_next_action
       and activity_type = 'internal_task'
       and source = 'on_hold_review'$$,
  array[1],
  'On Hold creates exactly one open internal_task primary with source=on_hold_review'
);

select results_eq(
  $$select status::text from public.leads
     where id = current_setting('test.lead_onhold')::uuid$$,
  array['on_hold'::text],
  'On Hold path transitions lead status to on_hold'
);

-- Previous open primary is now completed
select results_eq(
  $$select status from public.lead_follow_ups
     where id = current_setting('test.act_onhold')::uuid$$,
  array['completed'::text],
  'previous primary activity is completed under On Hold path'
);

-- After the transition + review activity insert, still exactly one open primary
select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
     where lead_id = current_setting('test.lead_onhold')::uuid
       and status = 'open'
       and is_primary_next_action$$,
  array[1],
  'exactly one open primary after On Hold complete-with-review'
);

-- =============================================================================
-- Section 10: Closed Lost via complete — transition + zero open primaries (2)
-- =============================================================================

-- Fresh active lead for CLOSED_LOST path
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbcb'::uuid,
  p_request_hash => repeat('0', 64),
  p_network_fingerprint_hash => repeat('1', 64),
  p_phone_fingerprint_hash => repeat('2', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Lost',
  p_phone_e164 => '+919511113333',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_lost', (
  select id::text from public.leads where submitted_name = '2A3 Lead Lost' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_lost')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_lost', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_lost')::uuid,
    'call',
    'Discovery call',
    now() + interval '1 day',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    true,
    null,
    null,
    null
  )
), true);
-- Add a secondary that should remain preserved as open after CLOSED_LOST
select set_config('test.act_lost_sec', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_lost')::uuid,
    'internal_task',
    'Housekeeping',
    now() + interval '3 days',
    'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid,
    false,
    null,
    null,
    null
  )
), true);

select public.complete_lead_activity(
  current_setting('test.act_lost')::uuid,
  'not_interested',
  null,
  'CLOSED_LOST',
  null, null, null, null, null, null, null,
  null, null,
  'Chose competitor', 'other', null
);

select results_eq(
  $$select status::text from public.leads
     where id = current_setting('test.lead_lost')::uuid$$,
  array['closed_lost'::text],
  'CLOSED_LOST transitions lead status via transition_lead_status_impl'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
     where lead_id = current_setting('test.lead_lost')::uuid
       and status = 'open'
       and is_primary_next_action$$,
  array[0],
  'zero open primaries remain after CLOSED_LOST (open secondaries preserved)'
);

-- =============================================================================
-- Section 11: Already-terminal lead complete-with-NONE succeeds unchanged (1)
-- =============================================================================

-- Use the earlier 'lead_term' (closed_lost fixture). Create an open activity as super_admin
-- context so the existing act_term (secondary) is fine to complete with NONE.
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select lives_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_term')::uuid,
    'completed',
    null,
    'NONE',
    null, null, null, null, null, null, null, null, null, null, null, null
  )$$,
  'already-terminal lead accepts NONE-complete on remaining open activity (no status change)'
);

-- =============================================================================
-- Section 12: Legacy RPC compatibility (3)
-- =============================================================================

-- Fresh lead so legacy tests don't collide with structured state
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbcc'::uuid,
  p_request_hash => repeat('3', 64),
  p_network_fingerprint_hash => repeat('4', 64),
  p_phone_fingerprint_hash => repeat('5', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead LegacyCompat',
  p_phone_e164 => '+919511114444',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_legcompat', (
  select id::text from public.leads where submitted_name = '2A3 Lead LegacyCompat' limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_legcompat')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select ok(
  (
    select (public.create_lead_follow_up(
      current_setting('test.lead_legcompat')::uuid,
      now() + interval '2 days',
      'c3333333-3333-3333-3333-333333333333'::uuid
    )).id is not null
  ),
  'legacy public.create_lead_follow_up still returns a row'
);

select set_config('test.act_legcompat_a', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_legcompat')::uuid,
    now() + interval '3 days',
    'c3333333-3333-3333-3333-333333333333'::uuid
  )
), true);
select results_eq(
  $$select status::text from public.complete_lead_follow_up(
      current_setting('test.act_legcompat_a')::uuid, 'Free-text outcome preserved'
    )$$,
  array['completed'::text],
  'legacy public.complete_lead_follow_up still works with free-text outcome'
);

select set_config('test.act_legcompat_b', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_legcompat')::uuid,
    now() + interval '4 days',
    'c3333333-3333-3333-3333-333333333333'::uuid
  )
), true);
select results_eq(
  $$select status::text from public.cancel_lead_follow_up(
      current_setting('test.act_legcompat_b')::uuid, 'legacy cancel'
    )$$,
  array['cancelled'::text],
  'legacy public.cancel_lead_follow_up still works'
);

-- =============================================================================
-- Section 13: Security — direct DML blocked for authenticated (6)
-- =============================================================================

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_ups', 'INSERT')$$,
  array[false],
  'authenticated cannot INSERT lead_follow_ups'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_ups', 'UPDATE')$$,
  array[false],
  'authenticated cannot UPDATE lead_follow_ups'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_ups', 'DELETE')$$,
  array[false],
  'authenticated cannot DELETE lead_follow_ups'
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

-- =============================================================================
-- Section 14: Pre-merge correctness corrections (title/duration, designate,
--             On Hold cancel-resolve, busy/callback/voicemail)
-- =============================================================================

-- Fresh active lead — lead_x may already be terminal from earlier CLOSED_LOST coverage.
reset role;
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbb0-bbbb-bbbb-bbbb-bbbbbbbbbb00'::uuid,
  p_request_hash => repeat('f', 64),
  p_network_fingerprint_hash => repeat('0', 64),
  p_phone_fingerprint_hash => repeat('1', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Corr',
  p_phone_e164 => '+919511118888',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_corr', (
  select id::text from public.leads where submitted_name = '2A3 Lead Corr' limit 1
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.assign_lead(current_setting('test.lead_corr')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

-- Seed an open primary so secondary NONE paths / designate demotion have a baseline.
select set_config('test.act_corr_primary', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'Corr primary', now() + interval '2 days',
    'normal', 'c3333333-3333-3333-3333-333333333333'::uuid,
    true, null, null, null
  )
), true);

-- A/B: create title/duration must mirror 2A-1 table CHECKs (1..120 / 1..1440)
select set_config('test.long_title_121', repeat('T', 121), true);
select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call',
    current_setting('test.long_title_121'),
    now() + interval '2 days',
    'normal', null, false, null, null, null
  )$$,
  null,
  'ACTIVITY_TITLE_INVALID',
  'create title length 121 rejects ACTIVITY_TITLE_INVALID'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_corr')::uuid
      and title = current_setting('test.long_title_121')$$,
  array[0],
  'invalid title 121 does not insert a row'
);

select throws_ok(
  $$select public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'Duration overflow', now() + interval '2 days',
    'normal', null, false, 1441, null, null
  )$$,
  null,
  'ACTIVITY_DURATION_INVALID',
  'create duration 1441 rejects ACTIVITY_DURATION_INVALID'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_corr')::uuid
      and title = 'Duration overflow'$$,
  array[0],
  'invalid duration 1441 does not insert a row'
);

-- C/D: NEXT_PRIMARY invalid title/duration rolls back entire completion
select set_config('test.act_np_bounds', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'NP bounds source', now() + interval '2 days',
    'normal', 'c3333333-3333-3333-3333-333333333333'::uuid,
    false, null, null, null
  )
), true);

select set_config('test.long_next_title_121', repeat('N', 121), true);
select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_np_bounds')::uuid,
    'connected', null, 'NEXT_PRIMARY',
    'call', current_setting('test.long_next_title_121'),
    now() + interval '3 days', 'normal',
    null, null, null, null, null, null, null, null
  )$$,
  null,
  'NEXT_PRIMARY_INVALID',
  'NEXT_PRIMARY title length 121 rejects NEXT_PRIMARY_INVALID'
);

select results_eq(
  $$select status from public.lead_follow_ups
    where id = current_setting('test.act_np_bounds')::uuid$$,
  array['open'::text],
  'invalid NEXT_PRIMARY title rolls back — source activity remains OPEN'
);

select throws_ok(
  $$select public.complete_lead_activity(
    current_setting('test.act_np_bounds')::uuid,
    'connected', null, 'NEXT_PRIMARY',
    'call', 'Next ok title', now() + interval '3 days', 'normal',
    1441, null, null, null, null, null, null, null
  )$$,
  null,
  'NEXT_PRIMARY_INVALID',
  'NEXT_PRIMARY duration 1441 rejects NEXT_PRIMARY_INVALID'
);

select results_eq(
  $$select status from public.lead_follow_ups
    where id = current_setting('test.act_np_bounds')::uuid$$,
  array['open'::text],
  'invalid NEXT_PRIMARY duration rolls back — source activity remains OPEN'
);

-- Designate: sales exec cannot designate another owner's activity
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('test.act_mgr_owned', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'Manager-owned secondary', now() + interval '8 days',
    'normal', 'c2222222-2222-2222-2222-222222222222'::uuid,
    false, null, null, null
  )
), true);
select set_config('test.prior_primary_before_desig', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_corr')::uuid
    and status = 'open' and is_primary_next_action
  order by created_at desc limit 1
), true);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.designate_primary_next_action(
    current_setting('test.act_mgr_owned')::uuid
  )$$,
  '42501',
  null,
  'sales executive cannot designate cross-owner activity'
);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_mgr_owned')::uuid$$,
  array[false],
  'rejected designate leaves manager-owned activity secondary'
);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.prior_primary_before_desig')::uuid$$,
  array[true],
  'rejected designate leaves prior primary unchanged'
);

-- Manager designates assignee-owned secondary successfully
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('test.act_assignee_sec', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'Assignee secondary for designate', now() + interval '9 days',
    'normal', 'c3333333-3333-3333-3333-333333333333'::uuid,
    false, null, null, null
  )
), true);
select ok(
  (
    select (public.designate_primary_next_action(
      current_setting('test.act_assignee_sec')::uuid
    )).is_primary_next_action
  ),
  'manager may designate activity owned by authorized assignee'
);

-- Designate activity whose owner fails crm_user_can_operate_lead (forged owner)
reset role;
insert into public.lead_follow_ups (
  lead_id, owner_id, due_at, status, created_by,
  activity_type, title, priority, is_primary_next_action, source, updated_at
) values (
  current_setting('test.lead_corr')::uuid,
  'c4444444-4444-4444-4444-444444444444'::uuid,
  now() + interval '10 days',
  'open',
  'c2222222-2222-2222-2222-222222222222'::uuid,
  'call', 'Unauthorized-owner secondary', 'normal', false, 'manual', now()
);
select set_config('test.act_unauth_owner', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_corr')::uuid
    and title = 'Unauthorized-owner secondary'
  limit 1
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$select public.designate_primary_next_action(
    current_setting('test.act_unauth_owner')::uuid
  )$$,
  '42501',
  null,
  'designate rejects when target owner fails crm_user_can_operate_lead'
);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.act_unauth_owner')::uuid$$,
  array[false],
  'unauthorized-owner designate does not switch primary'
);

-- On Hold: secondary complete must CANCEL prior primary (not demote-only).
-- Reuse active lead_corr (still assigned; act_assignee_sec is current primary).
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('test.act_hold_a', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_corr')::uuid
    and status = 'open' and is_primary_next_action
  order by created_at desc limit 1
), true);
select set_config('test.act_hold_b', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_corr')::uuid,
    'call', 'Hold secondary B', now() + interval '3 days',
    'normal', 'c3333333-3333-3333-3333-333333333333'::uuid,
    false, null, null, null
  )
), true);

select public.complete_lead_activity(
  current_setting('test.act_hold_b')::uuid,
  'busy', null, 'ON_HOLD',
  null, null, null, null, null, null, null,
  'Budget hold via secondary', now() + interval '14 days',
  null, null, null
);

select results_eq(
  $$select status from public.lead_follow_ups
    where id = current_setting('test.act_hold_b')::uuid$$,
  array['completed'::text],
  'On Hold secondary B is completed'
);

select results_eq(
  $$select status, is_primary_next_action
      from public.lead_follow_ups
     where id = current_setting('test.act_hold_a')::uuid$$,
  $$values ('cancelled'::text, false)$$,
  'On Hold cancels prior primary A (not open secondary demotion)'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_hold_a')::uuid
      and event_type = 'cancelled'$$,
  array[1],
  'cancelled prior primary emits cancelled event'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.act_hold_a')::uuid
      and event_type = 'primary_cleared'$$,
  array[1],
  'cancelled prior primary emits primary_cleared event'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where reference_id = current_setting('test.act_hold_a')::uuid
      and activity_type = 'follow_up.cancelled'$$,
  array[1],
  'cancelled prior primary writes follow_up.cancelled summary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
     where lead_id = current_setting('test.lead_corr')::uuid
       and status = 'open' and is_primary_next_action
       and source = 'on_hold_review'$$,
  array[1],
  'On Hold review primary is the sole open primary'
);

select results_eq(
  $$select status::text from public.leads
     where id = current_setting('test.lead_corr')::uuid$$,
  array['on_hold'::text],
  'secondary→On Hold transitions lead to on_hold'
);

-- busy / callback_requested / voicemail first-contact attempt marking
reset role;
select set_config('request.jwt.claim.sub', '', true);
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbbd-bbbb-bbbb-bbbb-bbbbbbbbbbdd'::uuid,
  p_request_hash => repeat('d4', 32),
  p_network_fingerprint_hash => repeat('e5', 32),
  p_phone_fingerprint_hash => repeat('f6', 32),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Busy',
  p_phone_e164 => '+919511119002',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbbe-bbbb-bbbb-bbbb-bbbbbbbbbbee'::uuid,
  p_request_hash => repeat('aa', 32),
  p_network_fingerprint_hash => repeat('bb', 32),
  p_phone_fingerprint_hash => repeat('cc', 32),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Callback',
  p_phone_e164 => '+919511119003',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select * from public.submit_lead_intake(
  p_idempotency_key => 'cbbbbbbf-bbbb-bbbb-bbbb-bbbbbbbbbbff'::uuid,
  p_request_hash => repeat('dd', 32),
  p_network_fingerprint_hash => repeat('ee', 32),
  p_phone_fingerprint_hash => repeat('ff', 32),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A3 Lead Voicemail',
  p_phone_e164 => '+919511119004',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null, p_message => null, p_landing_path => '/',
  p_attribution => '{}'::jsonb, p_source => 'local-test',
  p_consent_service_enquiry => true, p_consent_service_phone => true,
  p_consent_service_email => false, p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);
select set_config('test.lead_busy', (select id::text from public.leads where submitted_name = '2A3 Lead Busy' limit 1), true);
select set_config('test.lead_cb', (select id::text from public.leads where submitted_name = '2A3 Lead Callback' limit 1), true);
select set_config('test.lead_vm', (select id::text from public.leads where submitted_name = '2A3 Lead Voicemail' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select public.assign_lead(current_setting('test.lead_busy')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_cb')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_vm')::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, null);
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config('test.act_busy', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_busy')::uuid, 'call', 'Busy call',
    now() + interval '1 day', 'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid, false, null, null, null
  )
), true);
select public.complete_lead_activity(
  current_setting('test.act_busy')::uuid, 'busy', null, 'NEXT_PRIMARY',
  'call', 'After busy', now() + interval '2 days', 'normal',
  null, null, null, null, null, null, null, null
);
select results_eq(
  $$select first_contact_attempt_at is not null
      from public.crm_sla_clocks where lead_id = current_setting('test.lead_busy')::uuid$$,
  array[true],
  'busy outcome marks first_contact_attempt_at'
);

select set_config('test.act_cb', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_cb')::uuid, 'call', 'Callback call',
    now() + interval '1 day', 'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid, false, null, null, null
  )
), true);
select public.complete_lead_activity(
  current_setting('test.act_cb')::uuid, 'callback_requested', null, 'NEXT_PRIMARY',
  'call', 'After callback', now() + interval '2 days', 'normal',
  null, null, null, null, null, null, null, null
);
select results_eq(
  $$select first_contact_attempt_at is not null
      from public.crm_sla_clocks where lead_id = current_setting('test.lead_cb')::uuid$$,
  array[true],
  'callback_requested outcome marks first_contact_attempt_at'
);

select set_config('test.act_vm', (
  select id::text from public.create_lead_activity(
    current_setting('test.lead_vm')::uuid, 'call', 'Voicemail call',
    now() + interval '1 day', 'normal',
    'c3333333-3333-3333-3333-333333333333'::uuid, false, null, null, null
  )
), true);
select public.complete_lead_activity(
  current_setting('test.act_vm')::uuid, 'voicemail', null, 'NEXT_PRIMARY',
  'call', 'After voicemail', now() + interval '2 days', 'normal',
  null, null, null, null, null, null, null, null
);
select results_eq(
  $$select first_contact_attempt_at is not null
      from public.crm_sla_clocks where lead_id = current_setting('test.lead_vm')::uuid$$,
  array[true],
  'voicemail outcome marks first_contact_attempt_at'
);

select * from finish();
rollback;
