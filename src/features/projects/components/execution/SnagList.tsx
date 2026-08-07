"use client";

import { useState } from "react";
import type { SnagItem } from "../../execution/domain/snag-contract.ts";

interface SnagListProps {
  readonly snags: readonly SnagItem[];
  readonly readOnly?: boolean;
  readonly onResolveSnag: (
    snagRef: string,
    evidenceRefs: readonly string[]
  ) => Promise<{ success: boolean; message?: string }>;
}

export function SnagList({ snags, readOnly = false, onResolveSnag }: SnagListProps) {
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [evidenceByRef, setEvidenceByRef] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function resolve(snagRef: string) {
    if (pendingRef || readOnly) return;
    const evidence = evidenceByRef[snagRef]?.trim();
    if (!evidence) {
      setMessage("Evidence reference is required to resolve a snag.");
      return;
    }
    setPendingRef(snagRef);
    setMessage(null);
    try {
      const result = await onResolveSnag(snagRef, [evidence]);
      setMessage(result.success ? "Snag resolution recorded in prebuild adapter." : result.message ?? "Resolve failed.");
    } finally {
      setPendingRef(null);
    }
  }

  return (
    <section
      aria-label="Snag list"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Snag list</h2>
      {snags.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No snags recorded.</p>
      ) : (
        <ul className="mt-4 space-y-4" role="list">
          {snags.map((snag) => (
            <li
              key={snag.snagRef}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
            >
              <p className="text-sm font-medium text-neutral-100">{snag.description}</p>
              <p className="mt-1 text-xs text-neutral-400">
                Status: <span className="text-neutral-200">{snag.status}</span>
              </p>
              {snag.status !== "resolved" && !readOnly ? (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs text-neutral-300">
                    Resolution evidence
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                      value={evidenceByRef[snag.snagRef] ?? ""}
                      onChange={(event) =>
                        setEvidenceByRef((current) => ({
                          ...current,
                          [snag.snagRef]: event.target.value,
                        }))
                      }
                      aria-label={`Evidence for snag ${snag.snagRef}`}
                      disabled={pendingRef !== null}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={pendingRef !== null}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    onClick={() => resolve(snag.snagRef)}
                  >
                    Mark resolved
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {message ? (
        <p className="mt-4 text-sm text-neutral-300" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
