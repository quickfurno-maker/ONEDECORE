-- ONEDECORE Phase 9B M32 — landing page lab pgTAP
begin;
select plan(71);

select ok(exists (select 1 from public.permissions where code = 'landing_pages.read'), 'landing_pages.read exists');
select ok(exists (select 1 from public.permissions where code = 'landing_pages.manage'), 'landing_pages.manage exists');
select ok(exists (select 1 from public.permissions where code = 'landing_pages.publish'), 'landing_pages.publish exists');
select ok(exists (select 1 from public.permissions where code = 'landing_experiments.manage'), 'landing_experiments.manage exists');
select ok(exists (select 1 from public.permissions where code = 'landing_analytics.read'), 'landing_analytics.read exists');

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in (
      'landing_pages.read', 'landing_pages.manage', 'landing_pages.publish',
      'landing_experiments.manage', 'landing_analytics.read'
    )
    and r.code in ('super_admin', 'sales_manager')
  ),
  10,
  'SA/SM receive all five Landing Lab permissions'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in (
      'landing_pages.read', 'landing_pages.manage', 'landing_pages.publish',
      'landing_experiments.manage', 'landing_analytics.read'
    )
    and r.code in ('sales_executive', 'project_manager', 'designer', 'management', 'sales', 'project_operations', 'content_manager')
  ),
  0,
  'SE/PM/Designer/legacy have no Landing Lab grants'
);

select has_table('public', 'landing_pages', 'landing_pages exists');
select has_table('public', 'landing_page_versions', 'landing_page_versions exists');
select has_table('public', 'landing_publications', 'landing_publications exists');
select has_table('public', 'landing_experiments', 'landing_experiments exists');
select has_table('public', 'landing_experiment_variants', 'landing_experiment_variants exists');
select has_table('public', 'landing_exposures', 'landing_exposures exists');
select has_table('private', 'landing_lab_idempotency_requests', 'private landing lab idempotency ledger exists');

select ok(not exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name in ('campaign_leads', 'landing_attribution', 'campaign_conversions')
), 'no parallel attribution/conversion tables');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'landing_pages'),
  'landing_pages RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'landing_exposures'),
  'landing_exposures RLS enabled'
);

select ok(
  (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'landing_publications' and c.conname = 'chk_landing_publications_status')
  like '%draft%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'landing_publications' and c.conname = 'chk_landing_publications_status')
  like '%paused%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'landing_publications' and c.conname = 'chk_landing_publications_status')
  like '%archived%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'landing_publications' and c.conname = 'chk_landing_publications_status')
  not like '%scheduled%',
  'publication status is draft|live|paused|archived without scheduled'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'landing_exposures'
      and column_name in ('ip', 'ip_address', 'email', 'phone', 'user_agent', 'referrer', 'visitor_id', 'cookie', 'fingerprint')
  ),
  'landing_exposures has no IP/PII/raw visitor columns'
);

select ok(
  position('landing_lab_idempotency_xact_lock' in pg_get_functiondef('public.create_landing_page_draft(text,text,jsonb,text,uuid)'::regprocedure))
  < position('landing_lab_idempotency_lookup' in pg_get_functiondef('public.create_landing_page_draft(text,text,jsonb,text,uuid)'::regprocedure)),
  'create_landing_page_draft locks before ledger lookup'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'trg_leads_after_insert_touchpoint'
      and pg_get_functiondef(p.oid) like '%landing_page_reference%'
      and pg_get_functiondef(p.oid) like '%fbclid%'
  ),
  'first-touchpoint trigger is M32-enriched'
);

select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'trg_leads_after_insert_touchpoint'
      and pg_get_functiondef(p.oid) ilike '%update public.lead_source_touchpoints%'
  ),
  'first-touchpoint trigger does not update existing rows'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_versions'
      and column_name = 'destination_reference'
  ),
  'M31 campaign_versions.destination_reference still present'
);

-- Fixtures
set local role postgres;

insert into auth.users (id, instance_id, email, aud, role) values
  ('9b111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9b@onedecore.in', 'authenticated', 'authenticated'),
  ('9b222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_9b@onedecore.in', 'authenticated', 'authenticated'),
  ('9b333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9b@onedecore.in', 'authenticated', 'authenticated'),
  ('9b444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'pm_9b@onedecore.in', 'authenticated', 'authenticated'),
  ('9b555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'designer_9b@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9B ' || id::text
where id in (
  '9b111111-1111-1111-1111-111111111111',
  '9b222222-2222-2222-2222-222222222222',
  '9b333333-3333-3333-3333-333333333333',
  '9b444444-4444-4444-4444-444444444444',
  '9b555555-5555-5555-5555-555555555555'
);

insert into public.user_roles (user_id, role_id)
select '9b111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9b222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9b333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9b444444-4444-4444-4444-444444444444', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9b555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer' on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.landing_pages (page_reference, slug, title, created_by)
    values ('OD-LP-2026-999999', 'nope', 'Nope', '9b111111-1111-1111-1111-111111111111')$$,
  '42501',
  NULL,
  'authenticated direct insert into landing_pages denied'
);

select set_config('request.jwt.claims', '{"sub":"9b333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_landing_page_draft('SE Page', 'se-page', '[]'::jsonb, 'v1', '9b000000-0000-0000-0000-000000000001')$$,
  '42501',
  NULL,
  'sales_executive cannot create landing page'
);

select set_config('request.jwt.claims', '{"sub":"9b444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_landing_page_draft('PM Page', 'pm-page', '[]'::jsonb, 'v1', '9b000000-0000-0000-0000-000000000002')$$,
  '42501',
  NULL,
  'project_manager cannot create landing page'
);

select set_config('request.jwt.claims', '{"sub":"9b555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_landing_page_draft('Designer Page', 'designer-page', '[]'::jsonb, 'v1', '9b000000-0000-0000-0000-000000000003')$$,
  '42501',
  NULL,
  'designer cannot create landing page'
);

select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select ok(
  (select public.create_landing_page_draft(
    'Gurgaon Interiors',
    'gurgaon-interiors',
    '[{"blockId":"hero-main","type":"hero"}]'::jsonb,
    'Initial',
    '9b000000-0000-0000-0000-000000000010'
  )->>'page_reference') ~ '^OD-LP-[0-9]{4}-[0-9]{6}$',
  'SA can create landing page draft with OD-LP reference'
);

select is(
  public.create_landing_page_draft(
    'Gurgaon Interiors',
    'gurgaon-interiors',
    '[{"blockId":"hero-main","type":"hero"}]'::jsonb,
    'Initial',
    '9b000000-0000-0000-0000-000000000010'
  )->>'slug',
  'gurgaon-interiors',
  'create_landing_page_draft is idempotent on matching hash'
);

select throws_ok(
  $$select public.create_landing_page_draft(
    'Other title',
    'gurgaon-interiors',
    '[{"blockId":"hero-main","type":"hero"}]'::jsonb,
    'Initial',
    '9b000000-0000-0000-0000-000000000010'
  )$$,
  '22023',
  NULL,
  'idempotency key reuse with different hash is rejected'
);

-- Freeze, next version, publication graph
select lives_ok(
  $$select public.freeze_landing_page_version(
    (select id from public.landing_page_versions where version_number = 1 order by created_at desc limit 1),
    '9b000000-0000-0000-0000-000000000011'
  )$$,
  'freeze version 1'
);

set local role postgres;
select throws_ok(
  $$update public.landing_page_versions
    set label = 'tamper'
    where frozen_at is not null$$,
  '22023',
  NULL,
  'frozen version content is immutable'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.create_next_landing_page_version(
    (select landing_page_id from public.landing_page_versions where version_number = 1 order by created_at desc limit 1),
    (select id from public.landing_page_versions where version_number = 1 order by created_at desc limit 1),
    '9b000000-0000-0000-0000-000000000012'
  )$$,
  'create next draft version from frozen source'
);

select throws_ok(
  $$select public.create_landing_publication(
    (select id from public.landing_pages where slug = 'gurgaon-interiors'),
    (select id from public.landing_page_versions
      where landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')
        and version_number = 2),
    null,
    null,
    '9b000000-0000-0000-0000-000000000014'
  )$$,
  '22023',
  NULL,
  'unfrozen version cannot bind publication'
);

select lives_ok(
  $$select public.freeze_landing_page_version(
    (select id from public.landing_page_versions where version_number = 2 order by created_at desc limit 1),
    '9b000000-0000-0000-0000-000000000013'
  )$$,
  'freeze version 2'
);

select lives_ok(
  $$select public.create_landing_publication(
    (select id from public.landing_pages where slug = 'gurgaon-interiors'),
    (select id from public.landing_page_versions
      where landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')
        and version_number = 1),
    'OD-C-2026-000001',
    1,
    '9b000000-0000-0000-0000-000000000015'
  )$$,
  'create publication bound to frozen v1 with opaque campaign snapshot'
);

select is(
  (select status from public.landing_publications where campaign_reference = 'OD-C-2026-000001' limit 1),
  'draft',
  'new publication starts as draft'
);

select lives_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'live',
    1,
    '9b000000-0000-0000-0000-000000000016'
  )$$,
  'draft can go live'
);

set local role postgres;
select ok(
  (select public.get_live_landing_publication('gurgaon-interiors')->>'page') is not null,
  'live publication is readable by slug'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'paused',
    2,
    '9b000000-0000-0000-0000-000000000017'
  )$$,
  'live can pause'
);

set local role postgres;
select ok(
  public.get_live_landing_publication('gurgaon-interiors') is null,
  'paused publication is not publicly live'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'live',
    3,
    '9b000000-0000-0000-0000-000000000018'
  )$$,
  'paused can resume live'
);

select throws_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'draft',
    4,
    '9b000000-0000-0000-0000-000000000019'
  )$$,
  '22023',
  NULL,
  'live cannot return to draft'
);

-- Experiments
select lives_ok(
  $$select public.save_landing_experiment_draft(
    (select id from public.landing_publications order by created_at desc limit 1),
    null,
    jsonb_build_array(
      jsonb_build_object(
        'variant_key', 'control',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 1 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 50,
        'label', 'Control'
      ),
      jsonb_build_object(
        'variant_key', 'variant-b',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 2 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 50,
        'label', 'B'
      )
    ),
    '9b000000-0000-0000-0000-000000000020'
  )$$,
  'save A/B experiment draft with control version bound'
);

select throws_ok(
  $$select public.save_landing_experiment_draft(
    (select id from public.landing_publications order by created_at desc limit 1),
    (select id from public.landing_experiments order by created_at desc limit 1),
    jsonb_build_array(
      jsonb_build_object(
        'variant_key', 'a',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 1 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 25,
        'label', 'A'
      ),
      jsonb_build_object(
        'variant_key', 'b',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 2 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 25,
        'label', 'B'
      ),
      jsonb_build_object(
        'variant_key', 'c',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 2 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 25,
        'label', 'C'
      ),
      jsonb_build_object(
        'variant_key', 'd',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 2 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 25,
        'label', 'D'
      )
    ),
    '9b000000-0000-0000-0000-000000000021'
  )$$,
  '22023',
  NULL,
  'fourth experiment variant is rejected'
);

select lives_ok(
  $$select public.start_landing_experiment(
    (select id from public.landing_experiments order by created_at desc limit 1),
    '9b000000-0000-0000-0000-000000000022'
  )$$,
  'start experiment on live publication'
);

select throws_ok(
  $$select public.save_landing_experiment_draft(
    (select id from public.landing_publications order by created_at desc limit 1),
    null,
    jsonb_build_array(
      jsonb_build_object(
        'variant_key', 'control',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 1 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 50,
        'label', 'Control'
      ),
      jsonb_build_object(
        'variant_key', 'variant-b',
        'landing_page_version_id', (select id from public.landing_page_versions where version_number = 2 and landing_page_id = (select id from public.landing_pages where slug = 'gurgaon-interiors')),
        'allocation_percent', 50,
        'label', 'B'
      )
    ),
    '9b000000-0000-0000-0000-000000000023'
  )$$,
  '22023',
  NULL,
  'second running/draft experiment on same publication is rejected'
);

select lives_ok(
  $$select public.conclude_landing_experiment(
    (select id from public.landing_experiments order by created_at desc limit 1),
    'control',
    '9b000000-0000-0000-0000-000000000024'
  )$$,
  'human winner conclude'
);

select throws_ok(
  $$select public.conclude_landing_experiment(
    (select id from public.landing_experiments order by created_at desc limit 1),
    'variant-b',
    '9b000000-0000-0000-0000-000000000025'
  )$$,
  '22023',
  NULL,
  'concluded experiment is terminal'
);

-- Exposures via service_role path (postgres)
set local role postgres;
select lives_ok(
  $$select public.record_landing_exposure(
    (select id from public.landing_publications order by created_at desc limit 1),
    null,
    null,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')
  )$$,
  'record privacy-safe exposure'
);

select is(
  (
    select (public.record_landing_exposure(
      (select id from public.landing_publications order by created_at desc limit 1),
      null,
      null,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')
    )->>'inserted')::boolean
  ),
  false,
  'repeat exposure does not inflate unique denominator'
);

-- Archive terminal
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'archived',
    4,
    '9b000000-0000-0000-0000-000000000026'
  )$$,
  'live can archive'
);

select throws_ok(
  $$select public.transition_landing_publication(
    (select id from public.landing_publications order by created_at desc limit 1),
    'live',
    5,
    '9b000000-0000-0000-0000-000000000027'
  )$$,
  '22023',
  NULL,
  'archived publication is terminal'
);

set local role postgres;
select ok(
  public.get_live_landing_publication('gurgaon-interiors') is null,
  'archived publication is not publicly live'
);

select ok(
  (select public.verify_live_landing_publication_context(
    (select publication_reference from public.landing_publications order by created_at desc limit 1),
    (select page_reference from public.landing_pages where slug = 'gurgaon-interiors'),
    1,
    null,
    null
  )->>'ok')::boolean = false,
  'paused/archived publication context fails live verification'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Enriched first touchpoint
set local role postgres;
insert into public.contacts (id, display_name, status) values
  ('9bcaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '9B Lead', 'active')
on conflict (id) do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality,
  attribution
) values (
  '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9bcaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '9B Lead',
  'lead9b@example.com',
  'new',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/lp/gurgaon-interiors',
  'Gurgaon',
  jsonb_build_object(
    'landingPath', '/lp/gurgaon-interiors',
    'landing_page_reference', 'OD-LP-2026-000001',
    'page_version_number', '1',
    'publication_reference', 'OD-LP-PUB-2026-000001',
    'utmSource', 'google',
    'fbclid', 'fb.example',
    'gclid', 'g.example',
    'campaign_reference', 'OD-C-2026-000001',
    'campaign_version_number', '1'
  )
);

select is(
  (select count(*)::integer from public.lead_source_touchpoints where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  1,
  'exactly one first touchpoint is inserted'
);

select is(
  (select campaign_reference from public.lead_source_touchpoints where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  'OD-C-2026-000001',
  'trusted campaign_reference is copied onto first touchpoint'
);

select ok(
  (select metadata->>'landing_page_reference' from public.lead_source_touchpoints where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
  = 'OD-LP-2026-000001'
  and (select metadata->>'utm_source' from public.lead_source_touchpoints where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
  = 'google'
  and (select metadata->>'fbclid' from public.lead_source_touchpoints where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
  = 'fb.example',
  'first touchpoint metadata includes trusted landing and click ids'
);

select throws_ok(
  $$update public.lead_source_touchpoints
    set source_detail = 'tamper'
    where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1'$$,
  NULL,
  NULL,
  'lead_source_touchpoints remains append-only'
);

select ok(
  (select pg_column_size(metadata) <= 2048
   from public.lead_source_touchpoints
   where lead_id = '9bba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  'touchpoint metadata stays within 2048 bytes'
);

select ok(
  not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.table_name = 'landing_publications'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'campaign_versions'
  ),
  'landing_publications has no FK into M31 campaign_versions'
);

select has_column('public', 'campaign_versions', 'destination_reference', 'M31 destination_reference column unchanged');

select ok(
  not has_function_privilege(
    'anon',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_live_landing_publication'),
    'execute'
  ),
  'anon cannot execute get_live_landing_publication'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_live_landing_publication'),
    'execute'
  ),
  'authenticated cannot execute get_live_landing_publication'
);

select ok(
  has_function_privilege(
    'service_role',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_live_landing_publication'),
    'execute'
  ),
  'service_role can execute get_live_landing_publication'
);

select ok(
  not has_function_privilege(
    'anon',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'verify_live_landing_publication_context'),
    'execute'
  ),
  'anon cannot execute verify_live_landing_publication_context'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'verify_live_landing_publication_context'),
    'execute'
  ),
  'authenticated cannot execute verify_live_landing_publication_context'
);

select ok(
  has_function_privilege(
    'service_role',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'verify_live_landing_publication_context'),
    'execute'
  ),
  'service_role can execute verify_live_landing_publication_context'
);

select ok(
  not has_function_privilege(
    'anon',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'record_landing_exposure'),
    'execute'
  ),
  'anon cannot execute record_landing_exposure'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'record_landing_exposure'),
    'execute'
  ),
  'authenticated cannot execute record_landing_exposure'
);

select ok(
  has_function_privilege(
    'service_role',
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'record_landing_exposure'),
    'execute'
  ),
  'service_role can execute record_landing_exposure'
);

select finish();
rollback;
