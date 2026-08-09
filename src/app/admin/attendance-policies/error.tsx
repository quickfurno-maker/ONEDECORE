"use client";

import { useEffect } from "react";
import Link from "next/link";

interface AttendancePoliciesErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function AttendancePoliciesError({
  error,
  reset,
}: AttendancePoliciesErrorProps) {
  useEffect(() => {
    console.error(
      "[Attendance] Redacted operation: ATTENDANCE_POLICIES_ROUTE_ERROR",
      error.digest ? { digest: error.digest } : undefined
    );
  }, [error]);

  return (
    <section role="alert" className="rounded-lg border border-red-900/60 bg-red-950/30 px-6 py-8">
      <h1 className="text-lg font-semibold text-red-100">
        We could not load attendance policies.
      </h1>
      <p className="mt-2 text-sm text-red-200">Please try again.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 rounded-md bg-red-900/60 px-4 py-2 text-sm font-semibold text-red-50"
        >
          Try again
        </button>
        <Link
          href="/admin/attendance-policies"
          className="inline-flex min-h-11 items-center rounded-md border border-red-900/60 px-4 py-2 text-sm font-medium text-red-100"
        >
          Back to policies
        </Link>
      </div>
    </section>
  );
}
