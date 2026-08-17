import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPermission } from "@/server/auth";
import { hasAnyCrmLeadReadPermission } from "@/features/crm/server/crm-permissions";
import { hasAnyStaffNavPermission } from "@/features/staff-admin/server/staff-permissions";
import { hasAnyAttendanceNavPermission } from "@/features/staff-attendance/server/attendance-auth";
import { hasAnyLeaveNavPermission } from "@/features/staff-leave/server/leave-auth";
import { hasAnyWhatsappInboxReadPermission } from "@/features/whatsapp/server/whatsapp-permissions";
import { hasAnyProjectReadPermission } from "@/features/projects/server/project-permissions";
import { hasAnyCampaignReadPermission } from "@/features/marketing/server/campaign-permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Portal | ONEDECORE",
  description: "Internal administrative portal for ONEDECORE staff.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaffPermission("admin.access", "/admin");
  const [showCrmLink, showWhatsappLink, showStaffLink, showAttendanceLink, showLeaveLink, showProjectsLink, showCampaignsLink] =
    await Promise.all([
      hasAnyCrmLeadReadPermission(),
      hasAnyWhatsappInboxReadPermission(),
      hasAnyStaffNavPermission(),
      hasAnyAttendanceNavPermission(),
      hasAnyLeaveNavPermission(),
      hasAnyProjectReadPermission(),
      hasAnyCampaignReadPermission(),
    ]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-serif text-lg font-bold tracking-tight text-neutral-50">
              ONEDECORE
            </span>
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Admin Shell
            </span>
          </div>

          <nav
            aria-label="Admin"
            className="flex flex-wrap items-center gap-3 sm:gap-6"
          >
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/portfolio"
              className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Portfolio CMS
            </Link>
            {showStaffLink ? (
              <Link
                href="/admin/staff"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Staff
              </Link>
            ) : null}
            {showAttendanceLink ? (
              <Link
                href="/admin/attendance"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Attendance
              </Link>
            ) : null}
            {showLeaveLink ? (
              <Link
                href="/admin/leave"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Leave
              </Link>
            ) : null}
            {showCrmLink ? (
              <>
                <Link
                  href="/admin/crm/leads"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  CRM
                </Link>
                <Link
                  href="/admin/quotations"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  Quotations
                </Link>
              </>
            ) : null}
            {showProjectsLink ? (
              <Link
                href="/admin/projects"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Projects
              </Link>
            ) : null}
            {showCampaignsLink ? (
              <Link
                href="/admin/campaigns"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Campaigns
              </Link>
            ) : null}
            {showWhatsappLink ? (
              <Link
                href="/admin/whatsapp/inbox"
                className="inline-flex min-h-11 items-center text-xs font-medium text-neutral-300 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                WhatsApp Inbox
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="text-left lg:text-right">
              <span className="block text-[11px] uppercase tracking-wider text-neutral-500">
                Staff Identity
              </span>
              <span className="text-xs font-medium text-neutral-200">
                {session.email || session.userId}
              </span>
            </div>

            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="min-h-11 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-amber-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
