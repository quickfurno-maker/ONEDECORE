"use client";

import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";

export interface DesignEvidencePanelCallbacks {
  readonly onAttachEvidence?: (evidenceRef: string) => void;
  readonly onViewEvidence?: (evidenceRef: string) => void;
}

export interface DesignEvidencePanelProps {
  readonly evidence: readonly ProjectEvidenceRef[];
  readonly callbacks?: DesignEvidencePanelCallbacks;
}

export function DesignEvidencePanel({
  evidence,
  callbacks,
}: DesignEvidencePanelProps) {
  return (
    <section
      aria-label="Design evidence"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Evidence</h2>
      {evidence.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No evidence attached.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {evidence.map((item) => (
            <li
              key={item.evidenceRef}
              className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-300"
            >
              <span>
                {item.evidenceType} v{item.version}
              </span>
              {callbacks?.onViewEvidence ? (
                <button
                  type="button"
                  className="text-emerald-300 underline"
                  onClick={() => callbacks.onViewEvidence?.(item.evidenceRef)}
                >
                  View
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {callbacks?.onAttachEvidence ? (
        <button
          type="button"
          className="mt-4 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
          onClick={() => callbacks.onAttachEvidence?.("new-evidence")}
        >
          Attach evidence
        </button>
      ) : null}
    </section>
  );
}
