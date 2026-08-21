import Link from "next/link";
import type { OpsPipelineStage } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

const COLORS = ["#3E8EF7", "#8E5CF5", "#20C9B5", "#E2A83B", "#D7A529", "#35C98C", "#EA6666"];

export function PipelinePanel({ stages }: { stages: readonly OpsPipelineStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <DashboardPanel title="Sales Pipeline">
      {stages.length === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">No pipeline counts available for your scope.</p>
      ) : (
        <ul className="space-y-2">
          {stages.map((stage, index) => (
            <li key={stage.status}>
              <Link
                href={`/admin/crm/leads?status=${encodeURIComponent(stage.status)}`}
                className="block rounded-[8px] px-1 py-1 hover:bg-[var(--od-hover)]"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--od-text-2)]">{stage.label}</span>
                  <span className="font-semibold text-[var(--od-text)]">{stage.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{
                      width: `${(stage.count / max) * 100}%`,
                      background: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
