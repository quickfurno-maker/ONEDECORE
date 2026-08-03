-- ONEDECORE Phase 5E-B CRM sales targets + reporting pgTAP tests

begin;
select plan(24);

insert into auth.users (id, instance_id, email, aud, role) values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '5e-sa@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '5e-mgr@example.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '5e-execa@example.test', 'authenticated', 'authenticated'),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '5e-execb@example.test', 'authenticated', 'authenticated'),
  ('e5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '5e-pm@example.test', 'authenticated', 'authenticated'),
  ('e6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', '5e-designer@example.test', 'authenticated', 'authenticated'),
  ('e7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', '5e-mgmt@example.test', 'authenticated', 'authenticated'),
  ('e8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', '5e-sales@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444',
  'e5555555-5555-5555-5555-555555555555',
  'e6666666-6666-6666-6666-666666666666',
  'e7777777-7777-7777-7777-777777777777',
  'e8888888-8888-8888-8888-888888888888'
);

insert into public.user_roles (user_id, role_id)
select 'e1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'e2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'e3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'e6666666-6666-6666-6666-666666666666', id from public.roles where code = 'designer';
insert into public.user_roles (user_id, role_id)
select 'e7777777-7777-7777-7777-777777777777', id from public.roles where code = 'management';
insert into public.user_roles (user_id, role_id)
select 'e8888888-8888-8888-8888-888888888888', id from public.roles where code = 'sales';

select has_table('public', 'sales_targets', 'sales_targets table exists');
select has_table('public', 'sales_target_events', 'sales_target_events table exists');

select col_is_pk('public', 'sales_targets', 'id', 'sales_targets id is PK');
select col_not_null('public', 'sales_targets', 'target_scope', 'target_scope not null');
select col_not_null('public', 'sales_targets', 'target_month', 'target_month not null');

select results_eq(
  $$select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'sales_targets'
      and column_name in ('achieved_revenue', 'attainment_percent', 'variance')$$,
  array[0],
  'no forbidden achievement columns on sales_targets'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_lead_follow_ups_owner_status_due'
  ),
  'reporting follow-up index exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('sales_targets.manage'))$$,
  array[true],
  'super_admin has sales_targets.manage'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('sales_targets.manage'))$$,
  array[false],
  'sales_manager denied sales_targets.manage'
);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select (select private.has_permission('sales_targets.read'))$$,
  array[true],
  'sales_executive has sales_targets.read'
);

select set_config('request.jwt.claim.sub', 'e5555555-5555-5555-5555-555555555555', true);
select results_eq(
  $$select (select private.has_permission('sales_targets.read'))$$,
  array[false],
  'project_manager denied sales_targets.read'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.create_sales_target(
    'sales_team',
    date '2026-09-01',
    null,
    50000000,
    10,
    'Initial team target for September reporting cycle.'
  )$$,
  'super_admin creates team target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.create_sales_target(
    'sales_team',
    date '2026-09-01',
    null,
    50000000,
    10,
    'Duplicate team target should be rejected for same month.'
  )$$,
  '23505',
  null,
  'duplicate team target rejected'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.create_sales_target(
    'executive_personal',
    date '2026-09-01',
    'e3333333-3333-3333-3333-333333333333',
    25000000,
    5,
    'Executive personal target for assignable sales user A.'
  )$$,
  'super_admin creates executive personal target'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.create_sales_target(
    'executive_personal',
    date '2026-10-01',
    'e4444444-4444-4444-4444-444444444444',
    25000000,
    5,
    'Manager must not create sales targets under any scope.'
  )$$,
  '42501',
  null,
  'sales_manager cannot create target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select set_config('test.phase5e_exec_target_id', (
  select id::text from public.sales_targets
  where target_scope = 'executive_personal'
    and target_user_id = 'e3333333-3333-3333-3333-333333333333'
  limit 1
), true);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select count(*)::int from public.sales_targets
    where target_scope = 'executive_personal' and target_user_id = 'e3333333-3333-3333-3333-333333333333'$$,
  array[1],
  'executive sees own personal target via RLS'
);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select count(*)::int from public.sales_targets
    where target_scope = 'executive_personal' and target_user_id = 'e4444444-4444-4444-4444-444444444444'$$,
  array[0],
  'executive cannot see another executive target'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select count(*)::int from public.sales_targets where target_scope = 'sales_team'$$,
  array[1],
  'manager sees team target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.revise_sales_target(
    current_setting('test.phase5e_exec_target_id')::uuid,
    1,
    30000000,
    6,
    'Revised executive target after staffing review for the month.'
  )$$,
  'super_admin revises open target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.lock_sales_target(
    current_setting('test.phase5e_exec_target_id')::uuid,
    2,
    'Locking executive target after final configuration sign-off.'
  )$$,
  'super_admin locks target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.reopen_sales_target(
    current_setting('test.phase5e_exec_target_id')::uuid,
    3,
    'Reopening executive target for approved correction window.'
  )$$,
  'super_admin reopens locked target'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select count(*)::int from public.sales_target_events
    where target_id = current_setting('test.phase5e_exec_target_id')::uuid$$,
  array[4],
  'append-only history records created/revised/locked/reopened'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$update public.sales_target_events set reason = 'mutate' where true$$,
  '42501',
  null,
  'sales_target_events update blocked'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$delete from public.sales_targets where true$$,
  null,
  null,
  'sales_targets hard delete blocked by privileges'
);

select * from finish();
rollback;
