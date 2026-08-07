"use client";

import type { LeadFormPlaceholderBlock } from "../contracts/blocks.ts";

interface LeadFormBlockPreviewProps {
  readonly block: LeadFormPlaceholderBlock;
}

export function LeadFormBlockPreview({ block }: LeadFormBlockPreviewProps) {
  return (
    <form
      className="rounded-md border border-dashed border-neutral-700 bg-neutral-900/50 p-4"
      data-testid="lead-form-block-preview"
      onSubmit={(event) => event.preventDefault()}
      aria-disabled="true"
    >
      <h3 className="text-base font-medium text-neutral-100">{block.headline}</h3>
      {block.helperText ? (
        <p className="mt-1 text-sm text-neutral-400">{block.helperText}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        <label className="block text-sm text-neutral-300">
          Name
          <input
            disabled
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-400"
            placeholder="Preview only"
          />
        </label>
        <label className="block text-sm text-neutral-300">
          Phone
          <input
            disabled
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-400"
            placeholder="Preview only"
          />
        </label>
      </div>
      <button
        type="button"
        disabled
        className="mt-4 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
      >
        {block.submitLabel}
      </button>
      <p className="mt-2 text-xs text-amber-200" role="status">
        Prebuild preview — form does not submit.
      </p>
    </form>
  );
}
