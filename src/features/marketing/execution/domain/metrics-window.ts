const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_KEY = /^ms:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i;

export interface CanonicalUtcDayWindow {
  readonly date: string;
  readonly windowStartIso: string;
  readonly windowEndIso: string;
}

export function utcCalendarDayWindow(dateYmd: string): CanonicalUtcDayWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const start = Date.parse(`${dateYmd}T00:00:00.000Z`);
  if (!Number.isFinite(start)) return null;
  return {
    date: dateYmd,
    windowStartIso: new Date(start).toISOString(),
    windowEndIso: new Date(start + DAY_MS).toISOString(),
  };
}

export function previousCompleteUtcCalendarDay(now = new Date()): CanonicalUtcDayWindow {
  const utcYmd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
  const window = utcCalendarDayWindow(utcYmd);
  if (!window) throw new Error("CAMPAIGN_METRICS_WINDOW_INVALID");
  return window;
}

export function metricsSyncOperationKey(targetId: string, dateYmd: string): string {
  return `ms:${targetId}:${dateYmd}`;
}

export function parseMetricsSyncOperationKey(operationKey: string): CanonicalUtcDayWindow | null {
  const match = WINDOW_KEY.exec(operationKey);
  if (!match) return null;
  return utcCalendarDayWindow(match[2] ?? "");
}

/** Google Ads GAQL BETWEEN is inclusive at both ends. Canonical [D, D+1) must query exactly D. */
export function googleAdsSegmentsDateEquals(window: CanonicalUtcDayWindow): string {
  return window.date;
}

/**
 * Meta Insights time_range: official Ad Account Insights docs (developers.facebook.com
 * documentation/ads-commerce/marketing-api/reference/ad-account/insights):
 * since = beginning midnight of that day;
 * until = beginning midnight of the following day of that until date.
 * Therefore since=D and until=D is exactly calendar day D / canonical [D, D+1).
 */
export function metaInsightsTimeRangeForCanonicalDay(window: CanonicalUtcDayWindow): {
  readonly since: string;
  readonly until: string;
} {
  return { since: window.date, until: window.date };
}
