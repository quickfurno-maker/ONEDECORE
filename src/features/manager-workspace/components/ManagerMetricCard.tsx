import Link from "next/link";

import type { ManagerKpi } from "../contracts/manager-dashboard.ts";

/**
 * One KPI card.
 *
 * The card renders `kpi.display` and never `kpi.value ?? 0`. That is the whole
 * discipline: a card whose read failed says `Unavailable`, a card with no
 * denominator says `No data`, and a card that is genuinely at zero says `0` —
 * in a colour that does not shout, because zero SLA breaches is good news.
 */
export function ManagerMetricCard({ kpi }: { readonly kpi: ManagerKpi }) {
  const known = kpi.state === "known";

  const body = (
    <>
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {kpi.label}
      </span>
      <span
        className={`mt-2 block font-serif text-2xl font-bold tabular-nums ${
          known ? "text-neutral-50" : "text-neutral-400"
        }`}
      >
        {kpi.display}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
        {kpi.hint}
      </span>
    </>
  );

  const className =
    "flex min-h-11 flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-4 transition-colors";

  if (!kpi.href || !known) {
    // An unreadable number is not a link to a place that explains it.
    return <div className={className}>{body}</div>;
  }

  return (
    <Link
      href={kpi.href}
      className={`${className} hover:border-neutral-700 hover:bg-neutral-900`}
    >
      {body}
    </Link>
  );
}
