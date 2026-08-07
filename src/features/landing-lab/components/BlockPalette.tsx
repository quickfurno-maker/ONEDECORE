"use client";

import { LANDING_BLOCK_TYPES } from "../contracts/blocks.ts";

interface BlockPaletteProps {
  readonly readOnly?: boolean;
}

const BLOCK_LABELS: Record<(typeof LANDING_BLOCK_TYPES)[number], string> = {
  hero: "Hero",
  trust_proof: "Trust proof",
  service_highlights: "Service highlights",
  process: "Process",
  portfolio_preview: "Portfolio preview",
  testimonials: "Testimonials",
  faq: "FAQ",
  offer_cta: "Offer CTA",
  lead_form_placeholder: "Lead form",
  footer: "Footer",
};

export function BlockPalette({ readOnly = false }: BlockPaletteProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4" data-testid="block-palette">
      <h2 className="text-sm font-medium text-neutral-100">Block palette</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Structured blocks only. Drag-and-drop is not enabled in prebuild.
      </p>
      <ul className="mt-3 space-y-2">
        {LANDING_BLOCK_TYPES.map((type) => (
          <li key={type}>
            <button
              type="button"
              disabled={readOnly}
              className="w-full rounded-md border border-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {BLOCK_LABELS[type]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
