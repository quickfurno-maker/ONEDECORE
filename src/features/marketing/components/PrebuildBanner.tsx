export function CampaignGovernanceBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="campaign-governance-banner rounded-md border px-3 py-2 text-xs"
    >
      Approval governance only. Mock execution foundation — no live provider writes. Production activation Phase 10.
    </div>
  );
}

/** @deprecated Use CampaignGovernanceBanner. Kept so existing imports remain valid. */
export function PrebuildBanner() {
  return <CampaignGovernanceBanner />;
}
