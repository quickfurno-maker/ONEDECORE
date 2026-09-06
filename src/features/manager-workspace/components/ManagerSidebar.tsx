"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MANAGER_NAV_GROUPS,
  isManagerNavItemActive,
} from "../contracts/manager-nav.ts";

/**
 * The manager's navigation rail.
 *
 * Deliberately not `AdminSidebar`: that component renders the owner's nav model
 * — Content, Commerce, Marketing and Payroll groups included — behind
 * permission flags. This one has its own groups, and none of them is ever
 * hidden, because every entry in it belongs to the role.
 */
export function ManagerSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
}) {
  const pathname = usePathname() ?? "/manager";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-neutral-950/70 lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Manager workspace"
        className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-neutral-800 bg-neutral-950 px-3 py-5 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
            ONEDECORE
          </span>
          <p className="mt-1 text-xs text-neutral-500">Manager Workspace</p>
        </div>

        {MANAGER_NAV_GROUPS.map((group) => (
          <div key={group.id} className="mt-6 first:mt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
              {group.label}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const active = isManagerNavItemActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${
                        active
                          ? "bg-neutral-900 font-semibold text-amber-300"
                          : "text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
