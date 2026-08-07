"use client";

import type { LandingBlock } from "../contracts/blocks.ts";
import { LeadFormBlockPreview } from "./LeadFormBlockPreview.tsx";

interface PageBlockEditorProps {
  readonly blocks: readonly LandingBlock[];
  readonly selectedBlockId: string | null;
  readonly readOnly?: boolean;
  readonly onBlocksChange?: (blocks: readonly LandingBlock[]) => void;
}

function renderBlockSummary(block: LandingBlock): string {
  switch (block.type) {
    case "hero":
      return block.headline;
    case "trust_proof":
    case "service_highlights":
    case "process":
    case "portfolio_preview":
    case "testimonials":
    case "faq":
      return block.title;
    case "offer_cta":
      return block.headline;
    case "lead_form_placeholder":
      return block.headline;
    case "footer":
      return block.legalLine;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function PageBlockEditor({
  blocks,
  selectedBlockId,
  readOnly = false,
}: PageBlockEditorProps) {
  const selected = blocks.find((block) => block.blockId === selectedBlockId) ?? blocks[0] ?? null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4" data-testid="page-block-editor">
      <h2 className="text-sm font-medium text-neutral-100">Block editor</h2>
      {selected ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{selected.type}</p>
          <p className="text-sm text-neutral-200">{renderBlockSummary(selected)}</p>
          {selected.type === "lead_form_placeholder" ? (
            <LeadFormBlockPreview block={selected} />
          ) : null}
          {!readOnly ? (
            <p className="text-xs text-neutral-500">
              Editing is limited to structured fields in prebuild. Raw HTML is not supported.
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Frozen version — read only.</p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">Select a block from the outline.</p>
      )}
    </div>
  );
}
