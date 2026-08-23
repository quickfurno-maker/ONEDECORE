export function StorefrontDisabledBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[10px] border border-[var(--od-warning)]/40 bg-[var(--od-warning)]/10 px-3 py-2 text-xs text-[var(--od-warning)]"
    >
      {"Public /shop production activation remains OFF. Guest COD checkout is repository-only; online payments remain deferred to Phase 9D-E."}
    </div>
  );
}
