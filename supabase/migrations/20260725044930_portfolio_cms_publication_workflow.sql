-- ONEDECORE Phase 2E2 Portfolio CMS Publication Workflow Migration

-- 1. Revoke direct authenticated UPDATE on status and published_at columns
revoke update (status, published_at) on public.portfolio_projects from authenticated;

-- 2. Status Management RPC: set_portfolio_project_status
-- Security Definer required because direct update on status/published_at is revoked from authenticated
create or replace function public.set_portfolio_project_status(
  requested_project_id uuid,
  requested_status text
)
returns public.portfolio_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.portfolio_projects;
  v_service_count integer;
  v_ready_cover_count integer;
begin
  -- 1. Authorization check
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio project status' using errcode = '42501';
  end if;

  -- 2. Lock project row
  select * into v_project
  from public.portfolio_projects
  where id = requested_project_id
  for update;

  if not found then
    raise exception 'Portfolio project not found' using errcode = 'P0002';
  end if;

  -- 3. Validate status parameter
  if requested_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid project status value: %', requested_status using errcode = '23514';
  end if;

  -- 4. Publication prerequisites check
  if requested_status = 'published' then
    select count(*) into v_service_count
    from public.portfolio_project_services
    where project_id = requested_project_id;

    if v_service_count < 1 then
      raise exception 'Cannot publish project without assigned service' using errcode = '22000';
    end if;

    select count(*) into v_ready_cover_count
    from public.portfolio_media
    where project_id = requested_project_id
      and media_role = 'cover'
      and status = 'ready'
      and public_object_path is not null;

    if v_ready_cover_count < 1 then
      raise exception 'Cannot publish project without ready cover image' using errcode = '22000';
    end if;

    update public.portfolio_projects
    set status = 'published',
        published_at = coalesce(published_at, now()),
        updated_by = (select auth.uid())
    where id = requested_project_id
    returning * into v_project;
  else
    -- Returning to draft or archiving
    update public.portfolio_projects
    set status = requested_status,
        published_at = null,
        is_featured = false,
        updated_by = (select auth.uid())
    where id = requested_project_id
    returning * into v_project;
  end if;

  return v_project;
end;
$$;

revoke execute on function public.set_portfolio_project_status(uuid, text) from public, anon;
grant execute on function public.set_portfolio_project_status(uuid, text) to authenticated;

-- 3. Atomic Service Replacement RPC: replace_portfolio_project_services
create or replace function public.replace_portfolio_project_services(
  requested_project_id uuid,
  requested_service_codes text[]
)
returns setof public.portfolio_project_services
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text;
begin
  -- 1. Authorization check
  if not (select public.authorize('portfolio.manage')) then
    raise exception 'Permission denied to manage portfolio project services' using errcode = '42501';
  end if;

  -- 2. Lock project row
  perform 1
  from public.portfolio_projects
  where id = requested_project_id
  for update;

  if not found then
    raise exception 'Portfolio project not found' using errcode = 'P0002';
  end if;

  -- 3. Validate service code array
  if requested_service_codes is null or array_length(requested_service_codes, 1) is null or array_length(requested_service_codes, 1) < 1 or array_length(requested_service_codes, 1) > 3 then
    raise exception 'Project must have between 1 and 3 assigned services' using errcode = '22000';
  end if;

  foreach v_code in array requested_service_codes loop
    if v_code not in ('complete_home_interiors', 'modular_kitchens', 'custom_wardrobes') then
      raise exception 'Invalid service code: %', v_code using errcode = '23514';
    end if;
  end loop;

  -- 4. Insert new services first
  insert into public.portfolio_project_services (project_id, service_code)
  select requested_project_id, unnest(requested_service_codes)
  on conflict (project_id, service_code) do nothing;

  -- 5. Delete removed services
  delete from public.portfolio_project_services
  where project_id = requested_project_id
    and service_code not in (select unnest(requested_service_codes));

  return query
  select *
  from public.portfolio_project_services
  where project_id = requested_project_id;
end;
$$;

revoke execute on function public.replace_portfolio_project_services(uuid, text[]) from public, anon;
grant execute on function public.replace_portfolio_project_services(uuid, text[]) to authenticated;

-- 4. Published-Cover Guard Trigger
create or replace function private.prevent_published_cover_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_status text;
begin
  -- Check if old media was a ready cover
  if OLD.media_role = 'cover' and OLD.status = 'ready' then
    select status into v_project_status
    from public.portfolio_projects
    where id = OLD.project_id;

    if v_project_status = 'published' then
      if TG_OP = 'DELETE' then
        raise exception 'Cannot remove ready cover image of a published project. Return project to draft first.' using errcode = '22000';
      elsif TG_OP = 'UPDATE' then
        if NEW.media_role <> 'cover' or NEW.status <> 'ready' or NEW.public_object_path is null or NEW.project_id <> OLD.project_id then
          raise exception 'Cannot mutate ready cover image of a published project. Return project to draft first.' using errcode = '22000';
        end if;
      end if;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger trg_prevent_published_cover_mutation
  before update or delete on public.portfolio_media
  for each row execute function private.prevent_published_cover_mutation();

-- 5. Published-Service Guard Trigger
create or replace function private.prevent_published_service_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_status text;
  v_remaining_count integer;
begin
  select status into v_project_status
  from public.portfolio_projects
  where id = OLD.project_id;

  if v_project_status = 'published' then
    select count(*) into v_remaining_count
    from public.portfolio_project_services
    where project_id = OLD.project_id
      and service_code <> OLD.service_code;

    if v_remaining_count < 1 then
      raise exception 'Cannot remove final service from a published project.' using errcode = '22000';
    end if;
  end if;

  return OLD;
end;
$$;

create trigger trg_prevent_published_service_deletion
  before delete on public.portfolio_project_services
  for each row execute function private.prevent_published_service_deletion();
