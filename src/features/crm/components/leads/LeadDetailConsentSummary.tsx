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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Consent summary
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No consent records available.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">
                  {formatCrmCodeLabel(item.purposeCode)}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatTimestamp(item.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-neutral-400">
                {formatCrmCodeLabel(item.channel)} · {formatCrmCodeLabel(item.eventType)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Status summary
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {summary.onHoldReason ? (
          <div>
            <dt className="text-xs text-neutral-500">On-hold reason</dt>
            <dd className="mt-1 text-sm text-neutral-100">{summary.onHoldReason}</dd>
          </div>
        ) : null}
        {summary.onHoldSince ? (
          <div>
            <dt className="text-xs text-neutral-500">On-hold since</dt>
            <dd className="mt-1 text-sm text-neutral-100">
              {formatTimestamp(summary.onHoldSince)}
            </dd>
          </div>
        ) : null}
        {summary.closedLostReasonLabel ? (
          <div>
            <dt className="text-xs text-neutral-500">Closed-lost reason</dt>
            <dd className="mt-1 text-sm text-neutral-100">
              {summary.closedLostReasonLabel}
            </dd>
          </div>
        ) : null}
        {summary.closedLostNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">Closed-lost note</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-neutral-100">
              {summary.closedLostNote}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
