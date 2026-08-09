-- ONEDECORE Phase 2D2 Identity & RBAC pgTAP Database Tests

begin;
select plan(44);

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
  array[9],
  'Should have exactly 9 seeded system roles with is_system = true (6 legacy + 3 Phase 5B canonical)'
);

-- 5. Verify seeded system permissions count and is_system flag
select results_eq(
  'select count(*)::integer from public.permissions where is_system = true',
  array[44],
  'Should have exactly 44 seeded system permissions (6 foundation + 2 portfolio + 4 lead intake + 9 Phase 5B CRM + 2 Phase 5C2B manual lead + 3 Phase 5D bulk import + 3 Phase 5E targets/reporting + 3 Phase 6B inbox + 12 Phase 6D staff attendance leave) with is_system = true'
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

-- 10. Verify authorized application tables count
select results_eq(
  'select count(*)::integer from information_schema.tables where table_schema = ''public'' and table_type = ''BASE TABLE''',
  array[50],
  'Public schema must contain exactly the 50 authorized application tables (identity + portfolio + lead intake + Phase 5B CRM + Phase 5D bulk import + Phase 5E sales targets + Phase 6A WhatsApp + Phase 6B send-intent + Phase 6B dispatch + Phase 6C Kriti + Phase 6D staff attendance leave)'
);

-- 11. Phase 2C3 — rls_auto_enable existence and security properties
select has_function('public', 'rls_auto_enable', array[]::text[], 'public.rls_auto_enable function should exist');

select results_eq(
  'select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ''public'' and p.proname = ''rls_auto_enable''',
  array[true],
  'public.rls_auto_enable must be security definer'
);

select is(
  (select array_to_string(proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable'),
  'search_path=pg_catalog',
  'public.rls_auto_enable search_path must be pg_catalog'
);

-- 12. Phase 2C3 — ensure_rls event trigger existence and status
select results_eq(
  'select evtenabled from pg_event_trigger where evtname = ''ensure_rls''',
  array['O'::"char"],
  'ensure_rls event trigger must exist and be enabled'
);

-- 13. Phase 2C3 — Revoked execution privileges on public.rls_auto_enable()
select results_eq(
  'select has_function_privilege(''anon'', ''public.rls_auto_enable()'', ''execute'')',
  array[false],
  'anon must NOT have execute privilege on public.rls_auto_enable'
);

select results_eq(
  'select has_function_privilege(''authenticated'', ''public.rls_auto_enable()'', ''execute'')',
  array[false],
  'authenticated must NOT have execute privilege on public.rls_auto_enable'
);

select results_eq(
  'select has_function_privilege(''public'', ''public.rls_auto_enable()'', ''execute'')',
  array[false],
  'public pseudo-role must NOT have execute privilege on public.rls_auto_enable'
);

-- 14. Phase 2C3 — idx_user_roles_assigned_by index coverage
select has_index('public', 'user_roles', 'idx_user_roles_assigned_by', 'idx_user_roles_assigned_by index should exist on user_roles');

-- 15. Phase 2D1 — public.authorize(text) RPC signature and security properties
select has_function('public', 'authorize', array['text'], 'public.authorize(text) function should exist');

select results_eq(
  'select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ''public'' and p.proname = ''authorize''',
  array[false],
  'public.authorize must be SECURITY INVOKER (prosecdef = false)'
);

select is(
  (select array_to_string(proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'authorize'),
  'search_path=""',
  'public.authorize search_path must be empty string'
);

-- 16. Phase 2D1 — Execution grants on public.authorize(text)
select results_eq(
  'select has_function_privilege(''anon'', ''public.authorize(text)'', ''execute'')',
  array[false],
  'anon must NOT have execute privilege on public.authorize'
);

select results_eq(
  'select has_function_privilege(''public'', ''public.authorize(text)'', ''execute'')',
  array[false],
  'public pseudo-role must NOT have execute privilege on public.authorize'
);

select results_eq(
  'select has_function_privilege(''authenticated'', ''public.authorize(text)'', ''execute'')',
  array[true],
  'authenticated role MUST have execute privilege on public.authorize'
);

-- 17. Phase 2D1 — Functional permission evaluation unauthenticated check
select is(
  public.authorize('admin.access'),
  false,
  'Unauthenticated context returns false for public.authorize'
);

-- 18. Phase 2D2 — Profile status enforcement tests (pending, active, suspended, disabled)
insert into auth.users (id, instance_id, email, aud, role)
values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'superadmin@onedecore.in',
  'authenticated',
  'authenticated'
);

insert into public.user_roles (user_id, role_id)
select '22222222-2222-2222-2222-222222222222', id
from public.roles where code = 'super_admin';

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

-- Test 18.1: Pending profile status (default on insert) returns false
select is(
  public.authorize('admin.access'),
  false,
  'Pending profile status returns false for admin.access'
);

select is(
  private.has_role('super_admin'),
  false,
  'Pending profile status returns false for has_role'
);

-- Test 18.2: Active profile status returns true
update public.profiles set status = 'active' where id = '22222222-2222-2222-2222-222222222222';

select is(
  public.authorize('admin.access'),
  true,
  'Active profile status with super_admin role returns true for admin.access'
);

select is(
  private.has_role('super_admin'),
  true,
  'Active profile status with super_admin role returns true for has_role'
);

select is(
  public.authorize('nonexistent.permission'),
  false,
  'User without requested permission returns false'
);

-- Test 18.3: Suspended profile status returns false
update public.profiles set status = 'suspended' where id = '22222222-2222-2222-2222-222222222222';

select is(
  public.authorize('admin.access'),
  false,
  'Suspended profile status returns false for admin.access'
);

select is(
  private.has_role('super_admin'),
  false,
  'Suspended profile status returns false for has_role'
);

-- Test 18.4: Disabled profile status returns false
update public.profiles set status = 'disabled' where id = '22222222-2222-2222-2222-222222222222';

select is(
  public.authorize('admin.access'),
  false,
  'Disabled profile status returns false for admin.access'
);

select is(
  private.has_role('super_admin'),
  false,
  'Disabled profile status returns false for has_role'
);

-- Test 18.5: Active profile with inactive role returns false
update public.profiles set status = 'active' where id = '22222222-2222-2222-2222-222222222222';
update public.roles set is_active = false where code = 'super_admin';

select is(
  public.authorize('admin.access'),
  false,
  'Active profile with disabled role returns false for admin.access'
);

select * from finish();
rollback;
