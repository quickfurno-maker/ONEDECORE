"use client";

import { useState } from "react";

export interface ProductionReadyPanelCallbacks {
  readonly onApproveProductionReady?: (
    note: string
  ) => Promise<{ success: boolean; message?: string }>;
}

export interface ProductionReadyPanelProps {
  readonly leadDesignerName: string | null;
  readonly disabled?: boolean;
  readonly callbacks?: ProductionReadyPanelCallbacks;
}

export function ProductionReadyPanel({
  leadDesignerName,
  disabled = false,
  callbacks,
}: ProductionReadyPanelProps) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (pending || !callbacks?.onApproveProductionReady) return;
    const trimmed = note.trim();
    if (trimmed.length < 10) {
      setMessage("Production ready note must be at least 10 characters.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await callbacks.onApproveProductionReady(trimmed);
      setMessage(
        result.success
          ? "Production ready approval recorded via callback."
          : result.message ?? "Production ready approval failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Production ready approval"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Production ready</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Lead designer: {leadDesignerName ?? "Unassigned"}
      </p>
      <label className="mt-3 block text-sm text-neutral-300">
        Approval evidence note
        <textarea
          className="mt-1 block min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Production ready note"
        />
      </label>
      {callbacks?.onApproveProductionReady ? (
        <button
          type="button"
          disabled={disabled || pending}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          Approve production ready
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
