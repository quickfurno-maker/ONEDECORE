import type { ReactNode } from "react";

/**
 * CRM-wide premium dark workspace root.
 *
 * Every CRM route shares the same visual contract. Keeping the theme class on
 * the workspace root means page gutters, navigation, shared admin panels,
 * dialogs and route content all inherit one palette without per-page switches.
 */
export function CrmWorkspaceShell({ children }: { readonly children: ReactNode }) {
  return (
    <div
      className="od-crm od-crm-dark crm-app-shell space-y-5"
      data-crm-theme="dark"
    >
      {children}
    </div>
  );
}
