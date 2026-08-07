"use client";

import { useState } from "react";

export interface ClientApprovalPanelCallbacks {
  readonly onApprove?: (
    note: string | null
  ) => Promise<{ success: boolean; message?: string }>;
}

export interface ClientApprovalPanelProps {
  readonly projectReference: string;
  readonly disabled?: boolean;
  readonly callbacks?: ClientApprovalPanelCallbacks;
}

export function ClientApprovalPanel({
  projectReference,
  disabled = false,
  callbacks,
}: ClientApprovalPanelProps) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (pending || !callbacks?.onApprove) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await callbacks.onApprove(note.trim() || null);
      setMessage(
        result.success
          ? "Client approval recorded via callback."
          : result.message ?? "Client approval failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Client design approval"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Client approval</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Record auditable client approval for {projectReference}.
      </p>
      <label className="mt-3 block text-sm text-neutral-300">
        Approval note (optional)
        <textarea
          className="mt-1 block min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Client approval note"
        />
      </label>
      {callbacks?.onApprove ? (
        <button
          type="button"
          disabled={disabled || pending}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          Record client approval
        </button>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-neutral-400">
          {message}
        </p>
      ) : null}
    </section>
  );
}
