-- ONEDECORE Phase 2D2 Active-Staff Authorization Hardening Migration
-- Enforces public.profiles.status = 'active' requirement in private.has_role() and private.has_permission()

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
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = v_user_id
      and r.code = trim(requested_role)
      and r.is_active = true
      and p.status = 'active'
  );
end;
$$;
comment on function private.has_role(text)
is 'Checks if current authenticated user with an active profile holds an active role code.';

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
    join public.profiles prof on prof.id = ur.user_id
    where ur.user_id = v_user_id
      and p.code = trim(requested_permission)
      and r.is_active = true
      and p.is_active = true
      and prof.status = 'active'
  );
end;
$$;
comment on function private.has_permission(text)
is 'Checks if current authenticated user with an active profile possesses a specific active permission code.';

revoke execute on function private.has_role(text) from public, anon;
revoke execute on function private.has_permission(text) from public, anon;

grant execute on function private.has_role(text) to authenticated;
grant execute on function private.has_permission(text) to authenticated;
