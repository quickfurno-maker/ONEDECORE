-- ONEDECORE -- room categories become a many-to-many dimension.
--
-- WHY THE SCALAR WAS STRUCTURALLY WRONG
--
-- `portfolio_projects` is a WHOLE-PROJECT record. Its own columns say so:
-- `location_label`, `property_type`, `completion_year`, a description, and a
-- media gallery with one cover and many images. One row is one delivered home.
--
-- A delivered home is photographed across its kitchen, its hall and its
-- bedrooms. Under `portfolio_projects.portfolio_category_code` -- a single
-- nullable scalar -- that home could be filed under exactly one of those, and
-- the other categories would be empty even though the photographs exist. The
-- only ways out were both dishonest: split one home into several fake
-- "projects", or pick one room and pretend the rest were not delivered.
--
-- The service dimension already knew this. `portfolio_project_services` has
-- been many-to-many since the portfolio was built, because a project can be
-- sold as complete-home-interiors AND modular-kitchens. The room dimension is
-- the same shape and was modelled as a scalar only because, when it was added,
-- there were no projects to contradict it.
--
-- SO: `portfolio_project_categories` becomes canonical.
--
-- WHAT HAPPENS TO THE SCALAR
--
-- It is NOT dropped. It is already applied in production and history must stay
-- readable. Any non-null value it holds is copied into the join table by this
-- migration, so the two agree at the moment of the cut, and from here the join
-- table is the only thing runtime code reads or writes. The scalar is left
-- nullable and documented as deprecated compatibility data.
--
-- Two authorities writing the same fact is how they drift. There is one.
--
-- THE TWO DIMENSIONS STAY SEPARATE
--
-- `service_code` records the service a project was SOLD as and is read by CRM
-- and lead matching. `category_code` records the rooms a project can be
-- BROWSED under. They answer different questions and neither is derived from
-- the other. Nothing here touches `portfolio_project_services`.
--
-- NOTHING IS BACKFILLED BY GUESSWORK. Production holds zero portfolio projects
-- and this migration creates none. The backfill below moves classifications
-- that an editor already made; where the scalar is null, no mapping appears,
-- because "not yet classified" is a real answer and inventing one would put a
-- bedroom label on a project nobody looked at.

-- ---------------------------------------------------------------------------
-- 1. The join table
-- ---------------------------------------------------------------------------

create table if not exists public.portfolio_project_categories (
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  category_code text not null,
  created_at timestamptz not null default now(),

  primary key (project_id, category_code),
  constraint chk_portfolio_project_categories_code
    check (category_code in ('complete-interiors', 'kitchen', 'hall', 'bedroom'))
);

comment on table public.portfolio_project_categories is
  'Canonical many-to-many room/browsing categories for public portfolio navigation. One whole-home project may appear under several. Distinct from portfolio_project_services, which records the service the project was sold as.';

comment on column public.portfolio_project_categories.category_code is
  'One of complete-interiors, kitchen, hall, bedroom. Set by an editor; never inferred.';

-- The composite primary key already serves project -> categories. The reverse
-- direction is what the public listing filters on, so it gets its own index.
create index if not exists idx_portfolio_project_categories_code
  on public.portfolio_project_categories (category_code);

-- ---------------------------------------------------------------------------
-- 2. Privileges -- the same shape as portfolio_project_services
-- ---------------------------------------------------------------------------
--
-- Column-level INSERT rather than table-level: `created_at` is set by its
-- default and a client has no business supplying it. There is no UPDATE grant
-- at all, exactly as for services -- a mapping is inserted or deleted, never
-- edited, so there is no path by which one project's row becomes another's.

revoke all on table public.portfolio_project_categories from public, anon, authenticated;

grant select on table public.portfolio_project_categories to anon, authenticated;
grant insert (project_id, category_code) on table public.portfolio_project_categories to authenticated;
grant delete on table public.portfolio_project_categories to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row-level security -- mirrors the services policies exactly
-- ---------------------------------------------------------------------------

alter table public.portfolio_project_categories enable row level security;

-- Anonymous readers see a mapping only when its project is published. A draft
-- project's classification is not public information.
create policy "Anon select published project categories"
  on public.portfolio_project_categories for select to anon
  using (
    exists (
      select 1
      from public.portfolio_projects p
      where p.id = portfolio_project_categories.project_id
        and p.status = 'published'
    )
  );

create policy "Authenticated select project categories"
  on public.portfolio_project_categories for select to authenticated
  using (
    exists (
      select 1
      from public.portfolio_projects p
      where p.id = portfolio_project_categories.project_id
        and p.status = 'published'
    )
    or (select public.authorize('portfolio.read'))
    or (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert project categories"
  on public.portfolio_project_categories for insert to authenticated
  with check ((select public.authorize('portfolio.manage')));

create policy "Staff delete project categories"
  on public.portfolio_project_categories for delete to authenticated
  using ((select public.authorize('portfolio.manage')));

-- ---------------------------------------------------------------------------
-- 4. Carry the existing scalar classifications across
-- ---------------------------------------------------------------------------
--
-- Production has no portfolio rows, so this moves nothing there. It is written
-- for the local and staging databases that do, and for any row an editor
-- classified before this change: their work must not be lost by the cut.
--
-- Null stays null: no mapping is created for an unclassified project.
-- `on conflict do nothing` makes the migration safe to reason about even if a
-- mapping somehow already exists.

insert into public.portfolio_project_categories (project_id, category_code)
select p.id, p.portfolio_category_code
from public.portfolio_projects p
where p.portfolio_category_code is not null
on conflict (project_id, category_code) do nothing;

comment on column public.portfolio_projects.portfolio_category_code is
  'DEPRECATED compatibility column. The canonical room taxonomy is public.portfolio_project_categories, which is many-to-many. Retained because it is already deployed and historical rows must stay readable; runtime code neither reads nor writes it. Values present here were copied into the join table by migration 20260908150000.';

-- ---------------------------------------------------------------------------
-- 5. Atomic replacement RPC
-- ---------------------------------------------------------------------------
--
-- Modelled on `replace_portfolio_project_services`, including its security
-- posture: SECURITY INVOKER with a pinned empty `search_path`, an explicit
-- `authorize('portfolio.manage')` check, and a row lock so two editors saving
-- the same project cannot interleave into a half-applied set.
--
-- It is INVOKER, not DEFINER, deliberately. RLS already expresses who may write
-- a mapping, so a definer function would be a second, weaker copy of that rule
-- and a privilege boundary nobody asked for.
--
-- ONE DIFFERENCE FROM SERVICES: an EMPTY set is allowed.
--
-- A published project must have at least one service, because a project that
-- was sold as nothing is incoherent. A project with no room category is not
-- incoherent -- it is unclassified, which is precisely the state the nullable
-- scalar expressed and the state every project starts in. Such a project simply
-- appears under no category filter.

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
  -- 1. Authorization
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio project categories' using errcode = '42501';
  end if;

  -- 2. Lock the project row, and prove it exists
  perform 1
  from public.portfolio_projects
  where id = requested_project_id
  for update;

  if not found then
    raise exception 'Portfolio project not found' using errcode = 'P0002';
  end if;

  -- 3. Validate. A null array means "no categories", not an error, but an
  --    unrecognised code is refused rather than skipped: silently dropping it
  --    would save a set the editor did not choose.
  v_codes := coalesce(requested_category_codes, array[]::text[]);

  foreach v_code in array v_codes loop
    if v_code not in ('complete-interiors', 'kitchen', 'hall', 'bedroom') then
      raise exception 'Invalid portfolio category code: %', v_code using errcode = '23514';
    end if;
  end loop;

  -- 4. Insert the additions. `on conflict do nothing` makes a repeated code in
  --    the request harmless rather than a unique violation.
  insert into public.portfolio_project_categories (project_id, category_code)
  select requested_project_id, unnest(v_codes)
  on conflict (project_id, category_code) do nothing;

  -- 5. Remove what is no longer wanted. Insert-then-delete, like the services
  --    RPC, so the set is never briefly empty for a concurrent reader.
  delete from public.portfolio_project_categories
  where project_id = requested_project_id
    and category_code <> all (v_codes);

  return query
  select *
  from public.portfolio_project_categories
  where project_id = requested_project_id;
end;
$$;

comment on function public.replace_portfolio_project_categories(uuid, text[]) is
  'Atomically replaces a project''s room categories with the requested set. Requires portfolio.manage. An empty set is valid and means unclassified.';

revoke execute on function public.replace_portfolio_project_categories(uuid, text[]) from public, anon;
grant execute on function public.replace_portfolio_project_categories(uuid, text[]) to authenticated;
