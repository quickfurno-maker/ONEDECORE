"use client";

import { useState } from "react";
import type { QuotationClientDecisionType } from "../contracts/client-decision.ts";
import type { QuotationRevisionRef } from "../contracts/reference.ts";

interface ClientDecisionPanelProps {
  readonly revision: QuotationRevisionRef;
  readonly disabled?: boolean;
  readonly onDecision: (
    decision: QuotationClientDecisionType,
    note: string | null
  ) => Promise<{ success: boolean; message?: string }>;
}

export function ClientDecisionPanel({
  revision,
  disabled = false,
  onDecision,
}: ClientDecisionPanelProps) {
  const [pending, setPending] = useState<QuotationClientDecisionType | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(decision: QuotationClientDecisionType) {
    if (pending) return;
    if (decision !== "accept") {
      const trimmed = note.trim();
      if (trimmed.length < 10) {
        setMessage("Please provide at least 10 characters explaining your decision.");
        return;
      }
    }
    setPending(decision);
    setMessage(null);
    try {
      const result = await onDecision(decision, decision === "accept" ? null : note.trim());
      setMessage(result.success ? "Decision recorded in prebuild adapter." : result.message ?? "Decision failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-label="Client quotation decision"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <p className="text-sm text-neutral-300">
        You are responding to {revision.quotationReference} revision {revision.revisionNumber}.
      </p>
      <label className="mt-4 block text-sm text-neutral-200">
        Note (required for reject / revision request)
        <textarea
          className="mt-1 block min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Client decision note"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled || pending !== null}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => submit("accept")}
        >
          Accept quotation
        </button>
        <button
          type="button"
          disabled={disabled || pending !== null}
          className="rounded-md border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50"
          onClick={() => submit("reject")}
        >
          Reject
        </button>
        <button
          type="button"
          disabled={disabled || pending !== null}
          className="rounded-md border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          onClick={() => submit("request_revision")}
        >
          Request revision
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-neutral-200" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
