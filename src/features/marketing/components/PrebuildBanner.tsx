export function CampaignGovernanceBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
    >
      Approval governance only. Mock execution foundation — no live provider writes. Production activation Phase 10.
    </div>
  );
}

/** @deprecated Use CampaignGovernanceBanner. Kept so existing imports remain valid. */
export function PrebuildBanner() {
  return <CampaignGovernanceBanner />;
}
