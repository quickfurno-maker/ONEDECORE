"use client";

import type { KritiError } from "../contracts/errors.ts";
import type { KritiResult } from "../contracts/result.ts";
import { KRITI_HUMAN_CONTROL_DISCLAIMER } from "../contracts/human-control.ts";
import { buildKritiDisplayModel } from "../ui/extract-kriti-display.ts";
import { kritiPlainTextLines } from "../ui/render-kriti-safe-text.ts";
import { KritiWarnings } from "./KritiWarnings.tsx";

interface KritiResultCardProps {
  readonly result: KritiResult;
}

export function KritiResultCard({ result }: KritiResultCardProps) {
  if (!result.ok) {
    return <KritiErrorCard error={result.error} />;
  }

  const display = buildKritiDisplayModel(result.suggestion);

  return (
    <article
      aria-label="Kriti suggestion"
      className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {result.suggestion.schemaName}
        </p>
        <p className="text-xs text-neutral-400">{KRITI_HUMAN_CONTROL_DISCLAIMER}</p>
      </header>
      <KritiWarnings
        warnings={display.warnings}
        humanReviewRequired={display.humanReviewRequired}
      />
      {display.primaryText ? (
        <div className="space-y-1 text-sm text-neutral-100">
          {kritiPlainTextLines(display.primaryText).map((line, index) => (
            <p key={`${index}-${line.slice(0, 24)}`}>{line || "\u00a0"}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400">No displayable suggestion text.</p>
      )}
    </article>
  );
}

function KritiErrorCard({ error }: { error: KritiError }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100"
    >
      <p className="font-medium">{error.code}</p>
      <p className="mt-1 text-red-100/90">{error.message}</p>
    </div>
  );
}
