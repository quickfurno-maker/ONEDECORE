-- ONEDECORE Phase 5C1 CRM workspace access foundation pgTAP tests

begin;
select plan(13);

insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa5c@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr5c@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'exec5c@example.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'mgmt5c@example.test', 'authenticated', 'authenticated'),
  ('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'pm5c@example.test', 'authenticated', 'authenticated'),
  ('c7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'des5c@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active', display_name = 'Exec Five C'
where id = 'c3333333-3333-3333-3333-333333333333';

update public.profiles set status = 'active'
where id in (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c4444444-4444-4444-4444-444444444444',
  'c5555555-5555-5555-5555-555555555555',
  'c7777777-7777-7777-7777-777777777777'
);

insert into public.user_roles (user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'c2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'c3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c4444444-4444-4444-4444-444444444444', id from public.roles where code = 'management';
insert into public.user_roles (user_id, role_id)
select 'c5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'c7777777-7777-7777-7777-777777777777', id from public.roles where code = 'designer';

select results_eq(
  $$select count(*)::integer from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'sales_manager' and p.code = 'admin.access'$$,
  array[1],
  'sales_manager receives admin.access'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'sales_executive' and p.code = 'admin.access'$$,
  array[1],
  'sales_executive receives admin.access'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'project_manager' and p.code in ('leads.read_all', 'leads.read_assigned')$$,
  array[0],
  'project_manager does not gain CRM read access'
);

select results_eq(
  $$select count(*)::integer from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'designer' and p.code in ('leads.read_all', 'leads.read_assigned')$$,
  array[0],
  'designer does not gain CRM read access'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$select count(*)::integer from public.list_crm_assignable_executives()$$,
  array[1],
  'super_admin can list CRM assignable executives'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.list_crm_assignable_executives()$$,
  array[1],
  'sales_manager can list CRM assignable executives'
);

select set_config('request.jwt.claim.sub', 'c4444444-4444-4444-4444-444444444444', true);

select results_eq(
  $$select count(*)::integer from public.list_crm_assignable_executives()$$,
  array[1],
  'legacy management retains broad assignee directory access'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select * from public.list_crm_assignable_executives()$$,
  '42501',
  null,
  'sales_executive denied global assignee directory'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select display_name from public.list_crm_assignable_executives() where user_id = 'c3333333-3333-3333-3333-333333333333'::uuid$$,
  array['Exec Five C'],
  'directory returns safe display name only'
);

select results_eq(
  $$select count(*)::integer from information_schema.columns
    where table_schema = 'pg_catalog' and table_name = 'pg_proc' and column_name = 'email'$$,
  array[0],
  'directory RPC does not expose email column contract'
);

select results_eq(
  $$select count(*)::integer from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_crm_assignable_executives'$$,
  array[1],
  'public assignee directory RPC exists'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.list_crm_assignable_executives()$$,
  '42501',
  null,
  'assignee directory denied to anon'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer from public.leads where assigned_to is null$$,
  array[0],
  'sales_executive cannot see unassigned leads after 5C1 migration'
);

select * from finish();
rollback;
