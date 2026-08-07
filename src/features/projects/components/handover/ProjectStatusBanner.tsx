"use client";

import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";

interface ProjectStatusBannerProps {
  readonly model: HandoverDisplayModel;
}

export function ProjectStatusBanner({ model }: ProjectStatusBannerProps) {
  const tone =
    model.handoverState === "handover_accepted"
      ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-100"
      : "border-amber-700/40 bg-amber-950/20 text-amber-100";

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${tone}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">{model.handoverStateLabel}</p>
      {model.statusBanner ? (
        <p className="mt-1 text-neutral-200">{model.statusBanner}</p>
      ) : null}
      {model.isExecutionEligible ? (
        <p className="mt-2 text-xs uppercase tracking-wide text-emerald-200/80">
          Execution eligible
        </p>
      ) : (
        <p className="mt-2 text-xs uppercase tracking-wide text-amber-200/80">
          Execution locked
        </p>
      )}
    </div>
  );
}
