-- ONEDECORE — room browsing moves to the photograph, and Hall disappears.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- Browsing by room used to be a PROJECT-level facet. A visitor who clicked
-- "Bedroom" got whole-home case studies that happened to contain a bedroom,
-- and the only way to give each room its own card was to split one delivered
-- home into fake room-level "projects". So the room moved to where rooms
-- actually are: `portfolio_media.room_category_code`, one tag per photograph.
--
-- Two things then have to hold. The photograph-level allowlist must accept
-- exactly living-room, bedroom and kitchen — and NULL, because a cover shot or
-- a material detail belongs to no room and forcing one on it would put it in
-- front of somebody who asked for bedrooms. And Hall has to be genuinely gone:
-- translated in the rows that had it, and rejected by both remaining
-- constraints so it cannot return through the CMS.
--
-- The Hall translation is COLLISION-SAFE, which is the part worth testing: a
-- project may already carry both hall and living-room, and a blind update would
-- violate the composite primary key.

begin;
select plan(39);

-- ---------------------------------------------------------------------------
-- 1. The photograph-level room column
-- ---------------------------------------------------------------------------

select has_column(
  'public', 'portfolio_media', 'room_category_code',
  'photographs carry their own room classification'
);

select col_is_null(
  'public', 'portfolio_media', 'room_category_code',
  'and it is nullable — unclassified is a real answer, not a missing one'
);

select has_index(
  'public', 'portfolio_media', 'idx_portfolio_media_room_browse',
  'the room gallery has a covering index'
);

select ok(
  (select indpred is not null
     from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = 'idx_portfolio_media_room_browse'),
  'and it is PARTIAL — unclassified rows are never selected by room'
);

-- ---------------------------------------------------------------------------
-- 2. Focal point
-- ---------------------------------------------------------------------------

select has_column('public', 'portfolio_media', 'focal_x', 'focal_x exists');
select has_column('public', 'portfolio_media', 'focal_y', 'focal_y exists');

select col_not_null(
  'public', 'portfolio_media', 'focal_x',
  'focal_x is always present — there is always a crop centre'
);
select col_has_default(
  'public', 'portfolio_media', 'focal_x',
  'and defaults, so an unadjusted photograph needs no migration'
);

-- ---------------------------------------------------------------------------
-- 3. Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role)
values (
  'd1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'room-manager@onedecore.in', 'authenticated', 'authenticated'
);
update public.profiles set status = 'active'
  where id = 'd1111111-1111-4111-8111-111111111111';
insert into public.user_roles (user_id, role_id)
select 'd1111111-1111-4111-8111-111111111111', id
from public.roles where code = 'super_admin';

insert into auth.users (id, instance_id, email, aud, role)
values (
  'd2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'room-sales@onedecore.in', 'authenticated', 'authenticated'
);
update public.profiles set status = 'active'
  where id = 'd2222222-2222-4222-8222-222222222222';
insert into public.user_roles (user_id, role_id)
select 'd2222222-2222-4222-8222-222222222222', id
from public.roles where code = 'sales';

select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);

insert into public.portfolio_projects (
  id, slug, title, summary, status, published_at, created_by, updated_by
) values (
  'e1111111-1111-4111-8111-111111111111',
  'room-browse-fixture',
  'Room Browse Fixture',
  'A synthetic whole-home fixture summary that comfortably exceeds twenty chars.',
  'published', now(),
  'd1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111'
);

-- `chk_portfolio_media_ready_requirements` insists a 'ready' row is actually
-- renderable: path, dimensions, byte size and mime type all present. The
-- fixtures satisfy it rather than working around it.
insert into public.portfolio_media (
  id, project_id, public_object_path, media_role, status, alt_text,
  width_px, height_px, file_size_bytes, mime_type, sort_order,
  created_by, updated_by
) values
  ('f1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111',
   'e1111111-1111-4111-8111-111111111111/f1111111-1111-4111-8111-111111111111/cover-1600.webp',
   'cover', 'ready', 'Synthetic cover', 1600, 1200, 90000, 'image/webp', 0,
   'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111',
   'e1111111-1111-4111-8111-111111111111/f2222222-2222-4222-8222-222222222222/gallery-1200.webp',
   'gallery', 'ready', 'Synthetic gallery one', 1200, 900, 80000, 'image/webp', 1,
   'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'),
  ('f3333333-3333-4333-8333-333333333333', 'e1111111-1111-4111-8111-111111111111',
   'e1111111-1111-4111-8111-111111111111/f3333333-3333-4333-8333-333333333333/gallery-1200.webp',
   'gallery', 'ready', 'Synthetic gallery two', 1200, 900, 80000, 'image/webp', 2,
   'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- 4. The room allowlist
-- ---------------------------------------------------------------------------

select results_eq(
  $$select count(*)::integer from public.portfolio_media
     where project_id = 'e1111111-1111-4111-8111-111111111111'
       and room_category_code is null$$,
  array[3],
  'a freshly uploaded photograph is unclassified, never guessed'
);

select lives_ok(
  $$update public.portfolio_media set room_category_code = 'living-room'
     where id = 'f2222222-2222-4222-8222-222222222222'$$,
  'living-room is accepted'
);
select lives_ok(
  $$update public.portfolio_media set room_category_code = 'bedroom'
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  'bedroom is accepted'
);
select lives_ok(
  $$update public.portfolio_media set room_category_code = 'kitchen'
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  'kitchen is accepted'
);
select lives_ok(
  $$update public.portfolio_media set room_category_code = null
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  'and NULL is accepted — a cover or a material study has no room'
);

select throws_ok(
  $$update public.portfolio_media set room_category_code = 'hall'
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  '23514', null,
  'HALL IS REFUSED on a photograph — Living Room is the only term'
);

select throws_ok(
  $$update public.portfolio_media set room_category_code = 'balcony'
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  '23514', null,
  'an unknown room is refused'
);

-- A project-level facet code is not a photograph-level room code.
select throws_ok(
  $$update public.portfolio_media set room_category_code = 'complete-interiors'
     where id = 'f3333333-3333-4333-8333-333333333333'$$,
  '23514', null,
  'a project facet code is refused in the photograph room column'
);

-- ---------------------------------------------------------------------------
-- 5. Focal bounds
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.portfolio_media set focal_x = 0, focal_y = 100
     where id = 'f2222222-2222-4222-8222-222222222222'$$,
  'the edges of the frame are valid focal points'
);
select throws_ok(
  $$update public.portfolio_media set focal_x = 101
     where id = 'f2222222-2222-4222-8222-222222222222'$$,
  '23514', null,
  'a focal point outside the frame is refused'
);
select throws_ok(
  $$update public.portfolio_media set focal_y = -1
     where id = 'f2222222-2222-4222-8222-222222222222'$$,
  '23514', null,
  'and so is a negative one'
);

select results_eq(
  $$select focal_x::integer from public.portfolio_media
     where id = 'f1111111-1111-4111-8111-111111111111'$$,
  array[50],
  'an unadjusted photograph is centred, which is what the browser does anyway'
);

-- ---------------------------------------------------------------------------
-- 6. Hall is gone from the project facet
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('e1111111-1111-4111-8111-111111111111', 'hall')$$,
  '23514', null,
  'the project facet refuses hall'
);
select lives_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('e1111111-1111-4111-8111-111111111111', 'living-room')$$,
  'and accepts living-room'
);
select lives_ok(
  $$insert into public.portfolio_project_categories (project_id, category_code)
     values ('e1111111-1111-4111-8111-111111111111', 'complete-interiors')$$,
  'complete-interiors still works — it is the whole-home facet'
);

-- ---------------------------------------------------------------------------
-- 7. Hall is gone from the deprecated scalar
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.portfolio_projects set portfolio_category_code = 'hall'
     where id = 'e1111111-1111-4111-8111-111111111111'$$,
  '23514', null,
  'the deprecated scalar refuses hall too'
);
select lives_ok(
  $$update public.portfolio_projects set portfolio_category_code = 'living-room'
     where id = 'e1111111-1111-4111-8111-111111111111'$$,
  'and accepts living-room'
);
select has_column(
  'public', 'portfolio_projects', 'portfolio_category_code',
  'the deprecated column is still present for historical rows'
);

-- ---------------------------------------------------------------------------
-- 8. The Hall translation was collision-safe
-- ---------------------------------------------------------------------------
--
-- Re-running the migration's exact statements against a project holding BOTH
-- values proves the rule rather than the row count: the duplicate is dropped
-- and the survivor is living-room, with no primary-key violation.

insert into public.portfolio_projects (
  id, slug, title, summary, status, created_by, updated_by
) values (
  'e2222222-2222-4222-8222-222222222222',
  'hall-collision-fixture',
  'Hall Collision Fixture',
  'A synthetic fixture summary for the hall collision case, over twenty chars.',
  'draft',
  'd1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111'
);

-- Insert the pre-migration state directly, bypassing the new constraint the
-- same way an already-stored row would have predated it.
alter table public.portfolio_project_categories
  drop constraint chk_portfolio_project_categories_code;
insert into public.portfolio_project_categories (project_id, category_code)
values ('e2222222-2222-4222-8222-222222222222', 'hall'),
       ('e2222222-2222-4222-8222-222222222222', 'living-room');

-- The migration's statements, verbatim.
delete from public.portfolio_project_categories h
where h.category_code = 'hall'
  and exists (
    select 1 from public.portfolio_project_categories l
    where l.project_id = h.project_id and l.category_code = 'living-room'
  );
update public.portfolio_project_categories
set category_code = 'living-room' where category_code = 'hall';

alter table public.portfolio_project_categories
  add constraint chk_portfolio_project_categories_code
  check (category_code in ('complete-interiors', 'living-room', 'bedroom', 'kitchen'));

select results_eq(
  $$select category_code::text from public.portfolio_project_categories
     where project_id = 'e2222222-2222-4222-8222-222222222222'$$,
  array['living-room'],
  'a project holding BOTH hall and living-room collapses to one living-room row'
);

-- ---------------------------------------------------------------------------
-- 9. The atomic media RPCs
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$select count(*) from public.set_portfolio_media_room_category(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid,
            'f3333333-3333-4333-8333-333333333333'::uuid],
      'kitchen')$$,
  'a manager can bulk-tag a selection'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_media
     where project_id = 'e1111111-1111-4111-8111-111111111111'
       and room_category_code = 'kitchen'$$,
  array[2],
  'and both photographs carry the room'
);

select lives_ok(
  $$select count(*) from public.set_portfolio_media_room_category(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid],
      null)$$,
  'clearing back to unclassified is valid'
);

select throws_ok(
  $$select count(*) from public.set_portfolio_media_room_category(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid],
      'hall')$$,
  '23514', null,
  'the RPC refuses hall as well — no silent drop'
);

select throws_ok(
  $$select count(*) from public.reorder_portfolio_project_media(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid])$$,
  '22023', null,
  'a partial order is refused — the omitted rows would keep colliding positions'
);

select lives_ok(
  $$select count(*) from public.reorder_portfolio_project_media(
      'e1111111-1111-4111-8111-111111111111',
      array['f3333333-3333-4333-8333-333333333333'::uuid,
            'f2222222-2222-4222-8222-222222222222'::uuid,
            'f1111111-1111-4111-8111-111111111111'::uuid])$$,
  'a complete order is accepted'
);

select results_eq(
  $$select id::text from public.portfolio_media
     where project_id = 'e1111111-1111-4111-8111-111111111111'
     order by sort_order limit 1$$,
  array['f3333333-3333-4333-8333-333333333333'],
  'and the requested first photograph is first'
);

-- ---------------------------------------------------------------------------
-- 10. Authorization containment
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);

select throws_ok(
  $$select count(*) from public.set_portfolio_media_room_category(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid],
      'kitchen')$$,
  '42501', null,
  'a staff user without portfolio.manage cannot tag rooms'
);

select throws_ok(
  $$select count(*) from public.set_portfolio_project_cover(
      'e1111111-1111-4111-8111-111111111111',
      'f2222222-2222-4222-8222-222222222222')$$,
  '42501', null,
  'nor set the cover'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select count(*) from public.reorder_portfolio_project_media(
      'e1111111-1111-4111-8111-111111111111',
      array['f2222222-2222-4222-8222-222222222222'::uuid])$$,
  '42501', null,
  'and anonymous callers cannot reorder anything'
);

-- ---------------------------------------------------------------------------
-- 11. Nothing else moved
-- ---------------------------------------------------------------------------

reset role;

select has_table(
  'public', 'portfolio_project_services',
  'the service dimension is untouched by the room correction'
);

select results_eq(
  $$select count(*)::integer from public.portfolio_media
     where project_id = 'e1111111-1111-4111-8111-111111111111'$$,
  array[3],
  'and no photograph was created or destroyed by any of this'
);

select * from finish();
rollback;
