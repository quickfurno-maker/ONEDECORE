export function StorefrontDisabledBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[10px] border border-[var(--od-warning)]/40 bg-[var(--od-warning)]/10 px-3 py-2 text-xs text-[var(--od-warning)]"
    >
      {"Public /shop stays OFF until ONEDECORE_SHOP_PUBLIC_ENABLED=true. Guest COD is fail-closed while the gate is off; online payments remain deferred to Phase 9D-E."}
    </div>
  );
}
