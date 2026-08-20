"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar.tsx";
import { AdminTopBar } from "./AdminTopBar.tsx";
import { buildOpsCommandRoutes } from "../nav-routes.ts";
import type { OpsIdentity, OpsNavFlags } from "../types.ts";

const SIDEBAR_EVENT = "od-ops-sidebar";

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

function sidebarCollapsedSnapshot() {
  return window.localStorage.getItem("od-ops-sidebar") === "collapsed";
}

interface AdminShellProps {
  readonly identity: OpsIdentity;
  readonly flags: OpsNavFlags;
  readonly hrefs: {
    readonly crmLeads: string;
    readonly whatsappInbox: string;
    readonly attendance: string;
    readonly projects: string;
    readonly campaigns: string;
  };
  readonly children: ReactNode;
}

export function AdminShell({ identity, flags, hrefs, children }: AdminShellProps) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    sidebarCollapsedSnapshot,
    () => false
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const routes = buildOpsCommandRoutes(flags);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="od-ops min-h-screen">
      <a
        href="#od-ops-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-md focus:bg-[var(--od-elevated)] focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>
      <AdminSidebar
        flags={flags}
        hrefs={hrefs}
        collapsed={collapsed}
        onToggleCollapse={() => {
          const next = !sidebarCollapsedSnapshot();
          window.localStorage.setItem("od-ops-sidebar", next ? "collapsed" : "expanded");
          window.dispatchEvent(new Event(SIDEBAR_EVENT));
        }}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"}`}>
        <AdminTopBar
          identity={identity}
          flags={flags}
          routes={routes}
          commandOpen={commandOpen}
          onOpenCommand={() => setCommandOpen(true)}
          onCloseCommand={() => setCommandOpen(false)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main id="od-ops-main" className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
