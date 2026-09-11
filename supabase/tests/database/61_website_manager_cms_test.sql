-- Website Manager: permission, isolation, and the publish transaction.
--
-- WHAT THESE ASSERTIONS ARE FOR
--
-- The application checks permissions in four places, and three of them are
-- reachable only through code that can be changed. This file tests the fourth:
-- what the database itself refuses, to an anonymous caller, to an ordinary
-- staff member, and to a script with a valid session and bad intentions.
--
-- The publish path is tested as a TRANSACTION rather than as a sequence of
-- statements, because the failure mode that matters is half of it: a pointer
-- aimed at a version marked draft, or a published version with no draft behind
-- it and an editor with nowhere to work.

begin;
select plan(40);

-- ===========================================================================
-- A. Permission
-- ===========================================================================

select is(
  (select count(*)::int from public.permissions where code = 'website.manage' and is_active),
  1,
  'website.manage exists and is active'
);

-- Its own permission, not portfolio.manage reused. Portfolio manages a
-- gallery; this manages the front page of the company.
select isnt(
  (select id from public.permissions where code = 'website.manage'),
  (select id from public.permissions where code = 'portfolio.manage'),
  'website.manage is a distinct permission from portfolio.manage'
);

select is(
  (select count(*)::int
     from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     join public.permissions p on p.id = rp.permission_id
    where p.code = 'website.manage' and r.code = 'super_admin'),
  1,
  'super_admin holds website.manage'
);

-- Everyone else is deliberately excluded. Widening later is one insert;
-- narrowing after an incident is not.
select is(
  (select count(*)::int
     from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     join public.permissions p on p.id = rp.permission_id
    where p.code = 'website.manage' and r.code <> 'super_admin'),
  0,
  'no other role is granted website.manage by the migration'
);

select is(
  (select count(*)::int
     from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     join public.permissions p on p.id = rp.permission_id
    where p.code = 'website.manage' and r.code = 'content_manager'),
  0,
  'the Portfolio content manager does not inherit the homepage'
);

-- ===========================================================================
-- B. RLS is on, and nothing is granted to anon
-- ===========================================================================

select ok(
  (select relrowsecurity from pg_class where oid = 'public.website_homepage_versions'::regclass),
  'RLS is enabled on website_homepage_versions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.website_homepage_sections'::regclass),
  'RLS is enabled on website_homepage_sections'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.website_homepage_banners'::regclass),
  'RLS is enabled on website_homepage_banners'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.website_homepage_publication'::regclass),
  'RLS is enabled on website_homepage_publication'
);

select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name like 'website_homepage%'
      and grantee = 'anon'),
  0,
  'anon holds no privilege on any website management table'
);

-- TRUNCATE is the privilege that leaked repository-wide once already.
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name like 'website_homepage%'
      and grantee = 'authenticated'
      and privilege_type = 'TRUNCATE'),
  0,
  'authenticated holds no TRUNCATE on website management tables'
);

-- ===========================================================================
-- C. The public read exposes the published version and nothing else
-- ===========================================================================

select has_function('public', 'get_published_homepage_config', 'the public reader exists');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_published_homepage_config'),
  true,
  'the public reader is SECURITY DEFINER'
);

-- A definer function without a pinned search_path can be made to resolve an
-- attacker's shadowing object as its owner.
select ok(
  (select 'search_path=""' = any(proconfig)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_published_homepage_config'),
  'the public reader pins an empty search_path'
);

select ok(
  has_function_privilege('anon', 'public.get_published_homepage_config()', 'execute'),
  'anon may call the public reader'
);

select ok(
  not has_function_privilege('anon', 'public.get_website_homepage_draft()', 'execute'),
  'anon may NOT read the draft'
);

select ok(
  not has_function_privilege(
    'anon', 'public.save_website_homepage_draft(uuid, jsonb, jsonb)', 'execute'
  ),
  'anon may NOT write the draft'
);

select ok(
  not has_function_privilege('anon', 'public.publish_website_homepage(uuid)', 'execute'),
  'anon may NOT publish'
);

-- The seeded homepage is live and readable anonymously.
--
-- Twelve, not the sixteen this file originally asserted. The seed inserted
-- sixteen; `20260912120000_homepage_section_registry_r5.sql` then retired five
-- sections and added one. Both migrations have run by the time this test does,
-- so twelve is what a reader of the live config sees. The R5 migration's own
-- test file asserts WHICH twelve and in what order.
select is(
  jsonb_array_length(public.get_published_homepage_config() -> 'sections'),
  12,
  'the published config carries the current registry sections'
);

select is(
  jsonb_array_length(public.get_published_homepage_config() -> 'banners'),
  6,
  'the published config carries the six seeded banners'
);

-- The payload is the contract. An internal name, a version id or an actor
-- appearing here would be a leak that no application code could undo.
select is(
  (select count(*)::int
     from jsonb_array_elements(public.get_published_homepage_config() -> 'banners') b
    where b ? 'internalName' or b ? 'versionId' or b ? 'createdBy' or b ? 'enabled'),
  0,
  'the public banner payload exposes no admin metadata'
);

-- ===========================================================================
-- D. Draft isolation
-- ===========================================================================

select is(
  (select count(*)::int from public.website_homepage_versions where state = 'draft'),
  1,
  'exactly one draft exists after seeding'
);

select is(
  (select count(*)::int from public.website_homepage_versions where state = 'published'),
  1,
  'exactly one published version exists after seeding'
);

-- A second draft must be impossible, not merely discouraged. Two concurrent
-- "create draft" calls race, and only an index can see the other transaction's
-- uncommitted row.
select throws_ok(
  $$insert into public.website_homepage_versions (version_number, state) values (999, 'draft')$$,
  '23505',
  null,
  'a second draft is refused by the unique index'
);

select throws_ok(
  $$insert into public.website_homepage_versions (version_number, state, published_at)
    values (998, 'published', now())$$,
  '23505',
  null,
  'a second published version is refused by the unique index'
);

-- The draft is a different version from the published one, so editing it
-- cannot touch what is live.
select isnt(
  (select id from public.website_homepage_versions where state = 'draft'),
  (select published_version_id from public.website_homepage_publication where id),
  'the draft is not the version the publication pointer aims at'
);

-- ===========================================================================
-- E. Link safety, enforced by the data rather than by the form
-- ===========================================================================

select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, sort_order)
    select id, gen_random_uuid(), 'x', 'external', 'javascript:alert(1)', 90
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'a javascript: link is refused by the check constraint'
);

select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, sort_order)
    select id, gen_random_uuid(), 'x', 'internal', '//evil.example', 91
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'a protocol-relative internal link is refused'
);

select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, sort_order)
    select id, gen_random_uuid(), 'x', 'external', 'http://insecure.example', 92
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'a plain http external link is refused'
);

select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, sort_order)
    select id, gen_random_uuid(), 'x', 'external', 'data:text/html,<script>', 93
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'a data: link is refused'
);

-- An image with no alt text is unusable to a screen reader, and the moment the
-- image arrives is the only reliable moment to demand it.
select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, desktop_image_path, sort_order)
    select id, gen_random_uuid(), 'x', 'abc/def.webp', 94
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'an image without alt text is refused'
);

-- Only an external link may open a new tab: a same-origin navigation that
-- spawns a tab is a surprise, and consultation opens a dialog, not a page.
select throws_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, open_in_new_tab, sort_order)
    select id, gen_random_uuid(), 'x', 'internal', '/portfolio', true, 95
      from public.website_homepage_versions where state = 'draft'$$,
  '23514',
  null,
  'an internal link may not open a new tab'
);

select lives_ok(
  $$insert into public.website_homepage_banners (version_id, banner_id, internal_name, link_type, link_value, desktop_image_path, alt_text, sort_order)
    select id, gen_random_uuid(), 'valid', 'external', 'https://onedecore.in/portfolio', 'a/b.webp', 'Alt text', 96
      from public.website_homepage_versions where state = 'draft'$$,
  'a valid https banner with alt text is accepted'
);

-- ===========================================================================
-- F. Section invariants
-- ===========================================================================

select is(
  (select section_key from public.website_homepage_sections
    where version_id = (select published_version_id from public.website_homepage_publication where id)
    order by sort_order limit 1),
  'hero',
  'the hero is first in the published version'
);

select ok(
  (select is_visible from public.website_homepage_sections
    where version_id = (select published_version_id from public.website_homepage_publication where id)
      and section_key = 'hero'),
  'the hero is visible in the published version'
);

select is(
  (select section_key from public.website_homepage_sections
    where version_id = (select published_version_id from public.website_homepage_publication where id)
    order by sort_order desc limit 1),
  'consultation',
  'the consultation close is last in the published version'
);

-- A duplicate section key would give the homepage two of the same block, and
-- the primary key is what makes that impossible rather than merely unlikely.
select throws_ok(
  $$insert into public.website_homepage_sections (version_id, section_key, sort_order)
    select id, 'hero', 50 from public.website_homepage_versions where state = 'draft'$$,
  '23505',
  null,
  'a duplicate section key within a version is refused'
);

-- ===========================================================================
-- G. Mutations are refused without the permission
-- ===========================================================================

-- `anon` is not merely unprivileged here; it has no table grant at all, so the
-- failure is a privilege error rather than an empty result. An empty result
-- would mean RLS was doing the work and a future GRANT could undo it.
set local role anon;

select throws_ok(
  $$select count(*) from public.website_homepage_versions$$,
  '42501',
  null,
  'anon cannot read the versions table'
);

select throws_ok(
  $$select count(*) from public.website_homepage_banners$$,
  '42501',
  null,
  'anon cannot read the banners table'
);

select throws_ok(
  $$select public.get_website_homepage_draft()$$,
  '42501',
  null,
  'anon cannot call the draft reader'
);

reset role;

select * from finish();
rollback;
