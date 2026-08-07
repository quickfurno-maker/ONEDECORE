export function WhatsappLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-48 animate-pulse rounded bg-neutral-800" />
      <div className="h-24 animate-pulse rounded-lg bg-neutral-900/80" />
      <div className="h-24 animate-pulse rounded-lg bg-neutral-900/80" />
    </div>
  );
}
