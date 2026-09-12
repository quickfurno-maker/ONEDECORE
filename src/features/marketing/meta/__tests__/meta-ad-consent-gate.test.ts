import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { isMetaTrackablePath } from "../meta-tracking-config.ts";
import type { AdConsentState } from "../ad-consent.ts";
import {
  AD_CONSENT_COOKIE_NAME,
  AD_CONSENT_DENIED_VALUE,
  AD_CONSENT_GRANTED_VALUE,
  AD_CONSENT_MAX_AGE_SECONDS,
  AD_CONSENT_VERSION,
  isAdConsentGranted,
  parseAdConsent,
  readAdConsentFromHeader,
  readConsentCookie,
} from "../ad-consent.ts";
import { getMetaCapiConfig } from "../server/meta-capi-env.ts";
import { reportLeadConversion } from "../server/report-lead-conversion.ts";
import {
  PRIVACY_POLICY_CONTENT,
  PRIVACY_NOTICE_ADVERTISING_AMENDMENT,
  PRIVACY_NOTICE_VERSION,
} from "../../../legal/privacy-policy-content.ts";
import { PROCESSOR_REGISTER } from "../../../legal/processor-register.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const CONSENT = "src/features/marketing/meta/ad-consent.ts";
const BANNER = "src/features/marketing/meta/AdConsentBanner.tsx";
const BANNER_CSS = "src/features/marketing/meta/ad-consent-banner.css";
const PIXEL = "src/features/marketing/meta/MetaPixel.tsx";
const EVENTS = "src/features/marketing/meta/meta-pixel-events.ts";
const REPORT = "src/features/marketing/meta/server/report-lead-conversion.ts";
const ROOT_LAYOUT = "src/app/layout.tsx";
const HOOK = "src/features/marketing/meta/use-ad-consent.ts";
const DATA_INVENTORY = "src/features/legal/data-inventory.ts";

/** Source with comments stripped, so prose about a thing is not the thing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TOKEN = "EAAG-fake-token-for-tests-only-not-real-0123456789";
const PIXEL_ID = "1952479475419612";
const EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const GRANTED = `${AD_CONSENT_COOKIE_NAME}=${AD_CONSENT_GRANTED_VALUE}`;
const DENIED = `${AD_CONSENT_COOKIE_NAME}=${AD_CONSENT_DENIED_VALUE}`;

/**
 * Production's configuration, present and correct.
 *
 * Every CAPI test here runs with BOTH env values valid, because that is the
 * state of production. If a test passed only because the token was missing it
 * would prove nothing about the thing under test.
 */
const productionConfig = () =>
  getMetaCapiConfig({ pixelId: PIXEL_ID, accessToken: TOKEN })!;

/** Fires only if something actually attempted to reach Meta. */
function failingSend() {
  let called = 0;
  const send = (async () => {
    called += 1;
    return { status: "sent", eventsReceived: 1 } as const;
  }) as never;
  return { send, calls: () => called };
}

/*
 * ============================================================================
 * WHY THIS FILE EXISTS SEPARATELY FROM THE PIXEL SUITE.
 *
 * The other suite proves the integration does what Meta expects. This one
 * proves it does NOTHING until a visitor says yes — which is a different
 * property, and the one that survives the discovery that production already
 * has the pixel id and the access token set.
 * ============================================================================
 */

/* ========================================================================== */
/* 1. The cookie itself                                                        */
/* ========================================================================== */

describe("the advertising consent cookie fails closed", () => {
  test("only an exact, current grant reads as granted", () => {
    assert.equal(parseAdConsent(AD_CONSENT_GRANTED_VALUE), "granted");
    assert.equal(parseAdConsent(AD_CONSENT_DENIED_VALUE), "denied");
    assert.equal(parseAdConsent(`  ${AD_CONSENT_GRANTED_VALUE}  `), "granted");
  });

  test("absent, empty and malformed values are all unknown", () => {
    for (const value of [
      null,
      undefined,
      "",
      "   ",
      "granted",
      "true",
      "yes",
      "1",
      "v1:GRANTED",
      "v1:granted-ish",
      "v1:grantedX",
      "xv1:granted",
      "v1:",
      "{}",
      "v1:granted;v1:denied",
    ]) {
      assert.equal(parseAdConsent(value as string), "unknown", String(value));
      assert.equal(isAdConsentGranted(value as string), false, String(value));
    }
  });

  test("a stale version is unknown, so the question gets asked again", () => {
    /*
     * The version is in the value precisely so the question CAN be re-asked.
     * If what Meta receives ever changes, this string changes, every stored
     * decision becomes unknown, and nobody is carried over on a yes they gave
     * to a different description.
     */
    assert.equal(AD_CONSENT_VERSION, "v1");
    assert.equal(parseAdConsent("v0:granted"), "unknown");
    assert.equal(parseAdConsent("v2:granted"), "unknown");
  });

  test("the cookie name is matched exactly, not by prefix", () => {
    const decoy = `not_${AD_CONSENT_COOKIE_NAME}=v1:granted`;
    assert.equal(readConsentCookie(decoy), null);
    assert.equal(readAdConsentFromHeader(decoy), "unknown");
    assert.equal(
      readAdConsentFromHeader(`${decoy}; ${GRANTED}`),
      "granted",
      "the real cookie still answers when a decoy sits beside it"
    );
  });

  test("it is first-party, versioned, and carries no personal data", () => {
    assert.equal(AD_CONSENT_COOKIE_NAME, "onedecore_ad_tracking_consent");
    assert.equal(AD_CONSENT_GRANTED_VALUE, "v1:granted");
    assert.equal(AD_CONSENT_DENIED_VALUE, "v1:denied");
    assert.equal(AD_CONSENT_MAX_AGE_SECONDS, 180 * 24 * 60 * 60);
    const source = read(CONSENT);
    assert.match(source, /Path=\/; Max-Age=\$\{AD_CONSENT_MAX_AGE_SECONDS\}/);
    assert.match(source, /SameSite=Lax/);
    assert.match(source, /secure \? "; Secure" : ""/);
    assert.doesNotMatch(code(source), /HttpOnly/);
  });

  test("no third-party consent platform was introduced", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const names = Object.keys(pkg.dependencies ?? {}).join(" ");
    assert.doesNotMatch(names, /onetrust|cookiebot|iubenda|cookieyes|klaro|osano/i);
    assert.doesNotMatch(read(BANNER), /onetrust|cookiebot|iubenda/i);
  });
});

/* ========================================================================== */
/* 2. Consent is never inferred                                                */
/* ========================================================================== */

describe("consent is asked for, never deduced", () => {
  test("arriving from an ad is not agreeing to be measured", async () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * `_fbp`, `_fbc`, `fbclid` and UTM parameters all say someone ARRIVED from
     * an ad. Reading any of them as permission would mean the people most
     * likely to be tracked are exactly the ones who were never asked.
     */
    const probe = failingSend();
    for (const cookieHeader of [
      "_fbp=fb.1.1760000000.1234567890",
      "_fbc=fb.1.1760000000.AbCdEf",
      "_fbp=fb.1.1760000000.1; _fbc=fb.1.1760000000.A",
    ]) {
      const result = await reportLeadConversion(
        {
          eventId: EVENT_ID,
          cookieHeader,
          userAgent: "Mozilla/5.0",
          forwardedFor: "203.0.113.7",
          trustProxy: true,
          landingPath: "/",
          fbclid: "IwAR0abc",
        },
        { getConfig: productionConfig, send: probe.send }
      );
      assert.deepEqual(result, { status: "skipped", reason: "no-ad-consent" });
    }
    assert.equal(probe.calls(), 0, "nothing may reach Meta without consent");
  });

  test("the form's own consents are not advertising consent", () => {
    /*
     * Service-enquiry and WhatsApp consent say "you may contact me about my
     * enquiry". Neither is permission to load an advertising script — reusing
     * one for the other is the bundling the legal consent registry forbids.
     */
    const report = code(read(REPORT));
    assert.doesNotMatch(report, /consentServiceEnquiry|whatsappService|serviceEmail/);
    const consent = code(read(CONSENT));
    assert.doesNotMatch(consent, /serviceEnquiry|whatsapp|marketingConsent/i);
  });

  test("the cookie is the only input to the server gate", () => {
    const report = read(REPORT);
    assert.match(
      report,
      /if \(readAdConsentFromHeader\(input\.cookieHeader\) !== "granted"\)/
    );
    assert.match(report, /status: "skipped", reason: "no-ad-consent"/);
  });
});

/* ========================================================================== */
/* 3. The browser gate                                                         */
/* ========================================================================== */

describe("the browser loads and reports nothing without a grant", () => {
  test("a grant does not unlock a surface that was never trackable", () => {
    /*
     * The three conditions are AND-ed, and this is the direction that is easy
     * to get wrong: consent is the NEW gate, so it is tempting to treat it as
     * the decisive one. It is not. Someone who allowed advertising cookies on
     * the public site and then signs in must still see no Meta script on
     * /admin, and a customer opening their own /q quotation link must never be
     * measured on it whatever they agreed to elsewhere.
     */
    const gateOpens = (pathname: string, consent: AdConsentState) =>
      Boolean(PIXEL_ID) && isMetaTrackablePath(pathname) && consent === "granted";

    for (const path of [
      "/admin",
      "/admin/portfolio/media",
      "/admin/crm/leads",
      "/q",
      "/q/abc123",
      "/api/public/lead-intake",
    ]) {
      assert.equal(gateOpens(path, "granted"), false, `granted + ${path}`);
    }

    // And the same expression does open on the public pages, so the test above
    // is not passing because the helper says no to everything.
    for (const path of ["/", "/portfolio", "/shop", "/lp/kitchen", "/privacy"]) {
      assert.equal(gateOpens(path, "granted"), true, path);
      assert.equal(gateOpens(path, "denied"), false, path);
      assert.equal(gateOpens(path, "unknown"), false, path);
    }
  });

  test("all three gates are required to initialise", () => {
    const pixel = read(PIXEL);
    assert.match(
      pixel,
      /const allowed =\s*Boolean\(pixelId\) && trackable && consent === "granted";/
    );
    assert.match(pixel, /if \(!allowed\) return;/);
  });

  test("the script is requested inside the gated effect, never at module load", () => {
    /*
     * THE LEAK THIS PREVENTS.
     *
     * A top-level `<script>` or an import-time side effect would fetch
     * fbevents.js before any gate ran. The tag is created inside the effect
     * that has already checked all three conditions.
     */
    const pixel = read(PIXEL);
    const effectAt = pixel.indexOf("if (!allowed) return;");
    const scriptAt = pixel.indexOf("META_PIXEL_SCRIPT_SRC", effectAt);
    assert.ok(effectAt > 0 && scriptAt > effectAt);
    assert.doesNotMatch(read(ROOT_LAYOUT), /<script/i);
  });

  test("every browser event re-reads the cookie", () => {
    /*
     * Not captured once and not inherited from the component. A visitor can
     * withdraw between opening the form and submitting it, and `fbq` existing
     * proves only that they once granted — not that they still do.
     */
    const events = read(EVENTS);
    assert.match(events, /function consentGranted\(\): boolean/);
    assert.match(events, /if \(!consentGranted\(\)\) return;/);
    const guardAt = events.indexOf("if (!consentGranted()) return;");
    const fbqAt = events.indexOf("const fbq = getFbq();", guardAt);
    assert.ok(guardAt > 0 && fbqAt > guardAt, "consent is checked before fbq");
  });

  test("PageView, Lead and Contact all route through the one guard", () => {
    const events = read(EVENTS);
    for (const fn of ["trackMetaPageView", "trackMetaLead", "trackMetaContact"]) {
      assert.match(events, new RegExp(`export function ${fn}`));
    }
    // One guarded helper, three callers — no second path to fbq.
    assert.equal((events.match(/fbq\(/g) ?? []).length, 2, "only safeTrack calls fbq");
  });

  test("withdrawal takes effect within the page view", () => {
    const pixel = read(PIXEL);
    assert.match(pixel, /if \(consent !== "granted"\) lastReported\.current = null;/);
    assert.match(pixel, /\}, \[allowed, pixelId\]\);/);

    /*
     * The component learns of a withdrawal because the store it reads from is
     * subscribed to the change event `writeAdConsent` dispatches — and to
     * `focus`, so a decision made in another tab lands here too.
     */
    const hook = read(HOOK);
    assert.match(hook, /window\.addEventListener\(AD_CONSENT_CHANGE_EVENT, onChange\);/);
    assert.match(hook, /window\.addEventListener\("focus", onChange\);/);
    assert.match(read(CONSENT), /window\.dispatchEvent\(\s*new CustomEvent\(AD_CONSENT_CHANGE_EVENT/);
  });

  test("a re-grant emits one PageView for the page already open", () => {
    /*
     * Clearing `lastReported` on withdrawal is what makes this work: without
     * it a re-grant would stay silent because the current path was "already
     * reported" before consent was withdrawn.
     */
    const pixel = read(PIXEL);
    const clearAt = pixel.indexOf('if (consent !== "granted") lastReported.current = null;');
    const reportAt = pixel.indexOf("lastReported.current = pathname;");
    assert.ok(clearAt > 0 && reportAt > clearAt);
    assert.match(pixel, /if \(lastReported\.current === pathname\) return;/);
  });

  test("withdrawal clears the Meta cookies this site can reach", () => {
    const consent = read(CONSENT);
    assert.match(consent, /if \(state === "denied"\) clearMetaBrowserCookies\(\);/);
    assert.match(consent, /for \(const name of \["_fbp", "_fbc"\]\)/);
    assert.match(consent, /Max-Age=0/);
    // Both scopes, because the script may have written either.
    assert.match(consent, /const domains = \[undefined, host, `\.\$\{host\}`, `\.\$\{registrable\}`\]/);
  });

  test("it does not promise to recall what Meta already has", () => {
    const consent = read(CONSENT);
    assert.match(consent, /Events already transmitted to Meta are gone from this/);
    const section = PRIVACY_POLICY_CONTENT.find(
      (s) => s.id === "advertising-measurement"
    );
    assert.ok(section);
    assert.ok(
      section!.body.some((line) => /cannot be recalled by us/.test(line)),
      "the notice must not imply an undo that does not exist"
    );
  });
});

/* ========================================================================== */
/* 4. The server gate, with production configuration present                   */
/* ========================================================================== */

describe("the Conversions API respects the same decision", () => {
  const baseInput = {
    eventId: EVENT_ID,
    userAgent: "Mozilla/5.0",
    forwardedFor: "203.0.113.7",
    trustProxy: true,
    landingPath: "/",
    fbclid: null,
  };

  test("unknown consent sends nothing, even with a valid token", async () => {
    const probe = failingSend();
    const result = await reportLeadConversion(
      { ...baseInput, cookieHeader: null },
      { getConfig: productionConfig, send: probe.send }
    );
    assert.deepEqual(result, { status: "skipped", reason: "no-ad-consent" });
    assert.equal(probe.calls(), 0);
  });

  test("denied consent sends nothing", async () => {
    const probe = failingSend();
    const result = await reportLeadConversion(
      { ...baseInput, cookieHeader: DENIED },
      { getConfig: productionConfig, send: probe.send }
    );
    assert.deepEqual(result, { status: "skipped", reason: "no-ad-consent" });
    assert.equal(probe.calls(), 0);
  });

  test("a malformed consent value fails closed", async () => {
    for (const cookieHeader of [
      `${AD_CONSENT_COOKIE_NAME}=granted`,
      `${AD_CONSENT_COOKIE_NAME}=v0:granted`,
      `${AD_CONSENT_COOKIE_NAME}=v1:granted-ish`,
      `${AD_CONSENT_COOKIE_NAME}=`,
    ]) {
      const probe = failingSend();
      const result = await reportLeadConversion(
        { ...baseInput, cookieHeader },
        { getConfig: productionConfig, send: probe.send }
      );
      assert.deepEqual(
        result,
        { status: "skipped", reason: "no-ad-consent" },
        cookieHeader
      );
      assert.equal(probe.calls(), 0);
    }
  });

  test("a grant sends exactly one event, with the same id the browser used", async () => {
    const sent: Array<{ event_id: string; event_name: string }> = [];
    const send = (async (event: { event_id: string; event_name: string }) => {
      sent.push({ event_id: event.event_id, event_name: event.event_name });
      return { status: "sent", eventsReceived: 1 } as const;
    }) as never;

    const result = await reportLeadConversion(
      { ...baseInput, cookieHeader: GRANTED },
      { getConfig: productionConfig, send }
    );
    assert.deepEqual(result, { status: "sent", eventsReceived: 1 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.event_name, "Lead");
    assert.equal(
      sent[0]!.event_id,
      EVENT_ID,
      "the server must reuse the browser's event id, not mint one"
    );
  });

  test("consent is checked before the config, so the order reads as the policy", async () => {
    /*
     * With no token at all the answer is still "no consent" rather than "not
     * configured" — the advertising decision comes first whatever the
     * environment happens to hold.
     */
    const result = await reportLeadConversion(
      { ...baseInput, cookieHeader: null },
      { getConfig: () => null, send: failingSend().send }
    );
    assert.deepEqual(result, { status: "skipped", reason: "no-ad-consent" });
  });

  test("a granted lead still carries only the approved user_data", async () => {
    let captured: Record<string, unknown> | null = null;
    const send = (async (event: { user_data: Record<string, unknown> }) => {
      captured = event.user_data;
      return { status: "sent", eventsReceived: 1 } as const;
    }) as never;

    await reportLeadConversion(
      {
        ...baseInput,
        cookieHeader: `${GRANTED}; _fbp=fb.1.1760000000.1234567890`,
      },
      { getConfig: productionConfig, send }
    );
    assert.ok(captured);
    assert.deepEqual(Object.keys(captured!).sort(), [
      "client_ip_address",
      "client_user_agent",
      "fbp",
    ]);
    const serialised = JSON.stringify(captured);
    for (const forbidden of ["em", "ph", "fn", "ln", "external_id"]) {
      assert.ok(!serialised.includes(`"${forbidden}"`));
    }
  });

  test("the lead itself is unaffected by any of this", () => {
    /*
     * A skipped conversion is not a failed lead. The route ignores the result
     * and reports only a log field, exactly as it did before consent existed.
     */
    const route = read("src/app/api/public/lead-intake/route.ts");
    assert.match(route, /metaLog = safeMetaCapiLog\(capi\);/);
    assert.doesNotMatch(route, /if \(capi[.\s]/);
    assert.doesNotMatch(route, /throw .*capi/);
  });
});

/* ========================================================================== */
/* 5. The banner                                                               */
/* ========================================================================== */

describe("the choice is offered fairly, on public pages only", () => {
  test("it uses the same route gate as the pixel", () => {
    /*
     * A surface that may never be measured is never asked about measurement.
     * Sharing the predicate is what stops the two lists drifting into a cookie
     * banner on the admin console.
     */
    const banner = read(BANNER);
    assert.match(banner, /isMetaTrackablePath\(pathname\)/);
    assert.match(banner, /if \(!isMetaTrackablePath\(pathname\)\) return null;/);
  });

  test("two equal buttons, and decline comes first", () => {
    const banner = read(BANNER);
    const denyAt = banner.indexOf('data-od-cookie-action="deny"');
    const grantAt = banner.indexOf('data-od-cookie-action="grant"');
    assert.ok(denyAt > 0 && grantAt > denyAt, "decline is the first tab stop");
    assert.match(banner, /Necessary only/);
    assert.match(banner, /Allow advertising cookies/);

    // Same size and target; only the fill differs.
    const css = read(BANNER_CSS);
    const shared = css.slice(
      css.indexOf(".od-cookie__btn {"),
      css.indexOf(".od-cookie__btn--secondary")
    );
    assert.match(shared, /min-height: 44px/);
    assert.match(shared, /flex: 1 1 auto/);
  });

  test("nothing is pre-selected and dismissing is not consent", () => {
    /*
     * There is no checkbox to arrive pre-ticked, and no close control that
     * quietly means yes: leaving without choosing keeps the state `unknown`,
     * which is the same as denied for every gate in this system.
     */
    const banner = code(read(BANNER));
    assert.doesNotMatch(banner, /defaultChecked|checked=\{true\}/);
    assert.doesNotMatch(banner, /aria-label="Close"|onDismiss/);
    /*
     * There is no local copy of the decision to initialise wrongly: the banner
     * reads the cookie through the store, whose server snapshot is "unknown" —
     * the answer that means no tracking.
     */
    assert.match(banner, /const state: AdConsentState = useAdConsent\(\);/);
    assert.match(read(HOOK), /\(\) => "unknown" as const/);
  });

  test("the decision can be changed later, as easily as it was made", () => {
    const banner = read(BANNER);
    assert.match(banner, /Cookie preferences/);
    assert.match(banner, /data-od-cookie-reopen=""/);
    assert.match(banner, /function AdConsentReopener/);
  });

  test("it links to the disclosure it is asking about", () => {
    assert.match(read(BANNER), /href="\/privacy#advertising-measurement"/);
  });

  test("it is keyboard operable, mobile-safe and clears the sticky CTA", () => {
    const banner = read(BANNER);
    // Real buttons, not divs with handlers.
    assert.match(banner, /<button\s+ref=\{firstButtonRef\}/);
    assert.match(banner, /type="button"/);
    assert.match(banner, /role="region"/);
    assert.match(banner, /aria-label="Cookie preferences"/);

    const css = read(BANNER_CSS);
    assert.match(css, /:focus-visible \{\s*\n\s*outline: 2px solid/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    /*
     * The sticky conversion bar owns the bottom of a phone screen. The strip
     * sits ABOVE it — a consent banner that covered the enquiry CTA would cost
     * real leads to ask a question the visitor can answer later.
     */
    assert.match(css, /@media \(max-width: 1079px\)[\s\S]{0,260}inset-block-end: calc\(68px/);
    assert.match(css, /prefers-reduced-motion/);
  });

  test("it renders nothing until it has read the cookie", () => {
    /*
     * The server cannot read the cookie, so the first render is `unknown` on
     * both sides and the banner stays hidden until the first client effect.
     * Rendering during SSR and hiding afterwards would flash it at visitors who
     * decided months ago.
     */
    const banner = read(BANNER);
    assert.match(banner, /const ready = useHydrated\(\);/);
    assert.match(banner, /if \(!ready\) return null;/);
    // Server says false, client says true — no effect, so no cascading render.
    assert.match(read(HOOK), /export function useHydrated\(\): boolean \{[\s\S]*?\(\) => true,[\s\S]*?\(\) => false/);
    assert.doesNotMatch(code(banner), /useEffect/);
  });
});

/* ========================================================================== */
/* 6. The disclosure exists                                                    */
/* ========================================================================== */

describe("the Privacy Notice describes what was consented to", () => {
  const section = () =>
    PRIVACY_POLICY_CONTENT.find((s) => s.id === "advertising-measurement");

  test("there is a cookies and advertising measurement section, and it is public", () => {
    const s = section();
    assert.ok(s, "the advertising-measurement section must exist");
    assert.equal(s!.title, "Cookies and advertising measurement");
    assert.notEqual(s!.audience, "draft-only");
  });

  test("it states the opt-in, and what happens without it", () => {
    const body = section()!.body.join(" ");
    assert.match(body, /Allow advertising cookies/);
    assert.match(body, /Necessary only/);
    assert.match(body, /no Meta script is loaded, no Meta cookie is set and no event is sent/);
  });

  test("it lists exactly what Meta receives", () => {
    const body = section()!.body.join(" ");
    for (const item of [
      "event name",
      "event time",
      "page address",
      "user-agent",
      "IP address",
      "_fbp",
      "_fbc",
    ]) {
      assert.ok(body.includes(item), `the notice must name ${item}`);
    }
  });

  test("it states what is never sent, and that advanced matching is off", () => {
    const body = section()!.body.join(" ");
    for (const item of [
      "name",
      "phone number",
      "email address",
      "budget",
      "service selection",
      "enquiry message",
      "quotation data",
      "CRM record",
    ]) {
      assert.ok(body.includes(item), `the notice must exclude ${item}`);
    }
    assert.match(body, /advanced matching is switched off/);
  });

  test("it explains the event identifier without overclaiming", () => {
    const body = section()!.body.join(" ");
    assert.match(body, /random one-time value/);
    assert.match(body, /not derived from your contact details/);
  });

  test("Meta is named in the service-provider disclosure", () => {
    const processors = PRIVACY_POLICY_CONTENT.find((s) => s.id === "processors");
    assert.ok(processors);
    assert.ok(
      processors!.body.some((line) => /Meta Platforms/.test(line)),
      "Meta must appear where a reader looks for who else sees their data"
    );
  });

  test("the amendment is versioned and its approval is honestly unsigned", () => {
    assert.equal(PRIVACY_NOTICE_VERSION, "privacy-notice-v1.1");
    assert.equal(PRIVACY_NOTICE_ADVERTISING_AMENDMENT.ownerApproval, null);
  });

  test("the processor register records the consent dependency", () => {
    const entry = PROCESSOR_REGISTER.find((p) =>
      p.notes?.some((n) => /Meta Platforms/.test(n))
    );
    assert.ok(entry, "Meta must appear in the processor register");
    const notes = entry!.notes!.join(" ");
    assert.match(notes, /CONSENT-DEPENDENT/);
    assert.match(notes, /onedecore_ad_tracking_consent/);
    assert.match(notes, /Automatic advanced matching is OFF/);
    assert.doesNotMatch(notes, /No analytics, Meta Pixel/);
  });

  test("the data inventory no longer claims nothing is approved", () => {
    const inventory = read(DATA_INVENTORY);
    assert.doesNotMatch(inventory, /No analytics, Meta Pixel/);
    assert.match(inventory, /onedecore_ad_tracking_consent/);
    assert.match(inventory, /Automatic advanced matching is off/);
  });
});

/* ========================================================================== */
/* 7. Production configuration alone changes nothing                           */
/* ========================================================================== */

describe("having the env set is not permission", () => {
  test("a fully configured deployment still sends nothing without consent", async () => {
    /*
     * THE ASSUMPTION THIS REPLACES.
     *
     * An earlier version of this work argued it was safe because the pixel id
     * and token were unset. Production already has both. This test runs with
     * both present and asserts the only thing that was ever actually true: no
     * consent, no event.
     */
    assert.ok(productionConfig(), "the test must run with a valid config");
    const probe = failingSend();
    for (const cookieHeader of [null, "", DENIED, "other=1"]) {
      const result = await reportLeadConversion(
        {
          eventId: EVENT_ID,
          cookieHeader,
          userAgent: "Mozilla/5.0",
          forwardedFor: "203.0.113.7",
          trustProxy: true,
          landingPath: "/portfolio",
          fbclid: "IwAR0abc",
        },
        { getConfig: productionConfig, send: probe.send }
      );
      assert.deepEqual(result, { status: "skipped", reason: "no-ad-consent" });
    }
    assert.equal(probe.calls(), 0);
  });

  test("no source file still claims the env is the protection", () => {
    for (const rel of [PIXEL, REPORT, ROOT_LAYOUT]) {
      assert.doesNotMatch(
        read(rel),
        /Merging this PR does not start tracking anyone|unset in every environment/,
        `${rel} carries a stale safety claim`
      );
    }
  });
});
