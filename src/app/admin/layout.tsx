import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPermission } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Portal | ONEDECORE",
  description: "Internal administrative portal for ONEDECORE staff.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaffPermission("admin.access", "/admin");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-serif text-lg font-bold tracking-tight text-neutral-50">
              ONEDECORE
            </span>
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Admin Shell
            </span>
          </div>

          <nav className="flex items-center space-x-6">
            <Link
              href="/admin"
              className="text-xs font-medium text-neutral-300 hover:text-white transition"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/portfolio"
              className="text-xs font-medium text-neutral-300 hover:text-white transition"
            >
              Portfolio CMS
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <div className="text-right">
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
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-amber-400 hover:text-amber-400"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
