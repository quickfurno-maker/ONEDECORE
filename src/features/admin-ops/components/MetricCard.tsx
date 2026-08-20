import Link from "next/link";
import type { OpsKpiItem } from "../types.ts";

const ACCENT: Record<OpsKpiItem["accent"], string> = {
  purple: "text-[#8E5CF5] bg-[#8E5CF5]/15",
  warning: "text-[var(--od-warning)] bg-[var(--od-warning)]/15",
  blue: "text-[var(--od-blue)] bg-[var(--od-blue)]/15",
  teal: "text-[var(--od-teal)] bg-[var(--od-teal)]/15",
  positive: "text-[var(--od-positive)] bg-[var(--od-positive)]/15",
  gold: "text-[var(--od-gold)] bg-[var(--od-gold)]/15",
};

const LINE: Record<OpsKpiItem["accent"], string> = {
  purple: "#8E5CF5",
  warning: "#E2A83B",
  blue: "#3E8EF7",
  teal: "#20C9B5",
  positive: "#35C98C",
  gold: "#D7A529",
};

function Sparkline({ values, color }: { values: readonly number[]; color: string }) {
  if (values.length < 2) {
    return null;
  }
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (value / max) * 24;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

export function MetricCard({ item, index }: { item: OpsKpiItem; index: number }) {
  return (
    <Link
      href={item.href}
      className="od-enter block rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4 transition duration-150 hover:-translate-y-0.5 hover:border-[var(--od-border-strong)] hover:bg-[var(--od-elevated)]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${ACCENT[item.accent]}`}>
          {item.label.slice(0, 1)}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--od-muted)]">
        {item.label}
      </p>
      <p className="mt-1 text-[30px] font-semibold leading-none text-[var(--od-text)]">
        {item.value}
      </p>
      <p className="mt-2 text-xs text-[var(--od-muted)]">{item.context}</p>
      {item.sparkline ? (
        <Sparkline values={item.sparkline} color={LINE[item.accent]} />
      ) : null}
    </Link>
  );
}
