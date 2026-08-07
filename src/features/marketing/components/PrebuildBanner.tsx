export function PrebuildBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
    >
      PREBUILD — NOT LIVE — NO PROVIDER EXECUTION
    </div>
  );
}
