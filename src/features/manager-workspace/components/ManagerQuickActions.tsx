import Link from "next/link";

import {
  MANAGER_NEW_ENQUIRY,
  MANAGER_QUICK_ACTIONS,
} from "../contracts/manager-nav.ts";
import { ManagerPanel } from "./ManagerPanel.tsx";

/**
 * The one action, then the workspaces one click away.
 *
 * Navigation only. Nothing here mutates anything — "New Enquiry" is a link to
 * a route that carries its own form and its own `requireCrmCreateAccess`
 * guard, not a form on this page. Every destination re-checks its permissions
 * when opened.
 */
export function ManagerQuickActions() {
  return (
    <ManagerPanel title="Quick actions" caption="Your workspaces">
      <ul className="grid gap-3 sm:grid-cols-2">
        {MANAGER_QUICK_ACTIONS.map((item) => {
          const primary = item.href === MANAGER_NEW_ENQUIRY.href;
          return (
            <li key={item.href} className={primary ? "sm:col-span-2" : undefined}>
              <Link
                href={item.href}
                className={`flex min-h-11 flex-col justify-center rounded-lg border px-4 py-3 transition-colors ${
                  primary
                    ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-400/60 hover:bg-amber-500/10"
                    : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    primary ? "text-amber-200" : "text-neutral-100"
                  }`}
                >
                  {item.label}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-neutral-400">
                  {item.detail}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ManagerPanel>
  );
}
