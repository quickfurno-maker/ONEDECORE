-- ONEDECORE Phase 2C1 Identity & RBAC pgTAP Hardened Database Tests

begin;
select plan(19);

-- 1. Verify schema existence
select has_schema('private', 'Private security schema should exist');

-- 2. Verify exact table existence in public schema
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

-- 4. Verify seeded system roles count and is_system flag
select results_eq(
  'select count(*)::integer from public.roles where is_system = true',
  array[6],
  'Should have exactly 6 seeded system roles with is_system = true'
);

-- 5. Verify seeded system permissions count and is_system flag
select results_eq(
  'select count(*)::integer from public.permissions where is_system = true',
  array[6],
  'Should have exactly 6 seeded foundation permissions with is_system = true'
);

-- 6. Verify user_roles starts empty
select is_empty(
  'select * from public.user_roles',
  'public.user_roles should start empty before user assignment'
);

-- 7. Verify security definer property on set_updated_at function (must NOT be security definer)
select results_eq(
  'select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ''private'' and p.proname = ''set_updated_at''',
  array[false],
  'private.set_updated_at must NOT be security definer'
);

-- 8. Verify security definer property on has_role and has_permission functions
select results_eq(
  'select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ''private'' and p.proname = ''has_role''',
  array[true],
  'private.has_role must be security definer'
);

select results_eq(
  'select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ''private'' and p.proname = ''has_permission''',
  array[true],
  'private.has_permission must be security definer'
);

-- 9. Verify profile metadata normalization logic in trigger function
insert into auth.users (id, instance_id, email, raw_user_meta_data, aud, role)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'oversized@onedecore.in',
  jsonb_build_object('full_name', repeat('A', 200)),
  'authenticated',
  'authenticated'
);

select results_eq(
  'select length(display_name) from public.profiles where id = ''11111111-1111-1111-1111-111111111111''',
  array[120],
  'Oversized display_name metadata should be truncated to exactly 120 characters'
);

-- 10. Verify no unexpected application tables exist
select results_eq(
  'select count(*)::integer from information_schema.tables where table_schema = ''public'' and table_type = ''BASE TABLE''',
  array[5],
  'Public schema must contain exactly the 5 authorized identity tables'
);

select * from finish();
rollback;
