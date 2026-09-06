import Link from "next/link";

import { MANAGER_QUICK_ACTIONS } from "../contracts/manager-nav.ts";
import { ManagerPanel } from "./ManagerPanel.tsx";

/**
 * The workspaces one click away.
 *
 * Navigation only. Nothing here mutates anything — the dashboard is a read
 * surface, and every destination re-checks its own permissions when opened.
 */
export function ManagerQuickActions() {
  return (
    <ManagerPanel title="Quick actions" caption="Your workspaces">
      <ul className="grid gap-3 sm:grid-cols-2">
        {MANAGER_QUICK_ACTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-11 flex-col justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
            >
              <span className="text-sm font-semibold text-neutral-100">
                {item.label}
              </span>
              <span className="mt-1 text-xs leading-relaxed text-neutral-400">
                {item.detail}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ManagerPanel>
  );
}
