"use client";

import { useState } from "react";
import {
  DESIGN_REVISION_RETURN_STATES,
  type DesignState,
  getDesignStateLabel,
} from "../../contracts/design-states.ts";

export interface DesignRevisionPanelCallbacks {
  readonly onSubmitRevision?: (
    returnState: DesignState,
    note: string
  ) => Promise<{ success: boolean; message?: string }>;
}

export interface DesignRevisionPanelProps {
  readonly disabled?: boolean;
  readonly callbacks?: DesignRevisionPanelCallbacks;
}

export function DesignRevisionPanel({
  disabled = false,
  callbacks,
}: DesignRevisionPanelProps) {
  const [returnState, setReturnState] = useState<DesignState>("concept_design");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    if (!callbacks?.onSubmitRevision) return;
    const trimmed = note.trim();
    if (trimmed.length < 10) {
      setMessage("Revision note must be at least 10 characters.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await callbacks.onSubmitRevision(returnState, trimmed);
      setMessage(
        result.success
          ? "Revision request recorded via callback."
          : result.message ?? "Revision request failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Design revision"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Request revision</h2>
      <label className="mt-3 block text-sm text-neutral-300">
        Return stage
        <select
          className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
          value={returnState}
          onChange={(event) => setReturnState(event.target.value as DesignState)}
          aria-label="Revision return stage"
        >
          {DESIGN_REVISION_RETURN_STATES.map((state) => (
            <option key={state} value={state}>
              {getDesignStateLabel(state)}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm text-neutral-300">
        Revision note
        <textarea
          className="mt-1 block min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Revision note"
        />
      </label>
      {callbacks?.onSubmitRevision ? (
        <button
          type="button"
          disabled={disabled || pending}
          className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          Submit revision
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
