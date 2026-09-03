import {
  CRM_LEAD_SALES_BUCKET_LABELS,
  type CrmLeadSalesBucket,
} from "../../contracts/lead-sales-bucket.ts";

/**
 * The owner-facing sales bucket, as a compact badge.
 *
 * NEVER colour-only: the badge always carries its text label, so the bucket
 * survives greyscale printing and colour-blindness. It also never replaces the
 * pipeline stage badge beside it — bucket answers "how hot", stage answers "how
 * far", and the workspace shows both.
 */

const BUCKET_STYLES: Readonly<Record<CrmLeadSalesBucket, string>> = {
  HOT: "border-[var(--crm-danger)]/35 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  WARM: "border-[var(--crm-warning)]/35 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  COLD: "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
  LOST: "border-[var(--crm-danger)]/25 bg-[var(--crm-surface-subtle)] text-[var(--crm-danger)]",
  WON: "border-[var(--crm-success)]/30 bg-[var(--crm-success-soft)] text-[var(--crm-success)]",
  ON_HOLD:
    "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)]",
};

interface LeadSalesBucketBadgeProps {
  readonly bucket: CrmLeadSalesBucket;
  /** Renders the numeric priority alongside, on surfaces with room for it. */
  readonly priorityScore?: number;
}

export function LeadSalesBucketBadge({
  bucket,
  priorityScore,
}: LeadSalesBucketBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BUCKET_STYLES[bucket]}`}
      data-testid="crm-lead-sales-bucket"
      data-bucket={bucket}
    >
      {CRM_LEAD_SALES_BUCKET_LABELS[bucket]}
      {priorityScore === undefined ? null : (
        <span className="tabular-nums font-medium normal-case opacity-80">
          {priorityScore}
        </span>
      )}
    </span>
  );
}
