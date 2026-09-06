"use client";

import { useState, type ReactNode } from "react";

import { ManagerSidebar } from "./ManagerSidebar.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";

/**
 * The Manager workspace chrome.
 *
 * `AdminShell` is the owner's shell: it builds a command palette from the whole
 * product's route table and a sidebar from the owner's nav flags. Reusing it
 * and switching parts off would leave the manager's boundary living in props.
 * This shell has nothing to switch off.
 */
export function ManagerShell({
  displayName,
  roleLabel,
  children,
}: {
  readonly displayName: string;
  readonly roleLabel: string;
  readonly children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <a
        href="#manager-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      <ManagerSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="min-h-screen lg:pl-64">
        <ManagerTopBar
          displayName={displayName}
          roleLabel={roleLabel}
          onOpenNav={() => setMobileOpen(true)}
        />
        <main id="manager-main" className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
