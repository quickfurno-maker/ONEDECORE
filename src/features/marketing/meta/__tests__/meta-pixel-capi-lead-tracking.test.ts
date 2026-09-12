import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  getMetaPixelId,
  isMetaPixelConfigured,
  isMetaTrackablePath,
  META_EVENT,
  META_PIXEL_BEACON_ORIGIN,
  META_PIXEL_SCRIPT_ORIGIN,
  META_PIXEL_SCRIPT_SRC,
  META_PRIVATE_PATH_PREFIXES,
  META_PUBLIC_PATH_PREFIXES,
} from "../meta-tracking-config.ts";
import { isValidMetaEventId } from "../meta-pixel-events.ts";
import {
  getMetaCapiConfig,
  isMetaCapiConfigured,
  META_CAPI_TIMEOUT_MS,
} from "../server/meta-capi-env.ts";
import {
  buildCapiEndpoint,
  buildLeadEvent,
  safeMetaCapiLog,
  sendMetaCapiEvent,
  toEventTimeSeconds,
  type MetaCapiEvent,
} from "../server/meta-capi-client.ts";
import {
  buildEventSourceUrl,
  buildUserSignals,
  deriveFbc,
  META_CAPI_ALLOWED_USER_DATA_KEYS,
  META_CAPI_FORBIDDEN_KEYS,
  readCookie,
  readFbp,
  resolveClientIp,
  resolveUserAgent,
} from "../server/meta-capi-signals.ts";
import { reportLeadConversion } from "../server/report-lead-conversion.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const PIXEL = "src/features/marketing/meta/MetaPixel.tsx";
const EVENTS = "src/features/marketing/meta/meta-pixel-events.ts";
const CONFIG = "src/features/marketing/meta/meta-tracking-config.ts";
const CAPI_ENV = "src/features/marketing/meta/server/meta-capi-env.ts";
const CAPI_CLIENT = "src/features/marketing/meta/server/meta-capi-client.ts";
const SIGNALS = "src/features/marketing/meta/server/meta-capi-signals.ts";
const REPORT = "src/features/marketing/meta/server/report-lead-conversion.ts";
const ROUTE = "src/app/api/public/lead-intake/route.ts";
const BRIEF = "src/features/lead-intake/public/UnifiedLeadBrief.tsx";
const ROOT_LAYOUT = "src/app/layout.tsx";
const RUNTIME = "src/features/lead-intake/server/lead-intake-runtime.ts";
const ENV_EXAMPLE = ".env.example";

/** Source with comments stripped, so prose about a thing is not the thing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TOKEN = "EAAG-fake-token-for-tests-only-not-real-0123456789";
const PIXEL_ID = "1952479475419612";
const EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const testConfig = () =>
  getMetaCapiConfig({ pixelId: PIXEL_ID, accessToken: TOKEN })!;

/** A fetch that records what it was given and never touches the network. */
function recordingFetch(
  respond: () => Promise<Response> | Response
): { fetchImpl: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const okResponse = () =>
  new Response(JSON.stringify({ events_received: 1 }), { status: 200 });

/*
 * ============================================================================
 * NO TEST HERE TOUCHES THE NETWORK.
 *
 * Every transport test injects `fetchImpl`. `sendMetaCapiEvent` without one
 * would call the real Graph API, so a test that forgot the injection would
 * post a fabricated conversion into the live dataset from whatever machine ran
 * the suite. The recording fetch is the guard against that, and the last test
 * in this file asserts no module here has a hard-coded real endpoint call.
 * ============================================================================
 */

/* ========================================================================== */
/* 1. The pixel is off unless configured                                       */
/* ========================================================================== */

describe("the pixel is an activation gate", () => {
  test("no id, no pixel", () => {
    assert.equal(getMetaPixelId(undefined), null);
    assert.equal(getMetaPixelId(null), null);
    assert.equal(getMetaPixelId(""), null);
    assert.equal(getMetaPixelId("   "), null);
    assert.equal(isMetaPixelConfigured(null), false);
  });

  test("a placeholder is not an id", () => {
    /*
     * An unreplaced placeholder left in an env file would otherwise produce a
     * script tag that 404s on every page load — visible to visitors, invisible
     * in Meta.
     */
    assert.equal(getMetaPixelId("your-pixel-id"), null);
    assert.equal(getMetaPixelId("<pixel>"), null);
    assert.equal(getMetaPixelId("12345"), null, "too short to be a dataset id");
    assert.equal(getMetaPixelId("1952479475419612x"), null);
  });

  test("a real dataset id is accepted and trimmed", () => {
    assert.equal(getMetaPixelId(PIXEL_ID), PIXEL_ID);
    assert.equal(getMetaPixelId(`  ${PIXEL_ID}  `), PIXEL_ID);
    assert.equal(isMetaPixelConfigured(PIXEL_ID), true);
  });

  test("the component refuses to initialise without id or route", () => {
    const pixel = read(PIXEL);
    assert.match(pixel, /if \(!pixelId \|\| !trackable\) return;/);
    assert.match(pixel, /const pixelId = getMetaPixelId\(\);/);
    assert.match(pixel, /isMetaTrackablePath\(pathname\)/);
  });
});

/* ========================================================================== */
/* 2. Internal routes are never measured                                       */
/* ========================================================================== */

describe("private surfaces load no pixel", () => {
  test("the documented internal roots are all refused", () => {
    for (const path of [
      "/admin",
      "/admin/portfolio/media",
      "/manager",
      "/manager/dashboard",
      "/auth",
      "/auth/login",
      "/api",
      "/api/public/lead-intake",
    ]) {
      assert.equal(isMetaTrackablePath(path), false, path);
    }
  });

  test("the quotation client portal is refused, though it is customer-facing", () => {
    /*
     * THE LEAK THIS PREVENTS.
     *
     * `/q/<token>` is a customer opening their own quotation. It is not an
     * internal console, so a deny-list written as "the app routes" would have
     * let it through — and `event_source_url` would then have carried a
     * capability token and priced commercial terms to Meta.
     */
    assert.equal(isMetaTrackablePath("/q/abc123"), false);
    assert.equal(isMetaTrackablePath("/q"), false);
    assert.ok(META_PRIVATE_PATH_PREFIXES.includes("/q"));
  });

  test("an unknown path is refused, not allowed", () => {
    /*
     * Deny-by-default. A new internal route added next year is silently safe;
     * a new public page has to be added here on purpose, which is the right
     * way round for a third-party script.
     */
    for (const path of ["/internal", "/staff", "/crm", "/whatsapp", "/_next"]) {
      assert.equal(isMetaTrackablePath(path), false, path);
    }
  });

  test("junk input cannot slip past the gate", () => {
    for (const value of [
      null,
      undefined,
      "",
      "admin",
      "//evil.example.com",
      "https://evil.example.com/",
    ]) {
      assert.equal(isMetaTrackablePath(value as string), false, String(value));
    }
  });

  test("a private prefix wins over a public one", () => {
    assert.ok(META_PUBLIC_PATH_PREFIXES.includes("/"));
    assert.equal(isMetaTrackablePath("/admin"), false);
  });
});

/* ========================================================================== */
/* 3. Public PageView                                                          */
/* ========================================================================== */

describe("public pages are measured, once per navigation", () => {
  test("the public surfaces are trackable", () => {
    for (const path of [
      "/",
      "/portfolio",
      "/portfolio?view=projects",
      "/portfolio/a-real-pune-home",
      "/shop",
      "/lp/a-campaign",
      "/privacy",
      "/terms",
    ]) {
      assert.equal(isMetaTrackablePath(path), true, path);
    }
  });

  test("query and hash do not change the decision", () => {
    assert.equal(isMetaTrackablePath("/admin?x=1"), false);
    assert.equal(isMetaTrackablePath("/portfolio#gallery"), true);
  });

  test("PageView fires on the path, and is de-duplicated", () => {
    /*
     * THE DOUBLE-COUNT THIS PREVENTS.
     *
     * The effect depends on `pathname`, but a re-render from a parent, a
     * search-param change or Fast Refresh can run it again for the same path.
     * `lastReported` is what makes a PageView mean a navigation.
     */
    const pixel = read(PIXEL);
    assert.match(pixel, /const lastReported = useRef<string \| null>\(null\);/);
    assert.match(pixel, /if \(lastReported\.current === pathname\) return;/);
    assert.match(pixel, /trackMetaPageView\(\);/);
    assert.match(pixel, /\}, \[pathname, pixelId, trackable\]\);/);
  });

  test("init carries no parameters, so advanced matching stays off", () => {
    /*
     * `fbq('init', id, { em, ph, fn... })` is where advanced matching goes.
     * The absence of a second argument IS the "no PII to Meta" guarantee on
     * the browser side, so it is asserted rather than assumed.
     */
    const pixel = code(read(PIXEL));
    assert.match(pixel, /fbq\("init", pixelId\);/);
    assert.doesNotMatch(pixel, /fbq\("init", pixelId, \{/);
    assert.doesNotMatch(pixel, /em:|ph:|fn:|ln:|external_id/);
  });

  test("the mount point is the root layout, and there is only one", () => {
    assert.match(read(ROOT_LAYOUT), /<MetaPixel \/>/);
    assert.equal(read(PIXEL).match(/connect\.facebook\.net/g), null);
    assert.match(read(CONFIG), /META_PIXEL_SCRIPT_SRC/);
    assert.equal(META_PIXEL_SCRIPT_SRC, `${META_PIXEL_SCRIPT_ORIGIN}/en_US/fbevents.js`);
  });
});

/* ========================================================================== */
/* 4. Lead fires only on acceptance                                            */
/* ========================================================================== */

describe("browser Lead means an accepted enquiry and nothing else", () => {
  test("it is called in the success branch, before the key is cleared", () => {
    // Comment-stripped: the note above the call names `resetAfterSuccess()`.
    const brief = code(read(BRIEF));
    const submit = brief.slice(brief.indexOf("const result = await submitLeadIntake"));
    const successAt = submit.indexOf('result.kind === "success-created"');
    const trackAt = submit.indexOf("trackMetaLead(idempotencyKey)");
    const resetAt = submit.indexOf("resetAfterSuccess()");
    assert.ok(successAt >= 0 && trackAt > successAt, "Lead must be inside the success branch");
    assert.ok(trackAt < resetAt, "the key is cleared by resetAfterSuccess, so track first");
  });

  test("no other moment fires it", () => {
    /*
     * Exactly one call site. Opening the form, typing, clicking submit, a
     * validation failure and a network failure must all report nothing — each
     * would teach Meta to optimise for people who never became a customer.
     */
    const brief = read(BRIEF);
    assert.equal((brief.match(/trackMetaLead\(/g) ?? []).length, 1);
    const afterSuccess = brief.slice(brief.indexOf("if (!shouldReuseOnError"));
    assert.doesNotMatch(afterSuccess, /trackMetaLead/);
  });

  test("nothing else in the app fires a Lead", () => {
    /*
     * An admin creating a CRM lead by hand is not a website conversion. The
     * helper is imported by exactly one module, and that is the public form.
     */
    const events = read(EVENTS);
    assert.match(events, /export function trackMetaLead/);
    assert.equal(META_EVENT.lead, "Lead");
  });

  test("a blocked or absent fbq cannot break the flow", () => {
    /*
     * THE LOST LEAD THIS PREVENTS.
     *
     * `fbq` is missing far more often than expected — content blockers,
     * hardened browsers, the script still in flight. This call sits inside the
     * success path of a lead that is already in the database, so a throw here
     * would show a customer an error for an enquiry that was received.
     */
    const events = read(EVENTS);
    assert.match(events, /function getFbq\(\): Fbq \| null/);
    assert.match(events, /typeof candidate === "function"/);
    assert.match(events, /try \{[\s\S]*?\} catch \{/);
    assert.match(events, /if \(!fbq\) return;/);
  });
});

/* ========================================================================== */
/* 5. One event id, shared                                                     */
/* ========================================================================== */

describe("browser and server deduplicate on one id", () => {
  test("the id is the public form's idempotency key", () => {
    assert.match(read(BRIEF), /trackMetaLead\(idempotencyKey\)/);
    assert.match(read(RUNTIME), /eventId: validated\.idempotencyKey/);
  });

  test("it is a UUID, and nothing derived from the customer", () => {
    assert.equal(isValidMetaEventId(EVENT_ID), true);
    for (const bad of [
      "+919876543210",
      "someone@example.com",
      "lead-1",
      "",
      null,
      undefined,
      42,
    ]) {
      assert.equal(isValidMetaEventId(bad), false, String(bad));
    }
  });

  test("a retry of the same submission keeps the same id", () => {
    /*
     * `getOrCreateKey` returns the existing key while the payload fingerprint
     * is unchanged, and `shouldReuseOnError` keeps it across a 500/503/429.
     * So a customer who retries after a blip produces ONE conversion, not two.
     */
    const idem = read("src/features/lead-intake/public/lead-form-idempotency.ts");
    assert.match(idem, /if \(\s*currentKey &&\s*currentFingerprint === payloadFingerprint\s*\) \{\s*return currentKey;/);
    assert.match(idem, /export function shouldReuseOnError/);
    assert.match(read(BRIEF), /if \(!shouldReuseOnError\(result\.httpStatus\)\) \{/);
  });

  test("the server refuses to invent one", () => {
    /*
     * A server-minted id would never match the browser's, so every lead would
     * count twice. Skipping is the only outcome that leaves the numbers honest.
     */
    const report = read(REPORT);
    assert.match(report, /if \(!isValidMetaEventId\(input\.eventId\)\)/);
    assert.match(report, /status: "skipped", reason: "missing-event-id"/);
    assert.doesNotMatch(code(report), /randomUUID/);
  });

  test("an accepted lead is the only one that yields signals", () => {
    const runtime = read(RUNTIME);
    assert.match(
      runtime,
      /if \(result\.outcome !== "created" && result\.outcome !== "idempotent_replay"\) \{\s*return undefined;/
    );
  });
});

/* ========================================================================== */
/* 6. Only approved fields reach Meta                                          */
/* ========================================================================== */

describe("the CAPI payload carries the approved fields and no others", () => {
  const fullEvent = (): MetaCapiEvent =>
    buildLeadEvent({
      eventId: EVENT_ID,
      eventSourceUrl: "https://onedecore.in/portfolio",
      nowMs: 1_760_000_000_000,
      clientIp: "203.0.113.7",
      userAgent: "Mozilla/5.0 (iPhone)",
      fbc: "fb.1.1760000000.AbCdEf",
      fbp: "fb.1.1760000000.1234567890",
    });

  test("the event has exactly the approved top-level keys", () => {
    assert.deepEqual(Object.keys(fullEvent()).sort(), [
      "action_source",
      "event_id",
      "event_name",
      "event_source_url",
      "event_time",
      "user_data",
    ]);
  });

  test("user_data may contain only the four approved signals", () => {
    const keys = Object.keys(fullEvent().user_data).sort();
    assert.deepEqual(keys, [...META_CAPI_ALLOWED_USER_DATA_KEYS].sort());
  });

  test("no customer-identifying field can appear", () => {
    /*
     * These are Meta's advanced-matching keys: email, phone, first/last name,
     * date of birth, gender, city, state, zip, country, external id. Sending
     * any of them is what advanced matching MEANS, and it is off.
     */
    const serialised = JSON.stringify(fullEvent());
    for (const forbidden of META_CAPI_FORBIDDEN_KEYS) {
      assert.ok(
        !serialised.includes(`"${forbidden}"`),
        `user_data must never carry ${forbidden}`
      );
    }
  });

  test("no business field from the enquiry travels either", () => {
    const builder = code(read(CAPI_CLIENT)) + code(read(SIGNALS));
    for (const field of [
      "phoneE164",
      "email",
      "budget",
      "projectScope",
      "message",
      "locality",
      "timeline",
      "propertyCode",
      "submissionReference",
      "correlationId",
    ]) {
      assert.ok(!builder.includes(field), `${field} must not reach the CAPI builder`);
    }
  });

  test("action_source is website and event_time is whole seconds", () => {
    const event = fullEvent();
    assert.equal(event.action_source, "website");
    assert.equal(event.event_time, 1_760_000_000);
    assert.ok(Number.isInteger(event.event_time));
    /*
     * Milliseconds are the classic mistake: syntactically valid, decades in
     * the future, and every conversion silently dropped.
     */
    assert.equal(toEventTimeSeconds(1_760_000_000_999), 1_760_000_000);
  });
});

/* ========================================================================== */
/* 7. fbc / fbp                                                                */
/* ========================================================================== */

describe("fbp and fbc are read, validated, and never invented", () => {
  test("cookies are parsed out of a real header", () => {
    const header = "foo=bar; _fbp=fb.1.1760000000.1234567890; _fbc=fb.1.1760000000.AbC";
    assert.equal(readCookie(header, "_fbp"), "fb.1.1760000000.1234567890");
    assert.equal(readCookie(header, "_fbc"), "fb.1.1760000000.AbC");
    assert.equal(readCookie(header, "_missing"), null);
    assert.equal(readCookie(null, "_fbp"), null);
    assert.equal(readCookie("", "_fbp"), null);
  });

  test("a cookie name is matched exactly, not by prefix", () => {
    const header = "not_fbp=decoy; _fbp=fb.1.1760000000.9";
    assert.equal(readCookie(header, "_fbp"), "fb.1.1760000000.9");
  });

  test("a malformed value is dropped rather than forwarded", () => {
    assert.equal(readFbp("garbage"), null);
    assert.equal(readFbp("fb.1.abc.def"), null);
    assert.equal(readFbp(null), null);
    assert.equal(readFbp("fb.1.1760000000.1234567890"), "fb.1.1760000000.1234567890");
  });

  test("fbc is derived from fbclid only in Meta's documented format", () => {
    assert.equal(
      deriveFbc(null, "IwAR0abcDEF", 1_760_000_000),
      "fb.1.1760000000.IwAR0abcDEF"
    );
    // A real cookie always wins over a derivation.
    assert.equal(
      deriveFbc("fb.1.1750000000.Existing", "IwAR0abcDEF", 1_760_000_000),
      "fb.1.1750000000.Existing"
    );
  });

  test("with neither cookie nor click id, fbc is absent — never fabricated", () => {
    assert.equal(deriveFbc(null, null, 1_760_000_000), null);
    assert.equal(deriveFbc(null, "", 1_760_000_000), null);
    assert.equal(deriveFbc("nonsense", null, 1_760_000_000), null);
  });

  test("absent signals are omitted, not sent empty", () => {
    /*
     * Meta treats "" as a supplied value and it degrades match quality, where
     * a missing key is simply unknown.
     */
    const signals = buildUserSignals({
      clientIp: null,
      userAgent: null,
      fbc: null,
      fbp: null,
    });
    assert.deepEqual(signals, {});
    assert.equal(Object.keys(signals).length, 0);
  });

  test("neither is hashed", () => {
    const signals = buildUserSignals({
      clientIp: null,
      userAgent: null,
      fbc: "fb.1.1760000000.AbC",
      fbp: "fb.1.1760000000.999",
    });
    assert.equal(signals.fbc, "fb.1.1760000000.AbC");
    assert.equal(signals.fbp, "fb.1.1760000000.999");
    assert.doesNotMatch(code(read(SIGNALS)), /createHash|sha256|digest/);
  });
});

/* ========================================================================== */
/* 8. IP, user agent and source URL                                            */
/* ========================================================================== */

describe("network signals follow the pipeline's own trust rules", () => {
  test("a forwarded address is used only when the deployment trusts it", () => {
    assert.equal(
      resolveClientIp({ forwardedFor: "203.0.113.7", trustProxy: true }),
      "203.0.113.7"
    );
    assert.equal(
      resolveClientIp({ forwardedFor: "203.0.113.7", trustProxy: false }),
      null,
      "an untrusted header is spoofable and must be ignored"
    );
    assert.equal(
      resolveClientIp({ forwardedFor: "203.0.113.7, 10.0.0.1", trustProxy: true }),
      "203.0.113.7"
    );
    assert.equal(
      resolveClientIp({ forwardedFor: "not-an-ip", trustProxy: true }),
      null
    );
    assert.equal(resolveClientIp({ forwardedFor: null, trustProxy: true }), null);
  });

  test("the trust decision is the lead pipeline's, not a second one", () => {
    assert.match(read(RUNTIME), /trustProxy,/);
    assert.match(read(ROUTE), /trustProxy: result\.conversion\.trustProxy/);
  });

  test("the user agent is passed through, bounded", () => {
    assert.equal(resolveUserAgent("  Mozilla/5.0  "), "Mozilla/5.0");
    assert.equal(resolveUserAgent(""), null);
    assert.equal(resolveUserAgent(null), null);
    assert.equal(resolveUserAgent("x".repeat(2000)), null);
  });

  test("event_source_url is rebuilt from this site's own origin", () => {
    /*
     * THE EXFILTRATION THIS PREVENTS.
     *
     * A submitted landing path is attacker-controlled text. Forwarding it
     * would let a crafted request put any string into `event_source_url`.
     */
    assert.equal(buildEventSourceUrl("/portfolio"), "https://onedecore.in/portfolio");
    assert.equal(
      buildEventSourceUrl("https://evil.example.com/x"),
      "https://onedecore.in/"
    );
    assert.equal(buildEventSourceUrl("//evil.example.com"), "https://onedecore.in/");
    assert.equal(buildEventSourceUrl(null), "https://onedecore.in/");
  });

  test("the query string is dropped, and private paths collapse to the root", () => {
    assert.equal(
      buildEventSourceUrl("/portfolio?utm_source=meta&fbclid=abc"),
      "https://onedecore.in/portfolio"
    );
    assert.equal(
      buildEventSourceUrl("/q/secret-capability-token"),
      "https://onedecore.in/",
      "a quotation token must never leave in a source URL"
    );
    assert.equal(buildEventSourceUrl("/admin/crm"), "https://onedecore.in/");
  });
});

/* ========================================================================== */
/* 9. Failure can never cost a lead                                            */
/* ========================================================================== */

describe("a conversion report cannot fail a lead", () => {
  const event = (): MetaCapiEvent =>
    buildLeadEvent({
      eventId: EVENT_ID,
      eventSourceUrl: "https://onedecore.in/",
      nowMs: Date.now(),
      clientIp: null,
      userAgent: null,
      fbc: null,
      fbp: null,
    });

  test("a timeout resolves, it does not throw", async () => {
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const signal = init?.signal;
      if (signal?.aborted) {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
      return okResponse();
    }) as unknown as typeof fetch;

    const result = await sendMetaCapiEvent(event(), {
      config: testConfig(),
      fetchImpl,
      timeoutMs: 5,
    });
    assert.deepEqual(result, { status: "failed", reason: "timeout" });
  });

  test("a network error resolves", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const result = await sendMetaCapiEvent(event(), {
      config: testConfig(),
      fetchImpl,
    });
    assert.deepEqual(result, { status: "failed", reason: "network" });
  });

  test("4xx and 5xx resolve as rejected", async () => {
    for (const status of [400, 401, 403, 429, 500, 503]) {
      const { fetchImpl } = recordingFetch(() => new Response("{}", { status }));
      const result = await sendMetaCapiEvent(event(), {
        config: testConfig(),
        fetchImpl,
      });
      assert.deepEqual(result, { status: "rejected", httpStatus: status });
    }
  });

  test("a malformed body resolves", async () => {
    const { fetchImpl } = recordingFetch(
      () => new Response("<html>not json</html>", { status: 200 })
    );
    const result = await sendMetaCapiEvent(event(), {
      config: testConfig(),
      fetchImpl,
    });
    assert.deepEqual(result, { status: "failed", reason: "malformed" });
  });

  test("the orchestrator swallows anything a dependency throws", async () => {
    const result = await reportLeadConversion(
      {
        eventId: EVENT_ID,
        cookieHeader: null,
        userAgent: null,
        forwardedFor: null,
        trustProxy: false,
        landingPath: "/",
        fbclid: null,
      },
      {
        getConfig: testConfig,
        send: async () => {
          throw new Error("boom");
        },
      }
    );
    assert.deepEqual(result, { status: "failed", reason: "network" });
  });

  test("the route ignores the result and never branches on it", () => {
    /*
     * THE LOST LEAD THIS PREVENTS.
     *
     * A `if (!capi.ok) return 500` would turn a marketing outage into a lost
     * enquiry. The value is used for one log field and nothing else.
     */
    const route = read(ROUTE);
    assert.match(route, /const capi = await reportLeadConversion\(/);
    assert.match(route, /metaLog = safeMetaCapiLog\(capi\);/);
    assert.doesNotMatch(route, /if \(capi[.\s]/);
    assert.doesNotMatch(route, /throw .*capi/);
    // And it runs only for an accepted lead.
    assert.match(route, /if \(result\.conversion\) \{/);
  });

  test("the timeout is short and bounded by AbortController", () => {
    assert.ok(META_CAPI_TIMEOUT_MS <= 2000, "a lead response must not wait on Meta");
    const client = read(CAPI_CLIENT);
    assert.match(client, /new AbortController\(\)/);
    assert.match(client, /signal: controller\.signal/);
    assert.match(client, /clearTimeout\(timer\)/);
  });

  test("no config means no request at all", async () => {
    const { fetchImpl, calls } = recordingFetch(okResponse);
    const result = await sendMetaCapiEvent(event(), { config: null, fetchImpl });
    assert.deepEqual(result, { status: "not-configured" });
    assert.equal(calls.length, 0);
  });
});

/* ========================================================================== */
/* 10. The token never escapes                                                 */
/* ========================================================================== */

describe("the access token stays on the server", () => {
  test("it is never public-scoped", () => {
    const contract = read("src/config/env-contract.ts");
    assert.doesNotMatch(contract, /NEXT_PUBLIC_META_CONVERSIONS/);
    assert.match(
      contract,
      /name: "META_CONVERSIONS_API_ACCESS_TOKEN",\s*\n\s*scope: "server",\s*\n\s*sensitivity: "secret"/
    );
  });

  test("only server-only modules read it", () => {
    assert.match(read(CAPI_ENV), /^import "server-only";/m);
    assert.match(read(CAPI_CLIENT), /^import "server-only";/m);
    assert.match(read(REPORT), /^import "server-only";/m);
    for (const rel of [CONFIG, EVENTS, PIXEL]) {
      assert.doesNotMatch(
        read(rel),
        /META_CONVERSIONS_API_ACCESS_TOKEN/,
        `${rel} is in the browser graph and must not name the token`
      );
    }
  });

  test("it travels in the body, never the URL", async () => {
    const { fetchImpl, calls } = recordingFetch(okResponse);
    await sendMetaCapiEvent(
      buildLeadEvent({
        eventId: EVENT_ID,
        eventSourceUrl: "https://onedecore.in/",
        nowMs: Date.now(),
        clientIp: null,
        userAgent: null,
        fbc: null,
        fbp: null,
      }),
      { config: testConfig(), fetchImpl }
    );
    assert.equal(calls.length, 1);
    assert.ok(
      !calls[0]!.url.includes(TOKEN),
      "a token in a URL lands in proxy logs and error messages"
    );
    assert.equal(
      calls[0]!.url,
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`
    );
    assert.ok(String(calls[0]!.init.body).includes(TOKEN));
  });

  test("no result or log structure can carry it", () => {
    for (const result of [
      { status: "sent", eventsReceived: 1 },
      { status: "rejected", httpStatus: 401 },
      { status: "failed", reason: "timeout" },
      { status: "not-configured" },
      { status: "skipped", reason: "missing-event-id" },
    ] as const) {
      const logged = JSON.stringify(safeMetaCapiLog(result));
      assert.ok(!logged.includes(TOKEN));
      assert.ok(!logged.includes("access_token"));
      assert.ok(logged.length < 200, "a log line must stay bounded");
    }
  });

  test("an error body is never read back into a result", () => {
    /*
     * Meta's error payloads echo request context. The status code is the whole
     * of what an operator can act on, so the body is deliberately not parsed
     * on the failure path.
     */
    const client = code(read(CAPI_CLIENT));
    const start = client.indexOf("if (!response.ok)");
    // Everything between the failure branch and the first read of the body.
    const rejected = client.slice(start, client.indexOf("const text = await", start));
    assert.match(rejected, /return \{ status: "rejected", httpStatus: response\.status \};/);
    assert.doesNotMatch(rejected, /await response\.(text|json)\(\)/);
  });

  test("the config is unusable without both halves", () => {
    assert.equal(getMetaCapiConfig({ pixelId: PIXEL_ID, accessToken: null }), null);
    assert.equal(getMetaCapiConfig({ pixelId: null, accessToken: TOKEN }), null);
    assert.equal(getMetaCapiConfig({ pixelId: PIXEL_ID, accessToken: "short" }), null);
    assert.equal(isMetaCapiConfigured({ pixelId: PIXEL_ID, accessToken: TOKEN }), true);
  });

  test("the graph version and test code are validated, not interpolated", () => {
    /*
     * Both land in a URL path or a request body. An unchecked env string in a
     * URL is how a request ends up somewhere other than the Graph API.
     */
    assert.equal(
      buildCapiEndpoint(
        getMetaCapiConfig({
          pixelId: PIXEL_ID,
          accessToken: TOKEN,
          graphVersion: "../../evil",
        })!
      ),
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`
    );
    assert.equal(
      getMetaCapiConfig({
        pixelId: PIXEL_ID,
        accessToken: TOKEN,
        graphVersion: "v19.0",
      })!.graphVersion,
      "v19.0"
    );
    assert.equal(
      getMetaCapiConfig({
        pixelId: PIXEL_ID,
        accessToken: TOKEN,
        testEventCode: "not a code!",
      })!.testEventCode,
      null
    );
    assert.equal(
      getMetaCapiConfig({
        pixelId: PIXEL_ID,
        accessToken: TOKEN,
        testEventCode: "TEST12345",
      })!.testEventCode,
      "TEST12345"
    );
  });

  test("the test event code is sent only when configured", async () => {
    const withCode = recordingFetch(okResponse);
    await sendMetaCapiEvent(
      buildLeadEvent({
        eventId: EVENT_ID,
        eventSourceUrl: "https://onedecore.in/",
        nowMs: Date.now(),
        clientIp: null,
        userAgent: null,
        fbc: null,
        fbp: null,
      }),
      {
        config: getMetaCapiConfig({
          pixelId: PIXEL_ID,
          accessToken: TOKEN,
          testEventCode: "TEST12345",
        }),
        fetchImpl: withCode.fetchImpl,
      }
    );
    assert.ok(String(withCode.calls[0]!.init.body).includes("test_event_code"));

    const without = recordingFetch(okResponse);
    await sendMetaCapiEvent(
      buildLeadEvent({
        eventId: EVENT_ID,
        eventSourceUrl: "https://onedecore.in/",
        nowMs: Date.now(),
        clientIp: null,
        userAgent: null,
        fbc: null,
        fbp: null,
      }),
      { config: testConfig(), fetchImpl: without.fetchImpl }
    );
    assert.ok(!String(without.calls[0]!.init.body).includes("test_event_code"));
  });
});

/* ========================================================================== */
/* 11. Contact                                                                 */
/* ========================================================================== */

describe("Contact is a browser event on a real move to a human channel", () => {
  test("it fires on the WhatsApp and call actions only", () => {
    const fab = read("src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx");
    const sticky = read("src/features/public-site/home-r4/HomeStickyActions.tsx");
    assert.match(fab, /trackMetaContact\(\)/);
    assert.match(sticky, /onClick=\{\(\) => trackMetaContact\(\)\}/);
    assert.equal(META_EVENT.contact, "Contact");
  });

  test("it does not fire on navigation or on opening the form", () => {
    for (const rel of [
      BRIEF,
      "src/features/public-site/chrome/PublicSiteHeader.tsx",
      "src/features/public-site/chrome/PublicSiteFooter.tsx",
    ]) {
      assert.doesNotMatch(read(rel), /trackMetaContact/, rel);
    }
  });

  test("it carries no event id, because there is no server counterpart", () => {
    /*
     * A tap leaves the page for another application, so there is no server
     * request to hang a conversion on and nothing durable to confirm. Server
     * Contact is deliberately deferred rather than fabricated from a click the
     * server never saw.
     */
    const events = read(EVENTS);
    const contact = events.slice(events.indexOf("export function trackMetaContact"));
    assert.match(contact, /safeTrack\(META_EVENT\.contact\);/);
    assert.doesNotMatch(contact, /eventId/);
    assert.doesNotMatch(code(read(REPORT)), /Contact|contact/);
  });

  test("the link still works if the pixel is blocked", () => {
    // Comment-stripped: the FAB documents that it does NOT preventDefault.
    const fab = code(read("src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx"));
    assert.doesNotMatch(fab, /preventDefault/);
    const sticky = code(read("src/features/public-site/home-r4/HomeStickyActions.tsx"));
    assert.doesNotMatch(sticky, /preventDefault/);
  });
});

/* ========================================================================== */
/* 12. Nothing here calls the real network                                     */
/* ========================================================================== */

describe("the integration is inert without configuration", () => {
  test("no module hard-codes a live call", () => {
    for (const rel of [CONFIG, EVENTS, PIXEL, CAPI_ENV, CAPI_CLIENT, SIGNALS, REPORT]) {
      const source = code(read(rel));
      assert.ok(
        !/fetch\(\s*["'`]https:/.test(source),
        `${rel} must not fetch a literal URL`
      );
    }
  });

  test("the endpoint is built from validated config, never from input", () => {
    const client = read(CAPI_CLIENT);
    assert.match(client, /export function buildCapiEndpoint\(config: MetaCapiConfig\)/);
    assert.match(client, /graph\.facebook\.com\/\$\{config\.graphVersion\}\/\$\{config\.pixelId\}\/events/);
  });

  test("both gates are documented as blank in .env.example", () => {
    const example = read(ENV_EXAMPLE);
    assert.match(example, /^NEXT_PUBLIC_META_PIXEL_ID=$/m);
    assert.match(example, /^META_CONVERSIONS_API_ACCESS_TOKEN=$/m);
    assert.match(example, /^META_CONVERSIONS_API_GRAPH_VERSION=$/m);
    assert.match(example, /^META_CONVERSIONS_API_TEST_EVENT_CODE=$/m);
  });

  test("the CSP names the two Meta origins and no wildcard", () => {
    const csp = read("src/config/http-security.ts");
    assert.match(csp, /META_PIXEL_SCRIPT_ORIGIN/);
    assert.match(csp, /META_PIXEL_BEACON_ORIGIN/);
    assert.equal(META_PIXEL_SCRIPT_ORIGIN, "https://connect.facebook.net");
    assert.equal(META_PIXEL_BEACON_ORIGIN, "https://www.facebook.com");
    // Comment-stripped: the policy EXPLAINS why a wildcard is refused.
    assert.doesNotMatch(code(csp), /\*\.facebook/);
  });
});
