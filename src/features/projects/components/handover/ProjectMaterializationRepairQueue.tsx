"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { repairProjectMaterializationAction } from "../../server/project-actions.ts";

interface ProjectMaterializationRepairQueueProps {
  readonly rows: readonly {
    quotationVersionId: string;
    quotationId: string;
    quotationAcceptanceId: string;
    leadId: string;
    quotationNumber: string | null;
    acceptedAt: string | null;
  }[];
}

export function ProjectMaterializationRepairQueue({
  rows,
}: ProjectMaterializationRepairQueueProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function retry(row: ProjectMaterializationRepairQueueProps["rows"][number]) {
    setBusyId(row.quotationVersionId);
    const result = await repairProjectMaterializationAction({
      quotationVersionId: row.quotationVersionId,
    });
    setBusyId(null);
    setMessage(
      result.success
        ? `Project ${result.projectNumber ?? "created"} is ready.`
        : result.message || "Repair failed."
    );
    if (result.success) router.refresh();
  }

  return (
    <section className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
      <h2 className="text-sm font-semibold text-amber-100">Pending project materialization</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Closed-Won acceptances without a project. Super Admin and Sales Manager may retry the same canonical materializer.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No pending repair rows.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.quotationAcceptanceId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm"
            >
              <span>
                {row.quotationNumber ?? row.quotationId} · accepted{" "}
                {row.acceptedAt ? new Date(row.acceptedAt).toLocaleString() : "unknown"}
              </span>
              <button
                type="button"
                disabled={busyId === row.quotationVersionId}
                onClick={() => void retry(row)}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Retry materialization
              </button>
            </li>
          ))}
        </ul>
      )}
      {message ? <p className="mt-3 text-sm text-amber-200">{message}</p> : null}
    </section>
  );
}
