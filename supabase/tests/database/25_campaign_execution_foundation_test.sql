-- ONEDECORE Phase 9C-B M33 — campaign execution foundation pgTAP
begin;
select plan(49);

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
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('campaign_metric_snapshots', 'campaign_conversion_feedback_events')
  ),
  '9C-C metric/feedback tables absent'
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

select finish();
rollback;
