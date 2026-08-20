import type { ReactNode } from "react";

interface DashboardPanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly action?: ReactNode;
  readonly attention?: boolean;
}

export function DashboardPanel({
  title,
  children,
  className = "",
  action,
  attention = false,
}: DashboardPanelProps) {
  return (
    <section
      className={`rounded-[12px] border bg-[var(--od-surface)] p-5 ${
        attention
          ? "border-[var(--od-danger)]/35 shadow-[0_0_24px_rgba(234,102,102,0.08)]"
          : "border-[var(--od-border)]"
      } ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-[var(--od-text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
