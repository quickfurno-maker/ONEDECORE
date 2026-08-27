import type {
  CrmLeadDetailConsentSummaryItem,
  CrmLeadDetailStatusSummary,
} from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailConsentSummaryProps {
  readonly items: readonly CrmLeadDetailConsentSummaryItem[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailConsentSummary({
  items,
}: LeadDetailConsentSummaryProps) {
  return (
    <section className="crm-surface p-3.5 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Consent summary
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">No consent records available.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--crm-text)]">
                  {formatCrmCodeLabel(item.purposeCode)}
                </span>
                <span className="text-xs text-[var(--crm-muted)]">
                  {formatTimestamp(item.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-[var(--crm-muted)]">
                {formatCrmCodeLabel(item.channel)} · {formatCrmCodeLabel(item.eventType)}
              </p>
              <p className="mt-1 text-xs text-[var(--crm-muted)]">
                Notice {item.noticeVersion} · Copy {item.copyVersion}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface LeadDetailStatusSummaryProps {
  readonly summary: CrmLeadDetailStatusSummary;
}

export function LeadDetailStatusSummary({
  summary,
}: LeadDetailStatusSummaryProps) {
  const hasContent =
    summary.onHoldReason ||
    summary.onHoldSince ||
    summary.closedLostReasonLabel ||
    summary.closedLostNote;

  if (!hasContent) {
    return null;
  }

  return (
    <section className="crm-surface p-3.5 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Status summary
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {summary.onHoldReason ? (
          <div>
            <dt className="text-xs text-[var(--crm-muted)]">On-hold reason</dt>
            <dd className="mt-1 text-sm text-[var(--crm-text)]">{summary.onHoldReason}</dd>
          </div>
        ) : null}
        {summary.onHoldSince ? (
          <div>
            <dt className="text-xs text-[var(--crm-muted)]">On-hold since</dt>
            <dd className="mt-1 text-sm text-[var(--crm-text)]">
              {formatTimestamp(summary.onHoldSince)}
            </dd>
          </div>
        ) : null}
        {summary.closedLostReasonLabel ? (
          <div>
            <dt className="text-xs text-[var(--crm-muted)]">Closed-lost reason</dt>
            <dd className="mt-1 text-sm text-[var(--crm-text)]">
              {summary.closedLostReasonLabel}
            </dd>
          </div>
        ) : null}
        {summary.closedLostNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--crm-muted)]">Closed-lost note</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-[var(--crm-text)]">
              {summary.closedLostNote}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
