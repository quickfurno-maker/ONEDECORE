import {
  CRM_LEAD_SALES_BUCKET_LABELS,
  type CrmLeadSalesBucket,
} from "../../contracts/lead-sales-bucket.ts";
import {
  CRM_SALES_BUCKET_SOURCE_HINTS,
  type CrmSalesBucketSource,
} from "../../contracts/lead-sales-temperature.ts";

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
  /**
   * Marks a MANUAL classification with a dot.
   *
   * Without it a highlighted COLD is ambiguous: a considered human judgement
   * and a machine guess look identical. The dot carries a title and a
   * screen-reader label, so it is never colour- or shape-only.
   */
  readonly source?: CrmSalesBucketSource;
}

export function LeadSalesBucketBadge({
  bucket,
  priorityScore,
  source,
}: LeadSalesBucketBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BUCKET_STYLES[bucket]}`}
      data-testid="crm-lead-sales-bucket"
      data-bucket={bucket}
      data-source={source}
    >
      {CRM_LEAD_SALES_BUCKET_LABELS[bucket]}
      {source === "manual" ? (
        <span
          className="inline-flex items-center"
          title={CRM_SALES_BUCKET_SOURCE_HINTS.manual}
          data-testid="crm-bucket-manual-marker"
        >
          <span aria-hidden className="text-[9px] leading-none">
            ●
          </span>
          <span className="sr-only">Set manually</span>
        </span>
      ) : null}
      {priorityScore === undefined ? null : (
        <span className="tabular-nums font-medium normal-case opacity-80">
          {priorityScore}
        </span>
      )}
    </span>
  );
}
