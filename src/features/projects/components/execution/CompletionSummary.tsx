"use client";

import { useState } from "react";
import type { ExecutionState } from "../../execution/contracts/execution-states.ts";
import { getExecutionStateLabel } from "../../execution/contracts/execution-states.ts";

interface CompletionSummaryProps {
  readonly executionState: ExecutionState;
  readonly readOnly?: boolean;
  readonly onCompleteProject: (
    acknowledgementRef: string
  ) => Promise<{ success: boolean; message?: string }>;
}

export function CompletionSummary({
  executionState,
  readOnly = false,
  onCompleteProject,
}: CompletionSummaryProps) {
  const [ackRef, setAckRef] = useState("ack-completion-prebuild");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (pending || readOnly) return;
    if (!ackRef.trim()) {
      setMessage("Completion acknowledgement reference is required.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await onCompleteProject(ackRef.trim());
      setMessage(
        result.success
          ? "Completion recorded in prebuild adapter."
          : result.message ?? "Completion failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Completion summary"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Completion</h2>
      <p className="mt-2 text-sm text-neutral-300">
        Current state:{" "}
        <span className="font-medium text-neutral-100">
          {getExecutionStateLabel(executionState)}
        </span>
      </p>
      {executionState === "completed" ? (
        <p className="mt-2 text-sm text-emerald-200" role="status">
          Project is complete — terminal state.
        </p>
      ) : !readOnly ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-neutral-200">
            Completion acknowledgement reference
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={ackRef}
              onChange={(event) => setAckRef(event.target.value)}
              aria-label="Completion acknowledgement reference"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={submit}
          >
            Record completion acknowledgement
          </button>
        </div>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-neutral-300" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
