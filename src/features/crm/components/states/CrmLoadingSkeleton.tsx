export function CrmLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-[8px] bg-[var(--od-elevated)]" />
      <div className="h-32 animate-pulse rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)]" />
      <div className="h-64 animate-pulse rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)]" />
    </div>
  );
}
