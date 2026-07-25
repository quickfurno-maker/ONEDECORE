import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Shell | ONEDECORE Admin",
  description: "Internal staff portal shell.",
};

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-neutral-50">
          Staff Operations Portal
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Phase 2D1 Staff Authentication &amp; Authorization Foundation Active.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Identity &amp; RBAC
            </h2>
            <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Verified
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Database-backed RBAC with <code className="text-amber-300">admin.access</code> RPC verification active.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Portfolio CMS
            </h2>
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
              Phase 5
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Case study models, room tags, and storage bucket policies scheduled for Phase 5.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Lead CRM Engine
            </h2>
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
              Phase 7
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Sales qualification pipeline, lead management, and n8n webhooks scheduled for Phase 7.
          </p>
        </div>
      </div>
    </div>
  );
}
