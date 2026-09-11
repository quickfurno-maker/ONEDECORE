-- ONEDECORE — standalone room media: one table, two shapes, no bleed between them.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- `portfolio_media.project_id` became nullable so the owner can upload twenty
-- kitchen photographs without inventing twenty kitchen projects. That single
-- relaxation is the whole risk of the feature: every rule that used to be
-- guaranteed by "there is always a project" now has to be stated explicitly.
--
-- Four things must hold, and each is asserted from both directions here.
--
--   1. A standalone row is a tagged gallery image, or it does not exist. Not a
--      cover, not untagged. The cover case matters more than it looks:
--      `idx_portfolio_media_single_cover` is unique on project_id, and Postgres
--      treats NULLs as distinct, so without a check constraint a thousand
--      project-less "covers" would all be legal.
--
--   2. Publication is explicit and separate. Project media is public because
--      its PROJECT is published; library media is public only because somebody
--      published it. Neither may borrow the other's mechanism.
--
--   3. Nothing is published before it is renderable.
--
--   4. The library RPCs cannot touch project media and the project RPCs cannot
--      touch library media — including when handed a correctly-guessed uuid.
--
-- The existing project workflow is re-asserted throughout, because the failure
-- that would matter most is not a broken new feature but a quietly broken old
-- one.

begin;
select plan(55);

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

select col_is_null(
  'public', 'portfolio_media', 'project_id',
  'project_id is nullable — a photograph may exist without a project'
);

select has_column(
  'public', 'portfolio_media', 'room_gallery_published',
  'standalone media carries its own publication flag'
);

select col_not_null(
  'public', 'portfolio_media', 'room_gallery_published',
  'and it is never null — a row is published or it is not'
);

select col_default_is(
  'public', 'portfolio_media', 'room_gallery_published', 'false',
  'uploading is not publishing: the default is false'
);

select has_index(
  'public', 'portfolio_media', 'idx_portfolio_media_library_public',
  'the public library read has a covering index'
);

select ok(
  (select indpred is not null
     from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = 'idx_portfolio_media_library_public'),
  'and it is PARTIAL, so unpublished rows never enter it'
);

-- The project FK survives for rows that still have one.
select col_is_fk(
  'public', 'portfolio_media', 'project_id',
  'project_id is still a foreign key when present'
);

-- ---------------------------------------------------------------------------
-- 2. Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role)
values (
  'a1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'library-manager@onedecore.in', 'authenticated', 'authenticated'
);
update public.profiles set status = 'active'
  where id = 'a1111111-1111-4111-8111-111111111111';
insert into public.user_roles (user_id, role_id)
select 'a1111111-1111-4111-8111-111111111111', id
from public.roles where code = 'super_admin';

insert into auth.users (id, instance_id, email, aud, role)
values (
  'a2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'library-sales@onedecore.in', 'authenticated', 'authenticated'
);
update public.profiles set status = 'active'
  where id = 'a2222222-2222-4222-8222-222222222222';
insert into public.user_roles (user_id, role_id)
select 'a2222222-2222-4222-8222-222222222222', id
from public.roles where code = 'sales';

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

-- A real, published project with a real cover: the workflow that must not break.
insert into public.portfolio_projects (
  id, slug, title, summary, status, published_at, created_by, updated_by
) values (
  'b1111111-1111-4111-8111-111111111111',
  'library-fixture-home',
  'Library Fixture Home',
  'A synthetic whole-home fixture summary that comfortably exceeds twenty chars.',
  'published', now(),
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.portfolio_media (
  id, project_id, public_object_path, media_role, status, alt_text,
  room_category_code, width_px, height_px, file_size_bytes, mime_type, sort_order,
  created_by, updated_by
) values
  ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
   'b1111111-1111-4111-8111-111111111111/c1111111-1111-4111-8111-111111111111/cover-1600.webp',
   'cover', 'ready', 'Project cover', null, 1600, 1200, 90000, 'image/webp', 0,
   'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('c2222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111',
   'b1111111-1111-4111-8111-111111111111/c2222222-2222-4222-8222-222222222222/gallery-1200.webp',
   'gallery', 'ready', 'Project kitchen photograph', 'kitchen', 1200, 900, 80000, 'image/webp', 1,
   'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111');

-- Standalone library rows: two kitchens (one published, one not) and a bedroom.
insert into public.portfolio_media (
  id, project_id, public_object_path, media_role, status, alt_text,
  room_category_code, room_gallery_published,
  width_px, height_px, file_size_bytes, mime_type, sort_order,
  created_by, updated_by
) values
  ('d1111111-1111-4111-8111-111111111111', null,
   'room-library/kitchen/d1111111-1111-4111-8111-111111111111/gallery-1200.webp',
   'gallery', 'ready', 'ONEDECORE kitchen interior', 'kitchen', true,
   1200, 900, 80000, 'image/webp', 0,
   'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('d2222222-2222-4222-8222-222222222222', null,
   'room-library/kitchen/d2222222-2222-4222-8222-222222222222/gallery-1200.webp',
   'gallery', 'ready', 'ONEDECORE kitchen interior two', 'kitchen', false,
   1200, 900, 80000, 'image/webp', 1,
   'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('d3333333-3333-4333-8333-333333333333', null,
   'room-library/bedroom/d3333333-3333-4333-8333-333333333333/gallery-1200.webp',
   'gallery', 'ready', 'ONEDECORE bedroom interior', 'bedroom', false,
   1200, 900, 80000, 'image/webp', 0,
   'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111');

select is(
  (select count(*)::int from public.portfolio_media where project_id is null),
  3,
  'standalone media inserts cleanly with no project'
);

select is(
  (select count(*)::int from public.portfolio_media
    where project_id = 'b1111111-1111-4111-8111-111111111111'),
  2,
  'and the existing project-linked rows are untouched'
);

-- ---------------------------------------------------------------------------
-- 3. Standalone invariants
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.portfolio_media
      (project_id, media_role, alt_text, created_by, updated_by)
    values (null, 'gallery', 'untagged standalone',
      'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'a standalone row without a room is refused — it would be invisible everywhere'
);

select throws_ok(
  $$insert into public.portfolio_media
      (project_id, media_role, room_category_code, alt_text, created_by, updated_by)
    values (null, 'cover', 'kitchen', 'standalone cover attempt',
      'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'a standalone row can never be a cover — a cover requires a real project'
);

select throws_ok(
  $$insert into public.portfolio_media
      (project_id, media_role, room_category_code, alt_text, created_by, updated_by)
    values (null, 'gallery', 'garage', 'unknown room',
      'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'the room allowlist still governs standalone rows'
);

select throws_ok(
  $$insert into public.portfolio_media
      (project_id, media_role, room_category_code, alt_text, room_gallery_published,
       created_by, updated_by)
    values (null, 'gallery', 'kitchen', 'published while still draft', true,
      'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'nothing can be published before it is ready'
);

select throws_ok(
  $$update public.portfolio_media
       set room_gallery_published = true
     where id = 'c2222222-2222-4222-8222-222222222222'$$,
  '23514',
  null,
  'project media can never use the standalone publication flag'
);

-- ---------------------------------------------------------------------------
-- 4. Public read policy
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'anon CAN read a ready, published standalone photograph'
);

select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd2222222-2222-4222-8222-222222222222'),
  0,
  'anon CANNOT read an unpublished standalone photograph'
);

select is(
  (select count(*)::int from public.portfolio_media
    where id = 'c2222222-2222-4222-8222-222222222222'),
  1,
  'project media of a PUBLISHED project is still public'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

-- Draft and retired standalone rows must both stay private.
update public.portfolio_media
   set room_gallery_published = false, status = 'draft'
 where id = 'd1111111-1111-4111-8111-111111111111';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd1111111-1111-4111-8111-111111111111'),
  0,
  'a draft standalone photograph is never public'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
update public.portfolio_media
   set status = 'ready', room_gallery_published = true
 where id = 'd1111111-1111-4111-8111-111111111111';

update public.portfolio_media
   set room_gallery_published = false, status = 'retired'
 where id = 'd1111111-1111-4111-8111-111111111111';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd1111111-1111-4111-8111-111111111111'),
  0,
  'a retired standalone photograph is never public'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
update public.portfolio_media
   set status = 'ready', room_gallery_published = true
 where id = 'd1111111-1111-4111-8111-111111111111';

-- A project going back to draft still hides its media.
--
-- `published_at` has to be cleared in the same statement:
-- `chk_portfolio_projects_published_at` binds the two together, which is what
-- stops a draft project keeping a publication date.
update public.portfolio_projects set status = 'draft', published_at = null
 where id = 'b1111111-1111-4111-8111-111111111111';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::int from public.portfolio_media
    where id = 'c2222222-2222-4222-8222-222222222222'),
  0,
  'project media obeys its project publication, exactly as before'
);
select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'and a published standalone photograph is unaffected by that project'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
update public.portfolio_projects set status = 'published', published_at = now()
 where id = 'b1111111-1111-4111-8111-111111111111';

-- ---------------------------------------------------------------------------
-- 5. Library RPCs — existence and exposure
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'set_portfolio_library_room_category', array['uuid[]', 'text'],
  'the library retag RPC exists'
);
select has_function(
  'public', 'set_portfolio_library_publication', array['uuid[]', 'boolean'],
  'the library publication RPC exists'
);
select has_function(
  'public', 'reorder_portfolio_library_media', array['text', 'uuid[]'],
  'the library reorder RPC exists'
);

select ok(
  not has_function_privilege(
    'anon', 'public.set_portfolio_library_room_category(uuid[], text)', 'execute'
  ),
  'anon may NOT retag library media'
);
select ok(
  not has_function_privilege(
    'anon', 'public.set_portfolio_library_publication(uuid[], boolean)', 'execute'
  ),
  'anon may NOT publish library media'
);
select ok(
  not has_function_privilege(
    'anon', 'public.reorder_portfolio_library_media(text, uuid[])', 'execute'
  ),
  'anon may NOT reorder library media'
);

-- SECURITY INVOKER, so RLS still applies to whoever calls them.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_portfolio_library_room_category',
        'set_portfolio_library_publication',
        'reorder_portfolio_library_media'
      )
      and p.prosecdef),
  0,
  'no library RPC is SECURITY DEFINER'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_portfolio_library_room_category',
        'set_portfolio_library_publication',
        'reorder_portfolio_library_media'
      )
      and p.proconfig @> array['search_path=""']),
  3,
  'every library RPC pins an empty search_path'
);

-- ---------------------------------------------------------------------------
-- 6. Library RPCs — behaviour
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.set_portfolio_library_room_category(
      array['d3333333-3333-4333-8333-333333333333']::uuid[], 'kitchen')$$,
  'portfolio.manage may retag standalone media'
);

select is(
  (select room_category_code from public.portfolio_media
    where id = 'd3333333-3333-4333-8333-333333333333'),
  'kitchen',
  'and the retag actually landed'
);

select throws_ok(
  $$select public.set_portfolio_library_room_category(
      array['c2222222-2222-4222-8222-222222222222']::uuid[], 'bedroom')$$,
  '22023',
  null,
  'the library retag RPC REFUSES project-linked media'
);

select is(
  (select room_category_code from public.portfolio_media
    where id = 'c2222222-2222-4222-8222-222222222222'),
  'kitchen',
  'and the project photograph is unchanged by the attempt'
);

select throws_ok(
  $$select public.set_portfolio_library_room_category(
      array['d3333333-3333-4333-8333-333333333333']::uuid[], 'garage')$$,
  '23514',
  null,
  'an unknown room is refused'
);

-- A mixed selection fails as a whole rather than partially succeeding.
select throws_ok(
  $$select public.set_portfolio_library_room_category(
      array['d3333333-3333-4333-8333-333333333333',
            'c2222222-2222-4222-8222-222222222222']::uuid[], 'bedroom')$$,
  '22023',
  null,
  'one project row in the selection fails the whole retag'
);
select is(
  (select room_category_code from public.portfolio_media
    where id = 'd3333333-3333-4333-8333-333333333333'),
  'kitchen',
  'and nothing in that mixed selection was written'
);

-- Publication
select lives_ok(
  $$select public.set_portfolio_library_publication(
      array['d2222222-2222-4222-8222-222222222222']::uuid[], true)$$,
  'portfolio.manage may publish ready standalone media'
);

select throws_ok(
  $$select public.set_portfolio_library_publication(
      array['c2222222-2222-4222-8222-222222222222']::uuid[], true)$$,
  '22023',
  null,
  'the publication RPC REFUSES project-linked media'
);

-- A not-ready row poisons the whole batch rather than being skipped.
insert into public.portfolio_media (
  id, project_id, media_role, status, alt_text, room_category_code,
  created_by, updated_by
) values (
  'd4444444-4444-4444-8444-444444444444', null, 'gallery', 'draft',
  'ONEDECORE kitchen interior still processing', 'kitchen',
  'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'
);

select throws_ok(
  $$select public.set_portfolio_library_publication(
      array['d3333333-3333-4333-8333-333333333333',
            'd4444444-4444-4444-8444-444444444444']::uuid[], true)$$,
  '22023',
  null,
  'publishing refuses the batch when any row is not ready'
);

select is(
  (select count(*)::int from public.portfolio_media
    where id = 'd3333333-3333-4333-8333-333333333333' and room_gallery_published),
  0,
  'and the ready row in that batch was NOT published on its own'
);

-- Reorder
select throws_ok(
  $$select public.reorder_portfolio_library_media(
      'kitchen', array['d1111111-1111-4111-8111-111111111111']::uuid[])$$,
  '22023',
  null,
  'reorder refuses a partial set — order is only meaningful as a total order'
);

select throws_ok(
  $$select public.reorder_portfolio_library_media(
      'kitchen', array['d1111111-1111-4111-8111-111111111111',
                       'd1111111-1111-4111-8111-111111111111',
                       'd2222222-2222-4222-8222-222222222222',
                       'd3333333-3333-4333-8333-333333333333']::uuid[])$$,
  '22023',
  null,
  'reorder refuses duplicate ids'
);

select throws_ok(
  $$select public.reorder_portfolio_library_media(
      'kitchen', array['d1111111-1111-4111-8111-111111111111',
                       'd2222222-2222-4222-8222-222222222222',
                       'd3333333-3333-4333-8333-333333333333',
                       'c2222222-2222-4222-8222-222222222222']::uuid[])$$,
  '22023',
  null,
  'reorder refuses project-linked media even at the right cardinality'
);

select lives_ok(
  $$select public.reorder_portfolio_library_media(
      'kitchen', array['d3333333-3333-4333-8333-333333333333',
                       'd2222222-2222-4222-8222-222222222222',
                       'd4444444-4444-4444-8444-444444444444',
                       'd1111111-1111-4111-8111-111111111111']::uuid[])$$,
  'reorder accepts the complete kitchen set'
);

select results_eq(
  $$select id::text from public.portfolio_media
     where project_id is null and room_category_code = 'kitchen'
     order by sort_order$$,
  $$values ('d3333333-3333-4333-8333-333333333333'),
           ('d2222222-2222-4222-8222-222222222222'),
           ('d4444444-4444-4444-8444-444444444444'),
           ('d1111111-1111-4111-8111-111111111111')$$,
  'and the order is exactly what was supplied'
);

select is(
  (select array_agg(sort_order order by sort_order)::int[]
     from public.portfolio_media
    where project_id is null and room_category_code = 'kitchen'),
  array[0, 1, 2, 3],
  'with a dense 0..n-1 sequence'
);

-- ---------------------------------------------------------------------------
-- 7. Cross-scope: the project RPC cannot reach library media
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.set_portfolio_media_room_category(
      'b1111111-1111-4111-8111-111111111111',
      array['d1111111-1111-4111-8111-111111111111']::uuid[],
      'bedroom')$$,
  '22023',
  null,
  'the PROJECT retag RPC cannot reach standalone media'
);

-- ---------------------------------------------------------------------------
-- 8. Permissionless and anonymous callers
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$select public.set_portfolio_library_publication(
      array['d3333333-3333-4333-8333-333333333333']::uuid[], true)$$,
  '42501',
  null,
  'an authenticated user without portfolio.manage cannot publish'
);

select throws_ok(
  $$select public.set_portfolio_library_room_category(
      array['d3333333-3333-4333-8333-333333333333']::uuid[], 'bedroom')$$,
  '42501',
  null,
  'an authenticated user without portfolio.manage cannot retag'
);

select throws_ok(
  $$select public.reorder_portfolio_library_media(
      'kitchen', array['d3333333-3333-4333-8333-333333333333']::uuid[])$$,
  '42501',
  null,
  'an authenticated user without portfolio.manage cannot reorder'
);

/*
 * A user with no portfolio permission sees exactly what the public sees.
 *
 * Not zero: the authenticated policy grants the same published-media branch the
 * anonymous one does, so a logged-in stranger can read published photographs
 * like anybody else. What they must not see is the UNPUBLISHED ones, and that
 * is what the difference between these two counts proves.
 */
select is(
  (select count(*)::int from public.portfolio_media
    where project_id is null and not room_gallery_published),
  0,
  'a user without portfolio.manage cannot see UNPUBLISHED standalone media'
);

select ok(
  (select count(*) from public.portfolio_media where project_id is null) > 0,
  'though they can see the published ones, exactly as an anonymous visitor can'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

-- ---------------------------------------------------------------------------
-- 9. The existing project workflow still holds
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.portfolio_media
      (project_id, media_role, status, alt_text, public_object_path,
       width_px, height_px, file_size_bytes, mime_type, created_by, updated_by)
    values ('b1111111-1111-4111-8111-111111111111', 'cover', 'ready', 'Second cover',
      'b1111111-1111-4111-8111-111111111111/c9999999-9999-4999-8999-999999999999/cover-1600.webp',
      1600, 1200, 90000, 'image/webp',
      'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111')$$,
  '23505',
  null,
  'one cover per project is still enforced'
);

-- The source cascade still works, for standalone rows as well as project ones.
insert into public.portfolio_media_sources (
  media_id, original_bucket, original_object_path, original_mime_type,
  original_file_size_bytes, checksum_sha256, uploaded_by
) values (
  'd3333333-3333-4333-8333-333333333333', 'portfolio-originals',
  'room-library/kitchen/d3333333-3333-4333-8333-333333333333/original.jpg',
  'image/jpeg', 1234567,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'a1111111-1111-4111-8111-111111111111'
);

select is(
  (select count(*)::int from public.portfolio_media_sources
    where media_id = 'd3333333-3333-4333-8333-333333333333'),
  1,
  'a standalone photograph records its source like any other'
);

delete from public.portfolio_media where id = 'd3333333-3333-4333-8333-333333333333';

select is(
  (select count(*)::int from public.portfolio_media_sources
    where media_id = 'd3333333-3333-4333-8333-333333333333'),
  0,
  'and deleting it cascades to the source row'
);

select * from finish();
rollback;
