"use client";

export interface DesignHoldBannerCallbacks {
  readonly onResume?: () => void;
  readonly onViewReason?: () => void;
}

export interface DesignHoldBannerProps {
  readonly heldFromLabel: string;
  readonly reason: string | null;
  readonly callbacks?: DesignHoldBannerCallbacks;
}

export function DesignHoldBanner({
  heldFromLabel,
  reason,
  callbacks,
}: DesignHoldBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3"
    >
      <p className="text-sm font-semibold text-amber-100">Design on hold</p>
      <p className="mt-1 text-sm text-amber-200/90">
        Paused before {heldFromLabel}.
        {reason ? ` Reason: ${reason}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {callbacks?.onResume ? (
          <button
            type="button"
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-neutral-950"
            onClick={() => callbacks.onResume?.()}
          >
            Resume design
          </button>
        ) : null}
        {callbacks?.onViewReason ? (
          <button
            type="button"
            className="rounded-md border border-amber-700 px-3 py-2 text-sm text-amber-100"
            onClick={() => callbacks.onViewReason?.()}
          >
            View hold reason
          </button>
        ) : null}
      </div>
    </div>
  );
}
