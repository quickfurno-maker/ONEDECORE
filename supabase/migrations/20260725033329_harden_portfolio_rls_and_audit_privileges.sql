-- ONEDECORE Phase 2E1A Portfolio RLS, Audit Privilege & Auth Hardening Migration

-- 1. Revoke Broad Application-Table Privileges
revoke all on table public.portfolio_projects from public, anon, authenticated;
revoke all on table public.portfolio_project_services from public, anon, authenticated;
revoke all on table public.portfolio_media from public, anon, authenticated;
revoke all on table public.portfolio_media_sources from public, anon, authenticated;

-- 2. Regrant SELECT Privileges Explicitly
grant select on table public.portfolio_projects, public.portfolio_project_services, public.portfolio_media to anon, authenticated;
grant select on table public.portfolio_media_sources to authenticated;

-- 3. Regrant DELETE Privileges Narrowly
grant delete on table public.portfolio_projects, public.portfolio_project_services, public.portfolio_media, public.portfolio_media_sources to authenticated;

-- 4. Column-Level INSERT Privileges
grant insert (
  id, slug, title, summary, description, location_label, property_type,
  completion_year, status, is_featured, sort_order, seo_title, seo_description,
  published_at, created_by, updated_by
) on table public.portfolio_projects to authenticated;

grant insert (project_id, service_code) on table public.portfolio_project_services to authenticated;

grant insert (
  id, project_id, public_bucket, public_object_path, media_role, status,
  alt_text, caption, width_px, height_px, file_size_bytes, mime_type,
  sort_order, created_by, updated_by
) on table public.portfolio_media to authenticated;

grant insert (
  media_id, original_bucket, original_object_path, original_file_name,
  original_mime_type, original_file_size_bytes, checksum_sha256, uploaded_by
) on table public.portfolio_media_sources to authenticated;

-- 5. Column-Level UPDATE Privileges (Immutable audit/identity fields excluded)
grant update (
  slug, title, summary, description, location_label, property_type,
  completion_year, status, is_featured, sort_order, seo_title, seo_description,
  published_at, updated_by
) on table public.portfolio_projects to authenticated;

-- portfolio_project_services has NO update privilege granted (uses DELETE + INSERT)

grant update (
  project_id, public_bucket, public_object_path, media_role, status,
  alt_text, caption, width_px, height_px, file_size_bytes, mime_type,
  sort_order, updated_by
) on table public.portfolio_media to authenticated;

grant update (
  original_bucket, original_object_path, original_file_name, original_mime_type,
  original_file_size_bytes, checksum_sha256
) on table public.portfolio_media_sources to authenticated;

-- 6. Drop Existing Portfolio Table RLS Policies
drop policy if exists "Public read published portfolio projects" on public.portfolio_projects;
drop policy if exists "Staff read all portfolio projects" on public.portfolio_projects;
drop policy if exists "Staff insert portfolio projects" on public.portfolio_projects;
drop policy if exists "Staff update portfolio projects" on public.portfolio_projects;
drop policy if exists "Staff delete portfolio projects" on public.portfolio_projects;

drop policy if exists "Public read published project services" on public.portfolio_project_services;
drop policy if exists "Staff read all project services" on public.portfolio_project_services;
drop policy if exists "Staff insert project services" on public.portfolio_project_services;
drop policy if exists "Staff delete project services" on public.portfolio_project_services;

drop policy if exists "Public read ready published portfolio media" on public.portfolio_media;
drop policy if exists "Staff read all portfolio media" on public.portfolio_media;
drop policy if exists "Staff insert portfolio media" on public.portfolio_media;
drop policy if exists "Staff update portfolio media" on public.portfolio_media;
drop policy if exists "Staff delete portfolio media" on public.portfolio_media;

drop policy if exists "Staff read portfolio media sources" on public.portfolio_media_sources;
drop policy if exists "Staff insert portfolio media sources" on public.portfolio_media_sources;
drop policy if exists "Staff update portfolio media sources" on public.portfolio_media_sources;
drop policy if exists "Staff delete portfolio media sources" on public.portfolio_media_sources;

-- 7. Rebuild Consolidated Portfolio Table RLS Policies

-- 7.1 portfolio_projects
create policy "Anon select published portfolio projects"
  on public.portfolio_projects for select to anon
  using (status = 'published');

create policy "Authenticated select portfolio projects"
  on public.portfolio_projects for select to authenticated
  using (
    status = 'published'
    or (select public.authorize('portfolio.read'))
    or (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert portfolio projects"
  on public.portfolio_projects for insert to authenticated
  with check (
    (select public.authorize('portfolio.manage'))
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy "Staff update portfolio projects"
  on public.portfolio_projects for update to authenticated
  using ((select public.authorize('portfolio.manage')))
  with check (
    (select public.authorize('portfolio.manage'))
    and updated_by = (select auth.uid())
  );

create policy "Staff delete portfolio projects"
  on public.portfolio_projects for delete to authenticated
  using ((select public.authorize('portfolio.manage')));

-- 7.2 portfolio_project_services
create policy "Anon select published project services"
  on public.portfolio_project_services for select to anon
  using (
    exists (
      select 1
      from public.portfolio_projects p
      where p.id = portfolio_project_services.project_id
        and p.status = 'published'
    )
  );

create policy "Authenticated select project services"
  on public.portfolio_project_services for select to authenticated
  using (
    exists (
      select 1
      from public.portfolio_projects p
      where p.id = portfolio_project_services.project_id
        and p.status = 'published'
    )
    or (select public.authorize('portfolio.read'))
    or (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert project services"
  on public.portfolio_project_services for insert to authenticated
  with check ((select public.authorize('portfolio.manage')));

create policy "Staff delete project services"
  on public.portfolio_project_services for delete to authenticated
  using ((select public.authorize('portfolio.manage')));

-- 7.3 portfolio_media
create policy "Anon select ready published portfolio media"
  on public.portfolio_media for select to anon
  using (
    status = 'ready'
    and exists (
      select 1
      from public.portfolio_projects p
      where p.id = portfolio_media.project_id
        and p.status = 'published'
    )
  );

create policy "Authenticated select portfolio media"
  on public.portfolio_media for select to authenticated
  using (
    (
      status = 'ready'
      and exists (
        select 1
        from public.portfolio_projects p
        where p.id = portfolio_media.project_id
          and p.status = 'published'
      )
    )
    or (select public.authorize('portfolio.read'))
    or (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert portfolio media"
  on public.portfolio_media for insert to authenticated
  with check (
    (select public.authorize('portfolio.manage'))
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy "Staff update portfolio media"
  on public.portfolio_media for update to authenticated
  using ((select public.authorize('portfolio.manage')))
  with check (
    (select public.authorize('portfolio.manage'))
    and updated_by = (select auth.uid())
  );

create policy "Staff delete portfolio media"
  on public.portfolio_media for delete to authenticated
  using ((select public.authorize('portfolio.manage')));

-- 7.4 portfolio_media_sources
create policy "Staff select portfolio media sources"
  on public.portfolio_media_sources for select to authenticated
  using ((select public.authorize('portfolio.manage')));

create policy "Staff insert portfolio media sources"
  on public.portfolio_media_sources for insert to authenticated
  with check (
    (select public.authorize('portfolio.manage'))
    and uploaded_by = (select auth.uid())
  );

create policy "Staff update portfolio media sources"
  on public.portfolio_media_sources for update to authenticated
  using ((select public.authorize('portfolio.manage')))
  with check ((select public.authorize('portfolio.manage')));

create policy "Staff delete portfolio media sources"
  on public.portfolio_media_sources for delete to authenticated
  using ((select public.authorize('portfolio.manage')));

-- 8. Rebuild Storage RLS Policies on storage.objects
drop policy if exists "Staff select portfolio originals" on storage.objects;
drop policy if exists "Staff insert portfolio originals" on storage.objects;
drop policy if exists "Staff update portfolio originals" on storage.objects;
drop policy if exists "Staff delete portfolio originals" on storage.objects;

drop policy if exists "Staff insert portfolio public" on storage.objects;
drop policy if exists "Staff update portfolio public" on storage.objects;
drop policy if exists "Staff delete portfolio public" on storage.objects;

create policy "Staff select portfolio originals"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portfolio-originals'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert portfolio originals"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-originals'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff update portfolio originals"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio-originals'
    and (select public.authorize('portfolio.manage'))
  )
  with check (
    bucket_id = 'portfolio-originals'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff delete portfolio originals"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-originals'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff insert portfolio public"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-public'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff update portfolio public"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio-public'
    and (select public.authorize('portfolio.manage'))
  )
  with check (
    bucket_id = 'portfolio-public'
    and (select public.authorize('portfolio.manage'))
  );

create policy "Staff delete portfolio public"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-public'
    and (select public.authorize('portfolio.manage'))
  );
