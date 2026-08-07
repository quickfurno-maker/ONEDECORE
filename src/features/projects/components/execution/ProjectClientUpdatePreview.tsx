"use client";

import type { ProjectClientUpdateDraft } from "../../contracts/client-update.ts";

interface ProjectClientUpdatePreviewProps {
  readonly draft: ProjectClientUpdateDraft;
}

export function ProjectClientUpdatePreview({ draft }: ProjectClientUpdatePreviewProps) {
  return (
    <section
      aria-label="Client update preview"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Client update preview</h2>
      <p className="mt-2 text-xs uppercase tracking-wide text-amber-300">
        Human review required — Kriti wording assist only
      </p>
      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm text-neutral-200">
        {draft.draftText}
      </div>
      {draft.missingFacts.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-neutral-400">Missing facts</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200" role="list">
            {draft.missingFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {draft.warnings.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-neutral-400">Warnings</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-200" role="list">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
