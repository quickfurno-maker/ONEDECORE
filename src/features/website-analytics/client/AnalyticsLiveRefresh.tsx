"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export function AnalyticsLiveRefresh({
  loadedAt,
}: {
  readonly loadedAt: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, router]);

  const refreshedAt = new Date(loadedAt);
  const label = Number.isNaN(refreshedAt.getTime())
    ? "just now"
    : refreshedAt.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
      <span>{pending ? "Refreshingâ€¦" : "Updated " + label}</span>
      <span aria-hidden="true">Â·</span>
      <span>{enabled ? "Auto-refresh 30s" : "Auto-refresh paused"}</span>
      <button
        type="button"
        className="rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:border-neutral-500"
        onClick={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
        disabled={pending}
      >
        Refresh now
      </button>
      <button
        type="button"
        className="rounded border border-neutral-800 px-2 py-1 text-neutral-400 hover:border-neutral-600"
        onClick={() => setEnabled((value) => !value)}
      >
        {enabled ? "Pause live" : "Resume live"}
      </button>
    </div>
  );
}
