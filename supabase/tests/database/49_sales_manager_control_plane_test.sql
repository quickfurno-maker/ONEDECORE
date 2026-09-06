-- ONEDECORE — Sales Manager control plane: the role boundary, asserted.
--
-- WHY THIS SUITE IS MOSTLY NEGATIVE
--
-- A role gains authority one migration at a time. Every feature that shipped a
-- control plane granted it to `sales_manager` next to `super_admin`, and the
-- accumulated result was a second owner: campaign approval, landing page
-- publishing, storefront management, bulk enquiry import, duplicate override,
-- Project Manager assignment, designer staffing, execution cancellation.
--
-- So the assertions that matter are the ones that say NO. A positive test
-- ("manager can still work leads") passes whether or not the boundary holds; it
-- is the refusals that stop the next feature quietly widening the role again.
--
-- CLOSED LOST IS NOT DELETE — the distinction this suite exists to protect.
-- `leads.transition` stays with the sales team, `leads.delete` never leaves the
-- owner, and both halves are pinned below.

begin;
select plan(137);

-- -----------------------------------------------------------------------------
-- A reusable grant probe. Reads the real grant graph, including is_active, so a
-- permission deactivated rather than revoked still reads as denied.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.role_has(p_role text, p_permission text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.roles r
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where r.code = p_role
      and p.code = p_permission
      and p.is_active
      and r.is_active
  );
$$;

-- =============================================================================
-- A. The two new permissions exist
-- =============================================================================

select is(
  (select count(*)::integer from public.permissions where code = 'leads.delete' and is_active),
  1,
  'leads.delete exists and is active'
);
select is(
  (select count(*)::integer from public.permissions where code = 'projects.read_high_level' and is_active),
  1,
  'projects.read_high_level exists and is active'
);

-- =============================================================================
-- B. DELETE ENQUIRY — the owner alone
-- =============================================================================

select is(pg_temp.role_has('super_admin', 'leads.delete'), true, 'super_admin may delete an enquiry');

-- Named one by one rather than as a set, so adding a role to the system does not
-- silently pass this test by not being in the list.
select is(pg_temp.role_has('sales_manager', 'leads.delete'), false, 'sales_manager may NOT delete an enquiry');
select is(pg_temp.role_has('sales_executive', 'leads.delete'), false, 'sales_executive may NOT delete an enquiry');
select is(pg_temp.role_has('project_manager', 'leads.delete'), false, 'project_manager may NOT delete an enquiry');
select is(pg_temp.role_has('designer', 'leads.delete'), false, 'designer may NOT delete an enquiry');
select is(pg_temp.role_has('management', 'leads.delete'), false, 'legacy management may NOT delete an enquiry');
select is(pg_temp.role_has('sales', 'leads.delete'), false, 'legacy sales may NOT delete an enquiry');
select is(pg_temp.role_has('project_operations', 'leads.delete'), false, 'legacy project_operations may NOT delete an enquiry');

-- And the catch-all: exactly one role holds it, whatever roles exist.
select is(
  (select count(*)::integer
     from public.role_permissions rp
     join public.permissions p on p.id = rp.permission_id
    where p.code = 'leads.delete'),
  1,
  'exactly one role grant exists for leads.delete'
);
select is(
  (select r.code
     from public.role_permissions rp
     join public.permissions p on p.id = rp.permission_id
     join public.roles r on r.id = rp.role_id
    where p.code = 'leads.delete'),
  'super_admin',
  'and that role is super_admin'
);

-- =============================================================================
-- C. CLOSED LOST — unchanged, and explicitly NOT delete
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'leads.transition'), true, 'sales_manager keeps leads.transition (closed lost)');
select is(pg_temp.role_has('sales_executive', 'leads.transition'), true, 'sales_executive keeps leads.transition (closed lost)');
select is(pg_temp.role_has('super_admin', 'leads.transition'), true, 'super_admin keeps leads.transition');

-- The lifecycle transition and the delete authority must never be the same
-- grant. If a future migration ever merges them, this fails.
select isnt(
  (select id from public.permissions where code = 'leads.transition'),
  (select id from public.permissions where code = 'leads.delete'),
  'transition and delete are distinct permissions'
);

-- Closed lost still requires its reason and note, and still stores neither as a
-- tombstone: the lead stays in CRM truth.
select has_table('public', 'lead_events', 'the lead event log exists');
select has_table('public', 'lead_closure_reasons', 'the closed-lost reason catalogue exists');
select has_column('public', 'leads', 'closed_lost_reason_id', 'closed_lost_reason_id exists');
select has_column('public', 'leads', 'closed_lost_note', 'closed_lost_note exists');

-- =============================================================================
-- D. CAMPAIGNS AND MARKETING — none for the manager
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'campaigns.read'), false, 'sales_manager: no campaigns.read');
select is(pg_temp.role_has('sales_manager', 'campaigns.draft'), false, 'sales_manager: no campaigns.draft');
select is(pg_temp.role_has('sales_manager', 'campaigns.request_approval'), false, 'sales_manager: no campaigns.request_approval');
select is(pg_temp.role_has('sales_manager', 'campaigns.approve'), false, 'sales_manager: no campaigns.approve');
select is(pg_temp.role_has('sales_manager', 'campaigns.execute'), false, 'sales_manager: no campaigns.execute');
select is(pg_temp.role_has('sales_manager', 'campaigns.pause'), false, 'sales_manager: no campaigns.pause');
select is(pg_temp.role_has('sales_manager', 'campaigns.metrics.read'), false, 'sales_manager: no campaigns.metrics.read');
select is(pg_temp.role_has('sales_manager', 'marketing_consents.manage'), false, 'sales_manager: no marketing_consents.manage');

-- =============================================================================
-- E. LANDING LAB — none for the manager
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'landing_pages.read'), false, 'sales_manager: no landing_pages.read');
select is(pg_temp.role_has('sales_manager', 'landing_pages.manage'), false, 'sales_manager: no landing_pages.manage');
select is(pg_temp.role_has('sales_manager', 'landing_pages.publish'), false, 'sales_manager: no landing_pages.publish');
select is(pg_temp.role_has('sales_manager', 'landing_experiments.manage'), false, 'sales_manager: no landing_experiments.manage');
select is(pg_temp.role_has('sales_manager', 'landing_analytics.read'), false, 'sales_manager: no landing_analytics.read');

-- =============================================================================
-- F. BULK IMPORT AND DUPLICATE OVERRIDE — owner only
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'leads.bulk_import'), false, 'sales_manager: no bulk import');
select is(pg_temp.role_has('management', 'leads.bulk_import'), false, 'legacy management: no bulk import');
select is(pg_temp.role_has('sales_executive', 'leads.bulk_import'), false, 'sales_executive: no bulk import');
select is(pg_temp.role_has('sales', 'leads.bulk_import'), false, 'legacy sales: no bulk import');
select is(pg_temp.role_has('super_admin', 'leads.bulk_import'), true, 'super_admin keeps bulk import');
select is(pg_temp.role_has('super_admin', 'leads.bulk_import_approve'), true, 'super_admin keeps bulk import approval');
select is(pg_temp.role_has('sales_manager', 'leads.bulk_import_approve'), false, 'sales_manager: no bulk import approval');

select is(pg_temp.role_has('sales_manager', 'leads.duplicate_override'), false, 'sales_manager: no duplicate override');
select is(pg_temp.role_has('management', 'leads.duplicate_override'), true, 'legacy management keeps duplicate override (out of scope, pinned)');
select is(pg_temp.role_has('sales_executive', 'leads.duplicate_override'), false, 'sales_executive: no duplicate override');
select is(pg_temp.role_has('super_admin', 'leads.duplicate_override'), true, 'super_admin keeps duplicate override');

-- Manager can still create an ordinary, non-duplicate enquiry.
select is(pg_temp.role_has('sales_manager', 'leads.create'), true, 'sales_manager can still create an enquiry');

-- =============================================================================
-- G. COMMERCE — no control plane in this role
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'commerce.read'), false, 'sales_manager: no commerce.read');
select is(pg_temp.role_has('sales_manager', 'commerce.orders.manage'), false, 'sales_manager: no commerce.orders.manage');
select is(pg_temp.role_has('sales_manager', 'commerce.payments.read'), false, 'sales_manager: no commerce.payments.read');
select is(pg_temp.role_has('sales_manager', 'commerce.catalog.manage'), false, 'sales_manager: no commerce.catalog.manage');
select is(pg_temp.role_has('sales_manager', 'commerce.inventory.manage'), false, 'sales_manager: no commerce.inventory.manage');
select is(pg_temp.role_has('sales_manager', 'commerce.settings.manage'), false, 'sales_manager: no commerce.settings.manage');

-- =============================================================================
-- H. PORTFOLIO — never granted, pinned so the nav fix cannot be "fixed" by a grant
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'portfolio.read'), false, 'sales_manager: no portfolio.read');
select is(pg_temp.role_has('sales_manager', 'portfolio.manage'), false, 'sales_manager: no portfolio.manage');
select is(pg_temp.role_has('super_admin', 'portfolio.manage'), true, 'super_admin keeps portfolio.manage');

-- =============================================================================
-- I. PROJECTS — high-level read only
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'projects.read_high_level'), true, 'sales_manager gets high-level project status');
select is(pg_temp.role_has('sales_manager', 'projects.read'), false, 'sales_manager: no broad projects.read');
select is(pg_temp.role_has('sales_manager', 'projects.assign_pm'), false, 'sales_manager cannot assign a Project Manager');
select is(pg_temp.role_has('sales_manager', 'projects.accept_handover'), false, 'sales_manager cannot accept handover');
select is(pg_temp.role_has('sales_manager', 'project_design.read'), false, 'sales_manager: no design workspace read');
select is(pg_temp.role_has('sales_manager', 'project_design.staff'), false, 'sales_manager cannot staff designers');
select is(pg_temp.role_has('sales_manager', 'project_execution.read'), false, 'sales_manager: no execution workspace read');
select is(pg_temp.role_has('sales_manager', 'project_execution.cancel'), false, 'sales_manager cannot cancel execution');
select is(pg_temp.role_has('sales_manager', 'project_execution.hold'), false, 'sales_manager cannot hold execution');

-- The other project roles are untouched.
select is(pg_temp.role_has('super_admin', 'projects.read'), true, 'super_admin keeps projects.read');
select is(pg_temp.role_has('super_admin', 'projects.assign_pm'), true, 'super_admin keeps projects.assign_pm');
select is(pg_temp.role_has('super_admin', 'project_design.staff'), true, 'super_admin keeps project_design.staff');
select is(pg_temp.role_has('super_admin', 'project_execution.cancel'), true, 'super_admin keeps project_execution.cancel');
select is(pg_temp.role_has('project_manager', 'projects.read'), true, 'project_manager keeps projects.read');
select is(pg_temp.role_has('project_manager', 'projects.accept_handover'), true, 'project_manager keeps handover acceptance');
select is(pg_temp.role_has('project_manager', 'project_execution.read'), true, 'project_manager keeps execution read');
select is(pg_temp.role_has('designer', 'project_design.read'), true, 'designer keeps design read');
select is(pg_temp.role_has('sales_executive', 'projects.read'), true, 'sales_executive keeps its credited-project read');

-- The predicate rewrite: the manager branch is keyed to the NEW permission, and
-- the operational predicate has no manager branch at all.
select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'project_can_view_operational'),
  1,
  'private.project_can_view_operational exists'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'project_can_view') like '%projects.read_high_level%',
  'project_can_view keys the manager branch to projects.read_high_level'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'project_can_view_operational') not like '%sales_manager%',
  'the operational project predicate has no sales_manager branch'
);
select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'public' and tablename = 'project_events'
      and qual like '%project_can_view_operational%'),
  1,
  'project_events reads through the operational predicate'
);

-- The two staff directories that were gated on role alone.
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_assignable_project_managers') not like '%sales_manager%',
  'the assignable-PM directory is no longer role-gated to sales_manager'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_assignable_project_managers') like '%projects.assign_pm%',
  'the assignable-PM directory requires the permission its operation requires'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_assignable_designers') not like '%sales_manager%',
  'the assignable-designer directory is no longer role-gated to sales_manager'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_assignable_designers') like '%project_design.staff%',
  'the assignable-designer directory requires the permission its operation requires'
);

-- =============================================================================
-- J. CRM GLOBAL ADMIN — not the manager's
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'leads.assignment_rules.manage'), false, 'sales_manager: no assignment rules');
select is(pg_temp.role_has('sales_manager', 'crm.sla.manage'), false, 'sales_manager: no SLA settings');
select is(pg_temp.role_has('sales_manager', 'sales_targets.manage'), false, 'sales_manager: no target management');
select is(pg_temp.role_has('sales_manager', 'sources.manage'), false, 'sales_manager: no source catalogue management');
select is(pg_temp.role_has('sales_manager', 'lead_intake.audit'), false, 'sales_manager: no intake audit');

-- =============================================================================
-- K. WORKFORCE — self and direct reports, nothing administrative
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'staff.read'), true, 'sales_manager keeps staff.read (direct-report scoped by RLS)');
select is(pg_temp.role_has('sales_manager', 'staff.manage'), false, 'sales_manager cannot manage staff');
select is(pg_temp.role_has('sales_manager', 'staff.credentials.manage'), false, 'sales_manager cannot manage credentials');

select is(pg_temp.role_has('sales_manager', 'attendance.self'), true, 'sales_manager keeps own attendance');
select is(pg_temp.role_has('sales_manager', 'attendance.team.read'), true, 'sales_manager keeps team attendance read');
select is(pg_temp.role_has('sales_manager', 'attendance.read.all'), false, 'sales_manager: no global attendance');
select is(pg_temp.role_has('sales_manager', 'attendance.correct.all'), false, 'sales_manager: no global attendance correction');
select is(pg_temp.role_has('sales_manager', 'attendance.correct.team'), false, 'sales_manager: no team attendance correction');
select is(pg_temp.role_has('sales_manager', 'attendance.policies.manage'), false, 'sales_manager: no attendance policy authority');

select is(pg_temp.role_has('sales_manager', 'leave.self'), true, 'sales_manager keeps own leave');
select is(pg_temp.role_has('sales_manager', 'leave.team.approve'), true, 'sales_manager keeps team leave approval');
select is(pg_temp.role_has('sales_manager', 'leave.manage'), false, 'sales_manager: no leave catalogue authority');
select is(pg_temp.role_has('sales_manager', 'holidays.manage'), false, 'sales_manager: no holiday authority');

select is(pg_temp.role_has('sales_manager', 'salary.self'), true, 'sales_manager keeps own salary');
select is(pg_temp.role_has('sales_manager', 'salary.manage'), false, 'sales_manager: no payroll authority');

-- =============================================================================
-- L. WHAT THE MANAGER KEEPS — the sales job itself
-- =============================================================================

select is(pg_temp.role_has('sales_manager', 'admin.access'), true, 'sales_manager can still sign in to the workspace');
select is(pg_temp.role_has('sales_manager', 'leads.read_all'), true, 'sales_manager sees all enquiries');
select is(pg_temp.role_has('sales_manager', 'leads.manage'), true, 'sales_manager works enquiries');
select is(pg_temp.role_has('sales_manager', 'leads.assign'), true, 'sales_manager assigns enquiries');
select is(pg_temp.role_has('sales_manager', 'consents.read'), true, 'sales_manager reads consent state');
select is(pg_temp.role_has('sales_manager', 'sources.read'), true, 'sales_manager reads source labels');
select is(pg_temp.role_has('sales_manager', 'crm.notes.manage'), true, 'sales_manager manages notes');
select is(pg_temp.role_has('sales_manager', 'crm.follow_ups.manage'), true, 'sales_manager manages follow-ups');
select is(pg_temp.role_has('sales_manager', 'crm.activities.read'), true, 'sales_manager reads activities');
select is(pg_temp.role_has('sales_manager', 'crm.reporting.read'), true, 'sales_manager reads CRM reports');
select is(pg_temp.role_has('sales_manager', 'sales_targets.read'), true, 'sales_manager reads sales targets');
select is(pg_temp.role_has('sales_manager', 'crm.cadences.manage'), true, 'sales_manager runs the sales cadence');

select is(pg_temp.role_has('sales_manager', 'quotations.read'), true, 'sales_manager reads quotations');
select is(pg_temp.role_has('sales_manager', 'quotations.create'), true, 'sales_manager creates quotations');
select is(pg_temp.role_has('sales_manager', 'quotations.edit'), true, 'sales_manager edits quotations');
select is(pg_temp.role_has('sales_manager', 'quotations.finalize'), true, 'sales_manager finalizes quotations');
select is(pg_temp.role_has('sales_manager', 'quotations.send'), true, 'sales_manager sends quotations');

-- WhatsApp: `whatsapp.inbox.manage` was audited and grants operational inbox
-- scope only — viewing and routing unassigned conversations. It carries no
-- provider, WABA, template or webhook authority, so it stays.
select is(pg_temp.role_has('sales_manager', 'whatsapp.inbox.read'), true, 'sales_manager reads the sales inbox');
select is(pg_temp.role_has('sales_manager', 'whatsapp.inbox.use'), true, 'sales_manager replies in the sales inbox');
select is(pg_temp.role_has('sales_manager', 'whatsapp.inbox.manage'), true, 'sales_manager routes team conversations');

-- =============================================================================
-- M. SUPER ADMIN — no regression
-- =============================================================================

select is(pg_temp.role_has('super_admin', 'campaigns.read'), true, 'super_admin keeps campaigns.read');
select is(pg_temp.role_has('super_admin', 'campaigns.approve'), true, 'super_admin keeps campaigns.approve');
select is(pg_temp.role_has('super_admin', 'campaigns.execute'), true, 'super_admin keeps campaigns.execute');
select is(pg_temp.role_has('super_admin', 'campaigns.metrics.read'), true, 'super_admin keeps campaign metrics');
select is(pg_temp.role_has('super_admin', 'marketing_consents.manage'), true, 'super_admin keeps marketing consents');
select is(pg_temp.role_has('super_admin', 'landing_pages.manage'), true, 'super_admin keeps landing page management');
select is(pg_temp.role_has('super_admin', 'landing_pages.publish'), true, 'super_admin keeps landing page publishing');
select is(pg_temp.role_has('super_admin', 'landing_analytics.read'), true, 'super_admin keeps landing analytics');
select is(pg_temp.role_has('super_admin', 'commerce.read'), true, 'super_admin keeps commerce');
select is(pg_temp.role_has('super_admin', 'staff.manage'), true, 'super_admin keeps staff management');
select is(pg_temp.role_has('super_admin', 'staff.credentials.manage'), true, 'super_admin keeps credential control');
select is(pg_temp.role_has('super_admin', 'salary.manage'), true, 'super_admin keeps payroll');
select is(pg_temp.role_has('super_admin', 'attendance.policies.manage'), true, 'super_admin keeps attendance policy');
select is(pg_temp.role_has('super_admin', 'holidays.manage'), true, 'super_admin keeps holiday administration');
select is(pg_temp.role_has('super_admin', 'sales_targets.manage'), true, 'super_admin keeps target management');
select is(pg_temp.role_has('super_admin', 'crm.sla.manage'), true, 'super_admin keeps SLA settings');
select is(pg_temp.role_has('super_admin', 'leads.assignment_rules.manage'), true, 'super_admin keeps assignment rules');

select * from finish();
rollback;
