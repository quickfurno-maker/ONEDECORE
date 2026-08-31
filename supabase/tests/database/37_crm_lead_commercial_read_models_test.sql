-- CRM 2D — Lead commercial read models pgTAP
-- Canonical deal value (taxable_base_paise, ex-tax INR), locked stage
-- probabilities, weighted pipeline aggregate, and cross-lead isolation.
--
-- Certifies that the ONE SECURITY DEFINER helper added by CRM 2D cannot leak a
-- lead outside the caller CRM scope and never returns capability material.

begin;
select plan(48);

-- =============================================================================
-- Section 1: Schema, security attributes, privileges (18)
-- =============================================================================

select has_function(
  'private', 'crm_lead_deal_values', array['uuid', 'uuid'],
  'private.crm_lead_deal_values exists'
);
select has_function(
  'private', 'crm_stage_probability_bp', array['text'],
  'private.crm_stage_probability_bp exists'
);
select has_function(
  'public', 'get_crm_lead_commercial_state', array['uuid'],
  'public.get_crm_lead_commercial_state exists'
);
select has_function(
  'public', 'get_crm_lead_deal_values', array['uuid[]'],
  'public.get_crm_lead_deal_values exists'
);
select has_function(
  'public', 'get_crm_pipeline_value_summary', array['uuid'],
  'public.get_crm_pipeline_value_summary exists'
);

-- The single DEFINER is the deal-value resolver; every public surface is INVOKER.
select is(
  (select prosecdef from pg_proc where oid = 'private.crm_lead_deal_values(uuid,uuid)'::regprocedure),
  true,
  'crm_lead_deal_values is SECURITY DEFINER (quotation_access_grants has no authenticated SELECT policy)'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.get_crm_lead_commercial_state(uuid)'::regprocedure),
  false,
  'get_crm_lead_commercial_state is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.get_crm_lead_deal_values(uuid[])'::regprocedure),
  false,
  'get_crm_lead_deal_values is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.get_crm_pipeline_value_summary(uuid)'::regprocedure),
  false,
  'get_crm_pipeline_value_summary is SECURITY INVOKER'
);

select ok(
  exists (
    select 1
    from pg_proc p, unnest(p.proconfig) as cfg
    where p.oid = 'private.crm_lead_deal_values(uuid,uuid)'::regprocedure
      and cfg like 'search_path=%'
      and cfg <> 'search_path=public'
  ),
  'crm_lead_deal_values pins a non-default search_path'
);

select is(
  (select r.rolname from pg_proc p join pg_roles r on r.oid = p.proowner
   where p.oid = 'private.crm_lead_deal_values(uuid,uuid)'::regprocedure),
  'postgres',
  'crm_lead_deal_values is owned by postgres'
);

select ok(
  not has_function_privilege('anon', 'private.crm_lead_deal_values(uuid,uuid)', 'execute'),
  'anon cannot execute the deal-value resolver'
);
select ok(
  not has_function_privilege('anon', 'public.get_crm_lead_commercial_state(uuid)', 'execute'),
  'anon cannot execute get_crm_lead_commercial_state'
);
select ok(
  not has_function_privilege('anon', 'public.get_crm_pipeline_value_summary(uuid)', 'execute'),
  'anon cannot execute get_crm_pipeline_value_summary'
);
select ok(
  has_function_privilege('authenticated', 'public.get_crm_lead_commercial_state(uuid)', 'execute'),
  'authenticated may execute get_crm_lead_commercial_state'
);
select ok(
  has_function_privilege('authenticated', 'public.get_crm_pipeline_value_summary(uuid)', 'execute'),
  'authenticated may execute get_crm_pipeline_value_summary'
);

-- quotation_access_grants must remain unreadable: CRM 2D widened nothing.
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and tablename = 'quotation_access_grants' and cmd = 'SELECT'),
  0,
  'quotation_access_grants still has zero SELECT policies (no RLS widening)'
);

select is(
  (select count(*)::integer from public.permissions
   where code in (
     'crm.deal_value.read', 'crm.pipeline.value', 'crm.score.read'
   )),
  0,
  'CRM 2D introduced no new permission code'
);

-- =============================================================================
-- Section 2: Locked stage probabilities (Q5, Q7) (10)
-- =============================================================================

select is(private.crm_stage_probability_bp('new'), 500, 'new = 5%');
select is(private.crm_stage_probability_bp('assigned'), 1000, 'assigned = 10%');
select is(private.crm_stage_probability_bp('contacted'), 2000, 'contacted = 20%');
select is(private.crm_stage_probability_bp('qualified'), 3500, 'qualified = 35%');
select is(private.crm_stage_probability_bp('consultation_scheduled'), 5000, 'consultation_scheduled = 50%');
select is(private.crm_stage_probability_bp('proposal_sent'), 6500, 'proposal_sent = 65%');
select is(private.crm_stage_probability_bp('negotiation'), 8000, 'negotiation = 80%');
select is(private.crm_stage_probability_bp('closed_won'), 10000, 'closed_won = 100%');
select is(private.crm_stage_probability_bp('closed_lost'), 0, 'closed_lost = 0%');
select is(private.crm_stage_probability_bp('on_hold'), 0, 'on_hold = 0% (PARKED)');

-- =============================================================================
-- Section 3: Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('2d111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '2d-sa@example.test', 'authenticated', 'authenticated'),
  ('2d222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '2d-mgr@example.test', 'authenticated', 'authenticated'),
  ('2d333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '2d-execa@example.test', 'authenticated', 'authenticated'),
  ('2d444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '2d-execb@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  '2d111111-1111-1111-1111-111111111111',
  '2d222222-2222-2222-2222-222222222222',
  '2d333333-3333-3333-3333-333333333333',
  '2d444444-4444-4444-4444-444444444444'
);

insert into public.user_roles (user_id, role_id)
select '2d111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '2d222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select '2d333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '2d444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';

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

-- Owned by exec A: one lead per commercial tier.
select set_config('test.lead_none',     pg_temp.seed_lead('2d111111-0000-0000-0000-000000000001', '2D No Quotation',  '+919522220001')::text, true);
select set_config('test.lead_zero',     pg_temp.seed_lead('2d111111-0000-0000-0000-000000000002', '2D Zero Draft',    '+919522220002')::text, true);
select set_config('test.lead_draft',    pg_temp.seed_lead('2d111111-0000-0000-0000-000000000003', '2D Draft Value',   '+919522220003')::text, true);
select set_config('test.lead_final',    pg_temp.seed_lead('2d111111-0000-0000-0000-000000000004', '2D Finalized',     '+919522220004')::text, true);
select set_config('test.lead_issued',   pg_temp.seed_lead('2d111111-0000-0000-0000-000000000005', '2D Issued',        '+919522220005')::text, true);
select set_config('test.lead_revoked',  pg_temp.seed_lead('2d111111-0000-0000-0000-000000000006', '2D Revoked Grant', '+919522220006')::text, true);
select set_config('test.lead_accepted', pg_temp.seed_lead('2d111111-0000-0000-0000-000000000007', '2D Accepted',      '+919522220007')::text, true);
-- Owned by exec B: the isolation probe.
select set_config('test.lead_other',    pg_temp.seed_lead('2d111111-0000-0000-0000-000000000008', '2D Other Owner',   '+919522220008')::text, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2d222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.assign_lead(current_setting('test.lead_none')::uuid,     '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_zero')::uuid,     '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_draft')::uuid,    '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_final')::uuid,    '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_issued')::uuid,   '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_revoked')::uuid,  '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_accepted')::uuid, '2d333333-3333-3333-3333-333333333333'::uuid, null);
select public.assign_lead(current_setting('test.lead_other')::uuid,    '2d444444-4444-4444-4444-444444444444'::uuid, null);

-- Quotation roots via the canonical draft RPC. Version totals and delivery
-- state are then set directly as postgres: Phase 7's own suites (18/19) certify
-- the finalize/issue/accept RPC chain; this suite certifies the CRM 2D resolver.
select public.create_quotation_draft(current_setting('test.lead_zero')::uuid,     '2D Zero',      'k2d-zero');
select public.create_quotation_draft(current_setting('test.lead_draft')::uuid,    '2D Draft',     'k2d-draft');
select public.create_quotation_draft(current_setting('test.lead_final')::uuid,    '2D Final',     'k2d-final');
select public.create_quotation_draft(current_setting('test.lead_issued')::uuid,   '2D Issued',    'k2d-issued');
select public.create_quotation_draft(current_setting('test.lead_revoked')::uuid,  '2D Revoked',   'k2d-revoked');
select public.create_quotation_draft(current_setting('test.lead_accepted')::uuid, '2D Accepted',  'k2d-accepted');

set local role postgres;

create or replace function pg_temp.set_version_value(
  p_lead_id uuid, p_status text, p_paise bigint
)
returns uuid
language plpgsql
as $$
declare
  v_version_id uuid;
begin
  select qv.id into v_version_id
  from public.quotation_versions qv
  join public.quotations q on q.id = qv.quotation_id
  where q.lead_id = p_lead_id
  order by qv.version_number desc
  limit 1;

  update public.quotation_versions
  set subtotal_paise = p_paise,
      discount_total_paise = 0,
      taxable_base_paise = p_paise,
      status = p_status,
      is_current_draft = (p_status = 'draft'),
      finalized_at = case when p_status = 'finalized' then now() else null end,
      finalized_by = case when p_status = 'finalized'
                          then '2d222222-2222-2222-2222-222222222222'::uuid else null end
  where id = v_version_id;

  return v_version_id;
end;
$$;

-- Zero-value current draft must resolve to UNKNOWN, never to a ₹0 deal.
select pg_temp.set_version_value(current_setting('test.lead_zero')::uuid,     'draft',     0);
select pg_temp.set_version_value(current_setting('test.lead_draft')::uuid,    'draft',     4000000);
select pg_temp.set_version_value(current_setting('test.lead_final')::uuid,    'finalized', 5000000);
select set_config('test.ver_issued',   pg_temp.set_version_value(current_setting('test.lead_issued')::uuid,   'finalized', 8400000)::text, true);
select set_config('test.ver_revoked',  pg_temp.set_version_value(current_setting('test.lead_revoked')::uuid,  'finalized', 9000000)::text, true);
select set_config('test.ver_accepted', pg_temp.set_version_value(current_setting('test.lead_accepted')::uuid, 'finalized', 7000000)::text, true);

insert into public.quotation_access_grants (
  id, quotation_id, quotation_version_id, capability_token_hash, derivation_nonce, created_by
) values (
  '2daaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  (select quotation_id from public.quotation_versions where id = current_setting('test.ver_issued')::uuid),
  current_setting('test.ver_issued')::uuid,
  repeat('a', 64), repeat('b', 32), '2d222222-2222-2222-2222-222222222222'
);

-- A revoked grant must downgrade issued -> finalized.
insert into public.quotation_access_grants (
  id, quotation_id, quotation_version_id, capability_token_hash, derivation_nonce, created_by,
  revoked_at, revoked_by, revocation_reason
) values (
  '2dbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  (select quotation_id from public.quotation_versions where id = current_setting('test.ver_revoked')::uuid),
  current_setting('test.ver_revoked')::uuid,
  repeat('c', 64), repeat('d', 32), '2d222222-2222-2222-2222-222222222222',
  now(), '2d222222-2222-2222-2222-222222222222', 'test revocation'
);

insert into public.quotation_access_grants (
  id, quotation_id, quotation_version_id, capability_token_hash, derivation_nonce, created_by
) values (
  '2dcccccc-cccc-4ccc-8ccc-cccccccccccc',
  (select quotation_id from public.quotation_versions where id = current_setting('test.ver_accepted')::uuid),
  current_setting('test.ver_accepted')::uuid,
  repeat('e', 64), repeat('f', 32), '2d222222-2222-2222-2222-222222222222'
);

-- Acceptance carries its own taxable base, which must win over the version.
insert into public.quotation_acceptances (
  quotation_id, quotation_version_id, lead_id, access_grant_id,
  accepted_by_name, accepted_by_email, accepted_at,
  credited_sales_executive_id, sales_achievement_month, taxable_base_paise
) values (
  (select quotation_id from public.quotation_versions where id = current_setting('test.ver_accepted')::uuid),
  current_setting('test.ver_accepted')::uuid,
  current_setting('test.lead_accepted')::uuid,
  (select id from public.quotation_access_grants where quotation_version_id = current_setting('test.ver_accepted')::uuid),
  '2D Client', null, now(),
  '2d333333-3333-3333-3333-333333333333', to_char(now(), 'YYYY-MM'), 6900000
);

-- =============================================================================
-- Section 4: Deal-value precedence (Q4) (8)
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', '2d333333-3333-3333-3333-333333333333', true);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_none')::uuid)),
  'unknown',
  'no quotation resolves to unknown'
);

select is(
  (select taxable_base_paise from private.crm_lead_deal_values(null, current_setting('test.lead_none')::uuid)),
  null::bigint,
  'unknown deal value is NULL, never zero'
);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_zero')::uuid)),
  'unknown',
  'zero-value current draft resolves to unknown, not draft'
);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_draft')::uuid)),
  'draft',
  'positive current draft resolves to draft'
);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_final')::uuid)),
  'finalized',
  'finalized version without a grant resolves to finalized'
);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_issued')::uuid)),
  'issued',
  'finalized version with a live grant resolves to issued'
);

select is(
  (select commercial_state from private.crm_lead_deal_values(null, current_setting('test.lead_revoked')::uuid)),
  'finalized',
  'a revoked grant downgrades issued back to finalized'
);

select is(
  (select taxable_base_paise from private.crm_lead_deal_values(null, current_setting('test.lead_accepted')::uuid)),
  6900000::bigint,
  'accepted value wins over the version total'
);

-- =============================================================================
-- Section 5: Authorization isolation (7)
-- =============================================================================

select is(
  (select count(*)::integer from private.crm_lead_deal_values(null, current_setting('test.lead_other')::uuid)),
  0,
  'sales executive gets no row for a lead owned by another executive'
);

select throws_ok(
  format(
    $$select public.get_crm_lead_commercial_state(%L::uuid)$$,
    current_setting('test.lead_other')
  ),
  '42501',
  null,
  'get_crm_lead_commercial_state refuses an unowned lead (no existence oracle)'
);

select is(
  (select count(*)::integer from public.get_crm_lead_deal_values(
     array[current_setting('test.lead_other')::uuid, current_setting('test.lead_draft')::uuid]
   )),
  1,
  'batch read silently drops leads outside CRM scope'
);

select throws_ok(
  $$select public.get_crm_pipeline_value_summary('2d444444-4444-4444-4444-444444444444'::uuid)$$,
  '42501',
  null,
  'sales executive cannot query another owner pipeline value'
);

select throws_ok(
  $$select public.get_crm_lead_deal_values(
      (select array_agg(gen_random_uuid()) from generate_series(1, 301))
    )$$,
  '22023',
  null,
  'batch read is bounded'
);

-- Manager scope sees both executives; executive scope sees only its own.
select set_config('request.jwt.claim.sub', '2d222222-2222-2222-2222-222222222222', true);
select ok(
  (select count(*) from private.crm_lead_deal_values(null, null)) >= 8,
  'sales manager resolver covers the whole team queue'
);

select set_config('request.jwt.claim.sub', '2d333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*)::integer from private.crm_lead_deal_values(null, current_setting('test.lead_other')::uuid)),
  0,
  'executive scope never reaches another executive lead through the resolver'
);

-- =============================================================================
-- Section 6: Non-secret projection + weighted aggregate (5)
-- =============================================================================

-- The batch read must expose exactly three non-secret columns.
select set_eq(
  $$select unnest(proargnames[array_length(proargnames, 1) - 2 : array_length(proargnames, 1)])
    from pg_proc where oid = 'public.get_crm_lead_deal_values(uuid[])'::regprocedure$$,
  array['lead_id', 'commercial_state', 'taxable_base_paise'],
  'batch deal-value read exposes only lead_id, commercial_state and taxable_base_paise'
);

select ok(
  not (
    (select public.get_crm_lead_commercial_state(current_setting('test.lead_issued')::uuid))
      ?| array['capabilityTokenHash', 'derivationNonce', 'accessGrantId', 'capability_token_hash', 'derivation_nonce']
  ),
  'commercial state payload carries no capability material'
);

select is(
  ((select public.get_crm_lead_commercial_state(current_setting('test.lead_issued')::uuid)) ->> 'taxableBasePaise')::bigint,
  8400000::bigint,
  'issued lead reports its finalized version taxable base'
);

-- Every seeded lead sits in `assigned` (10%). Round per lead, then sum:
--   draft 4_000_000 -> 400_000
--   finalized 5_000_000 -> 500_000
--   issued 8_400_000 -> 840_000
--   revoked-grant finalized 9_000_000 -> 900_000
--   accepted 6_900_000 -> 690_000
-- Unknown-value leads contribute nothing rather than zero.
select is(
  (
    select (stage ->> 'weightedValuePaise')::bigint
    from jsonb_array_elements(
      (select public.get_crm_pipeline_value_summary(null)) -> 'stages'
    ) as stage
    where stage ->> 'stage' = 'assigned'
  ),
  3330000::bigint,
  'weighted total rounds per lead then sums at the locked assigned probability'
);

select is(
  (
    select ((select public.get_crm_pipeline_value_summary(null)) ->> 'activeValuedLeadCount')::integer
  ),
  5,
  'leads without a known value are excluded from totals and reported separately'
);

select * from finish();
rollback;
