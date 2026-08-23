export function StorefrontDisabledBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[10px] border border-[var(--od-warning)]/40 bg-[var(--od-warning)]/10 px-3 py-2 text-xs text-[var(--od-warning)]"
    >
      Public /shop is disabled. Production remains OFF. Checkout and payments are not in this phase.
    </div>
  );
}
