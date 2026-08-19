-- ONEDECORE Phase 9C-B M33 — campaign execution foundation pgTAP
begin;
select plan(78);

select ok(exists (select 1 from public.permissions where code = 'campaigns.execute'), 'campaigns.execute exists');
select ok(exists (select 1 from public.permissions where code = 'campaigns.pause'), 'campaigns.pause exists');
select ok(exists (select 1 from public.permissions where code = 'campaigns.metrics.read'), 'campaigns.metrics.read exists');

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in ('campaigns.execute', 'campaigns.pause', 'campaigns.metrics.read')
      and r.code in ('super_admin', 'sales_manager')
  ),
  6,
  'SA/SM receive three 9C-B permissions'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in ('campaigns.execute', 'campaigns.pause', 'campaigns.metrics.read')
      and r.code in ('sales_executive', 'project_manager', 'designer', 'management', 'sales', 'project_operations', 'content_manager')
  ),
  0,
  'SE/PM/Designer/legacy have no 9C-B grants'
);

select has_table('public', 'campaign_runs', 'campaign_runs exists');
select has_table('public', 'campaign_run_targets', 'campaign_run_targets exists');
select has_table('public', 'campaign_run_operations', 'campaign_run_operations exists');
select has_table('public', 'campaign_execution_events', 'campaign_execution_events exists');
select has_table('private', 'marketing_execution_idempotency_requests', 'private execution ledger exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_runs'),
  'campaign_runs RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_run_targets'),
  'campaign_run_targets RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_run_operations'),
  'campaign_run_operations RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_execution_events'),
  'campaign_execution_events RLS'
);

select ok(
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'campaign_run_targets'
      and c.contype in ('u', 'p')
      and pg_get_constraintdef(c.oid) ilike '%campaign_run_id%'
  ),
  'UNIQUE(campaign_run_id) on targets'
);

select is(
  (
    select count(*)::integer from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'claim_campaign_run_operation'
      and grantee in ('anon', 'authenticated')
  ),
  0,
  'claim RPC not granted to anon/authenticated'
);

select ok(
  exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'claim_campaign_run_operation'
      and grantee = 'service_role'
  ),
  'claim RPC granted to service_role'
);

select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('campaign_metric_snapshots', 'campaign_conversion_feedback_events')
    group by table_schema
    having count(*) = 2
  ),
  '9C-C metric/feedback tables exist after M34'
);

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_campaign_run' limit 1),
  'create_campaign_run security definer'
);

set local role postgres;

insert into auth.users (id, instance_id, email, aud, role) values
  ('9c111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9c@onedecore.in', 'authenticated', 'authenticated'),
  ('9c222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_9c@onedecore.in', 'authenticated', 'authenticated'),
  ('9c333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9c@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9C ' || id::text
where id in (
  '9c111111-1111-1111-1111-111111111111',
  '9c222222-2222-2222-2222-222222222222',
  '9c333333-3333-3333-3333-333333333333'
);

insert into public.user_roles (user_id, role_id)
select '9c111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9c222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9c333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.campaign_runs (
      run_reference, campaign_version_id, provider_channel, status, requested_by,
      configuration_hash, audience_rule_hash, destination_snapshot, targeting_mode
    ) values (
      'OD-CR-2026-999999', '00000000-0000-0000-0000-000000000001', 'meta_ads', 'scheduled',
      '9c111111-1111-1111-1111-111111111111', repeat('a',64), repeat('b',64), '{}'::jsonb, 'broad_public'
    )$$,
  '42501',
  NULL,
  'authenticated insert campaign_runs denied'
);

select lives_ok(
  $$select public.create_campaign_draft(
    'Meta Diwali',
    'Meta Diwali v1',
    'broad_public',
    array['meta_ads','email'],
    'https://onedecore.in/lp/diwali',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references', jsonb_build_array('media-1')),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9c000000-0000-0000-0000-000000000001'
  )$$,
  'SA draft meta+email campaign'
);

select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' order by created_at desc limit 1),
    (select lock_version from public.campaign_versions where title = 'Meta Diwali v1' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-000000000002'
  )$$,
  'SA request approval'
);

select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' order by created_at desc limit 1),
    'approved',
    null,
    '9c000000-0000-0000-0000-000000000003'
  )$$,
  'SA approve meta campaign'
);

select lives_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000010'
  )$$,
  'SA create run from approved meta version'
);

select is(
  (select status from public.campaign_runs order by created_at desc limit 1),
  'scheduled',
  'new run is scheduled'
);

select is(
  (
    select count(*)::integer from public.campaign_run_targets t
    where t.campaign_run_id = (select id from public.campaign_runs order by created_at desc limit 1)
  ),
  1,
  'exactly one target per run'
);

select is(
  (select provider_channel from public.campaign_runs order by created_at desc limit 1),
  'meta_ads',
  'run provider is meta_ads only'
);

select ok(
  (select 'email' = any(deferred_channels) from public.campaign_runs order by created_at desc limit 1),
  'email recorded as deferred not executed'
);

select is(
  public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000010'
  ) ->> 'run_reference',
  (select run_reference from public.campaign_runs order by created_at desc limit 1),
  'idempotent create returns same run'
);

select lives_ok(
  $$select public.create_campaign_draft(
    'Dual Ads',
    'Dual Ads v1',
    'broad_public',
    array['meta_ads','google_ads'],
    null,
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references', jsonb_build_array('m')),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9c000000-0000-0000-0000-000000000021'
  )$$,
  'draft dual ads campaign'
);

select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions where title = 'Dual Ads v1' order by created_at desc limit 1),
    (select lock_version from public.campaign_versions where title = 'Dual Ads v1' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-000000000022'
  )$$,
  'request dual ads approval'
);

select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where title = 'Dual Ads v1' order by created_at desc limit 1),
    'approved',
    null,
    '9c000000-0000-0000-0000-000000000023'
  )$$,
  'approve dual ads'
);

select throws_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Dual Ads v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000024'
  )$$,
  '22023',
  NULL,
  'both Meta+Google fail closed'
);

select lives_ok(
  $$select public.create_campaign_draft(
    'Draft only',
    'Draft only v1',
    'broad_public',
    array['google_ads'],
    null,
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise', null),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references', jsonb_build_array('m')),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9c000000-0000-0000-0000-000000000031'
  )$$,
  'draft google-only'
);

select throws_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Draft only v1' limit 1),
    '9c000000-0000-0000-0000-000000000032'
  )$$,
  '22023',
  NULL,
  'draft version cannot execute'
);

select throws_ok(
  $$select public.pause_campaign_run(
    (select id from public.campaign_runs where status = 'scheduled' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-000000000040'
  )$$,
  '22023',
  NULL,
  'pause denied unless running'
);

select set_config('request.jwt.claims', '{"sub":"9c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select throws_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000050'
  )$$,
  '42501',
  NULL,
  'SE cannot execute'
);

select set_config('request.jwt.claims', '{"sub":"9c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select lives_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000051'
  )$$,
  'SM can execute approved version'
);

select throws_ok(
  $$select public.cancel_campaign_run(
    (select id from public.campaign_runs where requested_by = '9c222222-2222-2222-2222-222222222222' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-000000000052'
  )$$,
  '42501',
  NULL,
  'SM cannot cancel'
);

select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.cancel_campaign_run(
    (select id from public.campaign_runs where requested_by = '9c111111-1111-1111-1111-111111111111' and status = 'scheduled' order by created_at asc limit 1),
    '9c000000-0000-0000-0000-000000000053'
  )$$,
  'SA can cancel'
);

reset role;
set local role postgres;

select lives_ok(
  $$select public.claim_campaign_run_operation('worker-a', 120)$$,
  'service claim lives'
);

select throws_ok(
  $$
    update public.campaign_execution_events
    set outcome_code = 'tamper'
    where id = (select id from public.campaign_execution_events limit 1)
  $$,
  '22023',
  NULL,
  'execution events append-only'
);

select ok(
  not exists (
    select 1 from public.campaign_run_targets t
    join public.campaign_runs r on r.id = t.campaign_run_id
    where t.provider_channel is distinct from r.provider_channel
  ),
  'no channel mismatch rows'
);

select is(
  (
    select destination_snapshot->>'production_live'
    from public.campaign_runs
    where requested_by = '9c111111-1111-1111-1111-111111111111'
    order by created_at asc
    limit 1
  ),
  'false',
  'destination snapshot not production-live'
);

select ok(
  exists (select 1 from public.campaign_run_operations where operation_type = 'create'),
  'create operations queued'
);

select ok(
  pg_get_functiondef('public.create_campaign_run(uuid,uuid)'::regprocedure) ilike '%search_path%',
  'create_campaign_run search_path set'
);

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_campaign_run_operation' limit 1),
  'claim security definer'
);

select ok(
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'campaign_spend'
  ),
  'no spend table'
);

select ok(
  exists (
    select 1 from pg_constraint where conname = 'chk_whatsapp_send_intents_purpose'
  ),
  'M19 purpose constraint still present'
);

-- ----------------------------------------------------------------------------
-- Correction gate: claim expiry, reconcile-found, cancel vs in-flight create
-- ----------------------------------------------------------------------------
reset role;
set local role postgres;

select is(
  (
    select count(*)::integer from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'resolve_campaign_run_create_reconcile_found'
      and grantee in ('anon', 'authenticated')
  ),
  0,
  'reconcile-found RPC not granted to anon/authenticated'
);

select ok(
  exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'resolve_campaign_run_create_reconcile_found'
      and grantee = 'service_role'
  ),
  'reconcile-found RPC granted to service_role'
);

-- Isolate one claimed create and expire it below max_attempts
update public.campaign_run_operations
set
  operation_state = 'claimed',
  attempt_count = 1,
  max_attempts = 5,
  claim_expires_at = now() - interval '10 seconds',
  next_attempt_at = now() - interval '1 hour',
  claimed_by = 'worker-expired'
where id = (
  select id from public.campaign_run_operations
  where operation_type = 'create' and operation_state in ('pending', 'claimed')
  order by created_at desc
  limit 1
);

update public.campaign_run_operations
set next_attempt_at = now() + interval '1 day'
where operation_state in ('pending', 'claimed')
  and id <> (
    select id from public.campaign_run_operations
    where claimed_by = 'worker-expired'
    order by created_at desc
    limit 1
  );

select is(
  public.claim_campaign_run_operation('worker-reclaim', 120) ->> 'outcome_code',
  'claimed',
  'expired claimed below max is reclaimed'
);

select is(
  (
    select attempt_count from public.campaign_run_operations
    where claimed_by = 'worker-reclaim'
    order by claimed_at desc
    limit 1
  ),
  2,
  'reclaim increments attempt_count'
);

update public.campaign_run_operations
set
  operation_state = 'claimed',
  attempt_count = 5,
  max_attempts = 5,
  claim_expires_at = now() - interval '10 seconds',
  next_attempt_at = now() - interval '2 hours'
where claimed_by = 'worker-reclaim';

select is(
  public.claim_campaign_run_operation('worker-max', 120) ->> 'outcome_code',
  'needs_reconcile',
  'expired claimed at max_attempts becomes needs_reconcile'
);

select ok(
  not exists (
    select 1 from public.campaign_run_operations
    where operation_state = 'claimed' and last_error_code = 'CLAIM_EXPIRED_UNKNOWN'
  ),
  'max-attempt expired claim is not stuck claimed'
);

select throws_ok(
  $$select public.bind_campaign_run_operation(
    (select id from public.campaign_run_operations where operation_state = 'needs_reconcile' and operation_type = 'create' order by completed_at desc limit 1),
    'mock-provider-1'
  )$$,
  '22023',
  NULL,
  'ordinary bind still requires claimed'
);

select lives_ok(
  $$select public.resolve_campaign_run_create_reconcile_found(
    (select id from public.campaign_run_operations where operation_state = 'needs_reconcile' and operation_type = 'create' order by completed_at desc limit 1),
    'mock-provider-1',
    null,
    null,
    'CREATED'
  )$$,
  'reconcile-found resolution lives'
);

select is(
  (
    select o.operation_state
    from public.campaign_run_operations o
    join public.campaign_run_targets t on t.id = o.campaign_run_target_id
    where t.provider_campaign_id = 'mock-provider-1'
      and o.operation_type = 'create'
    limit 1
  ),
  'succeeded',
  'reconcile-found resolves original create to succeeded'
);

select is(
  (
    select t.provider_campaign_id
    from public.campaign_run_targets t
    join public.campaign_runs r on r.id = t.campaign_run_id
    where t.provider_campaign_id = 'mock-provider-1'
    limit 1
  ),
  'mock-provider-1',
  'reconcile-found binds target'
);

select is(
  (
    select count(*)::integer
    from public.campaign_run_operations o
    join public.campaign_run_targets t on t.id = o.campaign_run_target_id
    where t.provider_campaign_id = 'mock-provider-1'
      and o.operation_type = 'activate'
      and o.operation_state in ('pending', 'claimed', 'succeeded')
  ),
  1,
  'scheduled reconcile-found queues exactly one activate'
);

select is(
  public.resolve_campaign_run_create_reconcile_found(
    (select o.id from public.campaign_run_operations o
     join public.campaign_run_targets t on t.id = o.campaign_run_target_id
     where t.provider_campaign_id = 'mock-provider-1' and o.operation_type = 'create' limit 1),
    'mock-provider-1',
    null,
    null,
    'CREATED'
  ) ->> 'outcome_code',
  'reconcile_found',
  'reconcile-found replay is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.campaign_run_operations o
    join public.campaign_run_targets t on t.id = o.campaign_run_target_id
    where t.provider_campaign_id = 'mock-provider-1'
      and o.operation_type = 'activate'
  ),
  1,
  'reconcile-found replay does not duplicate activate'
);

-- Cancel vs in-flight create: new run, claim create, cancel, complete late
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000080'
  )$$,
  'SA creates race-test run'
);

reset role;
set local role postgres;

update public.campaign_run_operations
set next_attempt_at = now() + interval '2 days'
where operation_state = 'pending'
  and campaign_run_id <> (
    select id from public.campaign_runs
    where requested_by = '9c111111-1111-1111-1111-111111111111'
    order by run_reference desc
    limit 1
  );

select lives_ok(
  $$select public.claim_campaign_run_operation('worker-inflight', 120)$$,
  'claim in-flight create for cancel race'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.cancel_campaign_run(
    (select id from public.campaign_runs
     where requested_by = '9c111111-1111-1111-1111-111111111111'
     order by run_reference desc limit 1),
    '9c000000-0000-0000-0000-000000000081'
  )$$,
  'SA cancels while create is claimed'
);

reset role;
set local role postgres;

select is(
  (
    select o.operation_state
    from public.campaign_run_operations o
    where o.claimed_by = 'worker-inflight'
    order by o.claimed_at desc
    limit 1
  ),
  'claimed',
  'cancel does not erase in-flight claimed create'
);

select lives_ok(
  $$select public.bind_campaign_run_operation(
    (select id from public.campaign_run_operations where claimed_by = 'worker-inflight' order by claimed_at desc limit 1),
    'mock-late-create',
    null,
    null,
    'CREATED'
  )$$,
  'late create success can still bind'
);

select lives_ok(
  $$select public.complete_campaign_run_operation(
    (select id from public.campaign_run_operations where claimed_by = 'worker-inflight' order by claimed_at desc limit 1),
    'mock_ok',
    '{"mock": true}'::jsonb
  )$$,
  'late create complete after cancel'
);

select is(
  (
    select r.status from public.campaign_runs r
    where r.id = (
      select campaign_run_id from public.campaign_run_operations
      where claimed_by = 'worker-inflight' order by claimed_at desc limit 1
    )
  ),
  'cancelled',
  'run remains cancelled after late create success'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations o
    where o.campaign_run_id = (
      select campaign_run_id from public.campaign_run_operations
      where claimed_by = 'worker-inflight' order by claimed_at desc limit 1
    )
    and o.operation_type = 'activate'
    and o.operation_state in ('pending', 'claimed', 'succeeded')
  ),
  0,
  'cancelled run never queues activate after late create'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations o
    where o.campaign_run_id = (
      select campaign_run_id from public.campaign_run_operations
      where claimed_by = 'worker-inflight' order by claimed_at desc limit 1
    )
    and o.operation_type = 'cancel'
    and o.operation_state in ('pending', 'claimed', 'succeeded')
  ),
  1,
  'late create after cancel queues exactly one cancel cleanup'
);

-- Cancelled run + create needs_reconcile -> reconcile-found cleanup, never activate
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Meta Diwali v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-000000000090'
  )$$,
  'SA creates cancelled-reconcile run'
);
reset role;
set local role postgres;

update public.campaign_run_operations o
set
  operation_state = 'needs_reconcile',
  last_error_code = 'UNKNOWN_PROVIDER_OUTCOME',
  completed_at = now(),
  next_attempt_at = now() - interval '1 hour'
from public.campaign_runs r
where o.campaign_run_id = r.id
  and r.requested_by = '9c111111-1111-1111-1111-111111111111'
  and o.operation_type = 'create'
  and o.operation_state = 'pending'
  and r.id = (select id from public.campaign_runs order by run_reference desc limit 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.cancel_campaign_run(
    (select id from public.campaign_runs order by run_reference desc limit 1),
    '9c000000-0000-0000-0000-000000000091'
  )$$,
  'cancel run that has needs_reconcile create'
);
reset role;
set local role postgres;

select lives_ok(
  $$select public.resolve_campaign_run_create_reconcile_found(
    (select o.id from public.campaign_run_operations o
     join public.campaign_runs r on r.id = o.campaign_run_id
     where r.id = (select id from public.campaign_runs order by run_reference desc limit 1)
       and o.operation_type = 'create'
     limit 1),
    'mock-cancelled-reconcile',
    null,
    null,
    'CREATED'
  )$$,
  'reconcile-found on cancelled run'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations o
    where o.campaign_run_id = (select id from public.campaign_runs order by run_reference desc limit 1)
      and o.operation_type = 'activate'
  ),
  0,
  'cancelled reconcile-found does not enqueue activate'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations o
    where o.campaign_run_id = (select id from public.campaign_runs order by run_reference desc limit 1)
      and o.operation_type = 'cancel'
      and o.operation_state in ('pending', 'claimed', 'succeeded')
  ),
  1,
  'cancelled reconcile-found enqueues one cancel cleanup'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select public.resolve_campaign_run_create_reconcile_found(
    '00000000-0000-0000-0000-000000000001',
    'x'
  )$$,
  '42501',
  NULL,
  'authenticated cannot execute reconcile-found RPC'
);
reset role;
set local role postgres;

select throws_ok(
  $$select public.resolve_campaign_run_create_reconcile_found(
    (select id from public.campaign_run_operations where operation_type = 'activate' limit 1),
    'x'
  )$$,
  '22023',
  NULL,
  'reconcile-found RPC requires needs_reconcile create'
);

select finish();
rollback;
