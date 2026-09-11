-- Portfolio: standalone room media, so a photograph can exist without a project.
--
-- WHY THE DATA MODEL HAD TO CHANGE
--
-- The portfolio is project-first: `portfolio_media.project_id` is NOT NULL, the
-- upload route demands a projectId, and public room browsing reaches a
-- photograph through its published parent. That is correct for case studies and
-- wrong for the thing the owner actually needs most often — twenty kitchen
-- photographs that are not twenty kitchen projects.
--
-- The tempting shortcuts were all worse than a migration:
--
--   * one hidden "Kitchen" project holding unrelated rooms — invents a
--     delivered home that does not exist, and every public surface that reads a
--     project title, locality or year would then be reading a fiction;
--   * a second gallery table — two places a room photograph can live, two RLS
--     stories, two cache tags, and a public query that has to union them
--     forever;
--   * hardcoded images — not manageable, which is the entire point.
--
-- So one row, two shapes.
--
--   PROJECT-LINKED   project_id is not null. Everything behaves exactly as it
--                    did: publication follows the parent project, a cover is
--                    possible, the existing RPCs own it.
--
--   ROOM LIBRARY     project_id is null. Always a gallery image, always tagged
--                    with a room, and public only when somebody explicitly
--                    publishes it.
--
-- The constraints below are what stop those two shapes bleeding into each
-- other. They are not decoration: without them a standalone row could become a
-- project cover, or a project image could be published into the room gallery
-- past its own project's draft status.

/* ========================================================================== */
/* 1. The column changes                                                      */
/* ========================================================================== */

alter table public.portfolio_media
  alter column project_id drop not null;

comment on column public.portfolio_media.project_id is
  'Owning project, or NULL for standalone room-library media. NULL implies media_role = gallery and a non-null room_category_code.';

/*
 * The publication gate for standalone media.
 *
 * A project image is public because its PROJECT is published — one decision,
 * made once, covering the whole case study. A standalone image has no project
 * to inherit that from, and "processing finished" is not a publication
 * decision: it means a file uploaded cleanly, which is true of a photograph the
 * owner is still deciding about.
 *
 * So the default is false. Uploading twenty images shows the owner twenty
 * images in the admin and shows a visitor nothing.
 */
alter table public.portfolio_media
  add column if not exists room_gallery_published boolean not null default false;

comment on column public.portfolio_media.room_gallery_published is
  'Standalone room-library publication. Meaningful only when project_id IS NULL; forced false for project-linked media, which inherits its project status.';

/* ========================================================================== */
/* 2. The invariants that keep the two shapes apart                           */
/* ========================================================================== */

/*
 * A standalone row is a tagged gallery image or it is nothing.
 *
 * Both halves matter. Without the role clause a standalone row could be a
 * cover, and `idx_portfolio_media_single_cover` would not catch it: that index
 * is unique on project_id, and Postgres treats NULLs as distinct, so a
 * thousand project-less "covers" would all be allowed. Without the room clause
 * a standalone row could be untagged, which means no room view can ever show
 * it and no admin filter can ever find it — an invisible row.
 */
alter table public.portfolio_media
  add constraint chk_portfolio_media_standalone_shape
  check (
    project_id is not null
    or (media_role = 'gallery' and room_category_code is not null)
  );

/*
 * Project-linked media never uses standalone publication semantics.
 *
 * Two publication systems on one row is how an image ends up public through
 * the door nobody was watching. A project image that somehow had this set
 * would appear in a room gallery while its project was still a draft.
 */
alter table public.portfolio_media
  add constraint chk_portfolio_media_library_publication
  check (project_id is null or room_gallery_published = false);

/*
 * Nothing is published before it is processed.
 *
 * `ready` is the state in which `public_object_path`, dimensions, size and mime
 * are all guaranteed present (see chk_portfolio_media_ready_requirements), so
 * this is the constraint that makes "published" imply "renderable". The RPC
 * checks it too; this is the copy that a script cannot skip.
 */
alter table public.portfolio_media
  add constraint chk_portfolio_media_published_is_ready
  check (room_gallery_published = false or status = 'ready');

/*
 * A cover always belongs to a real project.
 *
 * Implied by the shape constraint above, stated separately because it is the
 * invariant a reader comes looking for and because the two could drift if the
 * shape check is ever relaxed for another reason.
 */
alter table public.portfolio_media
  add constraint chk_portfolio_media_cover_requires_project
  check (media_role <> 'cover' or project_id is not null);

/* ========================================================================== */
/* 2b. Column privileges for the new column                                   */
/* ========================================================================== */

/*
 * THE PORTFOLIO TABLES USE COLUMN-LEVEL GRANTS, AND A NEW COLUMN IS NOT COVERED.
 *
 * `20260725033329_harden_portfolio_rls_and_audit_privileges` revoked everything
 * from `authenticated` and regranted INSERT and UPDATE on an explicit list of
 * columns — deliberately excluding `created_at`, `created_by` and the other
 * audit fields so application code cannot rewrite them. Later migrations that
 * added `room_category_code`, `focal_x` and `focal_y` extended those lists.
 *
 * A column outside the list is not merely ignored: naming it in an INSERT
 * produces `42501 permission denied for table portfolio_media`, and because the
 * error names the TABLE rather than the column it reads like a broken RLS
 * policy. The upload route reported "Failed to create media record" for every
 * file until this was added.
 *
 * SELECT already covers every column, so only the two write privileges are
 * needed here.
 */
grant insert (room_gallery_published) on table public.portfolio_media to authenticated;
grant update (room_gallery_published) on table public.portfolio_media to authenticated;

/* ========================================================================== */
/* 3. Indexes                                                                 */
/* ========================================================================== */

/*
 * The public room-library read, and only that read.
 *
 * Partial on the exact predicate the public query uses, so the index holds only
 * rows a visitor can actually be shown and stays small no matter how much
 * unpublished material accumulates behind it.
 */
create index if not exists idx_portfolio_media_library_public
  on public.portfolio_media (room_category_code, sort_order, created_at, id)
  where project_id is null and room_gallery_published and status = 'ready';

/*
 * The admin Media Library read: every standalone row for one room, published or
 * not, which is the opposite predicate and therefore a different index.
 */
create index if not exists idx_portfolio_media_library_admin
  on public.portfolio_media (room_category_code, sort_order, created_at, id)
  where project_id is null;

/* ========================================================================== */
/* 4. Public read policy                                                      */
/* ========================================================================== */

/*
 * Anonymous SELECT gains one branch and loses nothing.
 *
 * The project branch is character-for-character what it was. The library branch
 * is deliberately explicit about all four conditions rather than relying on the
 * table constraints to imply three of them — a policy that reads correctly on
 * its own survives a later constraint change, and this is the last line between
 * an unpublished photograph and the internet.
 */
drop policy if exists "Anon select ready published portfolio media" on public.portfolio_media;

create policy "Anon select ready published portfolio media"
  on public.portfolio_media
  for select
  to anon
  using (
    (
      status = 'ready'
      and project_id is not null
      and exists (
        select 1 from public.portfolio_projects p
        where p.id = portfolio_media.project_id
          and p.status = 'published'
      )
    )
    or (
      status = 'ready'
      and project_id is null
      and room_category_code is not null
      and room_gallery_published
    )
  );

drop policy if exists "Authenticated select portfolio media" on public.portfolio_media;

create policy "Authenticated select portfolio media"
  on public.portfolio_media
  for select
  to authenticated
  using (
    (
      status = 'ready'
      and project_id is not null
      and exists (
        select 1 from public.portfolio_projects p
        where p.id = portfolio_media.project_id
          and p.status = 'published'
      )
    )
    or (
      status = 'ready'
      and project_id is null
      and room_category_code is not null
      and room_gallery_published
    )
    or (select public.authorize('portfolio.read'))
    or (select public.authorize('portfolio.manage'))
  );

/* ========================================================================== */
/* 5. Library RPCs                                                            */
/* ========================================================================== */

/*
 * Three separate functions rather than flags on the project ones.
 *
 * `set_portfolio_media_room_category` takes a project id and refuses anything
 * outside it. Teaching it to also accept project-less rows would mean making
 * that project id optional, and an optional ownership check is not a check —
 * one caller passing null would silently gain the ability to retag the whole
 * table. The library functions instead assert the opposite (`project_id is
 * null`), so neither can reach the other's rows whatever ids it is handed.
 *
 * All three follow the established portfolio convention: SECURITY INVOKER,
 * empty search_path, an explicit authorize() gate, all-or-nothing by counting
 * the matched rows before writing, and `updated_by` set from auth.uid().
 */

create or replace function public.set_portfolio_library_room_category(
  requested_media_ids uuid[],
  requested_room_code text
)
returns setof public.portfolio_media
language plpgsql
set search_path to ''
as $$
declare
  v_ids uuid[];
  v_matched integer;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  -- A library row must always carry a room, so unlike the project function
  -- there is no "unclassified" option here: null would violate the shape check.
  if requested_room_code is null
     or requested_room_code not in ('living-room', 'bedroom', 'kitchen') then
    raise exception 'Invalid room category code: %', coalesce(requested_room_code, 'null')
      using errcode = '23514';
  end if;

  v_ids := coalesce(requested_media_ids, array[]::uuid[]);
  if array_length(v_ids, 1) is null then
    return;
  end if;

  /*
   * Every id must be standalone. Counting first turns an attempt to retag
   * project media — whether by mistake or by guessing a uuid — into an error
   * rather than an UPDATE that quietly matches nothing.
   */
  select count(*) into v_matched
  from public.portfolio_media m
  where m.id = any (v_ids)
    and m.project_id is null;

  if v_matched <> cardinality(v_ids) then
    raise exception 'Media selection is not standalone room-library media'
      using errcode = '22023';
  end if;

  return query
  update public.portfolio_media m
  set room_category_code = requested_room_code,
      updated_by = (select auth.uid())
  where m.id = any (v_ids)
    and m.project_id is null
  returning m.*;
end;
$$;

revoke execute on function public.set_portfolio_library_room_category(uuid[], text) from public, anon;
grant execute on function public.set_portfolio_library_room_category(uuid[], text) to authenticated;

comment on function public.set_portfolio_library_room_category(uuid[], text) is
  'Retags standalone room-library media. Rejects project-linked media and unknown room codes; all-or-nothing.';

create or replace function public.set_portfolio_library_publication(
  requested_media_ids uuid[],
  requested_published boolean
)
returns setof public.portfolio_media
language plpgsql
set search_path to ''
as $$
declare
  v_ids uuid[];
  v_matched integer;
  v_not_ready integer;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  if requested_published is null then
    raise exception 'Publication state is required' using errcode = '22023';
  end if;

  v_ids := coalesce(requested_media_ids, array[]::uuid[]);
  if array_length(v_ids, 1) is null then
    return;
  end if;

  select count(*) into v_matched
  from public.portfolio_media m
  where m.id = any (v_ids)
    and m.project_id is null;

  if v_matched <> cardinality(v_ids) then
    raise exception 'Media selection is not standalone room-library media'
      using errcode = '22023';
  end if;

  /*
   * Publishing a batch containing an unprocessed image fails the whole batch.
   *
   * The alternative — publish the ready ones and silently drop the rest — is
   * the worst outcome available: the owner selected twelve, sees a success, and
   * eleven are live. A refusal they can act on beats a partial success they
   * cannot see.
   */
  if requested_published then
    select count(*) into v_not_ready
    from public.portfolio_media m
    where m.id = any (v_ids)
      and m.status <> 'ready';

    if v_not_ready > 0 then
      raise exception 'Cannot publish media that is not ready (% of % selected)',
        v_not_ready, cardinality(v_ids) using errcode = '22023';
    end if;
  end if;

  return query
  update public.portfolio_media m
  set room_gallery_published = requested_published,
      updated_by = (select auth.uid())
  where m.id = any (v_ids)
    and m.project_id is null
  returning m.*;
end;
$$;

revoke execute on function public.set_portfolio_library_publication(uuid[], boolean) from public, anon;
grant execute on function public.set_portfolio_library_publication(uuid[], boolean) to authenticated;

comment on function public.set_portfolio_library_publication(uuid[], boolean) is
  'Publishes or unpublishes standalone room-library media. Refuses project-linked media and refuses to publish anything not ready; all-or-nothing.';

create or replace function public.reorder_portfolio_library_media(
  requested_room_code text,
  requested_media_ids uuid[]
)
returns setof public.portfolio_media
language plpgsql
set search_path to ''
as $$
declare
  v_ids uuid[];
  v_matched integer;
  v_total integer;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  if requested_room_code is null
     or requested_room_code not in ('living-room', 'bedroom', 'kitchen') then
    raise exception 'Invalid room category code: %', coalesce(requested_room_code, 'null')
      using errcode = '23514';
  end if;

  v_ids := coalesce(requested_media_ids, array[]::uuid[]);
  if array_length(v_ids, 1) is null then
    return;
  end if;

  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x) then
    raise exception 'Reorder list contains duplicate media ids' using errcode = '22023';
  end if;

  -- Every id must be standalone AND in this room.
  select count(*) into v_matched
  from public.portfolio_media m
  where m.id = any (v_ids)
    and m.project_id is null
    and m.room_category_code = requested_room_code;

  if v_matched <> cardinality(v_ids) then
    raise exception 'Reorder selection does not belong to this room library'
      using errcode = '22023';
  end if;

  /*
   * THE COMPLETE SET, OR NOTHING.
   *
   * Ordering is only meaningful as a total order. Accepting a subset would let
   * a paginated admin screen renumber page one to 0..47 and leave page two also
   * claiming 0..47 — a gallery whose order depends on which rows the database
   * happens to return first. The admin therefore loads the whole category
   * before it allows a reorder, and this is the assertion that makes that a
   * contract instead of an assumption.
   */
  select count(*) into v_total
  from public.portfolio_media m
  where m.project_id is null
    and m.room_category_code = requested_room_code
    and m.status <> 'retired';

  if v_total <> cardinality(v_ids) then
    raise exception 'Reorder requires the complete room set (% supplied, % active)',
      cardinality(v_ids), v_total using errcode = '22023';
  end if;

  return query
  update public.portfolio_media m
  set sort_order = ordered.position - 1,
      updated_by = (select auth.uid())
  from (
    select id, row_number() over () as position
    from unnest(v_ids) as id
  ) as ordered
  where m.id = ordered.id
    and m.project_id is null
    and m.room_category_code = requested_room_code
  returning m.*;
end;
$$;

revoke execute on function public.reorder_portfolio_library_media(text, uuid[]) from public, anon;
grant execute on function public.reorder_portfolio_library_media(text, uuid[]) to authenticated;

comment on function public.reorder_portfolio_library_media(text, uuid[]) is
  'Assigns a dense 0..n-1 order to one room library. Requires the complete active set for that room; rejects project-linked media, duplicates and cross-room ids.';
