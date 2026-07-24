-- ONEDECORE Phase 2C1 Identity & RBAC Foundation Hardened Migration
-- Description: Establishes private security schema, public profiles, roles, permissions, role_permissions, user_roles, RLS policies, column-level grants, system RBAC protection, and metadata normalization triggers.

-- 1. Private Security Schema
create schema private;
comment on schema private is 'Private internal schema for security functions and triggers; not exposed via PostgREST API.';

-- 2. Public Application Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null constraint profiles_display_name_length check (display_name is null or length(trim(display_name)) between 1 and 120),
  phone_e164 text null constraint profiles_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9]\d{1,14}$'),
  status text not null default 'pending' constraint profiles_status_check check (status in ('pending', 'active', 'suspended', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Staff profiles associated 1:1 with auth.users.';

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique constraint roles_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.roles is 'System and custom RBAC roles.';

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_.]*$'),
  name text not null,
  description text null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.permissions is 'Granular application feature permissions.';

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
comment on table public.role_permissions is 'Mapping between roles and granted permissions.';

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by uuid null default auth.uid() references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
comment on table public.user_roles is 'Mapping between users and assigned active roles.';

-- 3. Indexes
create index idx_user_roles_role_id on public.user_roles(role_id);
create index idx_role_permissions_permission_id on public.role_permissions(permission_id);

-- 4. Triggers & Private Helper Functions
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
comment on function private.set_updated_at() is 'Auto-updates updated_at timestamp on record modification.';

create trigger tr_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger tr_roles_updated_at
  before update on public.roles
  for each row execute function private.set_updated_at();

create trigger tr_permissions_updated_at
  before update on public.permissions
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_name text;
  v_norm_name text;
begin
  v_raw_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
  if v_raw_name is not null then
    v_norm_name := left(v_raw_name, 120);
  else
    v_norm_name := null;
  end if;

  insert into public.profiles (id, display_name, status)
  values (new.id, v_norm_name, 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;
comment on function private.handle_new_auth_user() is 'Automatically creates a profile entry when a new user is inserted into auth.users.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Backfill profiles for pre-existing auth users with normalized metadata
insert into public.profiles (id, display_name, status)
select
  id,
  case
    when coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), nullif(trim(raw_user_meta_data->>'name'), '')) is not null
    then left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), nullif(trim(raw_user_meta_data->>'name'), '')), 120)
    else null
  end,
  'pending'
from auth.users
on conflict (id) do nothing;

create or replace function private.has_role(requested_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null or requested_role is null or trim(requested_role) = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_user_id
      and r.code = trim(requested_role)
      and r.is_active = true
  );
end;
$$;
comment on function private.has_role(text) is 'Checks if current authenticated user holds an active role code.';

create or replace function private.has_permission(requested_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null or requested_permission is null or trim(requested_permission) = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = v_user_id
      and p.code = trim(requested_permission)
      and r.is_active = true
      and p.is_active = true
  );
end;
$$;
comment on function private.has_permission(text) is 'Checks if current authenticated user possesses a specific permission code.';

-- Function execution grants and schema revokes
revoke all on schema private from public;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function private.has_role(text) from public, anon;
revoke execute on function private.has_permission(text) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- 5. Seed Foundation System Roles & System Permissions
insert into public.roles (code, name, description, is_system) values
  ('super_admin', 'Super Admin', 'Full system administration access', true),
  ('management', 'Management', 'Broad operational and reporting access', true),
  ('sales', 'Sales Specialist', 'Lead management and sales operations', true),
  ('designer', 'Interior Designer', 'Design project collaboration and quote contribution', true),
  ('project_operations', 'Project Operations', 'Site execution and project handoff management', true),
  ('content_manager', 'Content Manager', 'Portfolio CMS and marketing content management', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true;

insert into public.permissions (code, name, description, is_system) values
  ('admin.access', 'Access Admin Portal', 'Allows login access to internal /admin CRM portal', true),
  ('users.read', 'Read Staff Users', 'Allows viewing staff profiles and assignments', true),
  ('users.manage', 'Manage Staff Users', 'Allows editing staff profiles and statuses', true),
  ('roles.read', 'Read Roles & Permissions', 'Allows viewing role definitions and permission matrices', true),
  ('roles.manage', 'Manage Roles & Permissions', 'Allows editing role definitions and assigning roles to users', true),
  ('audit.read', 'Read Audit Logs', 'Allows viewing system audit logs', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where (r.code = 'super_admin')
   or (r.code = 'management' and p.code in ('admin.access', 'users.read', 'roles.read', 'audit.read'))
   or (r.code in ('sales', 'designer', 'project_operations', 'content_manager') and p.code = 'admin.access')
on conflict (role_id, permission_id) do nothing;

-- 6. Row Level Security & Column-Level Privileges
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Explicitly revoke all privileges from public, anon, authenticated before least-privilege grants
revoke all on table public.profiles, public.roles, public.permissions, public.role_permissions, public.user_roles from public, anon, authenticated;

-- Explicit column-level and table-level grants to authenticated
grant select on table public.profiles to authenticated;
grant update (display_name, phone_e164, status) on table public.profiles to authenticated;

grant select on table public.roles to authenticated;
grant insert (code, name, description, is_active) on table public.roles to authenticated;
grant update (name, description, is_active) on table public.roles to authenticated;

grant select on table public.permissions to authenticated;
grant insert (code, name, description, is_active) on table public.permissions to authenticated;
grant update (name, description, is_active) on table public.permissions to authenticated;

grant select, insert, delete on table public.role_permissions to authenticated;

grant select, delete on table public.user_roles to authenticated;
grant insert (user_id, role_id) on table public.user_roles to authenticated;

-- RLS Policies
create policy "profiles_select_policy" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.has_permission('users.read'));

create policy "profiles_update_policy" on public.profiles
  for update to authenticated
  using (private.has_permission('users.manage'))
  with check (private.has_permission('users.manage'));

create policy "roles_select_policy" on public.roles
  for select to authenticated
  using (private.has_permission('roles.read') or private.has_permission('roles.manage'));

create policy "roles_insert_policy" on public.roles
  for insert to authenticated
  with check (private.has_permission('roles.manage') and is_system = false);

create policy "roles_update_policy" on public.roles
  for update to authenticated
  using (private.has_permission('roles.manage') and is_system = false)
  with check (private.has_permission('roles.manage') and is_system = false);

create policy "permissions_select_policy" on public.permissions
  for select to authenticated
  using (private.has_permission('roles.read') or private.has_permission('roles.manage'));

create policy "permissions_insert_policy" on public.permissions
  for insert to authenticated
  with check (private.has_permission('roles.manage') and is_system = false);

create policy "permissions_update_policy" on public.permissions
  for update to authenticated
  using (private.has_permission('roles.manage') and is_system = false)
  with check (private.has_permission('roles.manage') and is_system = false);

create policy "role_permissions_select_policy" on public.role_permissions
  for select to authenticated
  using (private.has_permission('roles.read') or private.has_permission('roles.manage'));

create policy "role_permissions_insert_policy" on public.role_permissions
  for insert to authenticated
  with check (
    private.has_permission('roles.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_id and r.is_system = false
    )
  );

create policy "role_permissions_delete_policy" on public.role_permissions
  for delete to authenticated
  using (
    private.has_permission('roles.manage')
    and exists (
      select 1 from public.roles r
      where r.id = role_id and r.is_system = false
    )
  );

create policy "user_roles_select_policy" on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_permission('users.read')
    or private.has_permission('roles.read')
    or private.has_permission('roles.manage')
  );

create policy "user_roles_insert_policy" on public.user_roles
  for insert to authenticated
  with check (
    private.has_permission('roles.manage')
    and assigned_by = (select auth.uid())
  );

create policy "user_roles_delete_policy" on public.user_roles
  for delete to authenticated
  using (private.has_permission('roles.manage'));
