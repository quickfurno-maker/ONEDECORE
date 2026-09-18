import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  resolveWebsiteTrafficSource,
} from "../source-resolution.ts";
import {
  parseWebsiteAnalyticsEvent,
} from "../server/ingest.ts";
import { websiteAnalyticsNoContentResponse } from "../server/analytics-http.ts";
import { AD_CONSENT_VERSION } from "../../marketing/meta/ad-consent.ts";

describe("website analytics source resolution", () => {
  test("distinguishes Facebook and Instagram paid traffic", () => {
    assert.equal(
      resolveWebsiteTrafficSource({
        utmSource: "facebook",
        utmMedium: "paid_social",
        fbclid: "abc",
      }).sourceKey,
      "facebook_ads"
    );
    assert.equal(
      resolveWebsiteTrafficSource({
        utmSource: "instagram",
        utmMedium: "paid_social",
        fbclid: "abc",
      }).sourceKey,
      "instagram_ads"
    );
  });

  test("does not invent Facebook vs Instagram from a generic Meta click", () => {
    assert.equal(
      resolveWebsiteTrafficSource({ fbclid: "abc" }).sourceKey,
      "meta_ads"
    );
  });

  test("classifies Google Ads, organic, referral and direct", () => {
    assert.equal(resolveWebsiteTrafficSource({ gclid: "x" }).sourceKey, "google_ads");
    assert.equal(
      resolveWebsiteTrafficSource({ referrerHost: "www.google.com" }).sourceKey,
      "google_organic"
    );
    assert.equal(
      resolveWebsiteTrafficSource({ referrerHost: "example.com" }).sourceKey,
      "referral"
    );
    assert.equal(resolveWebsiteTrafficSource({}).sourceKey, "direct");
  });
});

describe("website analytics ingestion contract", () => {
  const valid = () => ({
    visitorId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    eventId: "33333333-3333-4333-8333-333333333333",
    consentVersion: AD_CONSENT_VERSION,
    eventType: "page_view",
    path: "/?utm_source=facebook",
    actionKey: null,
    occurredAt: new Date().toISOString(),
    landingPath: "/?utm_source=facebook",
    referrerHost: null,
    sourceKey: "facebook_ads",
    medium: "paid_social",
    utmCampaign: "launch",
    utmContent: "creative-1",
    utmTerm: null,
    hasMetaClick: true,
    hasGoogleClick: false,
  });

  test("accepts only the bounded PII-free allow-list", () => {
    assert.ok(parseWebsiteAnalyticsEvent(valid()));
    assert.equal(
      parseWebsiteAnalyticsEvent({ ...valid(), phone: "+919999999999" }),
      null
    );
    assert.equal(
      parseWebsiteAnalyticsEvent({ ...valid(), path: "/admin" }),
      null
    );
  });

  test("stale consent versions fail closed", () => {
    assert.equal(
      parseWebsiteAnalyticsEvent({ ...valid(), consentVersion: "v1" }),
      null
    );
  });

  test("no-consent requests return a standards-compliant bodyless 204", async () => {
    const response = websiteAnalyticsNoContentResponse();
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), null);
    assert.equal(await response.text(), "");

    const route = readFileSync(
      join(process.cwd(), "src/app/api/public/analytics/event/route.ts"),
      "utf8"
    );
    assert.match(route, /websiteAnalyticsNoContentResponse\(\)/);
    assert.doesNotMatch(route, /json\(204/);
  });

  test("root layout mounts one native tracker and the lead success path emits one event", () => {
    const root = process.cwd();
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    const lead = readFileSync(
      join(root, "src/features/lead-intake/public/UnifiedLeadBrief.tsx"),
      "utf8"
    );
    assert.equal((layout.match(/<WebsiteAnalyticsTracker\s*\/>/g) ?? []).length, 1);
    assert.match(lead, /trackWebsiteAnalyticsEvent\("lead_submit_success"/);
  });

  test("analytics paths do not persist raw query strings or fragments", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/website-analytics/client/website-analytics-client.ts"),
      "utf8"
    );
    const helper = source.slice(
      source.indexOf("function currentPath"),
      source.indexOf("function buildInitialAttribution")
    );
    assert.match(helper, /location\.pathname/);
    assert.doesNotMatch(helper, /location\.search|location\.hash/);
  });

  test("admin analytics separates landing exposures from consented measurement and refreshes live", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src/features/website-analytics/server/dashboard.ts"),
      "utf8"
    );
    const page = readFileSync(
      join(process.cwd(), "src/app/admin/analytics/page.tsx"),
      "utf8"
    );
    const liveRefresh = readFileSync(
      join(process.cwd(), "src/features/website-analytics/client/AnalyticsLiveRefresh.tsx"),
      "utf8"
    );

    assert.match(dashboard, /\.from\("landing_exposures"\)/);
    assert.match(dashboard, /count: "exact"/);
    assert.match(page, /Two measurement layers/);
    assert.match(page, /Landing exposures/);
    assert.match(page, /Explicit v2 analytics consent only/);
    assert.match(liveRefresh, /REFRESH_INTERVAL_MS = 30_000/);
    assert.match(liveRefresh, /router\.refresh\(\)/);
  });
});


describe("owner mobile website analytics", () => {
  test("uses the caller bearer token and the shared analytics read model", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/mobile/website-analytics/route.ts"),
      "utf8"
    );
    const dashboard = readFileSync(
      join(process.cwd(), "src/features/website-analytics/server/dashboard.ts"),
      "utf8"
    );

    assert.match(route, /readBearerToken\(request\)/);
    assert.match(route, /createBearerClient\(token\)/);
    assert.match(route, /db\.auth\.getUser\(\)/);
    assert.match(route, /fetchWebsiteAnalyticsDashboardForClient/);
    assert.match(route, /WEBSITE_ANALYTICS_SOURCE_LABELS/);
    assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE_KEY/);

    assert.match(
      dashboard,
      /export async function fetchWebsiteAnalyticsDashboardForClient/
    );
    assert.match(dashboard, /get_website_analytics_dashboard/);
    assert.match(dashboard, /\.from\("landing_exposures"\)/);
    assert.match(dashboard, /\.from\("website_analytics_events"\)/);
  });

  test("keeps permission and range failures explicit for native callers", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/mobile/website-analytics/route.ts"),
      "utf8"
    );

    assert.match(route, /error\.code === "42501"/);
    assert.match(route, /error\.code === "22023"/);
    assert.match(route, /"forbidden"/);
    assert.match(route, /"invalid_request"/);
    assert.match(route, /"unavailable"/);
  });
});
