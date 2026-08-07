"use client";

import type { KritiPanelStatus } from "../ui/kriti-panel-state.ts";

interface KritiRetryControlProps {
  readonly status: KritiPanelStatus;
  readonly retryable: boolean;
  readonly disabled?: boolean;
  readonly onRetry: () => void;
}

export function KritiRetryControl({
  status,
  retryable,
  disabled = false,
  onRetry,
}: KritiRetryControlProps) {
  const canRetry =
    retryable &&
    (status === "failure" || status === "rate_limited" || status === "invalid_output");

  if (!canRetry) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRetry}
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Retry assistance
    </button>
  );
}
