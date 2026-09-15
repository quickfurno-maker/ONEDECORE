/**
 * WM-5 — analytics and attribution, application half.
 *
 * The database half (tables, RPCs, grants, token hashing, reply rules) is
 * proved by supabase/tests/database/68_whatsapp_analytics_attribution_test.sql.
 * This suite proves the app builds against it: the opaque click route never
 * becomes an existence oracle or an open redirect, analytics reads are
 * caller-session and permission-gated, the export is Super Admin only and
 * minimised, and the funnel UI shows only evidence the SQL returns.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildWhatsappRunReportCsv,
  escapeWhatsappCsvCell,
  formatWhatsappRate,
  parseWhatsappAnalyticsOverview,
  parseWhatsappRunAnalytics,
  resolveWhatsappAnalyticsRange,
  WHATSAPP_ANALYTICS_RPC,
  WHATSAPP_FUNNEL_STAGES,
  WHATSAPP_RUN_REPORT_COLUMNS,
  whatsappFunnelRate,
} from "../contracts/analytics.ts";
import {
  classifyWhatsappClickClient,
  isWhatsappClickToken,
  parseWhatsappClickAllowedHosts,
  resolveSafeWhatsappClickDestination,
  WHATSAPP_CLICK_ROUTE_PREFIX,
} from "../contracts/click-tracking.ts";
import { getWhatsappClickServerEnv, getWhatsappClickTrackingMode } from "../server/whatsapp-click-env.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MIGRATION = read("supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql");
const generatedTypes = read("src/types/database.generated.ts");

const FILES = {
  contracts: "src/features/whatsapp/contracts/analytics.ts",
  clicks: "src/features/whatsapp/contracts/click-tracking.ts",
  clickEnv: "src/features/whatsapp/server/whatsapp-click-env.ts",
  clickRoute: "src/app/w/c/[token]/route.ts",
  queries: "src/features/whatsapp/server/whatsapp-analytics-queries.ts",
  exportRoute: "src/app/api/admin/whatsapp/analytics/runs/[runId]/export/route.ts",
  page: "src/app/admin/whatsapp/analytics/page.tsx",
  funnel: "src/features/whatsapp/components/analytics/WhatsappFunnel.tsx",
  pgtap: "supabase/tests/database/68_whatsapp_analytics_attribution_test.sql",
};

describe("WM-5 deliverables exist", () => {
  for (const [name, path] of Object.entries(FILES)) {
    test(`${name}: ${path}`, () => assert.ok(existsSync(join(root, path)), path));
  }
});

describe("WM-5 RPC names are the migrated ones", () => {
  for (const rpc of [...Object.values(WHATSAPP_ANALYTICS_RPC), "record_whatsapp_click", "record_whatsapp_inbound_evidence", "save_whatsapp_click_destination"]) {
    test(rpc, () => assert.match(generatedTypes, new RegExp(`\\b${rpc}: \\{`)));
  }

  test("analytics grants: SA+SM read, SA export, nobody else", () => {
    assert.match(MIGRATION, /\('super_admin','whatsapp\.analytics\.read'\)/);
    assert.match(MIGRATION, /\('sales_manager','whatsapp\.analytics\.read'\)/);
    assert.match(MIGRATION, /\('super_admin','whatsapp\.reports\.export'\)/);
    assert.doesNotMatch(MIGRATION, /\('(sales_manager|sales_executive|management|sales)','whatsapp\.reports\.export'\)/);
    assert.doesNotMatch(MIGRATION, /\('(sales_executive|management|sales)','whatsapp\.analytics\.read'\)/);
  });

  test("tokens are stored as hashes and minted from 32 random bytes", () => {
    assert.match(MIGRATION, /token_hash text not null unique/);
    assert.match(MIGRATION, /gen_random_bytes\(32\)/);
    assert.doesNotMatch(MIGRATION, /\btoken text\b/);
  });
});

describe("opaque click tokens and safe redirect", () => {
  test("token shape is exactly 43 base64url characters", () => {
    assert.equal(isWhatsappClickToken("A".repeat(43)), true);
    assert.equal(isWhatsappClickToken("A".repeat(42)), false);
    assert.equal(isWhatsappClickToken(`${"A".repeat(42)}/`), false);
    assert.equal(isWhatsappClickToken("+919999999999"), false);
    assert.equal(WHATSAPP_CLICK_ROUTE_PREFIX, "/w/c/");
  });

  test("redirects only to https allowlisted hosts; never userinfo, IPs, localhost or another scheme", () => {
    const hosts = parseWhatsappClickAllowedHosts("designs.onedecore.in, bad host, 127.0.0.1", "https://onedecore.in");
    assert.deepEqual([...hosts].sort(), ["designs.onedecore.in", "onedecore.in"]);
    assert.equal(resolveSafeWhatsappClickDestination("https://onedecore.in/kitchens?utm=wa", hosts), "https://onedecore.in/kitchens?utm=wa");
    assert.equal(resolveSafeWhatsappClickDestination("https://www.onedecore.in/x", hosts), "https://www.onedecore.in/x");
    for (const bad of [
      "http://onedecore.in/x",
      "https://evil.example/x",
      "https://onedecore.in.evil.example/x",
      "https://user:pass@onedecore.in/x",
      "https://127.0.0.1/x",
      "javascript:alert(1)",
      "//onedecore.in/x",
      "https://localhost/x",
      null,
    ]) {
      assert.equal(resolveSafeWhatsappClickDestination(bad, hosts), null, String(bad));
    }
  });

  test("link previews are bots; the user agent is classified, never stored", () => {
    assert.equal(classifyWhatsappClickClient("WhatsApp/2.23.20.0 A"), "bot");
    assert.equal(classifyWhatsappClickClient("facebookexternalhit/1.1"), "bot");
    assert.equal(classifyWhatsappClickClient("Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile"), "browser");
    assert.equal(classifyWhatsappClickClient(""), "unknown");
    assert.doesNotMatch(MIGRATION, /user_agent|ip_address|remote_addr/);
  });

  test("click tracking defaults off and fails closed on a non-loopback local-test URL", () => {
    assert.equal(getWhatsappClickTrackingMode({}), "disabled");
    assert.equal(getWhatsappClickTrackingMode({ ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE: "local-test", NODE_ENV: "production" }), "disabled");
    const env = getWhatsappClickServerEnv({
      ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE: "local-test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NEXT_PUBLIC_APP_URL: "https://onedecore.in",
    });
    assert.equal(env.mode, "disabled");
    assert.equal(env.serviceRoleKey, null);
    assert.equal(env.fallbackUrl, "https://onedecore.in/");
  });

  test("the public route has no existence oracle and no open redirect", () => {
    const route = code(read(FILES.clickRoute));
    assert.match(route, /record_whatsapp_click/);
    assert.match(route, /resolveSafeWhatsappClickDestination/);
    assert.match(route, /status: 302/);
    assert.match(route, /"referrer-policy": "no-referrer"/);
    assert.match(route, /"cache-control": "no-store"/);
    // Every refusal path returns the same fallback redirect; no 404 or distinct body.
    assert.doesNotMatch(route, /status: 404|status: 401|status: 403|JSON\.stringify/);
    assert.equal((route.match(/redirect\(fallback\)/g) ?? []).length >= 3, true);
    assert.doesNotMatch(route, /searchParams|request\.url/);
  });
});

describe("reply attribution rules", () => {
  test("exact context first, inference bounded to 72h first reply, context elsewhere never re-inferred", () => {
    assert.match(MIGRATION, /'exact_context'/);
    assert.match(MIGRATION, /interval '72 hours'/);
    assert.match(MIGRATION, /'not_first_reply'/);
    assert.match(MIGRATION, /if not found then return 'context_not_attributable'; end if;/);
  });

  test("the webhook records evidence after ingest through the service-role RPC only", () => {
    const ingest = code(read("src/features/whatsapp/server/meta-webhook-ingest.ts"));
    assert.match(ingest, /"record_whatsapp_inbound_evidence"/);
    assert.doesNotMatch(ingest, /whatsapp_reply_attributions/);
  });
});

describe("analytics read models", () => {
  test("queries are caller-session only", () => {
    const queries = code(read(FILES.queries));
    assert.match(queries, /from "@\/lib\/supabase\/server"/);
    assert.doesNotMatch(queries, /supabase-js|serviceRoleKey|SUPABASE_SERVICE_ROLE/);
  });

  test("the page gates on whatsapp.analytics.read and shows export only with whatsapp.reports.export", () => {
    const page = code(read(FILES.page));
    assert.match(page, /permissions\["whatsapp\.analytics\.read"\]/);
    assert.match(page, /permissions\["whatsapp\.reports\.export"\] \?/);
    assert.ok(page.indexOf('permissions["whatsapp.analytics.read"]') < page.indexOf("getWhatsappAnalyticsOverviewForCurrentUser(range)"));
  });

  test("the export route authorizes first, uses the caller session, and hides refusals as not-found", () => {
    const route = code(read(FILES.exportRoute));
    assert.match(route, /resolveWhatsappControlPlaneAccess\(\)/);
    assert.match(route, /whatsapp\.reports\.export/);
    assert.doesNotMatch(route, /supabase-js|serviceRoleKey/);
    assert.ok(route.indexOf("whatsapp.reports.export") < route.indexOf("createClient()"));
    assert.match(route, /"content-disposition"/);
    assert.match(route, /return notFound\(\);/);
  });

  test("funnel order is the canonical evidence chain", () => {
    assert.deepEqual(
      WHATSAPP_FUNNEL_STAGES.map((stage) => stage.key),
      ["sent", "delivered", "read", "clicked", "replied", "consultation", "quotation", "booking"]
    );
    for (const stage of WHATSAPP_FUNNEL_STAGES) {
      assert.match(MIGRATION, new RegExp(`'${stage.key}',count\\(\\*\\) filter`), stage.key);
    }
  });

  test("rates divide by the previous stage and never by zero", () => {
    const summary = { targeted: 10, sent: 8, delivered: 6, read: 3, clicked: 0, replied: 0 };
    assert.equal(whatsappFunnelRate(summary, "sent"), 0.8);
    assert.equal(whatsappFunnelRate(summary, "delivered"), 0.75);
    assert.equal(whatsappFunnelRate(summary, "replied"), null);
    assert.equal(formatWhatsappRate(null), "—");
    assert.equal(formatWhatsappRate(0.05), "5.0%");
  });

  test("payload parsers keep only numbers and drop malformed rows", () => {
    const overview = parseWhatsappAnalyticsOverview({
      range: { from: "a", to: "b" },
      channel: { outbound_messages: 4, junk: "x" },
      campaign_funnel: { sent: 2 },
      runs: [{ run_id: "r", funnel: { sent: 2 } }, { funnel: {} }],
    });
    assert.deepEqual(overview?.channel, { outbound_messages: 4 });
    assert.equal(overview?.runs.length, 1);
    assert.equal(parseWhatsappAnalyticsOverview({}), null);
    assert.equal(parseWhatsappRunAnalytics({ clicks_by_destination: [] }), null);
  });

  test("range resolution is bounded to the offered windows", () => {
    const now = new Date("2026-09-15T00:00:00Z");
    assert.equal(resolveWhatsappAnalyticsRange("7d", now).from, "2026-09-08T00:00:00.000Z");
    assert.equal(resolveWhatsappAnalyticsRange("9999d", now).key, "30d");
  });
});

describe("minimised export", () => {
  test("columns carry no name, number or message text", () => {
    for (const column of WHATSAPP_RUN_REPORT_COLUMNS) {
      assert.doesNotMatch(column, /name|e164|phone$|body|text/);
    }
    assert.ok(WHATSAPP_RUN_REPORT_COLUMNS.includes("phone_last4"));
  });

  test("CSV cells neutralise spreadsheet formulas and quote separators", () => {
    assert.equal(escapeWhatsappCsvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(escapeWhatsappCsvCell("+91"), "'+91");
    assert.equal(escapeWhatsappCsvCell('a,"b"'), '"a,""b"""');
    assert.equal(escapeWhatsappCsvCell(null), "");
    const csv = buildWhatsappRunReportCsv({ truncated: false, rows: [{ recipient_ref: "r1", recipient_e164: "+919999999999", phone_last4: "9999", booking: true }] });
    assert.ok(csv);
    assert.equal(csv.rows, 1);
    assert.doesNotMatch(csv.csv, /\+919999999999/);
    assert.match(csv.csv.split("\r\n")[0]!, /^recipient_ref,contact_id,phone_last4/);
  });
});
