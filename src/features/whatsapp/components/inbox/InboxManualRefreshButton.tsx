"use client";

import { useRouter } from "next/navigation";

export function InboxManualRefreshButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-emerald-400/60 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      Refresh
    </button>
  );
}
