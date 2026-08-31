import {
  CRM_TIMELINE_CATEGORY_LABELS,
  formatTimelineTimestamp,
  type CrmLeadTimelinePage,
  type CrmTimelineCategory,
} from "../../contracts/lead-timeline-contracts.ts";
import { formatInrFromPaise } from "../../contracts/sales-target-contracts.ts";

/**
 * CRM 2D-1 — unified lead timeline (owner lock Q6).
 *
 * One chronological history surface for the lead. Notes are first-class here,
 * which is why the Notes panel no longer keeps its own history list. Every
 * label is human-readable — a raw code such as `lead.status_changed` must never
 * reach this component, and the contract layer guarantees that.
 *
 * Default view is All. There is no filter system: category styling carries the
 * distinction, per the owner lock.
 */

interface LeadDetailTimelineProps {
  readonly timeline: CrmLeadTimelinePage;
}

const CATEGORY_CLASSES: Readonly<Record<CrmTimelineCategory, string>> = {
  activity:
    "border-[var(--crm-primary)]/25 bg-[var(--crm-primary-soft)] text-[var(--crm-primary)]",
  note: "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)]",
  stage:
    "border-[var(--crm-info)]/25 bg-[var(--crm-info-soft)] text-[var(--crm-info)]",
  assignment: "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]",
  cadence: "border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]",
  quotation: "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
  consent:
    "border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  system:
    "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
};

export function LeadDetailTimeline({ timeline }: LeadDetailTimelineProps) {
  return (
    <section className="crm-surface p-3.5 sm:p-5" data-testid="crm-lead-timeline">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
          Timeline
        </h2>
        <p className="text-[11px] text-[var(--crm-muted)]">
          Newest first · times in Asia/Kolkata
        </p>
      </div>

      {timeline.entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">
          No timeline entries yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {timeline.entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="crm-timeline-entry"
              data-category={entry.category}
              data-source={entry.source}
              className="rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_CLASSES[entry.category]}`}
                >
                  {CRM_TIMELINE_CATEGORY_LABELS[entry.category]}
                </span>
                <span className="min-w-0 flex-1 font-medium text-[var(--crm-text)]">
                  {entry.title}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--crm-muted)]">
                  {formatTimelineTimestamp(entry.occurredAt)}
                </span>
              </div>

              {entry.detail ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[var(--crm-text-secondary)]">
                  {entry.detail}
                </p>
              ) : null}

              <p className="mt-1 text-[11px] text-[var(--crm-muted)]">
                {entry.actorLabel ?? "System"}
                {entry.amountPaise !== null
                  ? ` · ${formatInrFromPaise(entry.amountPaise)} ex-tax`
                  : ""}
              </p>
            </li>
          ))}
        </ol>
      )}

      {/* Truncation is always disclosed — never silent. */}
      {timeline.truncated ? (
        <p
          className="mt-3 rounded-[10px] border border-[var(--crm-border)] px-3 py-2 text-[12px] text-[var(--crm-muted)]"
          data-testid="crm-timeline-truncated"
        >
          Showing the most recent {timeline.limit} entries. Older history remains
          in the audit record.
        </p>
      ) : null}
    </section>
  );
}
