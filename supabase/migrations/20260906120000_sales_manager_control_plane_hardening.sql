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
-- E. Project visibility — a READ MODEL, not a wider row policy
-- -----------------------------------------------------------------------------
--
-- WHY THE RLS PREDICATES ARE LEFT ALONE
--
-- `private.project_can_view` gates `public.projects`, `project_manager_assignments`
-- and `project_events`, and its branches are keyed on `projects.read`. Section C
-- revokes that permission from sales_manager, so the manager loses raw access to
-- all three tables by that revocation alone. Nothing here needs to change for
-- the containment to hold, and the predicate is deliberately NOT touched.
--
-- An earlier draft of this migration added a `projects.read_high_level` branch
-- to that predicate instead. That was wrong, and worth recording why: RLS is
-- ROW-level. A branch named "high level" inside a full-table policy grants the
-- whole row — every column of `projects`, and the entire assignment history in
-- `project_manager_assignments`. It would have read as a narrow grant while
-- being a broad one.
--
-- So high-level status is a READ MODEL instead: two SECURITY DEFINER functions
-- that return an explicit, enumerated set of fields and nothing else. What the
-- Sales Manager can see is the list of keys below — not "whatever is in the
-- table today, plus whatever a later migration adds to it".

/*
 * The fields a Sales Manager may see about a project.
 *
 * Enumerated one by one on purpose. `select *` or a row type would silently
 * widen this the next time a column is added to `projects`, and the whole point
 * of this function is that widening it must be a decision someone makes.
 *
 * Names are resolved here because the function is SECURITY DEFINER: the manager
 * gets the CURRENT Project Manager and lead Designer as status fields without
 * `profiles` RLS being loosened and without any assignment history.
 */
create or replace function private.project_high_level_status_row(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'project_id', p.id,
    'project_number', p.project_number,
    'status', p.status,
    'client_display_name', coalesce(l.submitted_name, qa.accepted_by_name),
    'quotation_number', q.quotation_number,
    'commercial_currency', qv.currency,
    'commercial_grand_total_paise', qv.grand_total_paise,
    'current_project_manager', pm.display_name,
    'current_lead_designer', (
      select d.display_name
      from public.project_designer_assignments pda
      join public.profiles d on d.id = pda.designer_id
      where pda.project_id = p.id
        and pda.assignment_role = 'lead_designer'
        and pda.ended_at is null
      order by pda.assigned_at desc
      limit 1
    ),
    'created_at', p.created_at,
    'handover_accepted_at', p.handover_accepted_at,
    'design_state', dw.state,
    'design_started_at', dw.started_at,
    'design_completed_at', dw.completed_at,
    'execution_state', ew.state,
    'execution_initialization_status',
      case
        when not private.project_execution_entry_eligible(p.id) then 'not_eligible'
        when ew.project_id is null then 'pending_initialization'
        when ew.state = 'cancelled' then 'cancelled'
        when ew.state = 'completed' then 'completed'
        when ew.state = 'on_hold' then 'on_hold'
        else 'active'
      end,
    'execution_updated_at', ew.updated_at,
    'execution_completed_at', ew.completed_at
  )
  from public.projects p
  join public.quotation_acceptances qa on qa.id = p.quotation_acceptance_id
  left join public.leads l on l.id = p.lead_id
  left join public.quotations q on q.id = p.accepted_quotation_id
  left join public.quotation_versions qv on qv.id = p.accepted_quotation_version_id
  left join public.profiles pm on pm.id = p.primary_pm_id
  left join public.project_design_workflows dw on dw.project_id = p.id
  left join public.project_execution_workflows ew on ew.project_id = p.id
  where p.id = p_project_id;
$$;

alter function private.project_high_level_status_row(uuid) owner to postgres;
revoke all on function private.project_high_level_status_row(uuid) from public, anon, authenticated;

/*
 * The high-level project list.
 *
 * Authority is the permission, checked here and nowhere else that matters:
 * `projects.read_high_level` is held by super_admin and sales_manager and by no
 * one else, so a role that loses it loses this function in the same breath.
 * There is no role branch — a role list next to a permission check is how the
 * two drift apart.
 */
create or replace function public.list_project_high_level_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('projects.read_high_level')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_json order by created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select
      private.project_high_level_status_row(p.id) as row_json,
      p.created_at
    from public.projects p
  ) ordered;

  return v_rows;
end;
$$;

alter function public.list_project_high_level_status() owner to postgres;
revoke all on function public.list_project_high_level_status() from public, anon;
grant execute on function public.list_project_high_level_status() to authenticated;

/* One project, same field set, same authority. */
create or replace function public.get_project_high_level_status(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_project_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if not (select public.authorize('projects.read_high_level')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select private.project_high_level_status_row(p_project_id) into v_row;

  if v_row is null then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

alter function public.get_project_high_level_status(uuid) owner to postgres;
revoke all on function public.get_project_high_level_status(uuid) from public, anon;
grant execute on function public.get_project_high_level_status(uuid) to authenticated;

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
