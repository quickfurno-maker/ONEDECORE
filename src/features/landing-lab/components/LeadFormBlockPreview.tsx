import type { LeadFormPlaceholderBlock } from "../contracts/blocks.ts";

/**
 * What the editor sees where the lead block will sit. Not a form.
 *
 * WHY IT STOPPED BEING A `<form>`
 *
 * It rendered a real `<form>` element with real (disabled) inputs and a
 * `preventDefault` submit handler. It never submitted, but it was structurally
 * a second lead form in the codebase — one more thing to find when auditing
 * "how many public lead forms are there", and one keystroke away from becoming
 * a real one if somebody removed a `disabled`.
 *
 * The published page does not render fields here either: the block is a
 * headline, helper text and a button that opens the one canonical consultation
 * sheet. So the honest preview is that shape, not an imitation of a form the
 * visitor will never see.
 *
 * No `"use client"`: nothing here is interactive.
 */
export function LeadFormBlockPreview({
  block,
}: {
  readonly block: LeadFormPlaceholderBlock;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-neutral-700 bg-neutral-900/50 p-4"
      data-testid="lead-form-block-preview"
    >
      <h3 className="text-base font-medium text-neutral-100">{block.headline}</h3>
      {block.helperText ? (
        <p className="mt-1 text-sm text-neutral-400">{block.helperText}</p>
      ) : null}

      <p className="mt-4 rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-400">
        {block.submitLabel}
      </p>

      <p className="mt-2 text-xs text-amber-200" role="status">
        Preview only. On the published page this opens the ONEDECORE
        consultation form.
      </p>
    </div>
  );
}
