"use client";

import { useState } from "react";
import { DEFAULT_HANDOVER_CHECKLIST } from "../../execution/domain/handover-completion.ts";

interface HandoverChecklistProps {
  readonly readOnly?: boolean;
  readonly onCompleteHandover: (
    acknowledgementRef: string
  ) => Promise<{ success: boolean; message?: string }>;
}

export function HandoverChecklist({
  readOnly = false,
  onCompleteHandover,
}: HandoverChecklistProps) {
  const [ackRef, setAckRef] = useState("ack-handover-prebuild");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (pending || readOnly) return;
    if (!ackRef.trim()) {
      setMessage("Acknowledgement reference is required.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await onCompleteHandover(ackRef.trim());
      setMessage(
        result.success
          ? "Handover acknowledgement recorded in prebuild adapter."
          : result.message ?? "Handover failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Handover checklist"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Handover checklist</h2>
      <ul className="mt-3 space-y-2" role="list">
        {DEFAULT_HANDOVER_CHECKLIST.map((item) => (
          <li key={item.itemId} className="flex items-start gap-2 text-sm text-neutral-300">
            <span aria-hidden="true">{item.required ? "●" : "○"}</span>
            <span>
              {item.label}
              {item.required ? (
                <span className="ml-1 text-xs text-neutral-500">(required)</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-neutral-200">
            Acknowledgement reference
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={ackRef}
              onChange={(event) => setAckRef(event.target.value)}
              aria-label="Handover acknowledgement reference"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={submit}
          >
            Record handover acknowledgement
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
