"use client";

import { useState, useTransition } from "react";
import { setProjectStatusAction } from "../server/portfolio-cms-actions";

interface PortfolioStatusControlsProps {
  projectId: string;
  currentStatus: "draft" | "published" | "archived";
  hasService: boolean;
  hasReadyCover: boolean;
}

export function PortfolioStatusControls({
  projectId,
  currentStatus,
  hasService,
  hasReadyCover,
}: PortfolioStatusControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canPublish = hasService && hasReadyCover;

  function handleStatusChange(targetStatus: "draft" | "published" | "archived") {
    setError(null);
    startTransition(async () => {
      const res = await setProjectStatusAction(projectId, targetStatus);
      if (res?.error) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-[#E5E0DA] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-semibold text-[#1A1A1A]">Publication Status</h2>
          <p className="mt-1 text-sm text-[#666059]">
            Current State:{" "}
            <span
              className={`inline-block font-semibold uppercase tracking-wider text-xs px-2.5 py-0.5 rounded-full ${
                currentStatus === "published"
                  ? "bg-emerald-100 text-emerald-800"
                  : currentStatus === "archived"
                  ? "bg-stone-200 text-stone-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {currentStatus}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentStatus !== "published" && (
            <button
              type="button"
              disabled={isPending || !canPublish}
              onClick={() => handleStatusChange("published")}
              className="rounded-md bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333333] disabled:opacity-50"
            >
              {isPending ? "Updating..." : "Publish Project"}
            </button>
          )}

          {currentStatus === "published" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("draft")}
              className="rounded-md border border-[#E5E0DA] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] transition hover:bg-[#F9F7F5] disabled:opacity-50"
            >
              {isPending ? "Updating..." : "Return to Draft"}
            </button>
          )}

          {currentStatus !== "archived" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("archived")}
              className="rounded-md border border-[#E5E0DA] bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {currentStatus !== "published" && !canPublish && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
          <p className="font-semibold">Prerequisites for publishing:</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            <li className={hasService ? "text-emerald-700 font-medium" : "text-amber-800"}>
              {hasService ? "✓ Service assigned" : "✗ At least one ONEDECORE service must be assigned"}
            </li>
            <li className={hasReadyCover ? "text-emerald-700 font-medium" : "text-amber-800"}>
              {hasReadyCover ? "✓ Ready cover image uploaded" : "✗ At least one ready cover image must be uploaded"}
            </li>
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
