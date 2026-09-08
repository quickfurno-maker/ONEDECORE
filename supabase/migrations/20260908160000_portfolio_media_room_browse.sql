-- ONEDECORE -- room browsing becomes PHOTO-level, and Hall becomes Living Room.
--
-- THE CORRECTION
--
-- The public portfolio offered four project categories, one of which was
-- "Hall / Living Room". Two problems with that.
--
-- First, the label. "Hall" and "Living Room" are the same room to a visitor,
-- and offering both words invites them to wonder which one their space is.
-- Living Room is now the only public term.
--
-- Second, and structurally: browsing by room was a PROJECT-level facet. A
-- visitor who clicks "Bedroom" wants to look at bedrooms, and a project-level
-- facet answers a different question -- it hands them a whole-home case study
-- that happens to contain a bedroom somewhere. The alternative the last shape
-- invited was worse: split one delivered home into fake room-level "projects"
-- so each room could carry its own card.
--
-- So the room taxonomy moves to where the rooms actually are: the photographs.
--
--   portfolio_projects            one row = one real delivered home
--   portfolio_media               one row = one real photograph
--   portfolio_media.room_category_code   which room THIS photograph shows
--
-- Projects stays the default view and remains whole-home case studies. Living
-- Room, Bedroom and Kitchen become galleries of real tagged photographs, each
-- still carrying its parent project.
--
-- WHAT IS NOT DROPPED
--
-- `portfolio_project_categories` stays. It is already deployed, it is a
-- reasonable project-level facet, and dropping a table to change a label is not
-- a migration anyone should have to review. It simply stops being the authority
-- for room-photo galleries. Its Hall rows are translated to living-room and its
-- allowlist is rewritten so Hall cannot come back.
--
-- `portfolio_projects.portfolio_category_code` -- already deprecated by
-- 20260908150000 -- gets the same treatment for the same reason.
--
-- `portfolio_project_services` is untouched. Service is what a project was SOLD
-- as and is read by CRM; room is what a photograph SHOWS. Different questions.
--
-- NOTHING IS CLASSIFIED BY GUESSWORK. `room_category_code` is nullable and no
-- photograph is assigned a room here. A cover shot, a material detail or a
-- hallway view is legitimately unclassified, and NULL is the honest record of
-- that: it means "not for room browsing", not "unknown bedroom".

-- ---------------------------------------------------------------------------
-- 1. Room classification on the photograph
-- ---------------------------------------------------------------------------

alter table public.portfolio_media
  add column if not exists room_category_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_portfolio_media_room_category_code'
  ) then
    alter table public.portfolio_media
      add constraint chk_portfolio_media_room_category_code
      check (
        room_category_code is null
        or room_category_code in ('living-room', 'bedroom', 'kitchen')
      );
  end if;
end
$$;

comment on column public.portfolio_media.room_category_code is
  'Which room this photograph shows, for public room browsing: living-room, bedroom or kitchen. NULL means the photograph is not part of room browsing (a cover, a material detail, an exterior) -- it is never a guess at an unknown room. Set by an editor; never inferred.';

/*
 * The public room gallery asks "every published photo of a kitchen, newest
 * project first". Partial, because unclassified rows are never selected BY
 * room and excluding them keeps the index proportional to the classified set.
 * Project id is included so the per-project detail filter uses the same index.
 */
create index if not exists idx_portfolio_media_room_browse
  on public.portfolio_media (room_category_code, project_id, sort_order)
  where room_category_code is not null;

-- ---------------------------------------------------------------------------
-- 2. Focal point -- one original, several crops
-- ---------------------------------------------------------------------------
--
-- The display standard is 4:5 cards, 9:16 mobile features and 16:9 heroes from
-- ONE uploaded original. Cropping to the centre loses the subject whenever the
-- subject is not centred, and asking the owner to upload three files per
-- photograph is not a thing anyone would keep doing.
--
-- So the crop is expressed as a point of interest the browser honours through
-- `object-position`. Percentages, 0-100, defaulting to dead centre -- which is
-- exactly what the browser already does, so an un-adjusted photograph looks
-- precisely as it does today.
--
-- Integers, not floats: sub-percent precision on a focal point is noise, and
-- an integer survives a round trip through a form without drifting.

alter table public.portfolio_media
  add column if not exists focal_x smallint not null default 50;

alter table public.portfolio_media
  add column if not exists focal_y smallint not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_portfolio_media_focal_bounds'
  ) then
    alter table public.portfolio_media
      add constraint chk_portfolio_media_focal_bounds
      check (
        focal_x between 0 and 100
        and focal_y between 0 and 100
      );
  end if;
end
$$;

comment on column public.portfolio_media.focal_x is
  'Horizontal point of interest, 0-100 percent from the left. 50 is centre, which is the browser default, so an unadjusted image is unchanged.';
comment on column public.portfolio_media.focal_y is
  'Vertical point of interest, 0-100 percent from the top. 50 is centre.';

-- ---------------------------------------------------------------------------
-- 3. Hall becomes Living Room -- project-category table
-- ---------------------------------------------------------------------------
--
-- COLLISION-SAFE, because a project may already carry BOTH hall and
-- living-room. Translating blindly would violate the composite primary key, so
-- the rows that would collide are deleted and the rest are updated.
--
-- Production holds zero portfolio projects, so this moves nothing there. It is
-- written for local and staging databases that do, and for any classification
-- an editor made before this change.

delete from public.portfolio_project_categories h
where h.category_code = 'hall'
  and exists (
    select 1
    from public.portfolio_project_categories l
    where l.project_id = h.project_id
      and l.category_code = 'living-room'
  );

update public.portfolio_project_categories
set category_code = 'living-room'
where category_code = 'hall';

alter table public.portfolio_project_categories
  drop constraint if exists chk_portfolio_project_categories_code;

alter table public.portfolio_project_categories
  add constraint chk_portfolio_project_categories_code
  check (category_code in ('complete-interiors', 'living-room', 'bedroom', 'kitchen'));

comment on table public.portfolio_project_categories is
  'Project-level room facet, retained for compatibility. NOT the authority for public room browsing -- that is portfolio_media.room_category_code, which classifies individual photographs. Hall was translated to living-room by migration 20260908160000.';

-- ---------------------------------------------------------------------------
-- 4. Hall becomes Living Room -- deprecated scalar
-- ---------------------------------------------------------------------------

update public.portfolio_projects
set portfolio_category_code = 'living-room'
where portfolio_category_code = 'hall';

alter table public.portfolio_projects
  drop constraint if exists chk_portfolio_project_category_code;

alter table public.portfolio_projects
  add constraint chk_portfolio_project_category_code
  check (
    portfolio_category_code is null
    or portfolio_category_code in
      ('complete-interiors', 'living-room', 'bedroom', 'kitchen')
  );

comment on column public.portfolio_projects.portfolio_category_code is
  'DEPRECATED compatibility column. Runtime code neither reads nor writes it. Room browsing is per-photograph via portfolio_media.room_category_code; the project-level facet is portfolio_project_categories. Hall was translated to living-room by migration 20260908160000.';

-- ---------------------------------------------------------------------------
-- 5. Privileges for the new columns
-- ---------------------------------------------------------------------------
--
-- Column-level, matching the existing grants. `focal_x`/`focal_y` are
-- insertable so the upload route can accept a focal point at creation time;
-- both are updatable so the focal editor can move it afterwards.

grant insert (room_category_code, focal_x, focal_y)
  on table public.portfolio_media to authenticated;
grant update (room_category_code, focal_x, focal_y)
  on table public.portfolio_media to authenticated;

-- ---------------------------------------------------------------------------
-- 5b. The project-category RPC learns the new vocabulary
-- ---------------------------------------------------------------------------
--
-- `replace_portfolio_project_categories` carried its own inline copy of the
-- allowlist. Changing the table constraint without it would leave the function
-- refusing `living-room` and accepting `hall` — a category an editor could no
-- longer store. The two lists have to move together, which is exactly why the
-- pgTAP suite exercises the RPC and not only the constraint.
--
-- `create or replace` keeps the existing privileges; the signature is unchanged.

create or replace function public.replace_portfolio_project_categories(
  requested_project_id uuid,
  requested_category_codes text[]
)
returns setof public.portfolio_project_categories
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text;
  v_codes text[];
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio project categories' using errcode = '42501';
  end if;

  perform 1
  from public.portfolio_projects
  where id = requested_project_id
  for update;

  if not found then
    raise exception 'Portfolio project not found' using errcode = 'P0002';
  end if;

  v_codes := coalesce(requested_category_codes, array[]::text[]);

  foreach v_code in array v_codes loop
    if v_code not in ('complete-interiors', 'living-room', 'bedroom', 'kitchen') then
      raise exception 'Invalid portfolio category code: %', v_code using errcode = '23514';
    end if;
  end loop;

  insert into public.portfolio_project_categories (project_id, category_code)
  select requested_project_id, unnest(v_codes)
  on conflict (project_id, category_code) do nothing;

  delete from public.portfolio_project_categories
  where project_id = requested_project_id
    and category_code <> all (v_codes);

  return query
  select *
  from public.portfolio_project_categories
  where project_id = requested_project_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Atomic bulk room tagging
-- ---------------------------------------------------------------------------
--
-- The photo grid tags many images at once. Doing that as N separate updates
-- from the browser means a half-applied set whenever one fails, so it is one
-- statement inside one function.
--
-- SECURITY INVOKER with a pinned search_path, like every other portfolio RPC:
-- RLS already expresses who may write, and a definer function would be a
-- second, weaker copy of that rule.
--
-- A NULL room is valid and means "unclassified". An unrecognised room is
-- REFUSED -- silently dropping it would save a state the editor did not choose.
-- Every id must belong to the named project, which is what stops a caller
-- retagging someone else's media by guessing uuids.

create or replace function public.set_portfolio_media_room_category(
  requested_project_id uuid,
  requested_media_ids uuid[],
  requested_room_code text
)
returns setof public.portfolio_media
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_matched integer;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  if requested_room_code is not null
     and requested_room_code not in ('living-room', 'bedroom', 'kitchen') then
    raise exception 'Invalid room category code: %', requested_room_code using errcode = '23514';
  end if;

  v_ids := coalesce(requested_media_ids, array[]::uuid[]);

  if array_length(v_ids, 1) is null then
    return;
  end if;

  -- Every id must belong to this project. Counting first, rather than letting
  -- the UPDATE quietly skip strangers, turns a cross-project attempt into an
  -- error instead of a partial success nobody notices.
  select count(*) into v_matched
  from public.portfolio_media m
  where m.id = any (v_ids)
    and m.project_id = requested_project_id;

  if v_matched <> cardinality(v_ids) then
    raise exception 'Media selection does not belong to this project' using errcode = '22023';
  end if;

  return query
  update public.portfolio_media m
  set room_category_code = requested_room_code,
      updated_by = auth.uid()
  where m.id = any (v_ids)
    and m.project_id = requested_project_id
  returning m.*;
end;
$$;

comment on function public.set_portfolio_media_room_category(uuid, uuid[], text) is
  'Atomically sets the room category on a selection of one project''s media. NULL means unclassified. Requires portfolio.manage.';

revoke execute on function public.set_portfolio_media_room_category(uuid, uuid[], text) from public, anon;
grant execute on function public.set_portfolio_media_room_category(uuid, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Atomic cover promotion
-- ---------------------------------------------------------------------------
--
-- `idx_portfolio_media_single_cover` allows one non-retired cover per project,
-- so promoting a new one while the old one is still cover would violate it.
-- Demote-then-promote inside one function is atomic to any other transaction,
-- and each statement satisfies the index on its own.
--
-- The published-cover guard trigger still applies: a published project refuses
-- to have its ready cover mutated, and the editor is told to return it to draft
-- first. That is deliberate and this function does not work around it.

create or replace function public.set_portfolio_project_cover(
  requested_project_id uuid,
  requested_media_id uuid
)
returns setof public.portfolio_media
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  perform 1 from public.portfolio_projects where id = requested_project_id for update;
  if not found then
    raise exception 'Portfolio project not found' using errcode = 'P0002';
  end if;

  select m.status into v_status
  from public.portfolio_media m
  where m.id = requested_media_id
    and m.project_id = requested_project_id;

  if v_status is null then
    raise exception 'Media does not belong to this project' using errcode = '22023';
  end if;

  -- A cover has to be a picture the public can actually see.
  if v_status <> 'ready' then
    raise exception 'Only processed media can become the cover' using errcode = '22023';
  end if;

  update public.portfolio_media
  set media_role = 'gallery', updated_by = auth.uid()
  where project_id = requested_project_id
    and media_role = 'cover'
    and id <> requested_media_id;

  update public.portfolio_media
  set media_role = 'cover', updated_by = auth.uid()
  where id = requested_media_id;

  return query
  select * from public.portfolio_media where project_id = requested_project_id;
end;
$$;

comment on function public.set_portfolio_project_cover(uuid, uuid) is
  'Atomically promotes one processed media row to project cover, demoting the previous cover. Requires portfolio.manage.';

revoke execute on function public.set_portfolio_project_cover(uuid, uuid) from public, anon;
grant execute on function public.set_portfolio_project_cover(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Atomic deterministic reordering
-- ---------------------------------------------------------------------------
--
-- Drag-and-drop sends the whole order, not a swap. Applying it row by row from
-- the browser leaves the grid half-sorted if a request fails partway, so the
-- new order arrives as one array and is written in one statement.
--
-- CROSS-PROJECT REORDER IS IMPOSSIBLE HERE: every id must belong to the named
-- project, and the array must be the project's complete media set. A partial
-- array would leave the omitted rows holding stale positions that collide with
-- the new ones.

create or replace function public.reorder_portfolio_project_media(
  requested_project_id uuid,
  requested_media_ids uuid[]
)
returns setof public.portfolio_media
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_total integer;
  v_matched integer;
begin
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio media' using errcode = '42501';
  end if;

  v_ids := coalesce(requested_media_ids, array[]::uuid[]);

  if array_length(v_ids, 1) is null then
    return;
  end if;

  -- No duplicates: the same id twice would make two positions authoritative.
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x) then
    raise exception 'Duplicate media id in requested order' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.portfolio_media where project_id = requested_project_id;

  select count(*) into v_matched
  from public.portfolio_media m
  where m.id = any (v_ids) and m.project_id = requested_project_id;

  if v_matched <> cardinality(v_ids) then
    raise exception 'Media order does not belong to this project' using errcode = '22023';
  end if;
  if v_total <> cardinality(v_ids) then
    raise exception 'Media order must list every image in the project' using errcode = '22023';
  end if;

  update public.portfolio_media m
  set sort_order = ordered.position - 1,
      updated_by = auth.uid()
  from (
    select unnest(v_ids) as id, generate_subscripts(v_ids, 1) as position
  ) as ordered
  where m.id = ordered.id
    and m.project_id = requested_project_id;

  return query
  select * from public.portfolio_media
  where project_id = requested_project_id
  order by sort_order;
end;
$$;

comment on function public.reorder_portfolio_project_media(uuid, uuid[]) is
  'Atomically rewrites sort_order for one project''s complete media set from the supplied order. Requires portfolio.manage.';

revoke execute on function public.reorder_portfolio_project_media(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_portfolio_project_media(uuid, uuid[]) to authenticated;
