-- ONEDECORE — Sales Manager control plane hardening
--
-- WHAT THIS CORRECTS
--
-- The Sales Manager role accumulated authority one feature at a time. Each
-- migration that introduced a control plane granted it to `sales_manager`
-- alongside `super_admin`, because at the time "manager" was the nearest thing
-- to a second administrator. The result is a role that can approve campaigns,
-- publish landing pages, manage the storefront, bulk-import enquiries, override
-- duplicate protection, assign Project Managers, staff designers and cancel
-- project execution.
--
-- The owner-locked role model is narrower: SALES MANAGER means authority over
-- the SALES TEAM, not a second owner. The role code stays `sales_manager`
-- precisely so ONEDECORE can later add Project Manager, Design Manager and
-- Operations Manager without collapsing them into a generic "manager".
--
-- WHY THIS IS A DATABASE CHANGE AND NOT A UI CHANGE
--
-- Every surface removed here is reachable by a direct URL, a server action, a
-- mobile API route or an RPC. Hiding a sidebar link would leave all of those
-- open. Authority is removed where it is actually decided — the grant — so the
-- navigation disappears as a CONSEQUENCE of the permission, which is how the
-- existing `resolveOpsNavFlags` already derives it.
--
-- TWO NEW PERMISSIONS
--
--   leads.delete             Super Admin only. Deleting an enquiry is an owner
--                            action, permanently separate from marking one
--                            CLOSED LOST — see the note below.
--   projects.read_high_level Sales Manager's sales-visibility read on projects,
--                            replacing the broad `projects.read` that carried
--                            the full project workspace with it.
--
-- CLOSED LOST IS NOT DELETE
--
-- `leads.transition` is deliberately UNTOUCHED for sales_manager and
-- sales_executive. Marking an enquiry CLOSED LOST is an ordinary CRM lifecycle
-- transition that the sales team owns, it requires a reason and a note, and it
-- keeps the lead in CRM history. Deleting an enquiry is a different act with a
-- different authority, and this migration is where the two stop sharing one.

begin;

-- -----------------------------------------------------------------------------
-- A. New permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (code, name, description, is_active, is_system)
values
  (
    'leads.delete',
    'Delete enquiry',
    'Remove an enquiry from operational surfaces as an audit-preserving tombstone. Super Admin only, and never the same authority as marking an enquiry closed lost.',
    true,
    true
  ),
  (
    'projects.read_high_level',
    'Read project status (high level)',
    'Sales visibility of a project: identity, client, current stage, assigned Project Manager and dates. Carries no project execution or design workspace authority.',
    true,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  is_system = true;

-- -----------------------------------------------------------------------------
-- B. Grants for the new permissions
-- -----------------------------------------------------------------------------

-- Deleting an enquiry is the owner's alone. This is asserted negatively in the
-- test suite for EVERY other role, not merely granted positively here.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code = 'leads.delete'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('super_admin', 'sales_manager')
  and p.code = 'projects.read_high_level'
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- C. Revocations — Sales Manager
-- -----------------------------------------------------------------------------
--
-- One statement, one list. A revocation spread across several statements is a
-- revocation that can be half-applied by a later edit.
--
-- The commerce control-plane codes that sales_manager was never granted
-- (catalog/inventory/settings) are listed too. They cost nothing to delete and
-- they make the intent explicit: this role has NO commerce authority, not
-- "whichever commerce authority it happened to be given".

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'sales_manager'
  and p.code in (
    -- Campaigns and marketing: not a sales-team authority.
    'campaigns.read',
    'campaigns.draft',
    'campaigns.request_approval',
    'campaigns.approve',
    'campaigns.execute',
    'campaigns.pause',
    'campaigns.metrics.read',
    'marketing_consents.manage',
    -- Landing Lab: publishing public pages is an owner act.
    'landing_pages.read',
    'landing_pages.manage',
    'landing_pages.publish',
    'landing_experiments.manage',
    'landing_analytics.read',
    -- Bulk enquiry import: only the owner may load enquiries in bulk.
    'leads.bulk_import',
    -- Duplicate protection exists to stop the same customer being worked twice.
    -- A manager may SEE that a duplicate exists and open the existing enquiry;
    -- forcing a second one past that protection is the owner's call.
    'leads.duplicate_override',
    -- Commerce: no storefront control plane in this role.
    'commerce.read',
    'commerce.orders.manage',
    'commerce.payments.read',
    'commerce.catalog.manage',
    'commerce.inventory.manage',
    'commerce.settings.manage',
    -- Project execution and design: the manager sees status, not the workspace.
    'projects.read',
    'projects.assign_pm',
    'project_design.read',
    'project_design.staff',
    'project_execution.read',
    'project_execution.cancel'
  );

-- -----------------------------------------------------------------------------
-- D. Revocation — legacy `management`
-- -----------------------------------------------------------------------------
--
-- The legacy role mirrors Sales Manager breadth and is retained only for
-- existing assignments. Bulk import is Super Admin only, so it goes here too or
-- the restriction is one role assignment away from being meaningless.

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'management'
  and p.code = 'leads.bulk_import';

-- -----------------------------------------------------------------------------
-- E. Project visibility — high level for the manager, workspace for the rest
-- -----------------------------------------------------------------------------
--
-- `private.project_can_view` gates three tables: `projects`,
-- `project_manager_assignments` and `project_events`. Its sales_manager branch
-- was keyed on `projects.read`, which this migration removes from the role — so
-- without the rewrite below a manager would simply lose project visibility
-- entirely rather than keep the sales-status read the owner asked for.
--
-- The branch is therefore re-keyed to `projects.read_high_level`. The other
-- branches are untouched: Super Admin, the crediting Sales Executive, the
-- primary Project Manager and the currently assigned Designer keep exactly the
-- access they have today.
--
-- `create or replace` rather than drop/create: dropping a function silently
-- drops its grants, and these are called from RLS policies by `authenticated`.

create or replace function private.project_can_view(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.quotation_acceptances qa on qa.id = p.quotation_acceptance_id
    where p.id = p_project_id
      and (
        (
          (select public.authorize('projects.read'))
          and (
            (select private.has_role('super_admin'))
            or (
              (select private.has_role('sales_executive'))
              and qa.credited_sales_executive_id = auth.uid()
            )
            or (
              (select private.has_role('project_manager'))
              and p.primary_pm_id = auth.uid()
            )
          )
        )
        or (
          -- Sales-status visibility. Deliberately its own permission: it must
          -- not widen if `projects.read` is granted somewhere else later.
          (select public.authorize('projects.read_high_level'))
          and (select private.has_role('sales_manager'))
        )
        or (
          (select public.authorize('project_design.read'))
          and (select private.has_role('designer'))
          and private.project_design_is_current_assigned_designer(p_project_id, auth.uid())
        )
      )
  );
$$;

/*
 * The operational view of a project, which is NOT the manager's.
 *
 * `project_events` is the project's operational timeline — handover, design and
 * execution activity. High-level sales visibility means the project's identity,
 * client, stage, PM and dates; it does not mean reading the execution log. So
 * the events table moves to its own predicate, which is `project_can_view`
 * without the sales_manager branch.
 *
 * Everyone else keeps exactly what they had.
 */
create or replace function private.project_can_view_operational(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.quotation_acceptances qa on qa.id = p.quotation_acceptance_id
    where p.id = p_project_id
      and (
        (
          (select public.authorize('projects.read'))
          and (
            (select private.has_role('super_admin'))
            or (
              (select private.has_role('sales_executive'))
              and qa.credited_sales_executive_id = auth.uid()
            )
            or (
              (select private.has_role('project_manager'))
              and p.primary_pm_id = auth.uid()
            )
          )
        )
        or (
          (select public.authorize('project_design.read'))
          and (select private.has_role('designer'))
          and private.project_design_is_current_assigned_designer(p_project_id, auth.uid())
        )
      )
  );
$$;

alter function private.project_can_view_operational(uuid) owner to postgres;
revoke all on function private.project_can_view_operational(uuid) from public, anon;
grant execute on function private.project_can_view_operational(uuid) to authenticated;

drop policy if exists project_events_staff_read on public.project_events;
create policy project_events_staff_read
  on public.project_events for select to authenticated
  using (private.project_can_view_operational(project_id));

-- -----------------------------------------------------------------------------
-- F. Staff directories that were gated on ROLE alone
-- -----------------------------------------------------------------------------
--
-- Most project mutations check a permission AND a role, so removing the grant in
-- section C already denies them. These two did not: they returned a staff
-- directory on the strength of `has_role('sales_manager')` by itself, with no
-- permission check at all. Left alone, a manager would keep a list of every
-- Project Manager and every Designer that the rest of this migration takes the
-- authority to use away.
--
-- Each is now gated by the permission its OPERATION already requires —
-- `assign_project_manager` checks `projects.assign_pm`, `set_project_lead_designer`
-- checks `project_design.staff` — so the directory and the act it feeds can no
-- longer disagree. The role branch is dropped rather than narrowed: the
-- permission is the authority, and duplicating it as a role list is how these
-- two drifted apart in the first place.
--
-- Bodies are otherwise unchanged, and `create or replace` keeps the existing
-- signature, ownership and grants.

create or replace function public.list_assignable_project_managers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('projects.assign_pm')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'display_name', pr.display_name
    ) order by pr.display_name)
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where pr.status = 'active'
      and r.is_active = true
      and r.code = 'project_manager'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_assignable_designers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('project_design.staff')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'display_name', pr.display_name
    ) order by pr.display_name)
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where pr.status = 'active'
      and r.is_active = true
      and r.code = 'designer'
  ), '[]'::jsonb);
end;
$$;

commit;
