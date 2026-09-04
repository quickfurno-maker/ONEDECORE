import Link from "next/link";
import {
  CRM_LEAD_PRIMARY_SALES_BUCKETS,
  CRM_LEAD_SALES_BUCKETS,
  CRM_LEAD_SALES_BUCKET_DESCRIPTIONS,
  CRM_LEAD_SALES_BUCKET_LABELS,
  type CrmLeadSalesBucket,
  type CrmLeadSalesBucketCounts,
} from "../../contracts/lead-sales-bucket.ts";
import {
  buildLeadListHref,
  type LeadListQuery,
} from "../../contracts/lead-list-query.ts";
import { leadMonthCohortHeading } from "../../contracts/lead-month-cohort.ts";

/**
 * The PRIMARY organiser of the Leads workspace.
 *
 * It sits above the existing filters because the owner's first question is
 * "which bucket", not "which source". Counts are exact for the selected received
 * month and the active non-bucket filters, and they are computed over the whole
 * cohort — never over the current page — so the strip keeps telling the truth
 * about where the rest of the month's leads are while one bucket is selected.
 *
 * HOT / WARM / COLD / LOST are the owner's quick actions and carry the strongest
 * emphasis; WON and ON HOLD stay available but quieter.
 */

const PRIMARY: readonly CrmLeadSalesBucket[] = CRM_LEAD_PRIMARY_SALES_BUCKETS;

const ACTIVE_STYLES: Readonly<Record<CrmLeadSalesBucket, string>> = {
  HOT: "border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  WARM: "border-[var(--crm-warning)] bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  COLD: "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text)]",
  LOST: "border-[var(--crm-danger)]/60 bg-[var(--crm-surface-subtle)] text-[var(--crm-danger)]",
  WON: "border-[var(--crm-success)] bg-[var(--crm-success-soft)] text-[var(--crm-success)]",
  ON_HOLD:
    "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)]",
};

interface LeadSalesBucketStripProps {
  readonly query: LeadListQuery;
  readonly counts: CrmLeadSalesBucketCounts;
  /**
   * FALSE when the cohort exceeded the read ceiling, so `counts` is partial.
   *
   * Bucket counts are core sales numbers. A partial figure that LOOKS exact is
   * worse than no figure, so the tabs stay navigable but the numbers are
   * withheld rather than under-reported.
   */
  readonly countsExact: boolean;
}

function Tab({
  href,
  label,
  count,
  countsExact,
  selected,
  emphasis,
  title,
  testId,
  bucket,
}: {
  readonly href: string;
  readonly label: string;
  readonly count: number;
  readonly countsExact: boolean;
  readonly selected: boolean;
  readonly emphasis: boolean;
  readonly title: string;
  readonly testId: string;
  readonly bucket: CrmLeadSalesBucket | "ALL";
}) {
  const base =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]";

  const tone = selected
    ? bucket === "ALL"
      ? "border-[var(--crm-primary)] bg-[var(--crm-primary-soft)] text-[var(--crm-primary)]"
      : ACTIVE_STYLES[bucket]
    : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] hover:border-[var(--crm-border-strong)]";

  return (
    <Link
      href={href}
      title={title}
      aria-current={selected ? "page" : undefined}
      data-testid={testId}
      data-selected={selected ? "true" : "false"}
      className={`${base} ${tone} ${emphasis ? "font-semibold" : "font-medium"}`}
    >
      <span>{label}</span>
      <span
        className="tabular-nums rounded-full bg-[var(--crm-surface-subtle)] px-1.5 text-[11px] font-semibold"
        data-testid={`${testId}-count`}
        data-counts-exact={countsExact ? "true" : "false"}
        title={countsExact ? undefined : "Count unavailable for this cohort"}
      >
        {countsExact ? count : "—"}
      </span>
    </Link>
  );
}

export function LeadSalesBucketStrip({
  query,
  counts,
  countsExact,
}: LeadSalesBucketStripProps) {
  const secondary = CRM_LEAD_SALES_BUCKETS.filter(
    (bucket) => !PRIMARY.includes(bucket)
  );

  return (
    <section
      aria-label="Sales bucket"
      className="crm-surface rounded-[14px] p-3"
      data-testid="crm-lead-sales-bucket-strip"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          {leadMonthCohortHeading(query.month)}
        </h2>
        <p className="text-[11px] text-[var(--crm-muted)]">
          {countsExact
            ? `${counts.TOTAL} total`
            : "Counts unavailable — narrow the month or add a filter"}
        </p>
      </div>

      {/* Primary row: the four the owner reaches for. Page resets to 1 because a
          different bucket is a different result set. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Tab
          href={buildLeadListHref(query, "bucket", { page: 1 })}
          label="All"
          count={counts.TOTAL}
          countsExact={countsExact}
          selected={query.bucket === null}
          emphasis
          title="Every lead received in this month."
          testId="crm-bucket-tab-all"
          bucket="ALL"
        />
        {PRIMARY.map((bucket) => (
          <Tab
            key={bucket}
            href={buildLeadListHref(query, undefined, { bucket, page: 1 })}
            label={CRM_LEAD_SALES_BUCKET_LABELS[bucket]}
            count={counts[bucket]}
            countsExact={countsExact}
            selected={query.bucket === bucket}
            emphasis
            title={CRM_LEAD_SALES_BUCKET_DESCRIPTIONS[bucket]}
            testId={`crm-bucket-tab-${bucket.toLowerCase()}`}
            bucket={bucket}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {secondary.map((bucket) => (
          <Tab
            key={bucket}
            href={buildLeadListHref(query, undefined, { bucket, page: 1 })}
            label={CRM_LEAD_SALES_BUCKET_LABELS[bucket]}
            count={counts[bucket]}
            countsExact={countsExact}
            selected={query.bucket === bucket}
            emphasis={false}
            title={CRM_LEAD_SALES_BUCKET_DESCRIPTIONS[bucket]}
            testId={`crm-bucket-tab-${bucket.toLowerCase()}`}
            bucket={bucket}
          />
        ))}
      </div>
    </section>
  );
}
