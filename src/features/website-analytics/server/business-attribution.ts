import "server-only";

import { createAdminClient } from "@/lib/supabase/service-role";
import {
  resolveWebsiteTrafficSource,
  type WebsiteAnalyticsSourceKey,
} from "../source-resolution";

const PAGE_SIZE = 1000;
const WEBSITE_SOURCE = "website-planner";

interface LeadAttributionRow {
  readonly landing_path: string | null;
  readonly attribution: unknown;
  readonly created_at: string;
}

export interface WebsiteBusinessSourceRow {
  readonly source_key: WebsiteAnalyticsSourceKey;
  readonly enquiries: number;
  readonly homepage_enquiries: number;
}

export interface WebsiteBusinessCampaignRow {
  readonly utm_campaign: string;
  readonly source_key: WebsiteAnalyticsSourceKey;
  readonly medium: string | null;
  readonly enquiries: number;
}

export interface WebsiteBusinessPageRow {
  readonly path: string;
  readonly enquiries: number;
}

export interface LandingLabExposureRow {
  readonly slug: string;
  readonly title: string;
  readonly exposures: number;
  readonly last_exposure_at: string | null;
}

export interface WebsiteBusinessAttribution {
  readonly totalEnquiries: number;
  readonly homepageEnquiries: number;
  readonly lastEnquiryAt: string | null;
  readonly sources: readonly WebsiteBusinessSourceRow[];
  readonly campaigns: readonly WebsiteBusinessCampaignRow[];
  readonly pages: readonly WebsiteBusinessPageRow[];
  readonly landingLab: readonly LandingLabExposureRow[];
}

function startOfIstDay(date: string): string {
  return date + "T00:00:00+05:30";
}

function startOfNextIstDay(date: string): string {
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10) + "T00:00:00+05:30";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(
  record: Record<string, unknown>,
  key: string,
  max = 500
): string | null {
  const raw = record[key];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value.slice(0, max) : null;
}

export function normalizeBusinessLandingPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, "https://onedecore.in");
    return url.pathname.slice(0, 500) || "/";
  } catch {
    return value.split(/[?#]/, 1)[0]?.slice(0, 500) || "/";
  }
}

export function summarizeWebsiteLeadAttribution(
  rows: readonly LeadAttributionRow[]
): Omit<WebsiteBusinessAttribution, "landingLab"> {
  const sourceMap = new Map<
    WebsiteAnalyticsSourceKey,
    { enquiries: number; homepage: number }
  >();
  const campaignMap = new Map<
    string,
    {
      utm_campaign: string;
      source_key: WebsiteAnalyticsSourceKey;
      medium: string | null;
      enquiries: number;
    }
  >();
  const pageMap = new Map<string, number>();
  let homepageEnquiries = 0;
  let lastEnquiryAt: string | null = null;

  for (const row of rows) {
    const attribution = objectValue(row.attribution);
    const landingPath = normalizeBusinessLandingPath(
      row.landing_path ?? textValue(attribution, "landingPath")
    );
    const resolved = resolveWebsiteTrafficSource({
      utmSource: textValue(attribution, "utmSource", 80),
      utmMedium: textValue(attribution, "utmMedium", 80),
      utmCampaign: textValue(attribution, "utmCampaign", 200),
      utmContent: textValue(attribution, "utmContent", 200),
      utmTerm: textValue(attribution, "utmTerm", 200),
      fbclid: textValue(attribution, "fbclid", 200),
      gclid: textValue(attribution, "gclid", 200),
      wbraid: textValue(attribution, "wbraid", 200),
      gbraid: textValue(attribution, "gbraid", 200),
      referrerHost: textValue(attribution, "referrerHost", 253),
    });

    const source = sourceMap.get(resolved.sourceKey) ?? {
      enquiries: 0,
      homepage: 0,
    };
    source.enquiries += 1;
    if (landingPath === "/") {
      source.homepage += 1;
      homepageEnquiries += 1;
    }
    sourceMap.set(resolved.sourceKey, source);
    pageMap.set(landingPath, (pageMap.get(landingPath) ?? 0) + 1);

    if (resolved.campaign) {
      const key = [
        resolved.sourceKey,
        resolved.medium ?? "",
        resolved.campaign,
      ].join("\u0000");
      const campaign = campaignMap.get(key) ?? {
        utm_campaign: resolved.campaign,
        source_key: resolved.sourceKey,
        medium: resolved.medium,
        enquiries: 0,
      };
      campaign.enquiries += 1;
      campaignMap.set(key, campaign);
    }

    if (!lastEnquiryAt || row.created_at > lastEnquiryAt) {
      lastEnquiryAt = row.created_at;
    }
  }

  return {
    totalEnquiries: rows.length,
    homepageEnquiries,
    lastEnquiryAt,
    sources: [...sourceMap.entries()]
      .map(([source_key, value]) => ({
        source_key,
        enquiries: value.enquiries,
        homepage_enquiries: value.homepage,
      }))
      .sort((a, b) => b.enquiries - a.enquiries || a.source_key.localeCompare(b.source_key)),
    campaigns: [...campaignMap.values()].sort(
      (a, b) =>
        b.enquiries - a.enquiries ||
        a.utm_campaign.localeCompare(b.utm_campaign)
    ),
    pages: [...pageMap.entries()]
      .map(([path, enquiries]) => ({ path, enquiries }))
      .sort((a, b) => b.enquiries - a.enquiries || a.path.localeCompare(b.path)),
  };
}

async function readWebsiteLeadRows(
  fromIso: string,
  untilIso: string
): Promise<LeadAttributionRow[]> {
  const admin = createAdminClient();
  const rows: LeadAttributionRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("leads")
      .select("landing_path, attribution, created_at")
      .eq("source", WEBSITE_SOURCE)
      .is("deleted_at", null)
      .gte("created_at", fromIso)
      .lt("created_at", untilIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const batch = (data ?? []) as LeadAttributionRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

async function readLandingLabExposureRows(
  fromIso: string,
  untilIso: string
): Promise<LandingLabExposureRow[]> {
  const admin = createAdminClient();
  const exposureRows: Array<{
    publication_id: string;
    first_exposed_at: string;
  }> = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("landing_exposures")
      .select("publication_id, first_exposed_at")
      .gte("first_exposed_at", fromIso)
      .lt("first_exposed_at", untilIso)
      .order("first_exposed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const batch = (data ?? []) as Array<{
      publication_id: string;
      first_exposed_at: string;
    }>;
    exposureRows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  if (exposureRows.length === 0) return [];

  const publicationIds = [...new Set(exposureRows.map((row) => row.publication_id))];
  const { data: publications, error: publicationError } = await admin
    .from("landing_publications")
    .select("id, landing_page_id")
    .in("id", publicationIds);
  if (publicationError) throw publicationError;

  const publicationToPage = new Map(
    (publications ?? []).map((row) => [row.id, row.landing_page_id])
  );
  const pageIds = [
    ...new Set(
      [...publicationToPage.values()].filter(
        (value): value is string => typeof value === "string"
      )
    ),
  ];
  if (pageIds.length === 0) return [];

  const { data: pages, error: pageError } = await admin
    .from("landing_pages")
    .select("id, slug, title")
    .in("id", pageIds);
  if (pageError) throw pageError;

  const pageMeta = new Map(
    (pages ?? []).map((row) => [
      row.id,
      { slug: row.slug, title: row.title },
    ])
  );
  const grouped = new Map<
    string,
    { slug: string; title: string; exposures: number; last: string | null }
  >();

  for (const exposure of exposureRows) {
    const pageId = publicationToPage.get(exposure.publication_id);
    if (!pageId) continue;
    const meta = pageMeta.get(pageId);
    if (!meta) continue;
    const current = grouped.get(pageId) ?? {
      slug: meta.slug,
      title: meta.title,
      exposures: 0,
      last: null,
    };
    current.exposures += 1;
    if (!current.last || exposure.first_exposed_at > current.last) {
      current.last = exposure.first_exposed_at;
    }
    grouped.set(pageId, current);
  }

  return [...grouped.values()]
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      exposures: row.exposures,
      last_exposure_at: row.last,
    }))
    .sort((a, b) => b.exposures - a.exposures || a.slug.localeCompare(b.slug));
}

export async function fetchWebsiteBusinessAttribution(
  from: string,
  to: string,
  permissions: readonly string[]
): Promise<WebsiteBusinessAttribution | null> {
  if (!permissions.includes("website.analytics.read")) return null;

  const fromIso = startOfIstDay(from);
  const untilIso = startOfNextIstDay(to);

  try {
    const [leadRows, landingLab] = await Promise.all([
      readWebsiteLeadRows(fromIso, untilIso),
      readLandingLabExposureRows(fromIso, untilIso),
    ]);
    return {
      ...summarizeWebsiteLeadAttribution(leadRows),
      landingLab,
    };
  } catch {
    return null;
  }
}
