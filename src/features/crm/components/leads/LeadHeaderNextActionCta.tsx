"use client";

import { useLeadActions } from "./LeadActionsProvider.tsx";

/**
 * The header's "no primary next action" call to action.
 *
 * It performs NO mutation. It dispatches the existing `create-activity` intent
 * on `LeadActionsProvider`, exactly as the quick actions do, and
 * `LeadActivityWorkspace` remains the single authority that scrolls to, focuses
 * and submits the create form. A second activity mutation here would be a second
 * place for ownership and assignment rules to drift.
 *
 * Gating mirrors `LeadActivityWorkspace`'s own `showNoNextAction` exactly. In
 * particular an UNASSIGNED lead gets an honest explanation rather than a button
 * that would open a form the canonical rules refuse — an actionable-looking
 * control that cannot work is worse than none.
 */

interface LeadHeaderNextActionCtaProps {
  /** True when the lead has an owner. Canonical prerequisite for a next action. */
  readonly isAssigned: boolean;
  readonly canManageLeadFollowUps: boolean;
  readonly isTerminal: boolean;
  readonly isOnHold: boolean;
}

export function LeadHeaderNextActionCta({
  isAssigned,
  canManageLeadFollowUps,
  isTerminal,
  isOnHold,
}: LeadHeaderNextActionCtaProps) {
  const actions = useLeadActions();

  // No permission, closed, or parked: the header states the fact and stops.
  // Terminal and on-hold leads are not supposed to gain next actions.
  if (!canManageLeadFollowUps || isTerminal || isOnHold) {
    return null;
  }

  if (!isAssigned) {
    return (
      <span
        className="text-[11px] text-[var(--crm-text-secondary)]"
        data-testid="crm-header-next-action-needs-assignment"
      >
        Assign an owner to schedule one
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        actions?.dispatchIntent({ kind: "create-activity", activityType: null })
      }
      // 44px minimum: this is a primary field action on a phone.
      className="inline-flex min-h-11 items-center rounded-[10px] border border-[var(--crm-primary)] bg-[var(--crm-primary-soft)] px-3 text-[12px] font-semibold text-[var(--crm-primary)] transition hover:bg-[var(--crm-primary)] hover:text-[var(--crm-on-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
      data-testid="crm-header-add-next-action"
    >
      + Add next action
    </button>
  );
}
