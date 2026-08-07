"use client";

import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface CampaignApprovalPanelProps {
  readonly canApprove: boolean;
  readonly canRequestApproval: boolean;
  readonly selfApprovalBlocked: boolean;
  readonly disabled?: boolean;
  readonly onRequestApproval: () => void;
  readonly onApprove: () => void;
  readonly onReject: () => void;
}

export function CampaignApprovalPanel({
  canApprove,
  canRequestApproval,
  selfApprovalBlocked,
  disabled = false,
  onRequestApproval,
  onApprove,
  onReject,
}: CampaignApprovalPanelProps) {
  return (
    <section aria-label="Campaign approval" aria-live="polite" className="space-y-4">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Approval</h3>
      {selfApprovalBlocked ? (
        <p role="status" className="text-sm text-amber-200">
          Sales Manager cannot self-approve this campaign version.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canRequestApproval ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-neutral-600 px-3 py-2 text-sm"
            onClick={onRequestApproval}
          >
            Request approval
          </button>
        ) : null}
        {canApprove ? (
          <>
            <button
              type="button"
              disabled={disabled}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"
              onClick={onApprove}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={disabled}
              className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-200"
              onClick={onReject}
            >
              Reject
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
