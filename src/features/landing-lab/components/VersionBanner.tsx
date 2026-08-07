"use client";

import type { LandingPageVersion } from "../contracts/page-model.ts";
import { isLandingPageVersionFrozen } from "../contracts/page-model.ts";

interface VersionBannerProps {
  readonly version: LandingPageVersion;
}

export function VersionBanner({ version }: VersionBannerProps) {
  const frozen = isLandingPageVersionFrozen(version);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
      data-testid="version-banner"
    >
      <div>
        <p className="text-sm font-medium text-neutral-100">
          Version {version.versionNumber}: {version.label}
        </p>
        <p className="text-xs text-neutral-400">{version.pageReference}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          frozen
            ? "bg-emerald-950 text-emerald-200"
            : "bg-neutral-800 text-neutral-300"
        }`}
      >
        {frozen ? "Frozen (immutable)" : "Draft"}
      </span>
    </div>
  );
}
