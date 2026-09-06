import type { Metadata } from "next";
import Link from "next/link";
import { fetchOpsIdentity } from "@/features/admin-ops/server/ops-identity";
import { requireSalesManager } from "@/features/manager-workspace/server/manager-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manager Workspace | ONEDECORE",
  description: "Sales management workspace for authorized ONEDECORE personnel.",
};

/**
 * The Sales Manager landing page — deliberately a FOUNDATION, not a dashboard.
 *
 * The manager's real dashboard will be designed after the role has been used
 * for a while and it is clear what a sales manager actually opens first. What
 * this page must not do in the meantime is borrow the Super Admin dashboard:
 * its KPI cards, pipeline panels and attention feeds are the owner's view of
 * the whole business, and putting them here would re-create the boundary
 * problem this whole change exists to fix, one panel at a time.
 *
 * So there are no metrics here. Only the links to workspaces the manager is
 * already authorised for, each of which enforces its own permissions when
 * opened.
 */

const WORKSPACES: readonly { href: string; label: string; detail: string }[] = [
  {
    href: "/admin/crm/leads",
    label: "Enquiries",
    detail: "Work the sales pipeline, assign enquiries and record follow-ups.",
  },
  {
    href: "/admin/quotations",
    label: "Quotations",
    detail: "Prepare, finalise and send customer quotations.",
  },
  {
    href: "/admin/whatsapp/inbox",
    label: "WhatsApp Inbox",
    detail: "Reply to customers and route conversations across the team.",
  },
  {
    href: "/admin/crm/reports",
    label: "Reports",
    detail: "Sales reporting and targets for your team.",
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    detail: "Your own attendance and your team's.",
  },
  {
    href: "/admin/leave",
    label: "Leave",
    detail: "Your leave, and approvals for your direct reports.",
  },
];

export default async function ManagerHomePage() {
  const access = await requireSalesManager();
  const identity = await fetchOpsIdentity(access.userId, access.email);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="border-b border-neutral-800 pb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          ONEDECORE Manager Workspace
        </span>
        <h1 className="mt-3 font-serif text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
          {identity.displayName}
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sales Manager
        </p>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-neutral-400">
          This is your workspace. The sales dashboard is being designed around how
          the role is actually used — until it lands, everything you work with is
          one link away below.
        </p>
      </header>

      <section className="mt-8" aria-labelledby="manager-workspaces">
        <h2
          id="manager-workspaces"
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          Your workspaces
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {WORKSPACES.map((workspace) => (
            <li key={workspace.href}>
              <Link
                href={workspace.href}
                className="flex min-h-11 flex-col justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
              >
                <span className="text-sm font-semibold text-neutral-100">
                  {workspace.label}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-neutral-400">
                  {workspace.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-800 pt-6">
        <p className="text-[11px] text-neutral-500">
          Restricted System — Unauthorized access attempts are monitored and logged.
        </p>
        {/*
          * The same sign-out the rest of the workspace uses: an ordinary POST to
          * the existing route, so it works with JavaScript disabled and clears
          * the session through the one path that knows how.
          */}
        <form method="post" action="/auth/signout">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
          >
            Sign out
          </button>
        </form>
      </footer>
    </main>
  );
}
