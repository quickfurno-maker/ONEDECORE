-- CRM 2E — Management analytics read model pgTAP
--
-- Certifies that the single aggregate added by CRM 2E:
--   * exists with the locked signature, is SECURITY INVOKER, pins search_path
--     and is executable only by `authenticated`;
--   * fails closed on anon and on a caller without crm.reporting.read;
--   * refuses to aggregate another owner for a caller without broad lead read;
--   * emits the documented SLA / velocity / conversion / target shape with
--     exact denominators and NULL (never 0) for an undefined rate;
--   * measures SLA, first-contact velocity, stage reach and stage-to-stage
--     medians correctly over a seeded cohort, reading BOTH lead_events payload
--     spellings;
--   * adds no table of its own and leaves the CRM 2D probability table intact.

begin;
select plan(46);

-- =============================================================================
-- Section 1: Schema, security attributes, privileges (10)
-- =============================================================================

select has_function(
  'public', 'get_crm_management_analytics',
  array['timestamptz', 'timestamptz', 'date', 'uuid', 'uuid'],
  'public.get_crm_management_analytics exists with the locked signature'
);

select is(
  (select prosecdef
   from pg_proc
   where oid = 'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)'::regprocedure),
  false,
  'get_crm_management_analytics is SECURITY INVOKER (RLS stays the scope authority)'
);

select is(
  (select provolatile
   from pg_proc
   where oid = 'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)'::regprocedure),
  'v'::"char",
  'get_crm_management_analytics is VOLATILE (single clock_timestamp capture)'
);

select is(
  (select proconfig
   from pg_proc
   where oid = 'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)'::regprocedure),
  array['search_path=""'],
  'get_crm_management_analytics pins an empty search_path'
);

select is(
  (select pg_get_userbyid(proowner)
   from pg_proc
   where oid = 'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)'::regprocedure),
  'postgres',
  'get_crm_management_analytics is owned by postgres'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)',
    'execute'
  ),
  'authenticated may execute the analytics aggregate'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)',
    'execute'
  ),
  'anon may NOT execute the analytics aggregate'
);

select ok(
  (select obj_description(
     'public.get_crm_management_analytics(timestamptz,timestamptz,date,uuid,uuid)'::regprocedure,
     'pg_proc'
   )) like '%SECURITY INVOKER%',
  'the aggregate documents its INVOKER scope contract'
);

select ok(
  not exists (
    select 1 from pg_tables
    where schemaname in ('public', 'private')
      and tablename in (
        'crm_management_analytics', 'crm_analytics_snapshots', 'crm_metric_cache'
      )
  ),
  'CRM 2E creates no analytics table'
);

select is(
  (select private.crm_stage_probability_bp('proposal_sent')),
  6500,
  'CRM 2D locked stage probability is unchanged by CRM 2E'
);

-- =============================================================================
-- Section 2: Identities
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('2e111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'crm2e-sa@example.test', 'authenticated', 'authenticated'),
  ('2e222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'crm2e-exec@example.test', 'authenticated', 'authenticated'),
  ('2e333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'crm2e-nopriv@example.test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'CRM 2E Admin'
where id = '2e111111-1111-1111-1111-111111111111';
update public.profiles set status = 'active', display_name = 'CRM 2E Executive'
where id = '2e222222-2222-2222-2222-222222222222';
update public.profiles set status = 'active', display_name = 'CRM 2E Outsider'
where id = '2e333333-3333-3333-3333-333333333333';

insert into public.user_roles (user_id, role_id)
select '2e111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin'
on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '2e222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive'
on conflict do nothing;
-- The outsider deliberately holds no CRM role at all.

-- =============================================================================
-- Section 3: Fail-closed authorization (4)
-- =============================================================================

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$select public.get_crm_management_analytics(
      '2026-08-01T00:00:00+05:30'::timestamptz,
      '2026-08-31T23:59:59+05:30'::timestamptz
    )$$,
  '42501',
  null,
  'anon cannot read management analytics'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '2e333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.get_crm_management_analytics(
      '2026-08-01T00:00:00+05:30'::timestamptz,
      '2026-08-31T23:59:59+05:30'::timestamptz
    )$$,
  '42501',
  null,
  'a caller without crm.reporting.read is refused'
);

select set_config('request.jwt.claim.sub', '2e222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.get_crm_management_analytics(
      '2026-08-01T00:00:00+05:30'::timestamptz,
      '2026-08-31T23:59:59+05:30'::timestamptz,
      null,
      '2e111111-1111-1111-1111-111111111111'::uuid
    )$$,
  '42501',
  null,
  'an executive cannot aggregate another owner'
);

select lives_ok(
  $$select public.get_crm_management_analytics(
      '2026-08-01T00:00:00+05:30'::timestamptz,
      '2026-08-31T23:59:59+05:30'::timestamptz
    )$$,
  'an executive may read their own analytics'
);

-- =============================================================================
-- Section 4: Range validation (2)
-- =============================================================================

select set_config('request.jwt.claim.sub', '2e111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$select public.get_crm_management_analytics(null, null)$$,
  '22023',
  null,
  'a null range is refused'
);

select throws_ok(
  $$select public.get_crm_management_analytics(
      '2026-08-31T23:59:59+05:30'::timestamptz,
      '2026-08-01T00:00:00+05:30'::timestamptz
    )$$,
  '22023',
  null,
  'an inverted range is refused'
);

-- =============================================================================
-- Section 5: Payload shape over an empty cohort (16)
--
-- An empty cohort is the sharpest test of the unknown-never-zero rule: every
-- count is a truthful 0 and every rate must be NULL rather than 0%.
-- =============================================================================

select set_config(
  'test.empty_payload',
  public.get_crm_management_analytics(
    '1900-01-01T00:00:00+05:30'::timestamptz,
    '1900-01-31T23:59:59+05:30'::timestamptz,
    '1900-01-01'::date
  )::text,
  true
);

select ok(
  (current_setting('test.empty_payload')::jsonb) ?& array['sla', 'velocity', 'conversion', 'targets', 'capturedAt'],
  'payload carries sla, velocity, conversion, targets and capturedAt'
);

select ok(
  not ((current_setting('test.empty_payload')::jsonb) ? 'forecast'),
  'forecast is NOT re-implemented here; it stays in get_crm_pipeline_value_summary'
);

select is(
  ((current_setting('test.empty_payload')::jsonb) -> 'sla' ->> 'cohortLeadCount')::integer,
  0,
  'empty cohort reports zero received leads'
);

select is(
  ((current_setting('test.empty_payload')::jsonb) -> 'sla' ->> 'eligibleCount')::integer,
  0,
  'empty cohort has no SLA-eligible leads'
);

select is(
  ((current_setting('test.empty_payload')::jsonb) -> 'sla' ->> 'decidedCount')::integer,
  0,
  'empty cohort decides nothing'
);

select ok(
  (current_setting('test.empty_payload')::jsonb) -> 'sla' -> 'complianceBasisPoints' = 'null'::jsonb,
  'compliance over a zero denominator is NULL, never 0%'
);

select ok(
  (current_setting('test.empty_payload')::jsonb) -> 'velocity' -> 'medianFirstContactSeconds' = 'null'::jsonb,
  'an empty velocity sample is NULL, never 0 seconds'
);

select ok(
  (current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'wonRateBasisPoints' = 'null'::jsonb,
  'won rate over a zero denominator is NULL, never 0%'
);

select is(
  jsonb_array_length((current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'stages'),
  7,
  'the funnel always reports its seven ladder stages'
);

select is(
  (select jsonb_agg(stage.value ->> 'stage')
   from jsonb_array_elements(
     (current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'stages'
   ) as stage),
  '["received","contacted","qualified","consultation_scheduled","proposal_sent","negotiation","closed_won"]'::jsonb,
  'the ladder is received -> contacted -> ... -> closed_won'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'stages'
    ) as stage
    where stage.value ->> 'stage' in ('closed_lost', 'on_hold')
  ),
  'closed_lost and on_hold are never inside the funnel ladder'
);

select ok(
  ((current_setting('test.empty_payload')::jsonb) -> 'conversion')
    ?& array['closedLostCount', 'onHoldCurrentCount'],
  'closed_lost and on_hold are reported beside the funnel'
);

select ok(
  (select stage.value -> 'previousStage' = 'null'::jsonb
          and stage.value -> 'stepConversionBasisPoints' = 'null'::jsonb
   from jsonb_array_elements(
     (current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'stages'
   ) as stage
   where stage.value ->> 'stage' = 'received'),
  'the funnel head has no step denominator'
);

select is(
  (select stage.value ->> 'previousStage'
   from jsonb_array_elements(
     (current_setting('test.empty_payload')::jsonb) -> 'conversion' -> 'stages'
   ) as stage
   where stage.value ->> 'stage' = 'closed_won'),
  'negotiation',
  'every step rate names its own denominator stage'
);

select is(
  (current_setting('test.empty_payload')::jsonb) -> 'targets' ->> 'period',
  '1900-01',
  'the target period is the Asia/Kolkata month of the requested target month'
);

select is(
  jsonb_array_length((current_setting('test.empty_payload')::jsonb) -> 'targets' -> 'rows'),
  0,
  'no configured target yields no attainment rows rather than an invented one'
);

-- =============================================================================
-- Section 6: Target period derivation from the range start (2)
-- =============================================================================

select is(
  public.get_crm_management_analytics(
    '2026-08-01T00:00:00+05:30'::timestamptz,
    '2026-08-31T23:59:59+05:30'::timestamptz
  ) -> 'targets' ->> 'period',
  '2026-08',
  'an omitted target month falls back to the IST month of the range start'
);

-- 2026-08-31T20:00Z is already 2026-09-01 in Asia/Kolkata.
select is(
  public.get_crm_management_analytics(
    '2026-08-31T20:00:00+00:00'::timestamptz,
    '2026-09-30T23:59:59+05:30'::timestamptz
  ) -> 'targets' ->> 'period',
  '2026-09',
  'the IST calendar decides the achievement month, not UTC'
);

-- =============================================================================
-- Section 7: Measured cohort (12)
--
-- Lead A: SLA applied, attempted 30 minutes after receipt, inside the window
--         -> MET, and the only first-contact velocity sample.
-- Lead B: SLA applied, never attempted, window elapsed          -> BREACHED.
-- Lead C: no due snapshot                                       -> OUT OF POLICY.
--
-- Stage events are seeded directly so the instants are deterministic. Lead A
-- uses the Phase 5B payload spelling ({from,to}); lead B uses the Phase 7B
-- spelling ({from_status,to_status}), so a reader that honoured only one would
-- report contacted reach as 1 instead of 2.
-- =============================================================================

reset role;

select * from public.submit_lead_intake(
  p_idempotency_key => '2e000001-0000-0000-0000-000000000001'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'CRM 2E Lead A',
  p_phone_e164 => '+919711111111',
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
  p_idempotency_key => '2e000002-0000-0000-0000-000000000002'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'CRM 2E Lead B',
  p_phone_e164 => '+919722222222',
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
  p_idempotency_key => '2e000003-0000-0000-0000-000000000003'::uuid,
  p_request_hash => repeat('7', 64),
  p_network_fingerprint_hash => repeat('8', 64),
  p_phone_fingerprint_hash => repeat('9', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'CRM 2E Lead C',
  p_phone_e164 => '+919733333333',
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

select set_config('test.lead_a', (select id::text from public.leads where submitted_name = 'CRM 2E Lead A' limit 1), true);
select set_config('test.lead_b', (select id::text from public.leads where submitted_name = 'CRM 2E Lead B' limit 1), true);
select set_config('test.lead_c', (select id::text from public.leads where submitted_name = 'CRM 2E Lead C' limit 1), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2e111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.assign_lead(current_setting('test.lead_a')::uuid, '2e222222-2222-2222-2222-222222222222'::uuid, null);
select public.assign_lead(current_setting('test.lead_b')::uuid, '2e222222-2222-2222-2222-222222222222'::uuid, null);
select public.assign_lead(current_setting('test.lead_c')::uuid, '2e222222-2222-2222-2222-222222222222'::uuid, null);

-- Real transition, real event: proves closed_lost reach without seeding.
select public.transition_lead_status(
  current_setting('test.lead_c')::uuid, 'closed_lost', 'CRM 2E lost fixture', 'other'
);

reset role;

select private.ensure_first_contact_sla_clock(current_setting('test.lead_a')::uuid);
select private.ensure_first_contact_sla_clock(current_setting('test.lead_b')::uuid);
select private.ensure_first_contact_sla_clock(current_setting('test.lead_c')::uuid);

update public.crm_sla_clocks
set clock_started_at = now() - interval '3 hours',
    sla_due_at = now() - interval '2 hours',
    first_contact_attempt_at = now() - interval '150 minutes'
where lead_id = current_setting('test.lead_a')::uuid;

update public.crm_sla_clocks
set clock_started_at = now() - interval '3 hours',
    sla_due_at = now() - interval '2 hours',
    first_contact_attempt_at = null
where lead_id = current_setting('test.lead_b')::uuid;

-- Lead C keeps a NULL due: the policy never applied to it.
update public.crm_sla_clocks
set sla_due_at = null,
    first_contact_attempt_at = null
where lead_id = current_setting('test.lead_c')::uuid;

insert into public.lead_events (lead_id, event_type, actor_type, occurred_at, event_data)
values
  -- Lead A: Phase 5B payload spelling.
  (current_setting('test.lead_a')::uuid, 'lead.status_changed', 'staff',
   now() - interval '48 hours', '{"from":"assigned","to":"contacted"}'::jsonb),
  (current_setting('test.lead_a')::uuid, 'lead.status_changed', 'staff',
   now() - interval '24 hours', '{"from":"contacted","to":"qualified"}'::jsonb),
  -- A later RE-ENTRY into contacted must not move the first-entry instant.
  (current_setting('test.lead_a')::uuid, 'lead.resumed', 'staff',
   now() - interval '1 hour', '{"from":"on_hold","to":"contacted"}'::jsonb),
  -- Lead B: Phase 7B payload spelling.
  (current_setting('test.lead_b')::uuid, 'lead.status_changed', 'system',
   now() - interval '3 hours', '{"from_status":"assigned","to_status":"contacted"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2e111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'test.cohort_payload',
  public.get_crm_management_analytics(
    now() - interval '1 day',
    now() + interval '1 day',
    date_trunc('month', now() at time zone 'Asia/Kolkata')::date,
    '2e222222-2222-2222-2222-222222222222'::uuid
  )::text,
  true
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'cohortLeadCount')::integer,
  3,
  'the cohort is every lead received in the range within the owner scope'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'eligibleCount')::integer,
  2,
  'only leads carrying a receipt-time due snapshot enter the denominator'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'outOfPolicyCount')::integer,
  1,
  'a lead the policy never applied to is out of policy, not a breach'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'metCount')::integer,
  1,
  'a qualifying attempt at or before the due instant is MET'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'breachedCount')::integer,
  1,
  'an elapsed window with no attempt is BREACHED'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'pendingCount')::integer,
  0,
  'nothing is pending once every window has elapsed'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'sla' ->> 'complianceBasisPoints')::integer,
  5000,
  'compliance is met / (met + breached) = 1/2 = 50%'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'velocity' ->> 'firstContactSampleSize')::integer,
  1,
  'the first-contact sample counts only leads with a qualifying attempt'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'velocity' ->> 'medianFirstContactSeconds')::bigint,
  1800::bigint,
  'median time to first contact attempt is exact wall-clock seconds'
);

select is(
  (select (stage.value ->> 'reachedCount')::integer
   from jsonb_array_elements(
     (current_setting('test.cohort_payload')::jsonb) -> 'conversion' -> 'stages'
   ) as stage
   where stage.value ->> 'stage' = 'contacted'),
  2,
  'stage reach honours both event payload spellings and counts a lead once'
);

select is(
  ((current_setting('test.cohort_payload')::jsonb) -> 'conversion' ->> 'closedLostCount')::integer,
  1,
  'closed_lost is reported beside the funnel, not inside it'
);

select is(
  (select (entry.value ->> 'medianSeconds')::bigint
   from jsonb_array_elements(
     (current_setting('test.cohort_payload')::jsonb) -> 'velocity' -> 'stageTransitions'
   ) as entry
   where entry.value ->> 'toStage' = 'qualified'),
  86400::bigint,
  'contacted -> qualified uses FIRST entries, so a later resume cannot skew it'
);

reset role;

select * from finish();
rollback;
