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
});
