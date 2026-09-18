import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface WebsiteAnalyticsTotals {
  readonly visitors: number;
  readonly sessions: number;
  readonly page_views: number;
  readonly cta_actions: number;
  readonly form_starts: number;
  readonly form_submits: number;
  readonly leads: number;
  readonly qualified: number;
  readonly consultations: number;
  readonly proposals: number;
  readonly commercial_conversions: number;
  readonly commercial_value_minor: number;
}

export interface WebsiteAnalyticsSourceRow {
  readonly source_key: string;
  readonly visitors: number;
  readonly sessions: number;
  readonly page_views: number;
  readonly cta_actions: number;
  readonly leads: number;
  readonly qualified: number;
  readonly consultations: number;
  readonly proposals: number;
  readonly commercial_conversions: number;
  readonly commercial_value_minor: number;
}

export interface WebsiteAnalyticsCampaignRow {
  readonly utm_campaign: string;
  readonly visitors: number;
  readonly sessions: number;
  readonly leads: number;
  readonly qualified: number;
  readonly commercial_conversions: number;
}

export interface WebsiteAnalyticsPageRow {
  readonly path: string;
  readonly page_views: number;
  readonly sessions: number;
}

export interface WebsiteAnalyticsDashboard {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  readonly measurement_scope: "consented_first_party";
  readonly totals: WebsiteAnalyticsTotals;
  readonly sources: readonly WebsiteAnalyticsSourceRow[];
  readonly campaigns: readonly WebsiteAnalyticsCampaignRow[];
  readonly pages: readonly WebsiteAnalyticsPageRow[];
  readonly landingActivity: {
    readonly exposures: number | null;
    readonly lastExposureAt: string | null;
  };
  readonly lastMeasuredEventAt: string | null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function normalize(raw: unknown): WebsiteAnalyticsDashboard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const totals = (value.totals ?? {}) as Record<string, unknown>;
  const sourceRows = Array.isArray(value.sources) ? value.sources : [];
  const campaignRows = Array.isArray(value.campaigns) ? value.campaigns : [];
  const pageRows = Array.isArray(value.pages) ? value.pages : [];

  return {
    from: String(value.from ?? ""),
    to: String(value.to ?? ""),
    timezone: String(value.timezone ?? "Asia/Kolkata"),
    measurement_scope: "consented_first_party",
    totals: {
      visitors: asNumber(totals.visitors),
      sessions: asNumber(totals.sessions),
      page_views: asNumber(totals.page_views),
      cta_actions: asNumber(totals.cta_actions),
      form_starts: asNumber(totals.form_starts),
      form_submits: asNumber(totals.form_submits),
      leads: asNumber(totals.leads),
      qualified: asNumber(totals.qualified),
      consultations: asNumber(totals.consultations),
      proposals: asNumber(totals.proposals),
      commercial_conversions: asNumber(totals.commercial_conversions),
      commercial_value_minor: asNumber(totals.commercial_value_minor),
    },
    sources: sourceRows.map((row) => {
      const x = row as Record<string, unknown>;
      return {
        source_key: String(x.source_key ?? "direct"),
        visitors: asNumber(x.visitors),
        sessions: asNumber(x.sessions),
        page_views: asNumber(x.page_views),
        cta_actions: asNumber(x.cta_actions),
        leads: asNumber(x.leads),
        qualified: asNumber(x.qualified),
        consultations: asNumber(x.consultations),
        proposals: asNumber(x.proposals),
        commercial_conversions: asNumber(x.commercial_conversions),
        commercial_value_minor: asNumber(x.commercial_value_minor),
      };
    }),
    campaigns: campaignRows.map((row) => {
      const x = row as Record<string, unknown>;
      return {
        utm_campaign: String(x.utm_campaign ?? ""),
        visitors: asNumber(x.visitors),
        sessions: asNumber(x.sessions),
        leads: asNumber(x.leads),
        qualified: asNumber(x.qualified),
        commercial_conversions: asNumber(x.commercial_conversions),
      };
    }),
    pages: pageRows.map((row) => {
      const x = row as Record<string, unknown>;
      return {
        path: String(x.path ?? "/"),
        page_views: asNumber(x.page_views),
        sessions: asNumber(x.sessions),
      };
    }),
    landingActivity: {
      exposures: null,
      lastExposureAt: null,
    },
    lastMeasuredEventAt: null,
  };
}

function startOfIstDay(date: string): string {
  return date + "T00:00:00+05:30";
}

function startOfNextIstDay(date: string): string {
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10) + "T00:00:00+05:30";
}

export async function fetchWebsiteAnalyticsDashboard(
  from: string,
  to: string
): Promise<WebsiteAnalyticsDashboard | null> {
  const supabase = await createClient();
  const fromIso = startOfIstDay(from);
  const untilIso = startOfNextIstDay(to);

  const [dashboardResult, exposureResult, latestEventResult] = await Promise.all([
    supabase.rpc("get_website_analytics_dashboard", {
      p_from: from,
      p_to: to,
    }),
    supabase
      .from("landing_exposures")
      .select("first_exposed_at", { count: "exact" })
      .gte("first_exposed_at", fromIso)
      .lt("first_exposed_at", untilIso)
      .order("first_exposed_at", { ascending: false })
      .limit(1),
    supabase
      .from("website_analytics_events")
      .select("occurred_at")
      .gte("occurred_at", fromIso)
      .lt("occurred_at", untilIso)
      .order("occurred_at", { ascending: false })
      .limit(1),
  ]);

  if (dashboardResult.error) return null;
  const normalized = normalize(dashboardResult.data);
  if (!normalized) return null;

  return {
    ...normalized,
    landingActivity: {
      exposures: exposureResult.error ? null : (exposureResult.count ?? 0),
      lastExposureAt: exposureResult.error
        ? null
        : (exposureResult.data?.[0]?.first_exposed_at ?? null),
    },
    lastMeasuredEventAt: latestEventResult.error
      ? null
      : (latestEventResult.data?.[0]?.occurred_at ?? null),
  };
}

export const WEBSITE_ANALYTICS_SOURCE_LABELS: Readonly<Record<string, string>> = {
  direct: "Direct",
  facebook_ads: "Facebook Ads",
  instagram_ads: "Instagram Ads",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  google_organic: "Google Organic",
  facebook_organic: "Facebook Organic",
  instagram_organic: "Instagram Organic",
  referral: "Referral",
  email: "Email",
  whatsapp: "WhatsApp",
  other_campaign: "Other Campaign",
};
