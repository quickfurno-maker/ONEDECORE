/**
 * Phase 9A — provider-neutral creative approval snapshot. No landing FK.
 */

export interface CampaignCreativeSnapshot {
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: string;
  readonly mediaReferences: readonly string[];
}

export function validateCampaignCreativeSnapshot(
  snapshot: CampaignCreativeSnapshot
): string | null {
  const headline = snapshot.headline.trim();
  const primaryText = snapshot.primaryText.trim();
  const callToAction = snapshot.callToAction.trim();
  if (!headline || headline.length > 200) return "Headline is required and must be at most 200 characters.";
  if (!primaryText || primaryText.length > 4000) {
    return "Primary text is required and must be at most 4000 characters.";
  }
  if (!callToAction || callToAction.length > 120) {
    return "Call to action is required and must be at most 120 characters.";
  }
  if (snapshot.mediaReferences.length > 8) return "At most 8 media references are allowed.";
  for (const ref of snapshot.mediaReferences) {
    const trimmed = ref.trim();
    if (!trimmed || trimmed.length > 200) return "Media references must be opaque strings up to 200 characters.";
  }
  return null;
}
