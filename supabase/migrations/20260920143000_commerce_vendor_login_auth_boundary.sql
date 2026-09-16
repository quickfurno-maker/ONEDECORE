-- Separate external commerce-vendor authorization from staff profile authorization.
-- Vendor Auth users are provisioned with a pending profile by the generic auth trigger;
-- vendor access is governed by the dedicated vendor role plus commerce_vendors.status.

create or replace function private.current_commerce_vendor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_vendor_id uuid;
begin
  if v_user_id is null then return null; end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = v_user_id
      and r.code = 'commerce_vendor'
      and p.code = 'commerce.vendor.access'
      and r.is_active = true
      and p.is_active = true
  ) then return null; end if;

  select v.id into v_vendor_id
  from public.commerce_vendors v
  where v.user_id = v_user_id
    and v.status = 'active';

  return v_vendor_id;
end;
$$;

revoke all on function private.current_commerce_vendor_id() from public, anon;
grant execute on function private.current_commerce_vendor_id() to authenticated;

comment on function private.current_commerce_vendor_id() is
  'Resolves active external commerce vendors from their dedicated role and vendor status; intentionally independent of staff profile activation.';
