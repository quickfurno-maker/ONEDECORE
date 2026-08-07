"use client";

import type { AudienceVersion } from "../contracts/audience-rule.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface AudienceVersionSummaryProps {
  readonly version: AudienceVersion;
}

export function AudienceVersionSummary({ version }: AudienceVersionSummaryProps) {
  return (
    <section aria-label="Audience version summary" aria-live="polite" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Frozen audience version</h3>
      <dl className="grid gap-2 text-sm text-neutral-300">
        <div>
          <dt className="text-neutral-500">Version ID</dt>
          <dd>{version.audienceVersionId}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Rule hash</dt>
          <dd className="font-mono text-xs break-all">{version.ruleHash}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Frozen at</dt>
          <dd>{version.frozenAt}</dd>
        </div>
      </dl>
    </section>
  );
}
