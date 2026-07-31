-- ONEDECORE Phase 5C1 — CRM workspace access foundation (local only)
-- Grants portal access to canonical sales roles and exposes a narrow assignee directory RPC.

-- A. Portal access for canonical sales roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and r.code in ('sales_manager', 'sales_executive')
  and p.code = 'admin.access'
on conflict (role_id, permission_id) do nothing;

-- B. Safe CRM assignee directory (no profiles RLS relaxation)
create or replace function private.list_crm_assignable_executives_impl()
returns table (
  user_id uuid,
  display_name text,
  role_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select private.crm_has_broad_lead_read()) then
    raise exception 'Permission denied to list CRM assignable executives'
      using errcode = '42501';
  end if;

  return query
  select eligible.user_id, eligible.display_name, eligible.role_code
  from (
    select distinct on (pr.id)
      pr.id as user_id,
      coalesce(nullif(trim(pr.display_name), ''), 'Staff member')::text as display_name,
      r.code::text as role_code
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where pr.status = 'active'
      and r.is_active = true
      and r.code in ('sales_executive', 'sales')
    order by pr.id, r.code
  ) eligible
  order by eligible.display_name, eligible.user_id;
end;
$$;

create or replace function public.list_crm_assignable_executives()
returns table (
  user_id uuid,
  display_name text,
  role_code text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query select * from private.list_crm_assignable_executives_impl();
end;
$$;

alter function private.list_crm_assignable_executives_impl() owner to postgres;
alter function public.list_crm_assignable_executives() owner to postgres;

revoke all on function private.list_crm_assignable_executives_impl() from public, anon;
grant execute on function private.list_crm_assignable_executives_impl() to authenticated;

revoke all on function public.list_crm_assignable_executives() from public, anon;
grant execute on function public.list_crm_assignable_executives() to authenticated;
