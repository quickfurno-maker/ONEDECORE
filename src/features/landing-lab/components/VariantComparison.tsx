"use client";

import type { LandingPageVersion } from "../contracts/page-model.ts";
import { LandingPagePreview } from "./LandingPagePreview.tsx";

interface VariantComparisonProps {
  readonly left: LandingPageVersion;
  readonly right: LandingPageVersion;
}

export function VariantComparison({ left, right }: VariantComparisonProps) {
  return (
    <section
      className="grid gap-4 lg:grid-cols-2"
      data-testid="variant-comparison"
      aria-label="Variant comparison"
    >
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-100">
          {left.label} (v{left.versionNumber})
        </h3>
        <LandingPagePreview blocks={left.blocks} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-100">
          {right.label} (v{right.versionNumber})
        </h3>
        <LandingPagePreview blocks={right.blocks} />
      </div>
    </section>
  );
}
