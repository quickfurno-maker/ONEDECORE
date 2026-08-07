"use client";

import type { LandingBlock } from "../contracts/blocks.ts";

interface PageOutlineProps {
  readonly blocks: readonly LandingBlock[];
  readonly selectedBlockId: string | null;
}

export function PageOutline({ blocks, selectedBlockId }: PageOutlineProps) {
  return (
    <nav
      aria-label="Page outline"
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
      data-testid="page-outline"
    >
      <h2 className="text-sm font-medium text-neutral-100">Outline</h2>
      <ol className="mt-3 space-y-2">
        {blocks.map((block, index) => {
          const selected = block.blockId === selectedBlockId;
          return (
            <li key={block.blockId}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  selected
                    ? "border border-neutral-600 bg-neutral-900 text-neutral-50"
                    : "border border-transparent text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                <span className="text-xs text-neutral-500">{index + 1}.</span> {block.type}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
