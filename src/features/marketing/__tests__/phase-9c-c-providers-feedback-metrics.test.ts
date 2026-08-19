/**
 * Phase 9C-C — Meta/Google adapters, gates, attribution, metrics, feedback.
 * All HTTP is injected. CI must not contact live Ads hosts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { CAMPAIGN_OPERATION_TYPES } from "../execution/contracts/run-lifecycle.ts";
import { canShareProviderCustomerData } from "../execution/domain/provider-data-sharing.ts";
import { safeRatio } from "../execution/domain/metric-ratios.ts";
import { googleMicrosToSpendMinor, spendMinorToNumber } from "../execution/server/money.ts";
import {
  assertProviderUrlAllowed,
  createMemoryProviderHttpTransport,
  redactProviderHeaders,
} from "../execution/server/provider-http.ts";
import {
  GOOGLE_ADS_API_VERSION,
  META_MARKETING_API_VERSION,
  resolveGoogleAdsProviderConfig,
  resolveMetaAdsProviderConfig,
} from "../execution/server/provider-config.ts";
import { MetaAdsCampaignExecutionProvider } from "../execution/server/meta-ads-provider.ts";
import { GoogleAdsCampaignExecutionProvider } from "../execution/server/google-ads-provider.ts";
import {
  CAMPAIGN_PRODUCTION_GATE_OFF,
  CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE,
  resolveCampaignExecutionProvider,
} from "../execution/server/provider-factory.ts";
import {
  rejectUnsignedRunGuess,
  signCampaignExecutionContext,
  verifyCampaignExecutionContext,
  type CampaignExecutionContext,
} from "../execution/server/execution-context-crypto.ts";
import { ignoreUnsignedRunQuery, resolveTrustedRunAttribution } from "../execution/server/verify-execution-context.ts";
import { parseCampaignApprovedExecutionSpec } from "../execution/domain/approved-execution-spec.ts";
import { CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE } from "../execution/contracts/approved-execution-spec.ts";
import { buildGoogleSearchPausedCreatePlan } from "../execution/domain/google-search-paused-plan.ts";
import { buildMetaPausedCreatePlan } from "../execution/domain/meta-paused-plan.ts";
import {
  parseCapturedClickIdentifiers,
  selectMetaCapiIdentifiers,
} from "../execution/contracts/click-identifiers.ts";
import { metricsSyncOperationKey, parseMetricsSyncOperationKey, googleAdsSegmentsDateEquals, metaInsightsTimeRangeForCanonicalDay, utcCalendarDayWindow } from "../execution/domain/metrics-window.ts";
import { spendMinorToGoogleMicros } from "../execution/server/money.ts";
import {
  CAMPAIGN_APPROVAL_HASH_MISMATCH,
  CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED,
  CAMPAIGN_AUDIENCE_RULE_HASH_MISMATCH,
  CAMPAIGN_FROZEN_AUDIENCE_RULE_MISSING,
  CAMPAIGN_VERSIONS_APPROVED_SPEC_SELECT,
  loadApprovedExecutionSpec,
  type ApprovedSpecStore,
} from "../execution/server/load-approved-execution-spec.ts";
import { CAMPAIGN_PROVIDER_CURRENCY_MISMATCH } from "../execution/domain/provider-currency.ts";

const root = process.cwd();
const metaInsights = readFileSync(
  join(root, "src/features/marketing/__tests__/fixtures/meta-insights.json"),
  "utf8"
);
const googleMetrics = readFileSync(
  join(root, "src/features/marketing/__tests__/fixtures/google-metrics.json"),
  "utf8"
);

const command = {
  operationType: "create" as const,
  operationKey: "create:OD-CR-2026-000002",
  providerChannel: "meta_ads" as const,
  runReference: "OD-CR-2026-000002",
  runTargetReference: "OD-CRT-2026-000002",
  boundProviderCampaignId: "120000000000000001",
};

const metaConfig = {
  adAccountId: "act_123",
  accessToken: "secret-meta-token",
  graphVersion: META_MARKETING_API_VERSION,
  pageId: "111222333",
  datasetId: "pixel-dataset-1",
};

const googleConfig = {
  customerId: "1234567890",
  developerToken: "secret-dev-token",
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "secret-refresh",
  loginCustomerId: null as string | null,
  conversionActionResource: "customers/1234567890/conversionActions/555",
};

function sampleContext(overrides: Partial<CampaignExecutionContext> = {}): CampaignExecutionContext {
  return {
    version: 1,
    runReference: "OD-CR-2026-000001",
    runTargetReference: "OD-CRT-2026-000001",
    providerChannel: "meta_ads",
    campaignReference: "OD-C-2026-000001",
    campaignVersionNumber: 1,
    landingPublicationReference: "OD-LP-2026-000001",
    issuedAt: "2026-08-19T00:00:00.000Z",
    expiresAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

const HASH = "ab".repeat(32);

function googleCompatibleSpec() {
  const parsed = parseCampaignApprovedExecutionSpec({
    campaignVersionId: "44444444-4444-4444-4444-444444444444",
    versionStatus: "approved",
    versionConfigurationHash: HASH,
    runConfigurationHash: HASH,
    providerChannel: "google_ads",
    targetingMode: "broad_public",
    audienceRuleHash: HASH,
    budgetSnapshot: { currency: "INR", daily_budget_paise: 2500, total_budget_paise: 10000 },
    creativeSnapshot: {
      headline: "Home interiors",
      primary_text: "Book a consult today in Pune",
      call_to_action: "LEARN_MORE",
      media_references: [],
      headlines: ["Home interiors", "Pune design studio", "Free consult"],
      descriptions: ["Book a consult today in Pune", "Trusted interior designers"],
      keywords: ["interior design pune"],
      destination_url: "https://onedecore.in/lp/home-interiors",
    },
    intendedWindowSnapshot: { start_date: "2026-09-01", end_date: "2026-09-30" },
    destinationReference: "https://onedecore.in/lp/home-interiors",
  });
  if (!parsed.ok) throw new Error(parsed.code);
  return parsed.spec;
}

function metaCompatibleSpec() {
  const parsed = parseCampaignApprovedExecutionSpec({
    campaignVersionId: "44444444-4444-4444-4444-444444444444",
    versionStatus: "approved",
    versionConfigurationHash: HASH,
    runConfigurationHash: HASH,
    providerChannel: "meta_ads",
    targetingMode: "broad_public",
    audienceRuleHash: HASH,
    budgetSnapshot: { currency: "INR", daily_budget_paise: 2500, total_budget_paise: 10000 },
    creativeSnapshot: {
      headline: "Home interiors",
      primary_text: "Book a consult today in Pune",
      call_to_action: "LEARN_MORE",
      media_references: [],
      geo_country_codes: ["IN"],
      destination_url: "https://onedecore.in/lp/home-interiors",
    },
    intendedWindowSnapshot: { start_date: "2026-09-01", end_date: "2026-09-30" },
    destinationReference: "https://onedecore.in/lp/home-interiors",
  });
  if (!parsed.ok) throw new Error(parsed.code);
  return parsed.spec;
}

describe("Phase 9C-C operation types", () => {
  test("includes metrics_sync and conversion_feedback", () => {
    assert.ok(CAMPAIGN_OPERATION_TYPES.includes("metrics_sync"));
    assert.ok(CAMPAIGN_OPERATION_TYPES.includes("conversion_feedback"));
  });
});

describe("Phase 9C-C money normalization", () => {
  test("Google micros convert exactly to spend_minor", () => {
    assert.equal(spendMinorToNumber(googleMicrosToSpendMinor(BigInt(2500000))), 250);
    assert.throws(() => googleMicrosToSpendMinor(BigInt(1)));
  });

  test("divide-by-zero ratios are null", () => {
    assert.equal(safeRatio(100, 0), null);
    assert.equal(safeRatio(100, 4), 25);
  });
});

describe("Phase 9C-C transport redaction and network block", () => {
  test("redacts authorization developer-token and cookies", () => {
    const redacted = redactProviderHeaders({
      Authorization: "Bearer secret-meta-token",
      "developer-token": "secret-dev-token",
      Cookie: "sid=abc",
      Accept: "application/json",
    });
    assert.equal(redacted.Authorization, "[redacted]");
    assert.equal(redacted["developer-token"], "[redacted]");
    assert.equal(redacted.Cookie, "[redacted]");
    assert.equal(redacted.Accept, "application/json");
  });

  test("blocks live Ads hosts unless explicitly allowed", () => {
    assert.throws(() => assertProviderUrlAllowed("https://graph.facebook.com/v26.0/act_1", false));
    assert.throws(() => assertProviderUrlAllowed("https://googleads.googleapis.com/v25/customers/1", false));
    assert.throws(() => assertProviderUrlAllowed("https://oauth2.googleapis.com/token", false));
  });
});

describe("Phase 9C-C Meta adapter", () => {
  test("maps create request and never uses live fetch", async () => {
    let seenAuth = "";
    let seenBody = "";
    const transport = createMemoryProviderHttpTransport((input) => {
      if (input.method === "GET" && input.url.includes("fields=currency")) {
        return { status: 200, bodyText: JSON.stringify({ currency: "INR" }) };
      }
      seenAuth = input.headers.Authorization ?? "";
      seenBody = input.body ?? "";
      assert.match(input.url, /graph\.facebook\.com\/v26\.0\/act_123\/ads/);
      assert.match(input.body ?? "", /OUTCOME_TRAFFIC/);
      assert.match(input.body ?? "", /Home(\+|%20| )interiors/);
      assert.doesNotMatch(input.body ?? "", /invented-keyword/);
      return { status: 200, bodyText: JSON.stringify({ id: "120000000000000001" }) };
    });
    const provider = new MetaAdsCampaignExecutionProvider(metaConfig, transport);
    const result = await provider.create({
      ...command,
      boundProviderCampaignId: null,
      approvedSpec: metaCompatibleSpec(),
    });
    assert.equal(result.kind, "success");
    if (result.kind === "success") assert.equal(result.providerCampaignId, "120000000000000001");
    assert.equal(seenAuth, "Bearer secret-meta-token");
    assert.match(seenBody, /2500/);
    assert.equal(redactProviderHeaders({ Authorization: seenAuth }).Authorization, "[redacted]");
  });

  test("insufficient approved snapshot fails closed without network", async () => {
    const provider = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => {
        throw new Error("no network");
      })
    );
    const parsed = parseCampaignApprovedExecutionSpec({
      campaignVersionId: "44444444-4444-4444-4444-444444444444",
      versionStatus: "approved",
      versionConfigurationHash: HASH,
      runConfigurationHash: HASH,
      providerChannel: "meta_ads",
      targetingMode: "broad_public",
      audienceRuleHash: HASH,
      budgetSnapshot: { currency: "INR", daily_budget_paise: 2500, total_budget_paise: null },
      creativeSnapshot: {
        headline: "Home interiors",
        primary_text: "Book a consult",
        call_to_action: "Call now",
        media_references: [],
      },
      intendedWindowSnapshot: { start_date: "2026-09-01", end_date: null },
      destinationReference: "OD-LP-2026-000001",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = await provider.create({ ...command, approvedSpec: parsed.spec });
    assert.equal(result.kind, "validation_failure");
    if (result.kind === "validation_failure") {
      assert.equal(result.errorCode, CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE);
    }
  });

  test("classifies validation transient timeout and reconcile", async () => {
    const provider = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 400, bodyText: "{}" }))
    );
    assert.equal((await provider.pause(command)).kind, "validation_failure");

    const transient = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 429, bodyText: "{}" }))
    );
    assert.equal((await transient.pause(command)).kind, "transient_failure");

    const timeout = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => {
        throw new Error("aborted");
      })
    );
    assert.equal((await timeout.activate(command)).kind, "timeout_unknown");

    const found = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({
        status: 200,
        bodyText: JSON.stringify({ id: command.boundProviderCampaignId, status: "PAUSED" }),
      }))
    );
    assert.equal((await found.getStatus(command)).kind, "found");

    const missing = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 404, bodyText: "{}" }))
    );
    assert.equal((await missing.getStatus(command)).kind, "not_found");

    const rateLimited = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 429, bodyText: "{}" }))
    );
    assert.equal((await rateLimited.getStatus(command)).kind, "transient");

    const auth = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 401, bodyText: "{}" }))
    );
    assert.equal((await auth.getStatus(command)).kind, "auth_config");
  });

  test("maps insights spend without floating multiply", async () => {
    const provider = new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 200, bodyText: metaInsights }))
    );
    const metrics = await provider.fetchMetrics(command, {
      windowStartIso: "2026-08-01T00:00:00.000Z",
      windowEndIso: "2026-08-02T00:00:00.000Z",
    });
    assert.equal(metrics.kind, "success");
    if (metrics.kind === "success") {
      assert.equal(metrics.snapshot.spendMinor, 1250);
      assert.equal(metrics.snapshot.currency, "INR");
      assert.equal(metrics.snapshot.impressions, 100);
      assert.equal(metrics.snapshot.clicks, 4);
      assert.equal(metrics.snapshot.providerConversions, 1);
    }
  });

  test("builds conversion feedback request and blocks submit", async () => {
    const provider = new MetaAdsCampaignExecutionProvider(metaConfig, createMemoryProviderHttpTransport(() => {
      throw new Error("no network");
    }));
    const built = provider.buildConversionFeedbackRequest({
      eventReference: "OD-CFE-2026-000001",
      conversionType: "LeadCreated",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "meta_ads",
      clickIdentifiers: parseCapturedClickIdentifiers({ fbc: "fb.1.1710000000.AbC", fbp: "fb.1.1710000000.123", fbclid: "not-fbc" }),
      conversionActionResource: null,
      pixelOrDatasetId: "pixel-dataset-1",
      valueMinor: null,
      currency: null,
    });
    assert.equal(built.event_id, "OD-CFE-2026-000001");
    assert.equal((built.user_data as Record<string, string>).fbc, "fb.1.1710000000.AbC");
    assert.equal((built.user_data as Record<string, string>).fbp, "fb.1.1710000000.123");
    const fabricated = provider.buildConversionFeedbackRequest({
      eventReference: "OD-CFE-2026-000001",
      conversionType: "LeadCreated",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "meta_ads",
      clickIdentifiers: parseCapturedClickIdentifiers({ fbclid: "abc12345" }),
      conversionActionResource: null,
      pixelOrDatasetId: "pixel-dataset-1",
      valueMinor: null,
      currency: null,
    });
    assert.deepEqual(fabricated.user_data, {});
    assert.equal(selectMetaCapiIdentifiers(parseCapturedClickIdentifiers({ fbclid: "abc12345" })).fbc, null);
    const missingProvider = new MetaAdsCampaignExecutionProvider(
      { ...metaConfig, datasetId: null },
      createMemoryProviderHttpTransport(() => {
        throw new Error("no network");
      })
    );
    const missing = missingProvider.buildConversionFeedbackRequest({
      eventReference: "OD-CFE-2026-000001",
      conversionType: "LeadCreated",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "meta_ads",
      clickIdentifiers: [],
      conversionActionResource: null,
      pixelOrDatasetId: null,
      valueMinor: null,
      currency: null,
    });
    assert.equal(missing.errorCode, "CAMPAIGN_CONVERSION_DATASET_MISSING");
    const submitted = await provider.submitConversionFeedback({
      eventReference: "OD-CFE-2026-000001",
      conversionType: "LeadCreated",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "meta_ads",
      clickIdentifiers: [],
      conversionActionResource: null,
      pixelOrDatasetId: "pixel-dataset-1",
      valueMinor: null,
      currency: null,
    });
    assert.equal(submitted.kind, "blocked");
  });
});

describe("Phase 9C-C Google adapter", () => {
  test("creates paused Search object chain from approved budget", async () => {
    const urls: string[] = [];
    let mutateBody = "";
    const transport = createMemoryProviderHttpTransport((input) => {
      urls.push(input.url);
      if (input.url.includes("oauth2.googleapis.com")) {
        return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
      }
      if (input.body?.includes("customer.currency_code")) {
        return { status: 200, bodyText: JSON.stringify({ results: [{ customer: { currencyCode: "INR" } }] }) };
      }
      mutateBody = input.body ?? "";
      assert.match(input.url, /googleAds:mutate/);
      return {
        status: 200,
        bodyText: JSON.stringify({
          mutateOperationResponses: [
            { campaignBudgetResult: { resourceName: "customers/1234567890/campaignBudgets/1" } },
            { campaignResult: { resourceName: "customers/1234567890/campaigns/9" } },
            { adGroupResult: { resourceName: "customers/1234567890/adGroups/3" } },
          ],
        }),
      };
    });
    const provider = new GoogleAdsCampaignExecutionProvider(googleConfig, transport);
    const spec = googleCompatibleSpec();
    const result = await provider.create({
      ...command,
      providerChannel: "google_ads",
      boundProviderCampaignId: null,
      approvedSpec: spec,
    });
    assert.equal(result.kind, "success");
    assert.equal(spendMinorToGoogleMicros(2500).toString(), "25000000");
    assert.match(mutateBody, /"amountMicros":"25000000"/);
    assert.doesNotMatch(mutateBody, /100000000/);
    assert.match(mutateBody, /responsiveSearchAd/);
    assert.match(mutateBody, /interior design pune/);
    assert.match(mutateBody, /https:\/\/onedecore.in\/lp\/home-interiors/);
    assert.ok(urls.some((url) => url.includes(`googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/`)));
    const source = readFileSync(join(root, "src/features/marketing/execution/server/google-ads-provider.ts"), "utf8");
    assert.doesNotMatch(source, /100000000/);
    const planned = buildGoogleSearchPausedCreatePlan(spec, googleConfig.customerId);
    assert.equal(planned.ok, true);
  });

  test("maps micros metrics and status", async () => {
    const transport = createMemoryProviderHttpTransport((input) => {
      if (input.url.includes("oauth2.googleapis.com")) {
        return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
      }
      if (input.body?.includes("customer.currency_code")) {
        return { status: 200, bodyText: JSON.stringify({ results: [{ customer: { currencyCode: "INR" } }] }) };
      }
      if (input.body?.includes("metrics.cost_micros")) {
        return { status: 200, bodyText: googleMetrics };
      }
      return {
        status: 200,
        bodyText: JSON.stringify({
          results: [{ campaign: { resourceName: "customers/1234567890/campaigns/9", status: "PAUSED" } }],
        }),
      };
    });
    const provider = new GoogleAdsCampaignExecutionProvider(googleConfig, transport);
    const status = await provider.getStatus({
      ...command,
      providerChannel: "google_ads",
      boundProviderCampaignId: "customers/1234567890/campaigns/9",
    });
    assert.equal(status.kind, "found");
    const limited = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.url.includes("oauth2.googleapis.com")) {
          return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
        }
        return { status: 429, bodyText: "{}" };
      })
    );
    assert.equal(
      (
        await limited.getStatus({
          ...command,
          providerChannel: "google_ads",
          boundProviderCampaignId: "customers/1234567890/campaigns/9",
        })
      ).kind,
      "transient"
    );
    const metrics = await provider.fetchMetrics(
      {
        ...command,
        providerChannel: "google_ads",
        boundProviderCampaignId: "customers/1234567890/campaigns/9",
      },
      { windowStartIso: "2026-08-01T00:00:00.000Z", windowEndIso: "2026-08-02T00:00:00.000Z" }
    );
    assert.equal(metrics.kind, "success");
    if (metrics.kind === "success") {
      assert.equal(metrics.snapshot.spendMinor, 250);
      assert.equal(metrics.snapshot.currency, "INR");
    }
    const queries: string[] = [];
    const dated = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.url.includes("oauth2.googleapis.com")) {
          return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
        }
        if (input.body?.includes("customer.currency_code")) {
          return { status: 200, bodyText: JSON.stringify({ results: [{ customer: { currencyCode: "INR" } }] }) };
        }
        queries.push(input.body ?? "");
        return { status: 200, bodyText: googleMetrics };
      })
    );
    const d1 = utcCalendarDayWindow("2026-08-18");
    const d2 = utcCalendarDayWindow("2026-08-19");
    assert.ok(d1 && d2);
    await dated.fetchMetrics(
      { ...command, providerChannel: "google_ads", boundProviderCampaignId: "customers/1234567890/campaigns/9" },
      { windowStartIso: d1.windowStartIso, windowEndIso: d1.windowEndIso }
    );
    await dated.fetchMetrics(
      { ...command, providerChannel: "google_ads", boundProviderCampaignId: "customers/1234567890/campaigns/9" },
      { windowStartIso: d2.windowStartIso, windowEndIso: d2.windowEndIso }
    );
    assert.match(queries[0] ?? "", /segments\.date = '2026-08-18'/);
    assert.match(queries[1] ?? "", /segments\.date = '2026-08-19'/);
    assert.doesNotMatch(queries[0] ?? "", /2026-08-19/);
    assert.doesNotMatch(queries[1] ?? "", /2026-08-18/);
  });

  test("rate-limit and timeout unknown", async () => {
    const transient = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.url.includes("oauth2.googleapis.com")) {
          return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
        }
        return { status: 429, bodyText: "{}" };
      })
    );
    assert.equal(
      (
        await transient.pause({
          ...command,
          providerChannel: "google_ads",
          boundProviderCampaignId: "customers/1234567890/campaigns/9",
        })
      ).kind,
      "transient_failure"
    );
    const timeout = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport(() => {
        throw new Error("aborted");
      })
    );
    assert.equal(
      (
        await timeout.pause({
          ...command,
          providerChannel: "google_ads",
          boundProviderCampaignId: "customers/1234567890/campaigns/9",
        })
      ).kind,
      "timeout_unknown"
    );
    const incompatible = await timeout.create({ ...command, providerChannel: "google_ads", approvedSpec: null });
    assert.equal(incompatible.kind, "validation_failure");
  });

  test("conversion feedback builder stays local", async () => {
    const provider = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport(() => {
        throw new Error("no network");
      })
    );
    const built = provider.buildConversionFeedbackRequest({
      eventReference: "OD-CFE-2026-000002",
      conversionType: "CommercialConversion",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "google_ads",
      clickIdentifiers: parseCapturedClickIdentifiers({ gclid: "Cj0ABCDE" }),
      conversionActionResource: "customers/1234567890/conversionActions/555",
      pixelOrDatasetId: null,
      valueMinor: 12345,
      currency: "INR",
    });
    assert.equal(built.orderId, "OD-CFE-2026-000002");
    assert.equal(built.gclid, "Cj0ABCDE");
    assert.equal(built.conversionAction, "customers/1234567890/conversionActions/555");
    assert.doesNotMatch(JSON.stringify(built), /unspecified/);
    const missingAction = provider.buildConversionFeedbackRequest({
      eventReference: "OD-CFE-2026-000002",
      conversionType: "CommercialConversion",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "google_ads",
      clickIdentifiers: parseCapturedClickIdentifiers({ gclid: "Cj0ABCDE" }),
      conversionActionResource: null,
      pixelOrDatasetId: null,
      valueMinor: 12345,
      currency: "INR",
    });
    const noConfigProvider = new GoogleAdsCampaignExecutionProvider(
      { ...googleConfig, conversionActionResource: null },
      createMemoryProviderHttpTransport(() => {
        throw new Error("no network");
      })
    );
    assert.equal(
      noConfigProvider.buildConversionFeedbackRequest({
        eventReference: "OD-CFE-2026-000002",
        conversionType: "CommercialConversion",
        occurredAt: "2026-08-19T00:00:00.000Z",
        runReference: "OD-CR-2026-000002",
        runTargetReference: "OD-CRT-2026-000002",
        providerChannel: "google_ads",
        clickIdentifiers: [],
        conversionActionResource: null,
        pixelOrDatasetId: null,
        valueMinor: null,
        currency: null,
      }).errorCode,
      "CAMPAIGN_CONVERSION_ACTION_MISSING"
    );
    void missingAction;
    const submitted = await provider.submitConversionFeedback({
      eventReference: "OD-CFE-2026-000002",
      conversionType: "CommercialConversion",
      occurredAt: "2026-08-19T00:00:00.000Z",
      runReference: "OD-CR-2026-000002",
      runTargetReference: "OD-CRT-2026-000002",
      providerChannel: "google_ads",
      clickIdentifiers: parseCapturedClickIdentifiers({ gclid: "Cj0ABCDE" }),
      conversionActionResource: "customers/1234567890/conversionActions/555",
      pixelOrDatasetId: null,
      valueMinor: 12345,
      currency: "INR",
    });
    assert.equal(submitted.kind, "blocked");
    assert.equal(submitted.errorCode, "PROVIDER_DATA_SHARING_GATE_OFF");
  });
});

describe("Phase 9C-C factory gates", () => {
  test("config missing is fail-closed without network", () => {
    assert.equal(resolveMetaAdsProviderConfig({}).ok, false);
    assert.equal(resolveGoogleAdsProviderConfig({}).ok, false);
  });

  test("sandbox without transport gate fail closed", () => {
    const sandbox = resolveCampaignExecutionProvider({
      ONEDECORE_CAMPAIGN_EXECUTION_MODE: "sandbox",
      ONEDECORE_META_ADS_ACCOUNT_ID: "act_1",
      ONEDECORE_META_ADS_ACCESS_TOKEN: "token",
    });
    assert.equal(sandbox.ok, false);
    if (!sandbox.ok) assert.equal(sandbox.code, CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE);
  });

  test("live credentials do not enable production", () => {
    const live = resolveCampaignExecutionProvider({
      ONEDECORE_CAMPAIGN_EXECUTION_MODE: "live",
      ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED: "false",
      ONEDECORE_META_ADS_ACCOUNT_ID: "act_1",
      ONEDECORE_META_ADS_ACCESS_TOKEN: "token",
    });
    assert.equal(live.ok, false);
    if (!live.ok) assert.equal(live.code, CAMPAIGN_PRODUCTION_GATE_OFF);
  });

  test("data sharing remains blocked even if flag is true in 9C-C", () => {
    const decision = canShareProviderCustomerData({
      provider: "meta_ads",
      purpose: "conversion_identifier",
      targetingMode: "broad_public",
      executionMode: "live",
      productionSharingEnabled: true,
      marketingConsentGranted: true,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "PROVIDER_CUSTOMER_DATA_TRANSPORT_BLOCKED_IN_9C_C");
  });
});

describe("Phase 9C-C trusted attribution", () => {
  test("valid signed context verifies; expired and tampered fail", () => {
    const secret = "phase-9c-c-execution-hmac-secret-32chars";
    const signed = signCampaignExecutionContext(secret, sampleContext());
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    assert.equal(verifyCampaignExecutionContext(secret, signed, now).valid, true);
    assert.equal(verifyCampaignExecutionContext(secret, signed, Date.parse("2026-08-21T00:00:00.000Z")).valid, false);
    assert.equal(
      verifyCampaignExecutionContext(secret, { ...signed, signature: "00".repeat(32) }, now).valid,
      false
    );
  });

  test("unsigned run query is ignored and never guessed from UTM/time", () => {
    ignoreUnsignedRunQuery({ run_reference: "OD-CR-2026-000001", utm_campaign: "spring" });
    assert.throws(() =>
      rejectUnsignedRunGuess({
        utmCampaign: "spring",
        nowIso: "2026-08-19T12:00:00.000Z",
        queryRunId: "OD-CR-2026-000001",
      })
    );
  });

  test("execution context A binds only to trusted publication A", async () => {
    const secret = "phase-9c-c-execution-hmac-secret-32chars";
    const signed = signCampaignExecutionContext(secret, sampleContext());
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    const client = {
      async rpc() {
        return { data: { outcome_code: "ok" }, error: null };
      },
    } as unknown as Parameters<typeof resolveTrustedRunAttribution>[0]["client"];
    const same = await resolveTrustedRunAttribution({
      signed,
      client,
      hmacSecret: secret,
      trustedLandingPublicationReference: "OD-LP-2026-000001",
      nowMs: now,
    });
    assert.equal(same.ok, true);
    const swapped = await resolveTrustedRunAttribution({
      signed,
      client,
      hmacSecret: secret,
      trustedLandingPublicationReference: "OD-LP-2026-000002",
      nowMs: now,
    });
    assert.equal(swapped.ok, false);
    const expired = await resolveTrustedRunAttribution({
      signed,
      client,
      hmacSecret: secret,
      trustedLandingPublicationReference: "OD-LP-2026-000001",
      nowMs: Date.parse("2026-08-21T00:00:00.000Z"),
    });
    assert.equal(expired.ok, false);
  });
});

describe("Phase 9C-C approved spec and metrics windows", () => {
  test("hash mismatch and insufficient Google RSA fail closed", () => {
    const mismatch = parseCampaignApprovedExecutionSpec({
      campaignVersionId: "44444444-4444-4444-4444-444444444444",
      versionStatus: "approved",
      versionConfigurationHash: HASH,
      runConfigurationHash: "cd".repeat(32),
      providerChannel: "google_ads",
      targetingMode: "broad_public",
      audienceRuleHash: HASH,
      budgetSnapshot: { currency: "INR", daily_budget_paise: 2500, total_budget_paise: null },
      creativeSnapshot: { headline: "H", primary_text: "P", call_to_action: "LEARN_MORE", media_references: [] },
      intendedWindowSnapshot: { start_date: "2026-09-01", end_date: null },
      destinationReference: "https://onedecore.in/lp/x",
    });
    assert.equal(mismatch.ok, false);
    const googlePlan = buildGoogleSearchPausedCreatePlan(metaCompatibleSpec(), "123");
    assert.equal(googlePlan.ok, false);
    const metaPlan = buildMetaPausedCreatePlan(metaCompatibleSpec(), { pageId: "111" });
    assert.equal(metaPlan.ok, true);
  });

  test("canonical UTC days do not overlap", () => {
    const first = parseMetricsSyncOperationKey(metricsSyncOperationKey("33333333-3333-3333-3333-333333333333", "2026-08-01"));
    const second = parseMetricsSyncOperationKey(metricsSyncOperationKey("33333333-3333-3333-3333-333333333333", "2026-08-02"));
    assert.equal(first?.windowEndIso, second?.windowStartIso);
    assert.equal(parseMetricsSyncOperationKey("run:metrics_sync:once"), null);
  });

  test("Google GAQL uses equality on D only for [D, D+1)", () => {
    const d1 = utcCalendarDayWindow("2026-08-18");
    const d2 = utcCalendarDayWindow("2026-08-19");
    assert.ok(d1 && d2);
    assert.equal(googleAdsSegmentsDateEquals(d1), "2026-08-18");
    assert.equal(googleAdsSegmentsDateEquals(d2), "2026-08-19");
    assert.notEqual(googleAdsSegmentsDateEquals(d1), googleAdsSegmentsDateEquals(d2));
    const googleSrc = readFileSync(join(root, "src/features/marketing/execution/server/google-ads-provider.ts"), "utf8");
    assert.match(googleSrc, /segments\.date = '/);
    assert.doesNotMatch(googleSrc, /segments\.date BETWEEN/);
  });

  test("Meta Insights since=until=D for canonical day", () => {
    const d1 = utcCalendarDayWindow("2026-08-18");
    const d2 = utcCalendarDayWindow("2026-08-19");
    assert.ok(d1 && d2);
    assert.deepEqual(metaInsightsTimeRangeForCanonicalDay(d1), { since: "2026-08-18", until: "2026-08-18" });
    assert.deepEqual(metaInsightsTimeRangeForCanonicalDay(d2), { since: "2026-08-19", until: "2026-08-19" });
  });
});

describe("Phase 9C-C approved spec runtime source", () => {
  const RULE = "11".repeat(32);
  const versionId = "44444444-4444-4444-4444-444444444444";
  const runId = "22222222-2222-2222-2222-222222222222";

  function store(overrides: Record<string, { data: Record<string, unknown> | null; error: { message?: string } | null }>): ApprovedSpecStore {
    const tables: Record<string, { data: Record<string, unknown> | null; error: { message?: string } | null }> = {
      campaign_runs: {
        data: {
          campaign_version_id: versionId,
          configuration_hash: HASH,
          audience_rule_hash: RULE,
          provider_channel: "meta_ads",
          targeting_mode: "broad_public",
        },
        error: null,
      },
      campaign_versions: {
        data: {
          id: versionId,
          status: "approved",
          configuration_hash: HASH,
          budget_snapshot: { currency: "INR", daily_budget_paise: 2500, total_budget_paise: null },
          creative_snapshot: {
            headline: "Home interiors",
            primary_text: "Book a consult today in Pune",
            call_to_action: "LEARN_MORE",
            media_references: [],
            geo_country_codes: ["IN"],
            destination_url: "https://onedecore.in/lp/home-interiors",
          },
          intended_window_snapshot: { start_date: "2026-09-01", end_date: null },
          destination_reference: "https://onedecore.in/lp/home-interiors",
        },
        error: null,
      },
      campaign_audience_rule_versions: {
        data: { rule_hash: RULE, frozen_at: "2026-08-19T00:00:00.000Z" },
        error: null,
      },
      campaign_approvals: {
        data: { decision: "approved", configuration_hash: HASH, rule_hash: RULE },
        error: null,
      },
      ...overrides,
    };
    return {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => tables[table] ?? { data: null, error: null },
                };
              },
            };
          },
        };
      },
    };
  }

  test("valid run/version/rule/approval loads spec", async () => {
    const loaded = await loadApprovedExecutionSpec(store({}), runId);
    assert.equal(loaded.ok, true);
  });

  test("version query error fails deterministically", async () => {
    const loaded = await loadApprovedExecutionSpec(
      store({ campaign_versions: { data: null, error: { message: "column does not exist" } } }),
      runId
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.code, CAMPAIGN_APPROVED_SNAPSHOT_READ_FAILED);
  });

  test("missing frozen rule fails", async () => {
    const loaded = await loadApprovedExecutionSpec(
      store({ campaign_audience_rule_versions: { data: null, error: null } }),
      runId
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.code, CAMPAIGN_FROZEN_AUDIENCE_RULE_MISSING);
  });

  test("run rule hash mismatch fails", async () => {
    const loaded = await loadApprovedExecutionSpec(
      store({
        campaign_runs: {
          data: {
            campaign_version_id: versionId,
            configuration_hash: HASH,
            audience_rule_hash: "22".repeat(32),
            provider_channel: "meta_ads",
            targeting_mode: "broad_public",
          },
          error: null,
        },
      }),
      runId
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.code, CAMPAIGN_AUDIENCE_RULE_HASH_MISMATCH);
  });

  test("approval hash mismatch fails", async () => {
    const loaded = await loadApprovedExecutionSpec(
      store({
        campaign_approvals: {
          data: { decision: "approved", configuration_hash: "ff".repeat(32), rule_hash: RULE },
          error: null,
        },
      }),
      runId
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.code, CAMPAIGN_APPROVAL_HASH_MISMATCH);
  });

  test("campaign_versions select does not request audience_rule_hash", () => {
    assert.doesNotMatch(CAMPAIGN_VERSIONS_APPROVED_SPEC_SELECT, /audience_rule_hash/);
    const src = readFileSync(join(root, "src/features/marketing/execution/server/load-approved-execution-spec.ts"), "utf8");
    assert.match(src, /CAMPAIGN_VERSIONS_APPROVED_SPEC_SELECT/);
    const dispatcher = readFileSync(join(root, "src/features/marketing/execution/server/dispatcher.ts"), "utf8");
    assert.doesNotMatch(dispatcher, /campaign_versions[\s\S]{0,200}audience_rule_hash/);
  });
});

describe("Phase 9C-C provider currency authority", () => {
  test("Google INR account allows create; USD denies before mutate", async () => {
    let mutated = false;
    const inr = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.url.includes("oauth2.googleapis.com")) {
          return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
        }
        if (input.body?.includes("customer.currency_code")) {
          return { status: 200, bodyText: JSON.stringify({ results: [{ customer: { currencyCode: "INR" } }] }) };
        }
        mutated = true;
        return {
          status: 200,
          bodyText: JSON.stringify({
            mutateOperationResponses: [{ campaignResult: { resourceName: "customers/1234567890/campaigns/9" } }],
          }),
        };
      })
    );
    const allowed = await inr.create({
      ...command,
      providerChannel: "google_ads",
      boundProviderCampaignId: null,
      approvedSpec: googleCompatibleSpec(),
    });
    assert.equal(allowed.kind, "success");
    assert.equal(mutated, true);

    let usdMutated = false;
    const usd = new GoogleAdsCampaignExecutionProvider(
      googleConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.url.includes("oauth2.googleapis.com")) {
          return { status: 200, bodyText: JSON.stringify({ access_token: "ya29.fake" }) };
        }
        if (input.body?.includes("customer.currency_code")) {
          return { status: 200, bodyText: JSON.stringify({ results: [{ customer: { currencyCode: "USD" } }] }) };
        }
        usdMutated = true;
        throw new Error("mutate must not run");
      })
    );
    const denied = await usd.create({
      ...command,
      providerChannel: "google_ads",
      boundProviderCampaignId: null,
      approvedSpec: googleCompatibleSpec(),
    });
    assert.equal(denied.kind, "validation_failure");
    if (denied.kind === "validation_failure") assert.equal(denied.errorCode, CAMPAIGN_PROVIDER_CURRENCY_MISMATCH);
    assert.equal(usdMutated, false);
  });

  test("Meta INR allows create; mismatch denies; insights use account_currency", async () => {
    const allowed = await new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.method === "GET" && input.url.includes("fields=currency")) {
          return { status: 200, bodyText: JSON.stringify({ currency: "INR" }) };
        }
        return { status: 200, bodyText: JSON.stringify({ id: "120000000000000001" }) };
      })
    ).create({ ...command, boundProviderCampaignId: null, approvedSpec: metaCompatibleSpec() });
    assert.equal(allowed.kind, "success");

    let adsCalled = false;
    const denied = await new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport((input) => {
        if (input.method === "GET" && input.url.includes("fields=currency")) {
          return { status: 200, bodyText: JSON.stringify({ currency: "USD" }) };
        }
        adsCalled = true;
        throw new Error("ads mutate must not run");
      })
    ).create({ ...command, boundProviderCampaignId: null, approvedSpec: metaCompatibleSpec() });
    assert.equal(denied.kind, "validation_failure");
    if (denied.kind === "validation_failure") assert.equal(denied.errorCode, CAMPAIGN_PROVIDER_CURRENCY_MISMATCH);
    assert.equal(adsCalled, false);

    const metrics = await new MetaAdsCampaignExecutionProvider(
      metaConfig,
      createMemoryProviderHttpTransport(() => ({ status: 200, bodyText: metaInsights }))
    ).fetchMetrics(command, {
      windowStartIso: "2026-08-01T00:00:00.000Z",
      windowEndIso: "2026-08-02T00:00:00.000Z",
    });
    assert.equal(metrics.kind, "success");
    if (metrics.kind === "success") assert.equal(metrics.snapshot.currency, "INR");
  });
});

describe("Phase 9C-C admin metrics source", () => {
  test("panel source contains production and sharing banners and no secret tokens", () => {
    const src = readFileSync(
      join(root, "src/features/marketing/components/CampaignMetricsPanel.tsx"),
      "utf8"
    );
    assert.match(src, /Production campaign gate/);
    assert.match(src, /Provider-data-sharing gate/);
    assert.match(src, /taxable_base_paise/);
    assert.doesNotMatch(src, /ACCESS_TOKEN|developer-token|ya29\./);
  });
});
