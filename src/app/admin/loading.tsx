export default function AdminLoading() {
  return (
    <div aria-hidden="true" className="mx-auto max-w-[1600px] space-y-6">
      <div className="h-10 w-72 animate-pulse rounded-[8px] bg-[var(--od-elevated)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)]"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)]"
          />
        ))}
      </div>
    </div>
  );
}
