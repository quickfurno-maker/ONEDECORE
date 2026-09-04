"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isLeadsWorkspacePath } from "../../contracts/crm-workspace-theme.ts";

/**
 * The CRM workspace root, and the one place the Leads dark theme is switched on.
 *
 * The dark class MUST land on the same element as `.od-crm`. `.od-crm` declares
 * `background: var(--crm-bg)` and the dark layer only redefines that variable,
 * so putting the two classes on different elements left the outer workspace,
 * the nav and the page gutters on the light palette while an inner island went
 * dark — a mixed frame rather than one workspace.
 *
 * Route-scoped rather than CRM-wide: My Day, Pipeline, Calendar and Reports were
 * built and reviewed against the light palette, and flipping them unreviewed is
 * a larger change than this work covers.
 *
 * `usePathname` resolves during SSR in the app router, so the correct class is
 * present in the server-rendered HTML and there is no light flash before
 * hydration.
 */

export function CrmWorkspaceShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const dark = isLeadsWorkspacePath(pathname);

  return (
    <div
      className={`od-crm space-y-5${dark ? " od-crm-dark" : ""}`}
      data-crm-theme={dark ? "dark" : "light"}
    >
      {children}
    </div>
  );
}
