"use client";

import type { LandingBlock } from "../contracts/blocks.ts";
import type { LandingPageVersion } from "../contracts/page-model.ts";
import { LANDING_LAB_PREBUILD_BANNER } from "../fixtures/landing-fixtures.ts";
import { BlockPalette } from "./BlockPalette.tsx";
import { LandingPagePreview } from "./LandingPagePreview.tsx";
import { PageBlockEditor } from "./PageBlockEditor.tsx";
import { PageOutline } from "./PageOutline.tsx";
import { VersionBanner } from "./VersionBanner.tsx";

interface LandingPageEditorShellProps {
  readonly version: LandingPageVersion;
  readonly readOnly?: boolean;
  readonly onBlocksChange?: (blocks: readonly LandingBlock[]) => void;
}

export function LandingPageEditorShell({
  version,
  readOnly = false,
  onBlocksChange,
}: LandingPageEditorShellProps) {
  const blocks = version.blocks;
  const selectedBlockId = blocks[0]?.blockId ?? null;

  return (
    <div className="space-y-4" data-testid="landing-page-editor-shell">
      <div
        role="status"
        className="rounded-md border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
      >
        {LANDING_LAB_PREBUILD_BANNER}
      </div>
      <VersionBanner version={version} />
      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_minmax(280px,0.9fr)]">
        <aside className="space-y-4">
          <BlockPalette readOnly={readOnly} />
          <PageOutline blocks={blocks} selectedBlockId={selectedBlockId} />
        </aside>
        <section className="space-y-4">
          <PageBlockEditor
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            readOnly={readOnly}
            onBlocksChange={onBlocksChange}
          />
        </section>
        <aside>
          <LandingPagePreview blocks={blocks} />
        </aside>
      </div>
    </div>
  );
}
