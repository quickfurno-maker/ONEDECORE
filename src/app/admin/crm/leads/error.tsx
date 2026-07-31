"use client";

import { useEffect } from "react";
import Link from "next/link";

interface CrmLeadsErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function CrmLeadsError({ error, reset }: CrmLeadsErrorProps) {
  useEffect(() => {
    console.error(
      "[CRM] Redacted operation: CRM_LEADS_ROUTE_ERROR",
      error.digest ? { digest: error.digest } : undefined
    );
  }, [error]);

  return (
    <section role="alert" className="rounded-lg border border-red-900/60 bg-red-950/30 px-6 py-8">
      <h1 className="text-lg font-semibold text-red-100">
        We could not load the lead workspace.
      </h1>
      <p className="mt-2 text-sm text-red-200">
        An internal error occurred while loading CRM leads. Please try again.
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
          Back to leads
        </Link>
      </div>
    </section>
  );
}
