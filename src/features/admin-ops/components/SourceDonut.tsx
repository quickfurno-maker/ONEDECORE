import type { OpsSourceSlice } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

const COLORS = ["#3E8EF7", "#D7A529", "#20C9B5", "#8E5CF5", "#E2A83B", "#747D88"];

export function SourceDonut({ slices }: { slices: readonly OpsSourceSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const circumference = 2 * Math.PI * 36;

  return (
    <DashboardPanel title="Leads by Source">
      {total === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">
          Source mix appears when CRM reporting is available for this month.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 88 88" className="h-28 w-28 shrink-0" role="img" aria-label="Lead sources">
            <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            {slices.map((slice, index) => {
              const length = (slice.count / total) * circumference;
              const dashOffset = -slices
                .slice(0, index)
                .reduce((sum, item) => sum + (item.count / total) * circumference, 0);
              return (
                <circle
                  key={slice.id}
                  cx="44"
                  cy="44"
                  r="36"
                  fill="none"
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth="10"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 44 44)"
                />
              );
            })}
            <text x="44" y="48" textAnchor="middle" fill="#F5F3EE" fontSize="14" fontWeight="600">
              {total}
            </text>
          </svg>
          <ul className="min-w-0 space-y-2 text-sm">
            {slices.map((slice, index) => (
              <li key={slice.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[var(--od-text-2)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  {slice.label}
                </span>
                <span className="font-medium text-[var(--od-text)]">{slice.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardPanel>
  );
}
