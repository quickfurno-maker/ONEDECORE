import type { ReactNode } from "react";
import type { ReportFilters } from "../../contracts/reporting-contracts.ts";
import type { CrmManagementAnalyticsBundle } from "../../server/crm-management-analytics-queries.ts";
import {
  CRM_CONVERSION_STAGE_LABELS,
  formatBasisPointsPercent,
  formatDurationFromSeconds,
  forecastStageRank,
  pickHeadlineTargetRow,
} from "../../contracts/management-analytics-contracts.ts";
import {
  formatCompactInrFromPaise,
  formatDealValue,
  formatProbabilityLabel,
} from "../../contracts/deal-value-contracts.ts";
import { formatPipelineStageLabel } from "../../contracts/pipeline-contracts.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";

interface CrmManagementAnalyticsPanelProps {
  readonly bundle: CrmManagementAnalyticsBundle;
  readonly filters: ReportFilters;
  /** Managers/super-admin see team analytics; executives see personal only. */
  readonly isManagementView: boolean;
}

const UNKNOWN = "—";

/** Data attributes carry raw values so QA can verify arithmetic, not glyphs. */
function dataValue(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

/**
 * A money aggregate over a set in which NOTHING is valued is unknown, not zero.
 * `get_crm_pipeline_value_summary` coalesces those sums to 0 so the payload
 * stays integer-typed; rendering that 0 as "₹0" would claim a measurement that
 * was never made. Returns `null` — which `formatCompactInrFromPaise` renders as
 * an explicit unknown — whenever the contributing set is empty.
 */
function knownAggregatePaise(
  valuedLeadCount: number,
  paise: number
): number | null {
  return valuedLeadCount > 0 ? paise : null;
}

/* -------------------------------------------------------------------------- */

function SummaryCard({
  testId,
  label,
  value,
  caption,
  rawValue,
  tone = "neutral",
}: {
  readonly testId: string;
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly rawValue: number | null;
  readonly tone?: "neutral" | "success" | "warning" | "info";
}) {
  const barClass =
    tone === "success"
      ? "bg-[var(--crm-success)]"
      : tone === "warning"
        ? "bg-[var(--crm-warning)]"
        : tone === "info"
          ? "bg-[var(--crm-info)]"
          : "bg-[var(--crm-border-strong)]";

  return (
    <div
      data-testid={testId}
      data-value={dataValue(rawValue)}
      className="crm-surface relative overflow-hidden rounded-[14px] px-3.5 py-3 sm:rounded-[var(--crm-radius)] sm:px-4 sm:py-3.5"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${barClass}`} />
      <p className="text-[12px] font-medium text-[var(--crm-muted)]">{label}</p>
      <p className="mt-0.5 break-words text-[22px] font-semibold tabular-nums tracking-tight text-[var(--crm-text)] sm:text-[26px]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--crm-muted)]">{caption}</p>
    </div>
  );
}

function Stat({
  testId,
  label,
  value,
  rawValue,
  hint,
}: {
  readonly testId?: string;
  readonly label: string;
  readonly value: string;
  readonly rawValue?: number | null;
  readonly hint?: string;
}) {
  return (
    <div
      data-testid={testId}
      data-value={rawValue === undefined ? undefined : dataValue(rawValue)}
      className="rounded-[12px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 sm:rounded-[8px]"
    >
      <p className="text-[11px] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--crm-text)] sm:text-base">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-3 text-[var(--crm-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  testId,
  title,
  note,
  children,
}: {
  readonly testId: string;
  readonly title: string;
  readonly note: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4"
    >
      <h3 className="text-[13px] font-semibold text-[var(--crm-text)]">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-4 text-[var(--crm-muted)]">{note}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export function CrmManagementAnalyticsPanel({
  bundle,
  filters,
  isManagementView,
}: CrmManagementAnalyticsPanelProps) {
  const { analytics, forecast } = bundle;
  const { sla, velocity, conversion, targets } = analytics;

  const headlineTarget = pickHeadlineTargetRow(targets.rows, bundle.scopeOwnerId);

  const forecastStages = [...forecast.stages].sort(
    (a, b) => forecastStageRank(a.stage) - forecastStageRank(b.stage)
  );

  const maxReached = Math.max(
    ...conversion.stages.map((stage) => stage.reachedCount),
    1
  );

  const unknownValueCount = Math.max(
    forecast.activeLeadCount - forecast.activeValuedLeadCount,
    0
  );

  const attainmentValue =
    headlineTarget === null
      ? "No target set"
      : formatBasisPointsPercent(headlineTarget.attainmentBasisPoints, "Unknown");

  const attainmentCaption =
    headlineTarget === null
      ? `No ${isManagementView ? "team" : "personal"} target configured for ${targets.period}`
      : targets.canReadCommercialTruth
        ? `${formatDealValue(headlineTarget.achievedPaise)} of ${formatDealValue(headlineTarget.revenueTargetPaise)} · ${targets.period}`
        : `Accepted commercial truth not visible to this role · ${targets.period}`;

  return (
    <div
      data-testid="crm-2e-analytics"
      data-scope={isManagementView ? "management" : "personal"}
      data-scope-owner-id={bundle.scopeOwnerId ?? ""}
      data-captured-at={analytics.capturedAt}
      className="space-y-4"
    >
      {/* ---------------------------------------------------------------- */}
      {/* Top summary                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="crm-2e-summary-heading" data-testid="crm-2e-summary">
        <h2
          id="crm-2e-summary-heading"
          className="text-[13px] font-semibold text-[var(--crm-text)]"
        >
          {isManagementView ? "Management Analytics" : "My Performance"}
        </h2>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--crm-muted)]">
          {isManagementView
            ? "Team-wide factual metrics within your authorised CRM scope."
            : "Your personal metrics only. Team aggregates are not shown."}{" "}
          Cohort measures cover {filters.dateRange.label}; forecast and open-book
          measures are a current snapshot.
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            testId="crm-2e-card-sla"
            label="SLA compliance"
            value={formatBasisPointsPercent(sla.complianceBasisPoints, "No data")}
            rawValue={sla.complianceBasisPoints}
            caption={`${sla.metCount} met / ${sla.decidedCount} decided · ${sla.eligibleCount} eligible`}
            tone="info"
          />
          <SummaryCard
            testId="crm-2e-card-won-rate"
            label="Won rate"
            value={formatBasisPointsPercent(conversion.wonRateBasisPoints, "No data")}
            rawValue={conversion.wonRateBasisPoints}
            caption={`Closed won reach / ${conversion.receivedCount} received`}
            tone="success"
          />
          <SummaryCard
            testId="crm-2e-card-forecast"
            label="Current weighted forecast"
            value={formatCompactInrFromPaise(
              knownAggregatePaise(
                forecast.activeValuedLeadCount,
                forecast.activeWeightedValuePaise
              )
            )}
            rawValue={forecast.activeWeightedValuePaise}
            caption={`${forecast.activeValuedLeadCount} of ${forecast.activeLeadCount} open leads valued`}
            tone="warning"
          />
          <SummaryCard
            testId="crm-2e-card-target"
            label="Target attainment"
            value={attainmentValue}
            rawValue={headlineTarget?.attainmentBasisPoints ?? null}
            caption={attainmentCaption}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* A. First-response SLA                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section
        testId="crm-2e-sla"
        title="First-response SLA"
        note="Denominator counts only leads the SLA policy actually applied to at receipt (a due snapshot exists). First response means a qualifying first contact attempt, not a connection. Compliance = met ÷ (met + breached)."
      >
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            testId="crm-2e-sla-eligible"
            label="Eligible"
            value={String(sla.eligibleCount)}
            rawValue={sla.eligibleCount}
            hint="Policy applied"
          />
          <Stat
            testId="crm-2e-sla-met"
            label="Met"
            value={String(sla.metCount)}
            rawValue={sla.metCount}
            hint="Attempt ≤ due"
          />
          <Stat
            testId="crm-2e-sla-breached"
            label="Breached"
            value={String(sla.breachedCount)}
            rawValue={sla.breachedCount}
            hint="Attempt late or overdue"
          />
          <Stat
            testId="crm-2e-sla-pending"
            label="Pending"
            value={String(sla.pendingCount)}
            rawValue={sla.pendingCount}
            hint="Still inside window"
          />
          <Stat
            testId="crm-2e-sla-out-of-policy"
            label="Outside policy"
            value={String(sla.outOfPolicyCount)}
            rawValue={sla.outOfPolicyCount}
            hint="No due snapshot"
          />
          <Stat
            testId="crm-2e-sla-compliance"
            label="Compliance"
            value={formatBasisPointsPercent(sla.complianceBasisPoints, "No data")}
            rawValue={sla.complianceBasisPoints}
            hint={`of ${sla.decidedCount} decided`}
          />
        </div>
        {sla.outOfPolicyCount > 0 ? (
          <p
            data-testid="crm-2e-sla-non-retroactive-note"
            className="mt-2 text-[11px] leading-4 text-[var(--crm-muted)]"
          >
            {sla.outOfPolicyCount} of {sla.cohortLeadCount} received leads carry no
            SLA due snapshot and are excluded from the denominator. Activation is
            non-retroactive by design.
          </p>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* C. Conversion funnel                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section
        testId="crm-2e-funnel"
        title="Conversion funnel"
        note="Stage reach for leads received in the range: a lead counts at every stage it entered at least once, reconstructed from canonical stage events. Closed lost and On hold are reported separately and never removed from earlier stages."
      >
        <div className="crm-scrollbar-x -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <caption className="sr-only">
              Conversion funnel by canonical stage reach
            </caption>
            <thead className="text-[11px] text-[var(--crm-muted)]">
              <tr>
                <th scope="col" className="pb-2 font-medium">Stage</th>
                <th scope="col" className="pb-2 font-medium">Reached</th>
                <th scope="col" className="pb-2 text-right font-medium">Count</th>
                <th scope="col" className="pb-2 text-right font-medium">Step %</th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Of received %
                </th>
              </tr>
            </thead>
            <tbody>
              {conversion.stages.map((stage) => (
                <tr
                  key={stage.stage}
                  data-testid="crm-2e-funnel-row"
                  data-stage={stage.stage}
                  data-reached={stage.reachedCount}
                  data-previous-stage={stage.previousStage ?? ""}
                  data-previous-count={dataValue(stage.previousCount)}
                  data-step-bp={dataValue(stage.stepConversionBasisPoints)}
                  data-overall-bp={dataValue(stage.overallConversionBasisPoints)}
                  className="border-t border-[var(--crm-border)]"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-normal text-[var(--crm-text)]"
                  >
                    {CRM_CONVERSION_STAGE_LABELS[stage.stage]}
                  </th>
                  <td className="py-2 pr-3">
                    <div
                      className="h-2 min-w-[2px] rounded bg-[var(--crm-primary)]"
                      style={{
                        width: `${Math.max((stage.reachedCount / maxReached) * 100, 1)}%`,
                      }}
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                    {stage.reachedCount}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                    {stage.previousStage === null
                      ? UNKNOWN
                      : formatBasisPointsPercent(
                          stage.stepConversionBasisPoints,
                          UNKNOWN
                        )}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                    {formatBasisPointsPercent(
                      stage.overallConversionBasisPoints,
                      UNKNOWN
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Stat
            testId="crm-2e-funnel-lost"
            label="Closed lost"
            value={String(conversion.closedLostCount)}
            rawValue={conversion.closedLostCount}
            hint="Reported outside the funnel"
          />
          <Stat
            testId="crm-2e-funnel-on-hold"
            label="On hold now"
            value={String(conversion.onHoldCurrentCount)}
            rawValue={conversion.onHoldCurrentCount}
            hint="Parked, keeps stages reached"
          />
          <Stat
            testId="crm-2e-funnel-won-rate"
            label="Won rate"
            value={formatBasisPointsPercent(conversion.wonRateBasisPoints, "No data")}
            rawValue={conversion.wonRateBasisPoints}
            hint={`of ${conversion.receivedCount} received`}
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* B. Velocity                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section
        testId="crm-2e-velocity"
        title="Sales velocity"
        note="Medians, not averages. Time to first contact and stage-to-stage times cover leads received in the range; active age and days in stage are a current snapshot of the open book. A pair with no reconstructable history is shown as no data, never as zero."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            testId="crm-2e-velocity-first-contact"
            label="Median time to first contact"
            value={formatDurationFromSeconds(
              velocity.medianFirstContactSeconds,
              "No data"
            )}
            rawValue={velocity.medianFirstContactSeconds}
            hint={`${velocity.firstContactSampleSize} attempts in range`}
          />
          <Stat
            testId="crm-2e-velocity-lead-age"
            label="Median active lead age"
            value={formatDurationFromSeconds(
              velocity.medianActiveLeadAgeSeconds,
              "No data"
            )}
            rawValue={velocity.medianActiveLeadAgeSeconds}
            hint={`${velocity.activeLeadCount} open leads now`}
          />
          <Stat
            testId="crm-2e-velocity-stage-age"
            label="Median days in current stage"
            value={formatDurationFromSeconds(
              velocity.medianCurrentStageAgeSeconds,
              "No data"
            )}
            rawValue={velocity.medianCurrentStageAgeSeconds}
            hint="Since last stage entry"
          />
          <Stat
            testId="crm-2e-velocity-open-count"
            label="Open leads"
            value={String(velocity.activeLeadCount)}
            rawValue={velocity.activeLeadCount}
            hint="Not terminal, not parked"
          />
        </div>

        <div className="crm-scrollbar-x -mx-1 mt-3 overflow-x-auto px-1">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <caption className="sr-only">Median stage-to-stage times</caption>
            <thead className="text-[11px] text-[var(--crm-muted)]">
              <tr>
                <th scope="col" className="pb-2 font-medium">Transition</th>
                <th scope="col" className="pb-2 text-right font-medium">Sample</th>
                <th scope="col" className="pb-2 text-right font-medium">Median</th>
              </tr>
            </thead>
            <tbody>
              {velocity.stageTransitions.length === 0 ? (
                <tr className="border-t border-[var(--crm-border)]">
                  <td
                    colSpan={3}
                    data-testid="crm-2e-velocity-no-history"
                    className="py-2 text-[var(--crm-muted)]"
                  >
                    No stage-to-stage history is reconstructable for this range.
                  </td>
                </tr>
              ) : (
                velocity.stageTransitions.map((entry) => (
                  <tr
                    key={`${entry.fromStage}-${entry.toStage}`}
                    data-testid="crm-2e-transition-row"
                    data-from-stage={entry.fromStage}
                    data-to-stage={entry.toStage}
                    data-sample={entry.sampleSize}
                    data-median-seconds={dataValue(entry.medianSeconds)}
                    className="border-t border-[var(--crm-border)]"
                  >
                    <th
                      scope="row"
                      className="py-2 pr-3 font-normal text-[var(--crm-text)]"
                    >
                      {formatPipelineStageLabel(entry.fromStage as LeadStageCode)} →{" "}
                      {formatPipelineStageLabel(entry.toStage as LeadStageCode)}
                    </th>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {entry.sampleSize}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                      {formatDurationFromSeconds(entry.medianSeconds, "No data")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* D. Forecast                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section
        testId="crm-2e-forecast"
        title="Current forecast"
        note="A current snapshot, not historical revenue. Locked CRM 2D stage probabilities. On hold is parked and excluded from active totals; Closed won and Closed lost are not in the active forecast. Leads with unknown value stay unknown and are never counted as ₹0."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            testId="crm-2e-forecast-known-value"
            label="Open known deal value"
            value={formatCompactInrFromPaise(
              knownAggregatePaise(
                forecast.activeValuedLeadCount,
                forecast.activeDealValuePaise
              )
            )}
            rawValue={forecast.activeDealValuePaise}
            hint="Ex-tax, valued leads only"
          />
          <Stat
            testId="crm-2e-forecast-weighted"
            label="Weighted pipeline"
            value={formatCompactInrFromPaise(
              knownAggregatePaise(
                forecast.activeValuedLeadCount,
                forecast.activeWeightedValuePaise
              )
            )}
            rawValue={forecast.activeWeightedValuePaise}
            hint="Probability-weighted"
          />
          <Stat
            testId="crm-2e-forecast-known-count"
            label="Known / open leads"
            value={`${forecast.activeValuedLeadCount} / ${forecast.activeLeadCount}`}
            rawValue={forecast.activeValuedLeadCount}
            hint="Active stages only"
          />
          <Stat
            testId="crm-2e-forecast-unknown-count"
            label="Unknown value"
            value={String(unknownValueCount)}
            rawValue={unknownValueCount}
            hint="Excluded from totals"
          />
        </div>

        <div className="crm-scrollbar-x -mx-1 mt-3 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <caption className="sr-only">Weighted forecast by stage</caption>
            <thead className="text-[11px] text-[var(--crm-muted)]">
              <tr>
                <th scope="col" className="pb-2 font-medium">Stage</th>
                <th scope="col" className="pb-2 text-right font-medium">Prob.</th>
                <th scope="col" className="pb-2 text-right font-medium">Leads</th>
                <th scope="col" className="pb-2 text-right font-medium">Known value</th>
                <th scope="col" className="pb-2 text-right font-medium">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {forecastStages.length === 0 ? (
                <tr className="border-t border-[var(--crm-border)]">
                  <td
                    colSpan={5}
                    data-testid="crm-2e-forecast-empty"
                    className="py-2 text-[var(--crm-muted)]"
                  >
                    No open leads in the active forecast.
                  </td>
                </tr>
              ) : (
                forecastStages.map((stage) => (
                  <tr
                    key={stage.stage}
                    data-testid="crm-2e-forecast-row"
                    data-stage={stage.stage}
                    data-probability-bp={stage.probabilityBasisPoints}
                    data-lead-count={stage.leadCount}
                    data-valued-count={stage.valuedLeadCount}
                    data-deal-value-paise={stage.dealValuePaise}
                    data-weighted-paise={stage.weightedValuePaise}
                    className="border-t border-[var(--crm-border)]"
                  >
                    <th
                      scope="row"
                      className="py-2 pr-3 font-normal text-[var(--crm-text)]"
                    >
                      {formatPipelineStageLabel(stage.stage)}
                    </th>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {formatProbabilityLabel(stage.probabilityBasisPoints)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {stage.valuedLeadCount} / {stage.leadCount}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {formatCompactInrFromPaise(
                        knownAggregatePaise(stage.valuedLeadCount, stage.dealValuePaise)
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                      {formatCompactInrFromPaise(
                        knownAggregatePaise(
                          stage.valuedLeadCount,
                          stage.weightedValuePaise
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p
          data-testid="crm-2e-forecast-parked"
          data-parked-count={forecast.parkedLeadCount}
          data-parked-valued-count={forecast.parkedValuedLeadCount}
          data-parked-paise={forecast.parkedDealValuePaise}
          className="mt-2 text-[11px] leading-4 text-[var(--crm-muted)]"
        >
          On hold (parked): {forecast.parkedLeadCount} leads,{" "}
          {forecast.parkedValuedLeadCount} valued,{" "}
          {formatCompactInrFromPaise(
            knownAggregatePaise(
              forecast.parkedValuedLeadCount,
              forecast.parkedDealValuePaise
            )
          )}{" "}
          — excluded
          from every active total above.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* E. Target achievement                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section
        testId="crm-2e-targets"
        title="Target achievement"
        note="Achieved value is accepted-quotation commercial truth (ex-tax paise) credited by the existing sales-credit rule, for the Asia/Kolkata achievement month. CRM 2E adds no second credit rule."
      >
        <p
          data-testid="crm-2e-targets-period"
          data-period={targets.period}
          data-can-read-commercial={String(targets.canReadCommercialTruth)}
          data-period-achieved-paise={dataValue(targets.periodAchievedPaise)}
          data-period-accepted-count={dataValue(targets.periodAcceptedCount)}
          className="text-[11px] text-[var(--crm-muted)]"
        >
          Period {targets.period || UNKNOWN}
          {targets.canReadCommercialTruth
            ? ` · ${targets.periodAcceptedCount ?? 0} accepted quotations visible · ${formatDealValue(targets.periodAchievedPaise)} total`
            : " · accepted commercial truth is not visible to this role"}
        </p>
        {targets.rows.length === 0 ? (
          <p
            data-testid="crm-2e-targets-empty"
            className="mt-2 text-[12px] text-[var(--crm-muted)]"
          >
            No sales target is configured for {targets.period || "this period"}{" "}
            within your scope.
          </p>
        ) : (
          <div className="crm-scrollbar-x -mx-1 mt-2 overflow-x-auto px-1">
            <table className="w-full min-w-[620px] text-left text-[13px]">
              <caption className="sr-only">Target attainment</caption>
              <thead className="text-[11px] text-[var(--crm-muted)]">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Scope</th>
                  <th scope="col" className="pb-2 text-right font-medium">Target</th>
                  <th scope="col" className="pb-2 text-right font-medium">Achieved</th>
                  <th scope="col" className="pb-2 text-right font-medium">Attainment</th>
                  <th scope="col" className="pb-2 text-right font-medium">Remaining</th>
                  <th scope="col" className="pb-2 text-right font-medium">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {targets.rows.map((row) => (
                  <tr
                    key={row.targetId}
                    data-testid="crm-2e-target-row"
                    data-scope={row.targetScope}
                    data-target-user-id={row.targetUserId ?? ""}
                    data-target-paise={row.revenueTargetPaise}
                    data-achieved-paise={dataValue(row.achievedPaise)}
                    data-remaining-paise={dataValue(row.remainingPaise)}
                    data-attainment-bp={dataValue(row.attainmentBasisPoints)}
                    data-accepted-count={dataValue(row.acceptedCount)}
                    className="border-t border-[var(--crm-border)]"
                  >
                    <th
                      scope="row"
                      className="py-2 pr-3 font-normal text-[var(--crm-text)]"
                    >
                      {row.targetDisplayName}
                      <span className="ml-1.5 text-[11px] text-[var(--crm-muted)]">
                        {row.targetScope === "sales_team" ? "Team" : "Personal"}
                      </span>
                    </th>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {formatDealValue(row.revenueTargetPaise)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                      {row.achievedPaise === null
                        ? "Not visible"
                        : formatDealValue(row.achievedPaise)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                      {formatBasisPointsPercent(row.attainmentBasisPoints, "Unknown")}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {row.remainingPaise === null
                        ? "Unknown"
                        : formatDealValue(row.remainingPaise)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text-secondary)]">
                      {row.acceptedCount === null
                        ? "Unknown"
                        : `${row.acceptedCount} / ${row.closedWonCountTarget}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
