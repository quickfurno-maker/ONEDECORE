/**
 * Phase 9 migration-independent — marketing channel contracts.
 */

export const MARKETING_CHANNELS = [
  "meta_ads",
  "google_ads",
  "email",
  "whatsapp",
] as const;

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export function isMarketingChannel(value: string): value is MarketingChannel {
  return (MARKETING_CHANNELS as readonly string[]).includes(value);
}
