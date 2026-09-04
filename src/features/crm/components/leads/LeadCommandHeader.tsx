import Link from "next/link";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type {
  CrmLeadDetailFollowUp,
  CrmLeadDetailOverview,
} from "../../contracts/lead-detail-dtos.ts";
import type { CrmLeadCadenceState } from "../../contracts/cadence-contracts.ts";
import {
  CRM_COMMERCIAL_STATE_LABELS,
  formatDealValue,
  formatProbabilityLabel,
  stageProbabilityBasisPoints,
  computeWeightedValuePaise,
  isParkedStage,
  type CrmLeadCommercialState,
} from "../../contracts/deal-value-contracts.ts";
import type { CrmLeadScore } from "../../contracts/lead-score-contracts.ts";
import { resolveEffectiveSalesBucket } from "../../contracts/lead-sales-bucket.ts";
import {
  isLifecycleControlledBucket,
  type CrmManualSalesTemperature,
} from "../../contracts/lead-sales-temperature.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import {
  activityDueStateClassName,
  activityDueStateLabel,
  formatActivityTimestamp,
  formatActivityTypeLabel,
  getActivityDueState,
} from "../activities/activity-ui-utils.ts";
import { LeadRiskFlagChips } from "./LeadRiskFlagChips.tsx";
import { LeadScoreChip } from "./LeadScoreChip.tsx";
import { LeadSalesBucketBadge } from "./LeadSalesBucketBadge.tsx";
import { LeadSalesTemperatureControl } from "./LeadSalesTemperatureControl.tsx";
import { LeadStatusBadge } from "./LeadStatusBadge.tsx";

/**
 * CRM 2D-1 — the lead command header (owner lock Q9).
 *
 * Answers "who is this, where are they, what do I do next, and what is it
 * worth" without scrolling. It SUMMARISES existing panels and never becomes a
 * second authority: stage transitions, assignment and cadence lifecycle all
 * stay in their own controls.
 */

interface LeadCommandHeaderProps {
  readonly leadId: string;
  readonly overview: CrmLeadDetailOverview;
  readonly ownerLabel: string;
  readonly primaryNextAction: CrmLeadDetailFollowUp | null;
  readonly score: CrmLeadScore;
  /** The stored human judgement. NULL means nobody has classified this lead. */
  readonly manualSalesTemperature: CrmManualSalesTemperature | null;
  /** False without `leads.transition`; the control renders read-only. */
  readonly canSetTemperature: boolean;
  readonly commercial: CrmLeadCommercialState;
  readonly cadence: CrmLeadCadenceState | null;
  /** Latest consent state per channel, already permission-filtered. */
  readonly consentBlocked: boolean;
  readonly canReadConsents: boolean;
  readonly quickActions: React.ReactNode;
}

function FactItem({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">
        {label}
      </dt>
      <dd
        className="truncate text-[13px] text-[var(--crm-text)]"
        title={value}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}

export function LeadCommandHeader({
  leadId,
  overview,
  ownerLabel,
  primaryNextAction,
  score,
  manualSalesTemperature,
  canSetTemperature,
  commercial,
  cadence,
  consentBlocked,
  canReadConsents,
  quickActions,
}: LeadCommandHeaderProps) {
  const status = overview.status as LeadStageCode;

  // ONE canonical resolution, shared with the list and the pipeline.
  const effective = resolveEffectiveSalesBucket(
    status,
    score.band,
    manualSalesTemperature
  );
  const lifecycleControlled = isLifecycleControlledBucket(effective.bucket);
  const probabilityBp = stageProbabilityBasisPoints(status);
  const weightedPaise = computeWeightedValuePaise(
    commercial.taxableBasePaise,
    status
  );
  const parked = isParkedStage(status);

  const dueState = primaryNextAction
    ? getActivityDueState(primaryNextAction.dueAt)
    : null;

  return (
    <header
      className="crm-surface p-3.5 sm:p-5"
      data-testid="crm-lead-command-header"
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/crm/leads"
          className="crm-btn crm-btn-ghost min-h-9 px-2 text-[12px]"
        >
          ← Leads
        </Link>
        <p className="truncate text-[11px] text-[var(--crm-muted)]">
          Updated {formatActivityTimestamp(overview.updatedAt)}
        </p>
      </div>

      {/* Primary row — identity, stage, owner, priority, risk (Q9). */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1
          className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-tight text-[var(--crm-text)] sm:text-[26px]"
          title={overview.submittedName}
        >
          {overview.submittedName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* EVERY indicator is labelled. Three unlabelled chips that all read
              "COLD" — the effective bucket, the score band and the stage — were
              impossible to tell apart, so each now says what it is. */}
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--crm-muted)]">
              Temp
            </span>
            <LeadSalesBucketBadge bucket={effective.bucket} />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--crm-muted)]">
              Score
            </span>
            <LeadScoreChip score={score} showBreakdown />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--crm-muted)]">
              Stage
            </span>
            <LeadStatusBadge status={status} />
          </span>
        </div>
      </div>

      <p className="mt-1 text-[12px] text-[var(--crm-muted)]">
        Owner:{" "}
        <span className="text-[var(--crm-text-secondary)]">{ownerLabel}</span>
      </p>

      <div className="mt-2">
        <LeadRiskFlagChips flags={score.riskFlags} />
      </div>

      {/* The human control sits BELOW the read-only summary so the glanceable
          facts stay at the top and the action is a deliberate second step. */}
      <div className="mt-3">
        <LeadSalesTemperatureControl
          leadId={leadId}
          effectiveBucket={effective.bucket}
          source={effective.source}
          manualTemperature={manualSalesTemperature}
          canEdit={canSetTemperature && !lifecycleControlled}
          lifecycleReason={
            lifecycleControlled
              ? "Lifecycle decides this lead's bucket. Resume or reopen it to set a temperature again."
              : "You do not have permission to change this lead's temperature."
          }
        />
      </div>

      {/* Next action — the single most important fact on the page. */}
      <div
        className="mt-3 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2"
        data-testid="crm-lead-header-next-action"
      >
        {primaryNextAction && dueState ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-[var(--crm-text)]">
              {primaryNextAction.title}
            </span>
            <span className="text-[11px] text-[var(--crm-muted)]">
              {formatActivityTypeLabel(primaryNextAction.activityType)}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${activityDueStateClassName(dueState)}`}
            >
              {activityDueStateLabel(dueState)}
            </span>
            <span className="text-[11px] tabular-nums text-[var(--crm-text-secondary)]">
              {formatActivityTimestamp(primaryNextAction.dueAt)}
            </span>
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[var(--crm-danger)]">
            No primary next action
          </p>
        )}
      </div>

      {/* Secondary row — service, property, locality, cadence (Q9). */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <FactItem
          label="Service"
          value={formatCrmCodeLabel(overview.serviceCode)}
        />
        <FactItem
          label="Property"
          value={formatCrmCodeLabel(overview.propertyCode)}
        />
        <FactItem label="Locality" value={overview.locality ?? "—"} />
        <FactItem
          label="Cadence"
          value={
            cadence
              ? `${cadence.templateName} · ${formatCrmCodeLabel(cadence.status)}`
              : "None"
          }
          testId="crm-lead-header-cadence"
        />
      </dl>

      {/* Commercial strip (Q9). Unknown value never renders as ₹0. */}
      <dl
        className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--crm-border)] pt-3 sm:grid-cols-4"
        data-testid="crm-lead-header-commercial"
      >
        <FactItem
          label="Quotation"
          value={CRM_COMMERCIAL_STATE_LABELS[commercial.state]}
          testId="crm-lead-header-quotation-state"
        />
        <FactItem
          label="Deal value (ex-tax)"
          value={formatDealValue(commercial.taxableBasePaise)}
          testId="crm-lead-header-deal-value"
        />
        <FactItem
          label={parked ? "Probability (parked)" : "Probability"}
          value={formatProbabilityLabel(probabilityBp)}
          testId="crm-lead-header-probability"
        />
        <FactItem
          label="Weighted (ex-tax)"
          value={formatDealValue(weightedPaise)}
          testId="crm-lead-header-weighted-value"
        />
      </dl>

      {/* Consent stays secondary unless it is actually blocking outreach. */}
      {canReadConsents && consentBlocked ? (
        <p
          role="status"
          className="mt-3 rounded-[10px] border border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] px-3 py-2 text-[12px] text-[var(--crm-warning)]"
          data-testid="crm-lead-header-consent-warning"
        >
          Communication consent is withdrawn or denied for this contact. Check the
          consent panel before any outreach.
        </p>
      ) : null}

      <div className="mt-3 border-t border-[var(--crm-border)] pt-3">
        {quickActions}
      </div>
    </header>
  );
}
