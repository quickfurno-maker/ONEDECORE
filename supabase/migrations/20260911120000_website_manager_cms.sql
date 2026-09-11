-- Website Manager: admin-controlled homepage sections and promotional banners.
--
-- WHAT THIS IS FOR
--
-- Changing a homepage banner currently means editing `interiors-promo.ts`,
-- opening a pull request, waiting for CI and deploying. That is the right
-- process for code and an absurd one for a festive offer that runs for nine
-- days. This moves two specific things -- which banners exist, and which
-- sections are shown in which order -- out of TypeScript and into data the
-- owner can change from the admin, with a publish step and no deployment.
--
-- WHAT IT IS DELIBERATELY NOT
--
-- Not a generic CMS. Section COPY stays in code: it is written, reviewed and
-- shipped like code, and a free-text editor over a public marketing page is a
-- different product with a different risk profile. What is editable here is
-- structure (order, visibility) and campaign artwork.
--
-- THE VERSION MODEL, AND WHY IT IS NOT A SETTINGS TABLE
--
-- The obvious shape is one row per section and one per banner, edited in
-- place. That makes every keystroke live: an editor who drags a section and
-- then thinks better of it has already published twice, and there is no state
-- in which a half-finished campaign can be reviewed.
--
-- So a version is the unit. Exactly one version is `draft` and at most one is
-- `published`; everything else is `archived` and immutable. Admin writes touch
-- only the draft. Publishing flips states and moves a single pointer inside one
-- transaction, then clones a fresh draft from what was just published, so the
-- editor always has somewhere to work and the next edit starts from live.
--
-- Public readers never see a version id. They call one function that reads
-- through the pointer, which is the only place the words "what is live" mean
-- anything.
--
-- FAIL-SAFE IS A CODE CONCERN, NOT A DATA ONE
--
-- If this table is empty, unreachable or nonsense, the homepage must still
-- render. The public reader returns null on any failure and the application
-- falls back to the code-defined default order -- see
-- `homepage-registry.ts`. A database outage degrades the ability to CHANGE the
-- homepage, never the ability to serve it.

-- =========================================================================
-- 1. Permission
-- =========================================================================

-- A permission of its own, not `portfolio.manage` reused.
--
-- Portfolio manages a gallery; this manages the front page of the company. The
-- blast radius of a mistake is different, so the grant should be a different
-- decision. Seeded to `super_admin` only, matching how `portfolio.manage` was
-- introduced -- widening it later is one insert, narrowing it after the fact
-- is an incident.
insert into public.permissions (code, name, description, is_system, is_active) values
  ('website.manage', 'Manage Website Content', 'Allows editing, previewing and publishing homepage sections and promotional banners', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and r.is_system = true
  and p.code = 'website.manage'
on conflict (role_id, permission_id) do nothing;

-- =========================================================================
-- 2. Tables
-- =========================================================================

create table public.website_homepage_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null,
  state text not null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  published_at timestamptz null,
  published_by uuid null references auth.users(id) on delete set null,

  constraint chk_website_version_state check (state in ('draft', 'published', 'archived')),
  constraint chk_website_version_number check (version_number > 0),
  constraint uq_website_version_number unique (version_number),
  -- A published version must carry its publication moment, and an unpublished
  -- one must not pretend to have had one.
  constraint chk_website_version_published_at check (
    (state = 'published' and published_at is not null)
    or (state <> 'published' and (state = 'archived' or published_at is null))
  )
);

comment on table public.website_homepage_versions is
  'One editable revision of the homepage configuration. Exactly one draft, at most one published, the rest archived and immutable.';

-- Exactly one draft, ever.
--
-- A partial unique index rather than a trigger: two concurrent "create draft"
-- calls race, and a trigger that counts rows cannot see the other transaction's
-- uncommitted insert. The index can.
create unique index uq_website_single_draft
  on public.website_homepage_versions ((state))
  where state = 'draft';

create unique index uq_website_single_published
  on public.website_homepage_versions ((state))
  where state = 'published';

create index idx_website_versions_state on public.website_homepage_versions (state);

create table public.website_homepage_sections (
  version_id uuid not null references public.website_homepage_versions(id) on delete cascade,
  section_key text not null,
  sort_order integer not null,
  is_visible boolean not null default true,

  primary key (version_id, section_key),
  constraint chk_website_section_key check (section_key ~ '^[a-z][a-z0-9-]*$'),
  constraint chk_website_section_sort check (sort_order >= 0)
);

comment on table public.website_homepage_sections is
  'Per-version homepage section order and visibility. The key must match the code-owned section registry; the component itself is never stored here.';

create index idx_website_sections_version_order
  on public.website_homepage_sections (version_id, sort_order);

create table public.website_homepage_banners (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.website_homepage_versions(id) on delete cascade,
  -- Stable across versions: the same campaign keeps one id through every
  -- publish, so storage paths and any future analytics stay joinable.
  banner_id uuid not null,
  internal_name text not null,
  desktop_image_path text null,
  mobile_image_path text null,
  alt_text text null,
  link_type text not null default 'none',
  link_value text null,
  open_in_new_tab boolean not null default false,
  is_enabled boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,

  constraint uq_website_banner_per_version unique (version_id, banner_id),
  constraint chk_website_banner_name check (length(trim(internal_name)) between 1 and 80),
  constraint chk_website_banner_sort check (sort_order >= 0),
  constraint chk_website_banner_link_type check (link_type in ('none', 'internal', 'external', 'consultation')),
  constraint chk_website_banner_alt check (alt_text is null or length(alt_text) <= 200),

  -- Alt text is required once there is a picture. A banner whose entire
  -- content is an image is unusable to a screen reader without it, and the
  -- only reliable moment to demand it is the moment the image arrives.
  constraint chk_website_banner_alt_required check (
    desktop_image_path is null
    or (alt_text is not null and length(trim(alt_text)) > 0)
  ),

  -- A mobile override without a primary image is a configuration nobody meant
  -- to create: the card would fall back to an image that does not exist.
  constraint chk_website_banner_mobile_needs_desktop check (
    mobile_image_path is null or desktop_image_path is not null
  ),

  -- THE LINK RULES LIVE HERE, NOT ONLY IN THE FORM.
  --
  -- A server action validates, and so does the browser, and both are reachable
  -- only through code that can be changed. This constraint is the one place a
  -- `javascript:` href cannot get past, whatever calls the insert.
  constraint chk_website_banner_link_value check (
    (link_type = 'none' and link_value is null)
    or (link_type = 'consultation' and link_value is null)
    -- Internal: a single leading slash. `//evil.com` is a protocol-relative
    -- URL that browsers treat as external, which is why the second character
    -- is checked explicitly rather than trusting "starts with /".
    or (
      link_type = 'internal'
      and link_value is not null
      and link_value ~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/?#-]*$'
      and link_value !~ '^//'
    )
    -- External: https only. Not http, not ftp, not data:, not javascript:.
    or (
      link_type = 'external'
      and link_value is not null
      and link_value ~ '^https://[A-Za-z0-9._-]+(:[0-9]+)?(/[^\s]*)?$'
    )
  ),

  -- Only an external link may open a new tab. A same-origin navigation that
  -- spawns a tab is a surprise, and `consultation` opens a dialog, not a page.
  constraint chk_website_banner_new_tab check (
    open_in_new_tab = false or link_type = 'external'
  )
);

comment on table public.website_homepage_banners is
  'Per-version promotional banner rows. `banner_id` is stable across versions; the primary key is per-version so historical revisions stay immutable snapshots.';

create index idx_website_banners_version_order
  on public.website_homepage_banners (version_id, sort_order);
create index idx_website_banners_banner_id
  on public.website_homepage_banners (banner_id);

-- The singleton pointer.
--
-- One row, enforced by a check on a fixed primary key. The alternative -- read
-- `versions` for `state = 'published'` -- is the same fact stored in two
-- places, and the pointer is what makes swapping it atomic.
create table public.website_homepage_publication (
  id boolean primary key default true,
  published_version_id uuid null references public.website_homepage_versions(id) on delete restrict,
  published_at timestamptz null,
  published_by uuid null references auth.users(id) on delete set null,

  constraint chk_website_publication_singleton check (id = true)
);

comment on table public.website_homepage_publication is
  'Singleton pointer to the live homepage version. The only definition of "published" a public reader consults.';

insert into public.website_homepage_publication (id) values (true)
on conflict (id) do nothing;

create trigger trg_website_versions_updated_at
  before update on public.website_homepage_versions
  for each row execute function private.set_updated_at();

create trigger trg_website_banners_updated_at
  before update on public.website_homepage_banners
  for each row execute function private.set_updated_at();

-- =========================================================================
-- 3. Row level security
-- =========================================================================

alter table public.website_homepage_versions enable row level security;
alter table public.website_homepage_sections enable row level security;
alter table public.website_homepage_banners enable row level security;
alter table public.website_homepage_publication enable row level security;

-- Nothing is granted to anon or to authenticated by default. The public read
-- path is one SECURITY DEFINER function; there is no table-level anon grant to
-- widen by accident.
revoke all on table
  public.website_homepage_versions,
  public.website_homepage_sections,
  public.website_homepage_banners,
  public.website_homepage_publication
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.website_homepage_versions,
  public.website_homepage_sections,
  public.website_homepage_banners
to authenticated;

grant select, update on table public.website_homepage_publication to authenticated;

-- Every policy is the same question. Staff without `website.manage` -- which is
-- every staff member except the owner role today -- match no policy and so see
-- nothing and write nothing.
create policy "Website managers read versions"
  on public.website_homepage_versions for select to authenticated
  using ((select public.authorize('website.manage')));

create policy "Website managers write versions"
  on public.website_homepage_versions for all to authenticated
  using ((select public.authorize('website.manage')))
  with check ((select public.authorize('website.manage')));

create policy "Website managers read sections"
  on public.website_homepage_sections for select to authenticated
  using ((select public.authorize('website.manage')));

create policy "Website managers write sections"
  on public.website_homepage_sections for all to authenticated
  using ((select public.authorize('website.manage')))
  with check ((select public.authorize('website.manage')));

create policy "Website managers read banners"
  on public.website_homepage_banners for select to authenticated
  using ((select public.authorize('website.manage')));

create policy "Website managers write banners"
  on public.website_homepage_banners for all to authenticated
  using ((select public.authorize('website.manage')))
  with check ((select public.authorize('website.manage')));

create policy "Website managers read publication"
  on public.website_homepage_publication for select to authenticated
  using ((select public.authorize('website.manage')));

create policy "Website managers update publication"
  on public.website_homepage_publication for update to authenticated
  using ((select public.authorize('website.manage')))
  with check ((select public.authorize('website.manage')));

-- =========================================================================
-- 4. Storage
-- =========================================================================

-- Public bucket, like `portfolio-public`: these are marketing banners served
-- to anonymous visitors, and signing every card would defeat the CDN for no
-- secrecy that exists. Writes are another matter entirely -- see the policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('website-banners', 'website-banners', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Website managers insert banner objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'website-banners'
    and (select public.authorize('website.manage'))
  );

create policy "Website managers update banner objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'website-banners'
    and (select public.authorize('website.manage'))
  )
  with check (
    bucket_id = 'website-banners'
    and (select public.authorize('website.manage'))
  );

create policy "Website managers delete banner objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'website-banners'
    and (select public.authorize('website.manage'))
  );

-- =========================================================================
-- 5. Private helpers
-- =========================================================================

create function private.website_require_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'WEBSITE_UNAUTHENTICATED' using errcode = '42501';
  end if;
  if not private.has_permission('website.manage') then
    raise exception 'WEBSITE_FORBIDDEN' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

comment on function private.website_require_manager() is
  'Returns the acting user id, or raises 42501 unless they hold an active website.manage permission.';

-- =========================================================================
-- 6. Public read path
-- =========================================================================

-- The only thing an anonymous visitor may call.
--
-- It returns the published version's sections and enabled banners and nothing
-- else: no version ids, no draft, no archived revision, no actor, no
-- timestamps. That list is the contract, and it is why this is a function
-- rather than a view over the tables with an anon grant -- a view would need
-- `select` on the tables, and every future column would join the public
-- payload by default.
create function public.get_published_homepage_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version uuid;
  v_sections jsonb;
  v_banners jsonb;
begin
  select p.published_version_id into v_version
  from public.website_homepage_publication p
  where p.id = true;

  if v_version is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key', s.section_key,
      'order', s.sort_order,
      'visible', s.is_visible
    ) order by s.sort_order, s.section_key
  ), '[]'::jsonb)
  into v_sections
  from public.website_homepage_sections s
  where s.version_id = v_version;

  -- Disabled banners are filtered HERE, not by the caller. A disabled campaign
  -- is not "hidden in the payload" -- it never leaves the database, so there is
  -- no unpublished artwork sitting in the page source for anyone to read.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.banner_id,
      'image', b.desktop_image_path,
      'mobileImage', b.mobile_image_path,
      'alt', b.alt_text,
      'linkType', b.link_type,
      'linkValue', b.link_value,
      'newTab', b.open_in_new_tab,
      'order', b.sort_order
    ) order by b.sort_order, b.banner_id
  ), '[]'::jsonb)
  into v_banners
  from public.website_homepage_banners b
  where b.version_id = v_version
    and b.is_enabled = true;

  return jsonb_build_object('sections', v_sections, 'banners', v_banners);
end;
$$;

comment on function public.get_published_homepage_config() is
  'Returns the live homepage configuration: ordered sections and ordered ENABLED banners. Never exposes draft or archived versions, version ids, or actor metadata.';

revoke execute on function public.get_published_homepage_config() from public;
grant execute on function public.get_published_homepage_config() to anon, authenticated;

-- =========================================================================
-- 7. Admin read path
-- =========================================================================

create function public.get_website_homepage_draft()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_draft public.website_homepage_versions%rowtype;
  v_published public.website_homepage_versions%rowtype;
  v_sections jsonb;
  v_banners jsonb;
  v_published_sections jsonb;
  v_published_banners jsonb;
begin
  v_actor := private.website_require_manager();

  select * into v_draft
  from public.website_homepage_versions
  where state = 'draft';

  if not found then
    return null;
  end if;

  select * into v_published
  from public.website_homepage_versions
  where state = 'published';

  select coalesce(jsonb_agg(
    jsonb_build_object('key', s.section_key, 'order', s.sort_order, 'visible', s.is_visible)
    order by s.sort_order, s.section_key
  ), '[]'::jsonb)
  into v_sections
  from public.website_homepage_sections s
  where s.version_id = v_draft.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bannerId', b.banner_id,
      'internalName', b.internal_name,
      'image', b.desktop_image_path,
      'mobileImage', b.mobile_image_path,
      'alt', b.alt_text,
      'linkType', b.link_type,
      'linkValue', b.link_value,
      'newTab', b.open_in_new_tab,
      'enabled', b.is_enabled,
      'order', b.sort_order
    ) order by b.sort_order, b.banner_id
  ), '[]'::jsonb)
  into v_banners
  from public.website_homepage_banners b
  where b.version_id = v_draft.id;

  /*
   * The published version's shape travels with the draft.
   *
   * The Publish dialog has to answer "what will change on the live site", and
   * the only honest comparison is draft-against-published. Diffing the draft
   * against itself-as-loaded looked right and reported nothing whenever the
   * editor reloaded between saving and publishing — which is most of the time.
   *
   * Keys and ids only: enough to diff, and nothing that would make this a
   * second copy of the published payload.
   */
  select coalesce(jsonb_agg(
    jsonb_build_object('key', s.section_key, 'visible', s.is_visible)
    order by s.sort_order, s.section_key
  ), '[]'::jsonb)
  into v_published_sections
  from public.website_homepage_sections s
  where s.version_id = v_published.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bannerId', b.banner_id,
      'internalName', b.internal_name,
      'image', b.desktop_image_path,
      'mobileImage', b.mobile_image_path,
      'alt', b.alt_text,
      'linkType', b.link_type,
      'linkValue', b.link_value,
      'newTab', b.open_in_new_tab,
      'enabled', b.is_enabled
    ) order by b.sort_order, b.banner_id
  ), '[]'::jsonb)
  into v_published_banners
  from public.website_homepage_banners b
  where b.version_id = v_published.id;

  return jsonb_build_object(
    'draftVersionId', v_draft.id,
    'draftVersionNumber', v_draft.version_number,
    'draftUpdatedAt', v_draft.updated_at,
    'publishedVersionNumber', v_published.version_number,
    'publishedSections', v_published_sections,
    'publishedBanners', v_published_banners,
    'publishedAt', v_published.published_at,
    'publishedBy', (
      -- `display_name`, which is what `public.profiles` actually has. A wrong
      -- column here does not fail loudly: the RPC raises, the reader returns
      -- null, and the admin page says the CMS "is not set up".
      select pr.display_name from public.profiles pr where pr.id = v_published.published_by
    ),
    'sections', v_sections,
    'banners', v_banners
  );
end;
$$;

comment on function public.get_website_homepage_draft() is
  'Returns the working draft plus published-version metadata for the admin Website Manager. Requires website.manage.';

revoke execute on function public.get_website_homepage_draft() from public, anon;
grant execute on function public.get_website_homepage_draft() to authenticated;

-- =========================================================================
-- 8. Draft save
-- =========================================================================

-- One call replaces the whole draft.
--
-- Not one call per reordered section. A drag that renumbers eleven rows as
-- eleven requests leaves a half-ordered page whenever the seventh fails, and
-- the browser has no way to find out which. The client sends the entire
-- intention and the database either takes all of it or none.
create function public.save_website_homepage_draft(
  p_expected_version_id uuid default null,
  p_sections jsonb default '[]'::jsonb,
  p_banners jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_draft uuid;
  v_enabled_count integer;
  v_section_count integer;
  v_hero_order integer;
  v_hero_visible boolean;
begin
  v_actor := private.website_require_manager();

  select id into v_draft
  from public.website_homepage_versions
  where state = 'draft'
  for update;

  if v_draft is null then
    raise exception 'WEBSITE_NO_DRAFT' using errcode = 'P0002';
  end if;

  -- The editor saves the draft it loaded, or it saves nothing.
  --
  -- Two people with the permission editing at once is rare and silent: the
  -- second save would overwrite the first with no sign that anything was lost.
  if p_expected_version_id is not null and p_expected_version_id <> v_draft then
    raise exception 'WEBSITE_STALE_DRAFT' using errcode = '40001';
  end if;

  -- ---- sections -------------------------------------------------------

  if jsonb_typeof(p_sections) <> 'array' then
    raise exception 'WEBSITE_INVALID_SECTIONS' using errcode = '22023';
  end if;

  delete from public.website_homepage_sections where version_id = v_draft;

  insert into public.website_homepage_sections (version_id, section_key, sort_order, is_visible)
  select
    v_draft,
    s->>'key',
    (s->>'order')::integer,
    coalesce((s->>'visible')::boolean, true)
  from jsonb_array_elements(p_sections) as s;

  select count(*) into v_section_count
  from public.website_homepage_sections where version_id = v_draft;

  if v_section_count = 0 then
    raise exception 'WEBSITE_NO_SECTIONS' using errcode = '22023';
  end if;

  -- The hero is not negotiable. The UI disables the controls; this is what
  -- makes that true for anything that is not the UI.
  select sort_order, is_visible into v_hero_order, v_hero_visible
  from public.website_homepage_sections
  where version_id = v_draft and section_key = 'hero';

  if v_hero_order is null then
    raise exception 'WEBSITE_HERO_REQUIRED' using errcode = '23514';
  end if;
  if v_hero_visible is not true then
    raise exception 'WEBSITE_HERO_MUST_BE_VISIBLE' using errcode = '23514';
  end if;
  if v_hero_order <> (
    select min(sort_order) from public.website_homepage_sections where version_id = v_draft
  ) then
    raise exception 'WEBSITE_HERO_MUST_BE_FIRST' using errcode = '23514';
  end if;

  -- ---- banners --------------------------------------------------------

  if jsonb_typeof(p_banners) <> 'array' then
    raise exception 'WEBSITE_INVALID_BANNERS' using errcode = '22023';
  end if;

  delete from public.website_homepage_banners where version_id = v_draft;

  insert into public.website_homepage_banners (
    version_id, banner_id, internal_name, desktop_image_path, mobile_image_path,
    alt_text, link_type, link_value, open_in_new_tab, is_enabled, sort_order,
    created_by, updated_by
  )
  select
    v_draft,
    coalesce((b->>'bannerId')::uuid, gen_random_uuid()),
    b->>'internalName',
    nullif(b->>'image', ''),
    nullif(b->>'mobileImage', ''),
    nullif(b->>'alt', ''),
    coalesce(b->>'linkType', 'none'),
    nullif(b->>'linkValue', ''),
    coalesce((b->>'newTab')::boolean, false),
    coalesce((b->>'enabled')::boolean, true),
    (b->>'order')::integer,
    v_actor,
    v_actor
  from jsonb_array_elements(p_banners) as b;

  -- A ceiling, not a limit anybody should reach.
  --
  -- Twenty enabled banners is already a rail nobody scrolls to the end of; the
  -- number exists so a scripted client cannot put four hundred 5:8 cards on the
  -- homepage and make the page weigh forty megabytes.
  select count(*) into v_enabled_count
  from public.website_homepage_banners
  where version_id = v_draft and is_enabled = true;

  if v_enabled_count > 20 then
    raise exception 'WEBSITE_TOO_MANY_BANNERS' using errcode = '23514';
  end if;

  update public.website_homepage_versions
  set updated_by = v_actor
  where id = v_draft;

  return jsonb_build_object(
    'draftVersionId', v_draft,
    'sectionCount', v_section_count,
    'enabledBannerCount', v_enabled_count
  );
end;
$$;

comment on function public.save_website_homepage_draft(uuid, jsonb, jsonb) is
  'Replaces the working draft''s sections and banners in one transaction. Requires website.manage. Refuses a stale draft id, a missing or hidden hero, a hero that is not first, and more than 20 enabled banners.';

revoke execute on function public.save_website_homepage_draft(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_website_homepage_draft(uuid, jsonb, jsonb) to authenticated;

-- =========================================================================
-- 9. Publish
-- =========================================================================

-- Publish is four state changes and a clone, and it is one transaction.
--
-- Half of it would be a homepage pointing at a version marked draft, or a
-- published version with no draft behind it and an editor with nowhere to
-- work. Postgres gives the atomicity for free; the value here is that nothing
-- else in the application is allowed to do these steps separately.
create function public.publish_website_homepage(p_expected_draft_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_draft public.website_homepage_versions%rowtype;
  v_previous uuid;
  v_new_draft uuid;
  v_next_number integer;
  v_now timestamptz := now();
begin
  v_actor := private.website_require_manager();

  select * into v_draft
  from public.website_homepage_versions
  where state = 'draft'
  for update;

  if not found then
    raise exception 'WEBSITE_NO_DRAFT' using errcode = 'P0002';
  end if;

  -- Publishing the draft you were looking at, or nothing.
  if p_expected_draft_id is not null and p_expected_draft_id <> v_draft.id then
    raise exception 'WEBSITE_STALE_DRAFT' using errcode = '40001';
  end if;

  -- The same invariants the save enforced, re-checked at the boundary that
  -- actually matters. A draft can be written by one call and published by
  -- another, and only this one makes it public.
  if not exists (
    select 1 from public.website_homepage_sections
    where version_id = v_draft.id and section_key = 'hero' and is_visible
  ) then
    raise exception 'WEBSITE_HERO_REQUIRED' using errcode = '23514';
  end if;

  if (select count(*) from public.website_homepage_banners
      where version_id = v_draft.id and is_enabled) > 20 then
    raise exception 'WEBSITE_TOO_MANY_BANNERS' using errcode = '23514';
  end if;

  select id into v_previous
  from public.website_homepage_versions
  where state = 'published'
  for update;

  -- Archive first: the single-published index would reject the new one while
  -- the old still holds the state.
  if v_previous is not null then
    update public.website_homepage_versions
    set state = 'archived', updated_by = v_actor
    where id = v_previous;
  end if;

  update public.website_homepage_versions
  set state = 'published',
      published_at = v_now,
      published_by = v_actor,
      updated_by = v_actor
  where id = v_draft.id;

  update public.website_homepage_publication
  set published_version_id = v_draft.id,
      published_at = v_now,
      published_by = v_actor
  where id = true;

  -- A fresh draft, cloned from what just went live, so the editor's next edit
  -- starts from the truth rather than from whatever they published last.
  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.website_homepage_versions;

  insert into public.website_homepage_versions (version_number, state, created_by, updated_by)
  values (v_next_number, 'draft', v_actor, v_actor)
  returning id into v_new_draft;

  insert into public.website_homepage_sections (version_id, section_key, sort_order, is_visible)
  select v_new_draft, section_key, sort_order, is_visible
  from public.website_homepage_sections
  where version_id = v_draft.id;

  insert into public.website_homepage_banners (
    version_id, banner_id, internal_name, desktop_image_path, mobile_image_path,
    alt_text, link_type, link_value, open_in_new_tab, is_enabled, sort_order,
    created_by, updated_by
  )
  select
    v_new_draft, banner_id, internal_name, desktop_image_path, mobile_image_path,
    alt_text, link_type, link_value, open_in_new_tab, is_enabled, sort_order,
    v_actor, v_actor
  from public.website_homepage_banners
  where version_id = v_draft.id;

  return jsonb_build_object(
    'publishedVersionId', v_draft.id,
    'publishedVersionNumber', v_draft.version_number,
    'archivedVersionId', v_previous,
    'newDraftId', v_new_draft,
    'publishedAt', v_now
  );
end;
$$;

comment on function public.publish_website_homepage(uuid) is
  'Atomically publishes the working draft: archives the previous published version, moves the publication pointer, and clones a fresh draft. Requires website.manage. Refuses a stale draft id or an invalid draft.';

revoke execute on function public.publish_website_homepage(uuid) from public, anon;
grant execute on function public.publish_website_homepage(uuid) to authenticated;

-- =========================================================================
-- 10. Seed the homepage as it is today
-- =========================================================================

-- The cutover must change nothing.
--
-- Version 1 is the homepage exactly as the code renders it right now: the same
-- sixteen sections in the same order, all visible, and the same six empty
-- banner slots. Introducing the CMS is therefore invisible to a visitor until
-- somebody publishes an actual edit, which is the only safe way to move a live
-- front page onto a new mechanism.
do $$
declare
  v_published uuid;
  v_draft uuid;
  v_keys text[] := array[
    'hero', 'promo-carousel', 'complete-interiors', 'modular-kitchen',
    'wardrobes', 'renovation', 'why', 'factory', 'estimator', 'portfolio',
    'materials', 'process', 'service-areas', 'testimonials', 'faq',
    'consultation'
  ];
  v_banner_ids uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  i integer;
begin
  insert into public.website_homepage_versions (version_number, state, published_at)
  values (1, 'published', now())
  returning id into v_published;

  insert into public.website_homepage_versions (version_number, state)
  values (2, 'draft')
  returning id into v_draft;

  foreach i in array array(select generate_series(1, array_length(v_keys, 1))) loop
    insert into public.website_homepage_sections (version_id, section_key, sort_order, is_visible)
    values (v_published, v_keys[i], i - 1, true), (v_draft, v_keys[i], i - 1, true);
  end loop;

  for i in 1..6 loop
    insert into public.website_homepage_banners (
      version_id, banner_id, internal_name, is_enabled, sort_order
    ) values
      (v_published, v_banner_ids[i], 'Banner ' || i, true, i - 1),
      (v_draft, v_banner_ids[i], 'Banner ' || i, true, i - 1);
  end loop;

  update public.website_homepage_publication
  set published_version_id = v_published, published_at = now()
  where id = true;
end;
$$;
