"use client";

import { useState } from "react";
import {
  EXECUTION_HOLD_REASON_CODES,
  type ExecutionHoldRecord,
} from "../../execution/domain/hold-delay-contract.ts";
import type { ExecutionState } from "../../execution/contracts/execution-states.ts";
import { getExecutionStateLabel } from "../../execution/contracts/execution-states.ts";

interface ProjectHoldPanelProps {
  readonly currentState: ExecutionState;
  readonly holdRecord: ExecutionHoldRecord | null;
  readonly readOnly?: boolean;
  readonly onEnterHold: (input: {
    reasonCode: string;
    humanNote: string;
  }) => Promise<{ success: boolean; message?: string }>;
  readonly onResumeHold: () => Promise<{ success: boolean; message?: string }>;
}

export function ProjectHoldPanel({
  currentState,
  holdRecord,
  readOnly = false,
  onEnterHold,
  onResumeHold,
}: ProjectHoldPanelProps) {
  const [reasonCode, setReasonCode] = useState<string>(EXECUTION_HOLD_REASON_CODES[0]);
  const [humanNote, setHumanNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enterHold() {
    if (pending || readOnly) return;
    if (humanNote.trim().length < 10 || humanNote.trim().length > 1000) {
      setMessage("Hold note must be between 10 and 1000 characters.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await onEnterHold({ reasonCode, humanNote: humanNote.trim() });
      setMessage(result.success ? "Hold recorded in prebuild adapter." : result.message ?? "Hold failed.");
    } finally {
      setPending(false);
    }
  }

  async function resume() {
    if (pending || readOnly) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await onResumeHold();
      setMessage(result.success ? "Resume recorded in prebuild adapter." : result.message ?? "Resume failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Project hold controls"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Hold / delay</h2>

      {currentState === "on_hold" && holdRecord ? (
        <div className="mt-3 space-y-2 text-sm text-neutral-300">
          <p role="status">
            On hold since {new Date(holdRecord.enteredAt).toLocaleString()} — resume target:{" "}
            <span className="font-medium text-neutral-100">
              {getExecutionStateLabel(holdRecord.resumeTarget)}
            </span>
          </p>
          <p>{holdRecord.humanNote}</p>
          <button
            type="button"
            disabled={readOnly || pending}
            className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={resume}
          >
            Resume execution
          </button>
        </div>
      ) : currentState !== "completed" && currentState !== "cancelled" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-neutral-200">
            Reason code
            <select
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              aria-label="Hold reason code"
              disabled={readOnly || pending}
            >
              {EXECUTION_HOLD_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {code.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-neutral-200">
            Human note
            <textarea
              className="mt-1 block min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={humanNote}
              onChange={(event) => setHumanNote(event.target.value)}
              aria-label="Hold human note"
              maxLength={1000}
              disabled={readOnly || pending}
            />
          </label>
          <button
            type="button"
            disabled={readOnly || pending}
            className="rounded-md border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
            onClick={enterHold}
          >
            Place project on hold
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">Hold is not available in the current state.</p>
      )}

      {message ? (
        <p className="mt-4 text-sm text-neutral-300" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
