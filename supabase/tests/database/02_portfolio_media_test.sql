-- ONEDECORE Phase 2E1, Phase 2E2 & Phase 2E2A Portfolio Data & Media Storage pgTAP Security Tests

begin;
select plan(63);

-- 1. Verify portfolio tables exist
select has_table('public', 'portfolio_projects', 'public.portfolio_projects table should exist');
select has_table('public', 'portfolio_project_services', 'public.portfolio_project_services table should exist');
select has_table('public', 'portfolio_media', 'public.portfolio_media table should exist');
select has_table('public', 'portfolio_media_sources', 'public.portfolio_media_sources table should exist');

-- 2. Verify RLS is enabled on all four portfolio tables
select results_eq(
  'select relrowsecurity from pg_class where relname = ''portfolio_projects'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on portfolio_projects'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''portfolio_project_services'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on portfolio_project_services'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''portfolio_media'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on portfolio_media'
);

select results_eq(
  'select relrowsecurity from pg_class where relname = ''portfolio_media_sources'' and relnamespace = ''public''::regnamespace',
  array[true],
  'RLS should be enabled on portfolio_media_sources'
);

-- 3. Verify seeded system portfolio permissions
select results_eq(
  'select count(*)::integer from public.permissions where code in (''portfolio.read'', ''portfolio.manage'') and is_system = true',
  array[2],
  'Should have exactly 2 seeded portfolio permissions'
);

-- 4. Verify Super Admin role mapping for portfolio permissions
select results_eq(
  'select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = ''super_admin'' and p.code in (''portfolio.read'', ''portfolio.manage'')',
  array[2],
  'super_admin role should be mapped to both portfolio permissions'
);

-- 5. Verify Storage buckets configuration
select results_eq(
  'select public from storage.buckets where id = ''portfolio-originals''',
  array[false],
  'portfolio-originals bucket must be private'
);

select results_eq(
  'select file_size_limit from storage.buckets where id = ''portfolio-originals''',
  array[20971520::bigint],
  'portfolio-originals file size limit must be 20 MiB'
);

select results_eq(
  'select public from storage.buckets where id = ''portfolio-public''',
  array[true],
  'portfolio-public bucket must be public'
);

select results_eq(
  'select file_size_limit from storage.buckets where id = ''portfolio-public''',
  array[8388608::bigint],
  'portfolio-public file size limit must be 8 MiB'
);

-- 6. Setup test users for RLS testing
-- User A: Super Admin with active profile
insert into auth.users (id, instance_id, email, aud, role)
values (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'manager@onedecore.in',
  'authenticated',
  'authenticated'
);
update public.profiles set status = 'active' where id = '33333333-3333-3333-3333-333333333333';
insert into public.user_roles (user_id, role_id)
select '33333333-3333-3333-3333-333333333333', id from public.roles where code = 'super_admin';

-- User B: Staff reader with portfolio.read only
insert into auth.users (id, instance_id, email, aud, role)
values (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'reader@onedecore.in',
  'authenticated',
  'authenticated'
);
update public.profiles set status = 'active' where id = '44444444-4444-4444-4444-444444444444';
insert into public.user_roles (user_id, role_id)
select '44444444-4444-4444-4444-444444444444', id from public.roles where code = 'super_admin';

-- User C: Staff user with NO portfolio permissions (role sales)
insert into auth.users (id, instance_id, email, aud, role)
values (
  '88888888-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000000',
  'sales@onedecore.in',
  'authenticated',
  'authenticated'
);
update public.profiles set status = 'active' where id = '88888888-8888-8888-8888-888888888888';
insert into public.user_roles (user_id, role_id)
select '88888888-8888-8888-8888-888888888888', id from public.roles where code = 'sales';

-- 7. Insert test project fixture as User A (manager)
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

insert into public.portfolio_projects (
  id, slug, title, summary, status, created_by, updated_by
) values (
  '55555555-5555-5555-5555-555555555555',
  'draft-villa-project',
  'Draft Luxury Villa',
  'A sample draft interior design project summary text exceeding 20 chars',
  'draft',
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.portfolio_projects (
  id, slug, title, summary, status, published_at, created_by, updated_by
) values (
  '66666666-6666-6666-6666-666666666666',
  'published-penthouse-project',
  'Published Penthouse',
  'A sample published interior design project summary text exceeding 20 chars',
  'published',
  now(),
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.portfolio_project_services (project_id, service_code)
values ('66666666-6666-6666-6666-666666666666', 'complete_home_interiors');

-- Media fixture for published project
insert into public.portfolio_media (
  id, project_id, status, media_role, public_object_path, width_px, height_px, file_size_bytes, mime_type, alt_text, created_by, updated_by
) values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  'ready',
  'cover',
  '66666666-6666-6666-6666-666666666666/77777777-7777-7777-7777-777777777777/cover-1600.webp',
  1600,
  900,
  450000,
  'image/webp',
  'Main living room cover image',
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'
);

-- Media source fixture
insert into public.portfolio_media_sources (
  media_id, original_object_path, original_file_name, original_mime_type, original_file_size_bytes, uploaded_by
) values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666/77777777-7777-7777-7777-777777777777/original.jpg',
  'living_room_raw.jpg',
  'image/jpeg',
  12000000,
  '33333333-3333-3333-3333-333333333333'
);

-- 8. Anonymous RLS tests (executing as role anon)
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  'select count(*)::integer from public.portfolio_projects where id = ''55555555-5555-5555-5555-555555555555''',
  array[0],
  'Anonymous cannot see draft portfolio projects'
);

select results_eq(
  'select count(*)::integer from public.portfolio_projects where id = ''66666666-6666-6666-6666-666666666666''',
  array[1],
  'Anonymous can see published portfolio projects'
);

select results_eq(
  'select count(*)::integer from public.portfolio_media where project_id = ''66666666-6666-6666-6666-666666666666''',
  array[1],
  'Anonymous can see ready media for published projects'
);

select throws_ok(
  'select count(*)::integer from public.portfolio_media_sources',
  '42501',
  null,
  'Anonymous cannot see private media sources'
);

-- 9. Staff Reader RLS tests (executing as role authenticated with portfolio.read)
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select results_eq(
  'select count(*)::integer from public.portfolio_projects',
  array[2],
  'Staff reader can see both draft and published portfolio projects'
);

-- Switch to User C (sales role, no portfolio permissions)
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);

select results_eq(
  'select count(*)::integer from public.portfolio_projects',
  array[1],
  'Authenticated non-staff user sees only published portfolio projects'
);

select throws_ok(
  'insert into public.portfolio_projects (slug, title, summary, created_by, updated_by) values (''test-slug'', ''Test'', ''Summary length at least twenty chars'', ''88888888-8888-8888-8888-888888888888'', ''88888888-8888-8888-8888-888888888888'')',
  '42501',
  null,
  'Staff user without portfolio.manage permission cannot insert portfolio projects'
);

-- 10. Audit anti-spoofing tests
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select throws_ok(
  'insert into public.portfolio_projects (slug, title, summary, created_by, updated_by) values (''spoof-slug'', ''Spoof Title'', ''Summary length at least twenty chars'', ''44444444-4444-4444-4444-444444444444'', ''33333333-3333-3333-3333-333333333333'')',
  '42501',
  null,
  'Audit identity spoofing (created_by != auth.uid()) should fail RLS check'
);

-- 11. Constraint & Privilege Hardening tests (executing as postgres / authenticated)
reset role;

select throws_ok(
  'insert into public.portfolio_projects (slug, title, summary, created_by, updated_by) values (''Invalid Slug!'', ''Bad Slug'', ''Summary length at least twenty chars'', ''33333333-3333-3333-3333-333333333333'', ''33333333-3333-3333-3333-333333333333'')',
  '23514',
  null,
  'Invalid slug grammar should fail check constraint'
);

select throws_ok(
  'insert into public.portfolio_projects (slug, title, summary, status, created_by, updated_by) values (''published-no-date'', ''No Date'', ''Summary length at least twenty chars'', ''published'', ''33333333-3333-3333-3333-333333333333'', ''33333333-3333-3333-3333-333333333333'')',
  '23514',
  null,
  'Published project status without published_at should fail check constraint'
);

select throws_ok(
  'insert into public.portfolio_media (project_id, status, media_role, alt_text, created_by, updated_by) values (''66666666-6666-6666-6666-666666666666'', ''ready'', ''gallery'', ''Alt text text'', ''33333333-3333-3333-3333-333333333333'', ''33333333-3333-3333-3333-333333333333'')',
  '23514',
  null,
  'Ready media status without object path and dimensions should fail check constraint'
);

select throws_ok(
  'insert into public.portfolio_media (project_id, status, media_role, public_object_path, width_px, height_px, file_size_bytes, mime_type, alt_text, created_by, updated_by) values (''66666666-6666-6666-6666-666666666666'', ''ready'', ''cover'', ''66666666-6666-6666-6666-666666666666/cover2.webp'', 1600, 900, 450000, ''image/webp'', ''Second cover image'', ''33333333-3333-3333-3333-333333333333'', ''33333333-3333-3333-3333-333333333333'')',
  '23505',
  null,
  'Second active cover for same project should fail unique index'
);

select throws_ok(
  'insert into public.portfolio_media_sources (media_id, original_object_path, original_mime_type, original_file_size_bytes, uploaded_by) values (''77777777-7777-7777-7777-777777777777'', ''../unsafe_path.jpg'', ''image/jpeg'', 1000, ''33333333-3333-3333-3333-333333333333'')',
  '23514',
  null,
  'Unsafe object path containing .. should fail check constraint'
);

-- 12. Column-Level Privilege Hardening Verification
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select throws_ok(
  'update public.portfolio_projects set created_by = ''44444444-4444-4444-4444-444444444444'' where id = ''55555555-5555-5555-5555-555555555555''',
  '42501',
  null,
  'Updating created_by on portfolio_projects must fail privilege check'
);

select throws_ok(
  'update public.portfolio_projects set created_at = now() where id = ''55555555-5555-5555-5555-555555555555''',
  '42501',
  null,
  'Updating created_at on portfolio_projects must fail privilege check'
);

select throws_ok(
  'update public.portfolio_project_services set service_code = ''modular_kitchens'' where project_id = ''66666666-6666-6666-6666-666666666666''',
  '42501',
  null,
  'Updating portfolio_project_services must fail privilege check'
);

select throws_ok(
  'update public.portfolio_media_sources set uploaded_by = ''44444444-4444-4444-4444-444444444444'' where media_id = ''77777777-7777-7777-7777-777777777777''',
  '42501',
  null,
  'Updating uploaded_by on portfolio_media_sources must fail privilege check'
);

-- 13. Phase 2E2 & Phase 2E2A Workflow RPC, ACL & Security Contract Tests
reset role;

select has_function('public', 'set_portfolio_project_status', array['uuid', 'text'], 'set_portfolio_project_status RPC should exist in public schema');
select has_function('private', 'set_portfolio_project_status_impl', array['uuid', 'text'], 'set_portfolio_project_status_impl helper should exist in private schema');

-- Public wrapper must be SECURITY INVOKER
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_portfolio_project_status'),
  false,
  'public.set_portfolio_project_status must be SECURITY INVOKER'
);

-- Private helper must be SECURITY DEFINER
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'set_portfolio_project_status_impl'),
  true,
  'private.set_portfolio_project_status_impl must be SECURITY DEFINER'
);

-- Private helper owner must be postgres
select is(
  (select pg_get_userbyid(proowner) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'set_portfolio_project_status_impl'),
  'postgres',
  'private.set_portfolio_project_status_impl owner must be postgres'
);

-- Search path empty check
select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_portfolio_project_status'),
  array['search_path=""'],
  'public.set_portfolio_project_status search_path must be empty'
);

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'set_portfolio_project_status_impl'),
  array['search_path=""'],
  'private.set_portfolio_project_status_impl search_path must be empty'
);


-- Function ACL Execute Grants
select is(
  has_function_privilege('authenticated', 'public.set_portfolio_project_status(uuid,text)', 'EXECUTE'),
  true,
  'authenticated role can execute public wrapper'
);

select is(
  has_function_privilege('anon', 'public.set_portfolio_project_status(uuid,text)', 'EXECUTE'),
  false,
  'anon role cannot execute public wrapper'
);

select is(
  has_function_privilege('public', 'public.set_portfolio_project_status(uuid,text)', 'EXECUTE'),
  false,
  'PUBLIC pseudo-role cannot execute public wrapper'
);

select is(
  has_function_privilege('authenticated', 'private.set_portfolio_project_status_impl(uuid,text)', 'EXECUTE'),
  true,
  'authenticated role can execute private helper via wrapper'
);

select is(
  has_function_privilege('anon', 'private.set_portfolio_project_status_impl(uuid,text)', 'EXECUTE'),
  false,
  'anon role cannot execute private helper'
);

select is(
  has_function_privilege('public', 'private.set_portfolio_project_status_impl(uuid,text)', 'EXECUTE'),
  false,
  'PUBLIC pseudo-role cannot execute private helper'
);

select has_function('public', 'replace_portfolio_project_services', array['uuid', 'text[]'], 'replace_portfolio_project_services RPC should exist');

-- Direct UPDATE on status & published_at column must fail privilege check
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select throws_ok(
  'update public.portfolio_projects set status = ''published'' where id = ''55555555-5555-5555-5555-555555555555''',
  '42501',
  null,
  'Direct status UPDATE on portfolio_projects must fail privilege check'
);

select throws_ok(
  'update public.portfolio_projects set published_at = now() where id = ''55555555-5555-5555-5555-555555555555''',
  '42501',
  null,
  'Direct published_at UPDATE on portfolio_projects must fail privilege check'
);

-- Null auth.uid() rejection check
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''published'')',
  '42501',
  'Authentication required',
  'Null auth.uid() should be rejected by RPC'
);

-- Authenticated user without portfolio.manage (User C) rejection check
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
select throws_ok(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''published'')',
  '42501',
  'Permission denied to manage portfolio project status',
  'User C without portfolio.manage permission must be rejected with 42501'
);

-- Return to authorized User A
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

-- Invalid status value rejection check
select throws_ok(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''invalid_status'')',
  '22023',
  null,
  'Invalid status value should be rejected with 22023'
);

-- Missing project UUID rejection check
select throws_ok(
  'select public.set_portfolio_project_status(''11111111-1111-1111-1111-111111111111'', ''published'')',
  'P0002',
  null,
  'Missing project UUID should be rejected with P0002'
);

-- Publish without services must fail RPC execution
select throws_ok(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''published'')',
  '22000',
  null,
  'Publishing project without assigned service should fail'
);

-- Assign service using replace_portfolio_project_services RPC
select isnt_empty(
  'select public.replace_portfolio_project_services(''55555555-5555-5555-5555-555555555555'', array[''complete_home_interiors'', ''modular_kitchens''])',
  'Atomic service assignment should return inserted service rows'
);

-- Publish without ready cover must fail RPC execution
select throws_ok(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''published'')',
  '22000',
  null,
  'Publishing project without ready cover should fail'
);

-- Add ready cover to draft project
insert into public.portfolio_media (
  id, project_id, status, media_role, public_object_path, width_px, height_px, file_size_bytes, mime_type, alt_text, created_by, updated_by
) values (
  '99999999-9999-9999-9999-999999999999',
  '55555555-5555-5555-5555-555555555555',
  'ready',
  'cover',
  '55555555-5555-5555-5555-555555555555/99999999-9999-9999-9999-999999999999/cover-1600.webp',
  1600,
  900,
  450000,
  'image/webp',
  'Villa cover image',
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'
);

-- Publish with valid service and ready cover should succeed
select isnt_empty(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''published'')',
  'Publishing project with valid service and ready cover should succeed'
);

-- Verify updated_by comes from auth.uid()
select results_eq(
  'select updated_by from public.portfolio_projects where id = ''55555555-5555-5555-5555-555555555555''',
  array['33333333-3333-3333-3333-333333333333'::uuid],
  'Updated actor comes from auth.uid()'
);

-- Published cover deletion must fail guard trigger
select throws_ok(
  'delete from public.portfolio_media where id = ''99999999-9999-9999-9999-999999999999''',
  '22000',
  null,
  'Deleting ready cover of published project should fail guard trigger'
);

-- Final published service deletion must fail guard trigger
select throws_ok(
  'delete from public.portfolio_project_services where project_id = ''66666666-6666-6666-6666-666666666666''',
  '22000',
  null,
  'Deleting final service of published project should fail guard trigger'
);

-- Return project to draft
select isnt_empty(
  'select public.set_portfolio_project_status(''55555555-5555-5555-5555-555555555555'', ''draft'')',
  'Returning published project to draft should succeed'
);

-- Verify return to draft clears published_at to NULL
select results_eq(
  'select (published_at is null) from public.portfolio_projects where id = ''55555555-5555-5555-5555-555555555555''',
  array[true],
  'Return to draft clears published_at'
);

-- Verify return to draft clears is_featured to false
select results_eq(
  'select is_featured from public.portfolio_projects where id = ''55555555-5555-5555-5555-555555555555''',
  array[false],
  'Return to draft clears is_featured'
);

-- Cover deletion on draft project should now succeed
select lives_ok(
  'delete from public.portfolio_media where id = ''99999999-9999-9999-9999-999999999999''',
  'Cover deletion on draft project should succeed'
);

-- Non-published project deletion cascade should succeed
select lives_ok(
  'delete from public.portfolio_projects where id = ''55555555-5555-5555-5555-555555555555''',
  'Deleting non-published project and cascading services/media should succeed'
);

select * from finish();
rollback;
