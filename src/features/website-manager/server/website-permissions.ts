import "server-only";

import { cache } from "react";
import { getClaims } from "@/server/auth/claims";

/**
 * The one question every Website Manager surface asks.
 *
 * `website.manage`, not `portfolio.manage` and not `admin.access`. Portfolio
 * manages a gallery; this manages the front page of the company, and reusing a
 * permission would mean every future decision about who may edit the gallery is
 * silently also a decision about who may edit the homepage.
 *
 * Every entry point re-asks: the page, the preview, each server action, and the
 * database policies underneath all of them. That is not redundancy to trim — a
 * server action is reachable by anyone who can reach the app, and only the
 * database can be certain who is asking.
 */
export const WEBSITE_MANAGE_PERMISSION = "website.manage" as const;

export const hasWebsiteManagePermission = cache(async (): Promise<boolean> => {
  try {
    const claims = await getClaims();
    return (
      claims?.isActive === true &&
      claims.permissions.includes(WEBSITE_MANAGE_PERMISSION)
    );
  } catch {
    // An unreadable claim set is not permission. Failing closed here means a
    // transient auth error hides the link rather than exposing the editor.
    return false;
  }
});

/** Throws unless the caller may manage website content. */
export async function requireWebsiteManage(): Promise<void> {
  if (!(await hasWebsiteManagePermission())) {
    throw new Error("Unauthorized");
  }
}
