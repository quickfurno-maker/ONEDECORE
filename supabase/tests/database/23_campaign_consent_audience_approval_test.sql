-- ONEDECORE Phase 9A M31 — campaign consent, audience, approval pgTAP
begin;
select plan(91);

-- ----------------------------------------------------------------------------
-- Foundation
-- ----------------------------------------------------------------------------
select ok(exists (select 1 from public.permissions where code = 'campaigns.read'), 'campaigns.read exists');
select ok(exists (select 1 from public.permissions where code = 'campaigns.draft'), 'campaigns.draft exists');
select ok(exists (select 1 from public.permissions where code = 'campaigns.request_approval'), 'campaigns.request_approval exists');
select ok(exists (select 1 from public.permissions where code = 'campaigns.approve'), 'campaigns.approve exists');
select ok(exists (select 1 from public.permissions where code = 'marketing_consents.manage'), 'marketing_consents.manage exists');
select ok(not exists (select 1 from public.permissions where code in (
  'campaigns.publish', 'campaigns.schedule', 'campaigns.send', 'campaigns.provider_manage'
)), 'no Phase 9A publish/schedule/send/provider_manage permissions');

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in (
      'campaigns.read', 'campaigns.draft', 'campaigns.request_approval', 'campaigns.approve', 'marketing_consents.manage'
    )
    and r.code in ('super_admin', 'sales_manager')
  ),
  10,
  'SA/SM receive all five Phase 9A permissions'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in (
      'campaigns.read', 'campaigns.draft', 'campaigns.request_approval', 'campaigns.approve', 'marketing_consents.manage'
    )
    and r.code in ('sales_executive', 'project_manager', 'designer', 'management', 'sales', 'project_operations', 'content_manager')
  ),
  0,
  'legacy/SE/PM/Designer have no Phase 9A grants'
);

select has_table('public', 'campaigns', 'campaigns exists');
select has_table('public', 'campaign_versions', 'campaign_versions exists');
select has_table('public', 'campaign_audience_rule_versions', 'campaign_audience_rule_versions exists');
select has_table('public', 'campaign_approvals', 'campaign_approvals exists');
select has_table('private', 'marketing_idempotency_requests', 'private marketing idempotency ledger exists');

select ok(not exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'contact_suppressions', 'campaign_members', 'campaign_recipients',
      'campaign_audience_members', 'campaign_recipient_snapshots',
      'campaign_jobs', 'campaign_delivery_jobs',
      'campaign_provider_objects', 'campaign_spend', 'campaign_conversions',
      'campaign_attribution', 'experiments'
    )
), 'forbidden 9A/9B/9C tables absent');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaigns'),
  'campaigns RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_versions'),
  'campaign_versions RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_audience_rule_versions'),
  'audience rule versions RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'campaign_approvals'),
  'campaign_approvals RLS enabled'
);

select ok(
  (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'campaign_versions' and c.conname = 'chk_campaign_versions_status')
  not ilike '%scheduled%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'campaign_versions' and c.conname = 'chk_campaign_versions_status')
  not ilike '%paused%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'campaign_versions' and c.conname = 'chk_campaign_versions_status')
  not ilike '%cancelled%'
  and (select pg_get_constraintdef(c.oid)
   from pg_constraint c
   join pg_class t on t.oid = c.conrelid
   where t.relname = 'campaign_versions' and c.conname = 'chk_campaign_versions_status')
  not ilike '%completed%',
  'version status has no scheduled/paused/completed/cancelled'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'chk_whatsapp_send_intents_purpose')
  like '%WHATSAPP_SERVICE%',
  'M19 WHATSAPP_SERVICE purpose constraint still present'
);

select ok(
  position('marketing_idempotency_xact_lock' in pg_get_functiondef('public.create_campaign_draft(text,text,text,text[],text,jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure))
  < position('marketing_idempotency_lookup' in pg_get_functiondef('public.create_campaign_draft(text,text,text,text[],text,jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure)),
  'create_campaign_draft locks before ledger lookup'
);

select ok(
  position('marketing_idempotency_xact_lock' in pg_get_functiondef('public.decide_campaign_version(uuid,text,text,uuid)'::regprocedure))
  < position('marketing_idempotency_lookup' in pg_get_functiondef('public.decide_campaign_version(uuid,text,text,uuid)'::regprocedure)),
  'decide_campaign_version locks before ledger lookup'
);

select ok(
  position('marketing_idempotency_xact_lock' in pg_get_functiondef('public.record_marketing_consent_event(uuid,text,text,text,text,text,text,uuid)'::regprocedure))
  < position('marketing_idempotency_lookup' in pg_get_functiondef('public.record_marketing_consent_event(uuid,text,text,text,text,text,text,uuid)'::regprocedure)),
  'consent RPC locks before ledger lookup'
);

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'has_current_marketing_consent'),
  'has_current_marketing_consent is security definer'
);

select ok(
  pg_get_functiondef('public.create_campaign_draft(text,text,text,text[],text,jsonb,jsonb,jsonb,jsonb,uuid)'::regprocedure)
    ilike '%search_path%'
  and pg_get_functiondef('public.decide_campaign_version(uuid,text,text,uuid)'::regprocedure)
    ilike '%search_path%'
  and pg_get_functiondef('private.has_current_marketing_consent(uuid)'::regprocedure)
    ilike '%search_path%'
  and pg_get_functiondef('public.record_marketing_consent_event(uuid,text,text,text,text,text,text,uuid)'::regprocedure)
    ilike '%search_path%',
  'Phase 9A definer functions set search_path empty'
);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
set local role postgres;

insert into auth.users (id, instance_id, email, aud, role) values
  ('9a111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9a@onedecore.in', 'authenticated', 'authenticated'),
  ('9a222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm1_9a@onedecore.in', 'authenticated', 'authenticated'),
  ('9a222222-2222-2222-2222-222222222221', '00000000-0000-0000-0000-000000000000', 'sm2_9a@onedecore.in', 'authenticated', 'authenticated'),
  ('9a333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9a@onedecore.in', 'authenticated', 'authenticated'),
  ('9a444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'pm_9a@onedecore.in', 'authenticated', 'authenticated'),
  ('9a555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'designer_9a@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9A ' || id::text
where id in (
  '9a111111-1111-1111-1111-111111111111',
  '9a222222-2222-2222-2222-222222222222',
  '9a222222-2222-2222-2222-222222222221',
  '9a333333-3333-3333-3333-333333333333',
  '9a444444-4444-4444-4444-444444444444',
  '9a555555-5555-5555-5555-555555555555'
);

insert into public.user_roles (user_id, role_id)
select '9a111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9a222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9a222222-2222-2222-2222-222222222221', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9a333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9a444444-4444-4444-4444-444444444444', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9a555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer' on conflict do nothing;

insert into public.contacts (id, display_name, status) values
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '9A Eligible', 'active'),
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '9A DNC', 'do_not_contact'),
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '9A Suppressed Email', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'email', 'eligible9a@example.com', true, 'active'),
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'whatsapp', '+919811122291', false, 'active'),
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'email', 'dnc9a@example.com', true, 'active'),
  ('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'email', 'suppressed9a@example.com', true, 'suppressed')
on conflict do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality
) values
(
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '9A Eligible',
  'eligible9a@example.com',
  'qualified',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'Noida'
),
(
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  '9A DNC',
  'dnc9a@example.com',
  'qualified',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'Noida'
),
(
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  '9aba1111-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  '9A Suppressed',
  'suppressed9a@example.com',
  'qualified',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'Noida'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Direct DML denied
-- ----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.campaigns (campaign_reference, name, created_by)
    values ('OD-C-2026-999999', 'Nope', '9a111111-1111-1111-1111-111111111111')$$,
  '42501',
  NULL,
  'authenticated insert into campaigns denied'
);

select throws_ok(
  $$update public.campaigns set name = 'x' where false$$,
  '42501',
  NULL,
  'authenticated update campaigns denied'
);

select throws_ok(
  $$delete from public.campaign_approvals where false$$,
  '42501',
  NULL,
  'authenticated delete campaign_approvals denied'
);

-- ----------------------------------------------------------------------------
-- Create / deny roles
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.create_campaign_draft(
    'Diwali interiors',
    'Diwali interiors v1',
    'direct_or_custom',
    array['email','whatsapp'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references', jsonb_build_array('media-1')),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','in','values', jsonb_build_array('qualified','new')),
      jsonb_build_object('field','locality','operator','equals','values', jsonb_build_array('Noida'))
    )),
    '9a000000-0000-0000-0000-000000000001'
  )$$,
  'SA can create campaign draft'
);

select ok(
  exists (select 1 from public.campaigns where campaign_reference ~ '^OD-C-[0-9]{4}-[0-9]{6}$'),
  'campaign_reference matches OD-C-YYYY-SEQ6'
);

select is(
  (select status from public.campaign_versions order by created_at desc limit 1),
  'draft',
  'created version is draft'
);

select throws_ok(
  $$
    select set_config('request.jwt.claims', '{"sub":"9a333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select public.create_campaign_draft(
      'SE campaign', 'SE v1', 'broad_public', array['meta_ads'], null,
      jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
      jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
      jsonb_build_object('start_date','2026-09-01','end_date', null),
      jsonb_build_object('logic','and','rules', jsonb_build_array(
        jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
      )),
      '9a000000-0000-0000-0000-0000000000a1'
    )
  $$,
  '42501',
  NULL,
  'SE cannot create campaign'
);

select throws_ok(
  $$
    select set_config('request.jwt.claims', '{"sub":"9a444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
    select public.create_campaign_draft(
      'PM campaign', 'PM v1', 'broad_public', array['meta_ads'], null,
      jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
      jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
      jsonb_build_object('start_date','2026-09-01','end_date', null),
      jsonb_build_object('logic','and','rules', jsonb_build_array(
        jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
      )),
      '9a000000-0000-0000-0000-0000000000a2'
    )
  $$,
  '42501',
  NULL,
  'PM cannot create campaign'
);

select throws_ok(
  $$
    select set_config('request.jwt.claims', '{"sub":"9a555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
    select public.create_campaign_draft(
      'Designer campaign', 'D v1', 'broad_public', array['meta_ads'], null,
      jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
      jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
      jsonb_build_object('start_date','2026-09-01','end_date', null),
      jsonb_build_object('logic','and','rules', jsonb_build_array(
        jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
      )),
      '9a000000-0000-0000-0000-0000000000a3'
    )
  $$,
  '42501',
  NULL,
  'Designer cannot create campaign'
);

select throws_ok(
  $$
    set local role anon;
    select public.create_campaign_draft(
      'Anon', 'Anon', 'broad_public', array['meta_ads'], null,
      jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
      jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
      jsonb_build_object('start_date','2026-09-01','end_date', null),
      jsonb_build_object('logic','and','rules', jsonb_build_array(
        jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
      )),
      '9a000000-0000-0000-0000-0000000000a4'
    )
  $$,
  '42501',
  NULL,
  'anon cannot execute create_campaign_draft'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$select public.create_campaign_draft(
    'Bad channel', 'Bad channel', 'broad_public', array['sms'], null,
    jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
    )),
    '9a000000-0000-0000-0000-0000000000a5'
  )$$,
  '22023',
  NULL,
  'invalid channels denied'
);

select throws_ok(
  $$select public.create_campaign_draft(
    'Dup channel', 'Dup channel', 'broad_public', array['email','email'], null,
    jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
    )),
    '9a000000-0000-0000-0000-0000000000dc'
  )$$,
  '22023',
  NULL,
  'duplicate channels denied'
);

select is(
  (
    select public.create_campaign_draft(
      'Diwali interiors',
      'Diwali interiors v1',
      'direct_or_custom',
      array['email','whatsapp'],
      'opaque-dest-001',
      jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
      jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references', jsonb_build_array('media-1')),
      jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
      jsonb_build_object('logic','and','rules', jsonb_build_array(
        jsonb_build_object('field','lead_stage','operator','in','values', jsonb_build_array('qualified','new')),
        jsonb_build_object('field','locality','operator','equals','values', jsonb_build_array('Noida'))
      )),
      '9a000000-0000-0000-0000-000000000001'
    )->>'campaign_id'
  ),
  (select id::text from public.campaigns order by created_at desc limit 1),
  'idempotent create replay returns same campaign'
);

select throws_ok(
  $$select public.create_campaign_draft(
    'Diwali interiors changed',
    'Diwali interiors v1',
    'direct_or_custom',
    array['email','whatsapp'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references', jsonb_build_array('media-1')),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','in','values', jsonb_build_array('qualified','new')),
      jsonb_build_object('field','locality','operator','equals','values', jsonb_build_array('Noida'))
    )),
    '9a000000-0000-0000-0000-000000000001'
  )$$,
  '22023',
  NULL,
  'same idempotency key different hash conflicts'
);

set local role postgres;
select is(
  (
    select r.rule_hash
    from public.campaign_audience_rule_versions r
    join public.campaign_versions v on v.id = r.campaign_version_id
    order by v.created_at desc
    limit 1
  ),
  private.hash_campaign_audience_rule_group(
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','locality','operator','equals','values', jsonb_build_array('noida')),
      jsonb_build_object('field','lead_stage','operator','in','values', jsonb_build_array('new','qualified'))
    ))
  ),
  'canonical audience hash is order-stable'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ----------------------------------------------------------------------------
-- Save draft / optimistic concurrency / invalid field
-- ----------------------------------------------------------------------------
select throws_ok(
  $$select public.save_campaign_draft(
    (select id from public.campaign_versions order by created_at desc limit 1),
    99,
    'Diwali interiors v1',
    'direct_or_custom',
    array['email'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9a000000-0000-0000-0000-0000000000a6'
  )$$,
  'P0002',
  NULL,
  'wrong lock version conflicts'
);

select throws_ok(
  $$select public.save_campaign_draft(
    (select id from public.campaign_versions order by created_at desc limit 1),
    1,
    'Diwali interiors v1',
    'direct_or_custom',
    array['email'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','email','operator','equals','values', jsonb_build_array('x@y.com'))
    )),
    '9a000000-0000-0000-0000-0000000000a7'
  )$$,
  '22023',
  NULL,
  'PII/non-allowlist audience field denied'
);

select lives_ok(
  $$select public.save_campaign_draft(
    (select id from public.campaign_versions order by created_at desc limit 1),
    1,
    'Diwali interiors v1',
    'direct_or_custom',
    array['email','whatsapp'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references', jsonb_build_array('media-1')),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','in','values', jsonb_build_array('qualified')),
      jsonb_build_object('field','locality','operator','equals','values', jsonb_build_array('Noida'))
    )),
    '9a000000-0000-0000-0000-0000000000a8'
  )$$,
  'SA can save draft'
);

select is(
  (select lock_version from public.campaign_versions order by created_at desc limit 1),
  2,
  'save draft increments lock_version'
);

-- ----------------------------------------------------------------------------
-- Request approval freeze
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions order by created_at desc limit 1),
    2,
    '9a000000-0000-0000-0000-0000000000a9'
  )$$,
  'SA can request approval'
);

select is(
  (select status from public.campaign_versions order by created_at desc limit 1),
  'pending_approval',
  'request approval moves to pending_approval'
);

select ok(
  (select configuration_hash ~ '^[0-9a-f]{64}$' from public.campaign_versions order by created_at desc limit 1),
  'configuration_hash frozen as sha256 hex'
);

select ok(
  (select frozen_at is not null from public.campaign_audience_rule_versions
   where campaign_version_id = (select id from public.campaign_versions order by created_at desc limit 1)),
  'audience rule frozen on request approval'
);

select throws_ok(
  $$select public.save_campaign_draft(
    (select id from public.campaign_versions order by created_at desc limit 1),
    3,
    'changed after submit',
    'direct_or_custom',
    array['email'],
    'opaque-dest-001',
    jsonb_build_object('currency','INR','daily_budget_paise',1,'total_budget_paise',1),
    jsonb_build_object('headline','Home interiors','primary_text','Book a consult','call_to_action','Enquire','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-09-01','end_date','2026-09-30'),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9a000000-0000-0000-0000-0000000000aa'
  )$$,
  '22023',
  NULL,
  'save after submission denied'
);

select is(
  (
    select public.request_campaign_approval(
      (select id from public.campaign_versions order by created_at desc limit 1),
      2,
      '9a000000-0000-0000-0000-0000000000a9'
    )->>'status'
  ),
  'pending_approval',
  'request approval idempotent replay does not duplicate freeze'
);

select is(
  (select count(*)::integer from public.campaign_versions where campaign_id = (select id from public.campaigns order by created_at desc limit 1)),
  1,
  'idempotent request approval does not create another version'
);

-- ----------------------------------------------------------------------------
-- SM self-approval denied; other SM and SA may approve
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"9a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select lives_ok(
  $$select public.create_campaign_draft(
    'SM own campaign',
    'SM own v1',
    'broad_public',
    array['meta_ads'],
    null,
    jsonb_build_object('currency','INR','daily_budget_paise',0,'total_budget_paise', null),
    jsonb_build_object('headline','H','primary_text','Primary text here','call_to_action','Go','media_references','[]'::jsonb),
    jsonb_build_object('start_date','2026-10-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('new'))
    )),
    '9a000000-0000-0000-0000-0000000000ab'
  )$$,
  'SM can create draft'
);

select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1),
    1,
    '9a000000-0000-0000-0000-0000000000ac'
  )$$,
  'SM can request approval on own draft'
);

select throws_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1),
    'approved',
    null,
    '9a000000-0000-0000-0000-0000000000ad'
  )$$,
  '42501',
  NULL,
  'SM creator/requester self-approval denied'
);

select set_config('request.jwt.claims', '{"sub":"9a222222-2222-2222-2222-222222222221","role":"authenticated"}', true);

select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1),
    'approved',
    null,
    '9a000000-0000-0000-0000-0000000000ae'
  )$$,
  'other SM may approve'
);

select is(
  (select status from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1),
  'approved',
  'other SM approval is terminal approved'
);

select is(
  (select count(*)::integer from public.campaign_approvals where campaign_version_id = (
    select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1
  )),
  1,
  'exactly one approval row'
);

select throws_ok(
  $$update public.campaign_approvals set reason = 'x' where true$$,
  '42501',
  NULL,
  'authenticated cannot update approvals'
);

set local role postgres;
select throws_ok(
  $$update public.campaign_approvals set reason = 'mutated' where campaign_version_id = (
    select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1
  )$$,
  '22023',
  NULL,
  'approval append-only even as postgres trigger'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' order by created_at desc limit 1),
    'rejected',
    'Incomplete audience and budget proposal',
    '9a000000-0000-0000-0000-0000000000af'
  )$$,
  'SA may reject pending version including own'
);

select is(
  (select status from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' order by created_at desc limit 1),
  'rejected',
  'SA rejection is terminal rejected'
);

select throws_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' order by created_at desc limit 1),
    'approved',
    null,
    '9a000000-0000-0000-0000-0000000000b0'
  )$$,
  '22023',
  NULL,
  'decide not allowed on terminal version'
);

-- ----------------------------------------------------------------------------
-- Next version
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.create_next_campaign_version(
    (select campaign_id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' order by created_at desc limit 1),
    '9a000000-0000-0000-0000-0000000000b1'
  )$$,
  'next version from rejected'
);

select is(
  (select max(version_number) from public.campaign_versions where campaign_id = (
    select campaign_id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' order by created_at desc limit 1
  )),
  2,
  'next version number is n+1'
);

select is(
  (select status from public.campaign_versions
   where campaign_id = (select campaign_id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' limit 1)
     and version_number = 1),
  'rejected',
  'old rejected version unchanged'
);

select is(
  (select frozen_at from public.campaign_audience_rule_versions
   where campaign_version_id = (
     select id from public.campaign_versions
     where campaign_id = (select campaign_id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' limit 1)
       and version_number = 2
   )),
  null,
  'new audience rule row is unfrozen'
);

select is(
  (select count(*)::integer from public.campaign_approvals a
   join public.campaign_versions v on v.id = a.campaign_version_id
   where v.version_number = 2
     and v.campaign_id = (select campaign_id from public.campaign_versions where created_by = '9a111111-1111-1111-1111-111111111111' limit 1)),
  0,
  'approval row is not copied to next version'
);

-- ----------------------------------------------------------------------------
-- Consent
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.record_marketing_consent_event(
    '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'granted',
    'phone',
    'copy-v1',
    'notice-v1',
    'phone_call',
    'Customer instructed grant',
    '9a000000-0000-0000-0000-0000000000b4'
  )$$,
  'SA can record MARKETING grant'
);

set local role postgres;
select is(
  (select purpose_code from public.consent_events where contact_id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' order by created_at desc limit 1),
  'MARKETING',
  'staff RPC writes MARKETING only'
);

select is(
  (select actor_type from public.consent_events where contact_id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' order by created_at desc limit 1),
  'staff',
  'staff actor_type'
);

select is(
  (select source from public.consent_events where contact_id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' order by created_at desc limit 1),
  'staff_marketing_consent',
  'server-fixed consent source'
);
select ok(
  private.has_current_marketing_consent('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  'current MARKETING consent derived from latest granted'
);
set local role authenticated;

select lives_ok(
  $$select public.record_marketing_consent_event(
    '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'granted',
    'phone',
    'copy-v1',
    'notice-v1',
    'phone_call',
    'Customer instructed grant',
    '9a000000-0000-0000-0000-0000000000b4'
  )$$,
  'consent idempotent replay'
);

set local role postgres;
select is(
  (select count(*)::integer from public.consent_events where contact_id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and purpose_code = 'MARKETING'),
  1,
  'idempotent consent does not duplicate event'
);
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"9a222222-2222-2222-2222-222222222221","role":"authenticated"}', true);
select lives_ok(
  $$select public.record_marketing_consent_event(
    '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'granted',
    'email',
    'copy-v1',
    'notice-v1',
    'email',
    null,
    '9a000000-0000-0000-0000-0000000000c2'
  )$$,
  'SM can record MARKETING grant'
);

select is(
  (select status from public.contacts where id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  'do_not_contact',
  'MARKETING grant does not clear DNC'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a222222-2222-2222-2222-222222222221","role":"authenticated"}', true);
select is(
  (
    public.record_marketing_consent_event(
      '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'withdrawn',
      'phone',
      'copy-v1',
      'notice-v1',
      'phone_call',
      'Customer withdrew',
      '9a000000-0000-0000-0000-0000000000d9'
    )
  )->>'event_type',
  'withdrawn',
  'SM can withdraw MARKETING'
);

set local role postgres;
select is(
  (select event_type from public.consent_events
    where contact_id = '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and purpose_code = 'MARKETING'
    order by occurred_at desc, created_at desc, id desc
    limit 1),
  'withdrawn',
  'latest MARKETING event is withdrawn'
);
select ok(
  not private.has_current_marketing_consent('9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  'latest withdrawn means no current MARKETING consent'
);
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.record_marketing_consent_event(
    '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'granted',
    'phone',
    'copy-v2',
    'notice-v2',
    'phone_call',
    'Re-granted after instruction',
    '9a000000-0000-0000-0000-0000000000c3'
  )$$,
  'SA can re-grant after withdrawal'
);

select throws_ok(
  $$select public.record_marketing_consent_event(
    '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'suppressed',
    'phone',
    'copy-v1',
    'notice-v1',
    'phone_call',
    null,
    '9a000000-0000-0000-0000-0000000000b3'
  )$$,
  '22023',
  NULL,
  'staff RPC cannot write suppressed'
);

select throws_ok(
  $$
    select set_config('request.jwt.claims', '{"sub":"9a333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select public.record_marketing_consent_event(
      '9acaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'granted', 'phone', 'copy-v1', 'notice-v1', 'phone_call', null,
      '9a000000-0000-0000-0000-0000000000a1'
    )
  $$,
  '42501',
  NULL,
  'SE cannot manage MARKETING consent'
);

select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ----------------------------------------------------------------------------
-- Preview aggregates, no PII
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.preview_campaign_audience(
    (select id from public.campaign_versions where version_number = 2 and created_by = '9a111111-1111-1111-1111-111111111111' limit 1)
  )$$,
  'SA can preview audience aggregates'
);

select ok(
  (
    select (public.preview_campaign_audience(
      (select id from public.campaign_versions where version_number = 2 and created_by = '9a111111-1111-1111-1111-111111111111' limit 1)
    ))::text
  )
  not ilike '%eligible9a@example.com%'
  and (
    select (public.preview_campaign_audience(
      (select id from public.campaign_versions where version_number = 2 and created_by = '9a111111-1111-1111-1111-111111111111' limit 1)
    ))::text
  )
  not ilike '%9acaaaaa%',
  'preview returns no emails or contact ids'
);

select ok(
  (
    select public.preview_campaign_audience(
      (select id from public.campaign_versions where created_by = '9a222222-2222-2222-2222-222222222222' order by created_at desc limit 1)
    )->>'eligible_direct_or_custom_count' is null
  ),
  'broad_public eligible_direct_or_custom_count is not applicable'
);

select throws_ok(
  $$
    select set_config('request.jwt.claims', '{"sub":"9a333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select public.preview_campaign_audience(
      (select id from public.campaign_versions limit 1)
    )
  $$,
  '42501',
  NULL,
  'SE cannot preview audience'
);

set local role postgres;
select ok(
  (select status from public.contact_channels where address_normalized = 'suppressed9a@example.com') = 'suppressed',
  'channel suppression not cleared by consent grant'
);

select ok(
  not exists (select 1 from public.whatsapp_send_intents where purpose_code = 'MARKETING'),
  'no WhatsApp MARKETING send intents created'
);

select ok(
  coalesce((
    select configuration_hash from public.campaign_versions
    where created_by = '9a222222-2222-2222-2222-222222222222'
    order by created_at desc limit 1
  ), '') not like '%eligible_direct_or_custom_count%',
  'preview aggregates are not stored in configuration_hash'
);

select ok(
  has_function_privilege('anon', 'public.create_campaign_draft(text,text,text,text[],text,jsonb,jsonb,jsonb,jsonb,uuid)', 'execute') = false,
  'anon execute create_campaign_draft denied'
);

select ok(
  has_function_privilege('authenticated', 'private.has_current_marketing_consent(uuid)', 'execute') = false,
  'authenticated cannot execute private consent helper'
);

select finish();
rollback;
