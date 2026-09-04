/**
 * Which CRM routes use the premium dark Leads theme.
 *
 * Pure, and in `contracts/` rather than inside the shell component, so the
 * route rule has direct behavioural tests — the node test runner cannot load a
 * `.tsx` module, and "does /admin/crm/leadsources accidentally go dark?" is
 * exactly the kind of question a source assertion answers badly.
 */

const LEADS_ROOT = "/admin/crm/leads";

/**
 * True for the leads list, the new-lead form and every lead detail route.
 *
 * The trailing-slash check matters: a bare `startsWith` would also match
 * `/admin/crm/leadsources`, silently theming an unrelated workspace.
 */
export function isLeadsWorkspacePath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return pathname === LEADS_ROOT || pathname.startsWith(`${LEADS_ROOT}/`);
}
