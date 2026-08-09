export function AttendanceLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-neutral-800" />
      <div className="h-40 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />
      <div className="h-64 animate-pulse rounded-lg border border-neutral-800 bg-neutral-900/50" />
    </div>
  );
}
