-- ONEDECORE Phase 2C Identity & RBAC pgTAP Database Tests

begin;
select plan(14);

-- 1. Verify schema existence
select has_schema('private', 'Private security schema should exist');

-- 2. Verify table existence in public schema
select has_table('public', 'profiles', 'public.profiles table should exist');
select has_table('public', 'roles', 'public.roles table should exist');
select has_table('public', 'permissions', 'public.permissions table should exist');
select has_table('public', 'role_permissions', 'public.role_permissions table should exist');
select has_table('public', 'user_roles', 'public.user_roles table should exist');

-- 3. Verify Row Level Security is enabled on all five tables
select results_eq(
  'select relrowsecurity from pg_class where relname = ''profiles'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on profiles'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''roles'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on roles'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''permissions'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on permissions'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''role_permissions'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on role_permissions'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''user_roles'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on user_roles'
);

-- 4. Verify seeded roles count
select results_eq(
  'select count(*)::integer from public.roles',
  array[6],
  'Should have exactly 6 seeded system roles'
);

-- 5. Verify seeded permissions count
select results_eq(
  'select count(*)::integer from public.permissions',
  array[6],
  'Should have exactly 6 seeded foundation permissions'
);

-- 6. Verify user_roles starts empty
select is_empty(
  'select * from public.user_roles',
  'public.user_roles should start empty before user assignment'
);

select * from finish();
rollback;
