"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * What "fail closed" looks like on the Manager dashboard.
 *
 * The dashboard's primary CRM read is allowed to throw. This is why: a lost
 * primary read must produce a page that says so, not a page of zeros. Zeros
 * read as good news — no breaches, no overdue work, nothing unassigned — and a
 * dashboard that reports good news because it could not read anything is worse
 * than a dashboard that is down.
 *
 * The reason is not shown. It is logged with its digest and the visitor is told
 * what happened, because an error message from the database is a description of
 * the database.
 */
export default function ManagerDashboardError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[MANAGER] Redacted operation: MANAGER_DASHBOARD_ROUTE_ERROR",
      error.digest ? { digest: error.digest } : undefined
    );
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <section
        role="alert"
        className="rounded-lg border border-red-900/60 bg-red-950/30 px-6 py-8"
      >
        <h1 className="text-lg font-semibold text-red-100">
          We could not load your dashboard.
        </h1>
        <p className="mt-2 text-sm text-red-200">
          The sales figures could not be read, so nothing is shown rather than
          showing numbers we cannot stand behind. Your workspaces are still
          open.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-11 rounded-md bg-red-900/60 px-4 py-2 text-sm font-semibold text-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            Try again
          </button>
          <Link
            href="/admin/crm/leads"
            className="inline-flex min-h-11 items-center rounded-md border border-red-900/60 px-4 py-2 text-sm font-medium text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            Go to enquiries
          </Link>
        </div>
      </section>
    </main>
  );
}
