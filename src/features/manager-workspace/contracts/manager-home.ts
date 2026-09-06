/**
 * Where each staff role lands after signing in.
 *
 * WHY THIS IS A CONTRACT AND NOT AN `if` IN THE LOGIN ROUTE
 *
 * The Super Admin dashboard at `/admin` is the owner's view of the whole
 * business: global KPIs, campaigns, commerce, payroll. A Sales Manager has no
 * business authority over any of it, so landing there is wrong even when every
 * individual panel would refuse to load — the page is the wrong answer to
 * "where do I work?".
 *
 * Two places decide this and they must agree: the login redirect, and `/admin`
 * itself when a manager navigates to it directly or follows a stale bookmark.
 * Both read this module.
 */

/** The Super Admin home. Also the historical default for every staff role. */
export const ADMIN_HOME = "/admin";

/** The Sales Manager workspace. */
export const MANAGER_HOME = "/manager";

/** The workspace roots a staff redirect may land in. Nothing else is allowed. */
export const STAFF_WORKSPACE_ROOTS = [ADMIN_HOME, MANAGER_HOME] as const;

/**
 * Whether a path is a safe internal staff destination.
 *
 * Pure and dependency-free so the Proxy can use the SAME allowlist as the
 * server helper — two copies of this rule is how one of them ends up looser.
 *
 * The `//` guard is the part that matters: `/admin//evil.example.com` is a
 * protocol-relative URL a browser resolves to another ORIGIN, so a bare prefix
 * test would hand an open redirect straight back.
 */
export function isSafeStaffRedirect(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return STAFF_WORKSPACE_ROOTS.some(
    (root) =>
      (pathname === root || pathname.startsWith(`${root}/`)) &&
      !pathname.startsWith(`${root}//`)
  );
}

export interface StaffHomeRoles {
  /** Super Admin outranks everything: the owner always lands on /admin. */
  readonly isSuperAdmin: boolean;
  readonly isSalesManager: boolean;
}

/**
 * The home this staff member should land on.
 *
 * Super Admin first, deliberately. An account holding both roles is the owner
 * account, and sending it to the manager workspace would hide the business
 * controls it is the only account that has.
 */
export function resolveStaffHome(roles: StaffHomeRoles): string {
  if (roles.isSuperAdmin) {
    return ADMIN_HOME;
  }
  if (roles.isSalesManager) {
    return MANAGER_HOME;
  }
  return ADMIN_HOME;
}

/**
 * The post-login destination, given an already-validated `next`.
 *
 * `safeNext` has been through `getSafeAdminRedirect`, so it is `/admin` or a
 * path beneath it and nothing else. What it has NOT been through is any check
 * that this particular staff member should be there.
 *
 * The rule:
 *
 *   - A bare `/admin` is the DEFAULT, not a request. It is replaced by the
 *     role's own home, so a Sales Manager signing in normally — or following a
 *     crafted or stale `next=/admin` — reaches `/manager`, never the owner
 *     dashboard.
 *   - A deeper `/admin/...` path is a real destination the visitor asked for.
 *     It is preserved, because those routes are individually permission-guarded
 *     and a manager legitimately works in several of them. If they are not
 *     entitled, that route refuses them on its own terms rather than this
 *     function guessing.
 *
 * Nothing outside `/admin` can reach here, so there is no open redirect to
 * reintroduce.
 */
export function resolveLoginDestination(
  safeNext: string,
  roles: StaffHomeRoles
): string {
  const home = resolveStaffHome(roles);
  if (safeNext === ADMIN_HOME) {
    return home;
  }
  return safeNext;
}
