-- ONEDECORE Phase 2E1 Portfolio Data & Media Storage Foundation Migration

-- 1. Insert Portfolio System Permissions & System Super Admin Mapping
insert into public.permissions (code, name, description, is_system, is_active) values
  ('portfolio.read', 'Read Portfolio Content', 'Allows viewing portfolio draft and published content', true, true),
  ('portfolio.manage', 'Manage Portfolio Content', 'Allows editing, publishing, and deleting portfolio projects and media', true, true)
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
  and p.code in ('portfolio.read', 'portfolio.manage')
on conflict (role_id, permission_id) do nothing;

-- 2. Create Application Tables

-- 2.1 portfolio_projects
create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  description text,
  location_label text,
  property_type text,
  completion_year smallint,
  status text not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_portfolio_projects_slug check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint chk_portfolio_projects_title check (length(trim(title)) between 3 and 120),
  constraint chk_portfolio_projects_summary check (length(trim(summary)) between 20 and 320),
  constraint chk_portfolio_projects_description check (description is null or length(description) <= 10000),
  constraint chk_portfolio_projects_location_label check (location_label is null or length(location_label) <= 120),
  constraint chk_portfolio_projects_property_type check (property_type is null or length(property_type) <= 80),
  constraint chk_portfolio_projects_completion_year check (completion_year is null or (completion_year >= 2000 and completion_year <= (extract(year from now())::integer + 1))),
  constraint chk_portfolio_projects_status check (status in ('draft', 'published', 'archived')),
  constraint chk_portfolio_projects_featured_published check ((is_featured = false) or (is_featured = true and status = 'published')),
  constraint chk_portfolio_projects_published_at check ((status = 'published' and published_at is not null) or (status <> 'published' and published_at is null)),
  constraint chk_portfolio_projects_seo_title check (seo_title is null or length(seo_title) <= 70),
  constraint chk_portfolio_projects_seo_description check (seo_description is null or length(seo_description) <= 170),
  constraint chk_portfolio_projects_sort_order check (sort_order >= 0)
);

comment on table public.portfolio_projects is 'Core architectural portfolio projects catalog.';

-- Indexes for portfolio_projects
create index idx_portfolio_projects_status_featured_sort on public.portfolio_projects (status, is_featured, sort_order);
create index idx_portfolio_projects_created_by on public.portfolio_projects (created_by);
create index idx_portfolio_projects_updated_by on public.portfolio_projects (updated_by);

-- 2.2 portfolio_project_services
create table public.portfolio_project_services (
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  service_code text not null,
  created_at timestamptz not null default now(),

  primary key (project_id, service_code),
  constraint chk_portfolio_project_services_code check (service_code in ('complete_home_interiors', 'modular_kitchens', 'custom_wardrobes'))
);

comment on table public.portfolio_project_services is 'Services associated with portfolio projects.';

create index idx_portfolio_project_services_code on public.portfolio_project_services (service_code);

-- 2.3 portfolio_media
create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  public_bucket text not null default 'portfolio-public',
  public_object_path text,
  media_role text not null default 'gallery',
  status text not null default 'draft',
  alt_text text not null,
  caption text,
  width_px integer,
  height_px integer,
  file_size_bytes bigint,
  mime_type text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_portfolio_media_bucket check (public_bucket = 'portfolio-public'),
  constraint chk_portfolio_media_role check (media_role in ('cover', 'gallery')),
  constraint chk_portfolio_media_status check (status in ('draft', 'ready', 'retired')),
  constraint chk_portfolio_media_ready_requirements check (
    (status = 'ready' and public_object_path is not null and width_px is not null and height_px is not null and file_size_bytes is not null and mime_type is not null)
    or (status <> 'ready')
  ),
  constraint chk_portfolio_media_public_object_path check (
    public_object_path is null or (
      public_object_path !~ '^/' and
      public_object_path !~ '\.\.' and
      public_object_path !~ '\\' and
      public_object_path !~ '\?'
    )
  ),
  constraint chk_portfolio_media_mime_type check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint chk_portfolio_media_dimensions check ((width_px is null and height_px is null) or (width_px > 0 and width_px <= 12000 and height_px > 0 and height_px <= 12000)),
  constraint chk_portfolio_media_file_size check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 8388608)),
  constraint chk_portfolio_media_alt_text check (length(trim(alt_text)) between 5 and 180),
  constraint chk_portfolio_media_caption check (caption is null or length(caption) <= 500),
  constraint chk_portfolio_media_sort_order check (sort_order >= 0)
);

comment on table public.portfolio_media is 'Public web-ready derivative media metadata.';

create unique index idx_portfolio_media_public_path on public.portfolio_media (public_object_path) where public_object_path is not null;
create unique index idx_portfolio_media_single_cover on public.portfolio_media (project_id) where (media_role = 'cover' and status <> 'retired');
create index idx_portfolio_media_project_status_sort on public.portfolio_media (project_id, status, sort_order);
create index idx_portfolio_media_created_by on public.portfolio_media (created_by);
create index idx_portfolio_media_updated_by on public.portfolio_media (updated_by);

-- 2.4 portfolio_media_sources
create table public.portfolio_media_sources (
  media_id uuid primary key references public.portfolio_media(id) on delete cascade,
  original_bucket text not null default 'portfolio-originals',
  original_object_path text not null unique,
  original_file_name text,
  original_mime_type text not null,
  original_file_size_bytes bigint not null,
  checksum_sha256 text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),

  constraint chk_portfolio_media_sources_bucket check (original_bucket = 'portfolio-originals'),
  constraint chk_portfolio_media_sources_path check (
    original_object_path !~ '^/' and
    original_object_path !~ '\.\.' and
    original_object_path !~ '\\' and
    original_object_path !~ '\?'
  ),
  constraint chk_portfolio_media_sources_mime check (original_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint chk_portfolio_media_sources_size check (original_file_size_bytes > 0 and original_file_size_bytes <= 20971520),
  constraint chk_portfolio_media_sources_file_name check (original_file_name is null or length(original_file_name) <= 255),
  constraint chk_portfolio_media_sources_checksum check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$')
);

comment on table public.portfolio_media_sources is 'Private original photographs metadata.';

create index idx_portfolio_media_sources_uploaded_by on public.portfolio_media_sources (uploaded_by);

-- 3. Updated At Triggers
create trigger trg_portfolio_projects_updated_at
  before update on public.portfolio_projects
  for each row execute function private.set_updated_at();

create trigger trg_portfolio_media_updated_at
  before update on public.portfolio_media
  for each row execute function private.set_updated_at();

-- 4. Storage Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('portfolio-originals', 'portfolio-originals', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio-public', 'portfolio-public', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 5. Row Level Security & Privileges

alter table public.portfolio_projects enable row level security;
alter table public.portfolio_project_services enable row level security;
alter table public.portfolio_media enable row level security;
alter table public.portfolio_media_sources enable row level security;

-- Revoke all table privileges from public, anon, authenticated
revoke all on table public.portfolio_projects, public.portfolio_project_services, public.portfolio_media, public.portfolio_media_sources from public, anon, authenticated;

-- Explicit Table Grants
grant select on table public.portfolio_projects, public.portfolio_project_services, public.portfolio_media to public, anon, authenticated;
grant insert, update, delete on table public.portfolio_projects, public.portfolio_project_services, public.portfolio_media to authenticated;
grant select, insert, update, delete on table public.portfolio_media_sources to authenticated;

-- 5.1 portfolio_projects RLS Policies
create policy "Public read published portfolio projects"
  on public.portfolio_projects for select to public
  using (status = 'published');

create policy "Staff read all portfolio projects"
  on public.portfolio_projects for select to authenticated
  using (public.authorize('portfolio.read') or public.authorize('portfolio.manage'));

create policy "Staff insert portfolio projects"
  on public.portfolio_projects for insert to authenticated
  with check (public.authorize('portfolio.manage') and created_by = auth.uid() and updated_by = auth.uid());

create policy "Staff update portfolio projects"
  on public.portfolio_projects for update to authenticated
  using (public.authorize('portfolio.manage'))
  with check (public.authorize('portfolio.manage') and updated_by = auth.uid());

create policy "Staff delete portfolio projects"
  on public.portfolio_projects for delete to authenticated
  using (public.authorize('portfolio.manage'));

-- 5.2 portfolio_project_services RLS Policies
create policy "Public read published project services"
  on public.portfolio_project_services for select to public
  using (exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published'));

create policy "Staff read all project services"
  on public.portfolio_project_services for select to authenticated
  using (public.authorize('portfolio.read') or public.authorize('portfolio.manage'));

create policy "Staff insert project services"
  on public.portfolio_project_services for insert to authenticated
  with check (public.authorize('portfolio.manage'));

create policy "Staff delete project services"
  on public.portfolio_project_services for delete to authenticated
  using (public.authorize('portfolio.manage'));

-- 5.3 portfolio_media RLS Policies
create policy "Public read ready published portfolio media"
  on public.portfolio_media for select to public
  using (status = 'ready' and exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published'));

create policy "Staff read all portfolio media"
  on public.portfolio_media for select to authenticated
  using (public.authorize('portfolio.read') or public.authorize('portfolio.manage'));

create policy "Staff insert portfolio media"
  on public.portfolio_media for insert to authenticated
  with check (public.authorize('portfolio.manage') and created_by = auth.uid() and updated_by = auth.uid());

create policy "Staff update portfolio media"
  on public.portfolio_media for update to authenticated
  using (public.authorize('portfolio.manage'))
  with check (public.authorize('portfolio.manage') and updated_by = auth.uid());

create policy "Staff delete portfolio media"
  on public.portfolio_media for delete to authenticated
  using (public.authorize('portfolio.manage'));

-- 5.4 portfolio_media_sources RLS Policies
create policy "Staff read portfolio media sources"
  on public.portfolio_media_sources for select to authenticated
  using (public.authorize('portfolio.manage'));

create policy "Staff insert portfolio media sources"
  on public.portfolio_media_sources for insert to authenticated
  with check (public.authorize('portfolio.manage') and uploaded_by = auth.uid());

create policy "Staff update portfolio media sources"
  on public.portfolio_media_sources for update to authenticated
  using (public.authorize('portfolio.manage'))
  with check (public.authorize('portfolio.manage'));

create policy "Staff delete portfolio media sources"
  on public.portfolio_media_sources for delete to authenticated
  using (public.authorize('portfolio.manage'));

-- 6. Storage RLS Policies on storage.objects

create policy "Staff select portfolio originals"
  on storage.objects for select to authenticated
  using (bucket_id = 'portfolio-originals' and public.authorize('portfolio.manage'));

create policy "Staff insert portfolio originals"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-originals' and public.authorize('portfolio.manage'));

create policy "Staff update portfolio originals"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-originals' and public.authorize('portfolio.manage'))
  with check (bucket_id = 'portfolio-originals' and public.authorize('portfolio.manage'));

create policy "Staff delete portfolio originals"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-originals' and public.authorize('portfolio.manage'));

create policy "Staff insert portfolio public"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-public' and public.authorize('portfolio.manage'));

create policy "Staff update portfolio public"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-public' and public.authorize('portfolio.manage'))
  with check (bucket_id = 'portfolio-public' and public.authorize('portfolio.manage'));

create policy "Staff delete portfolio public"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-public' and public.authorize('portfolio.manage'));
