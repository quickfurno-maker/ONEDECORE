/**
 * L1.1 — owner-directed homepage conversion refinement.
 *
 * FOUR CHANGES, AND THE ONE THING THAT MUST NOT MOVE WITH THEM
 *
 *   1. The projects count is displayed again — and ONLY that one.
 *   2. The hero is images and nothing else.
 *   3. WhatsApp sits beside the sticky consultation CTA, from configuration.
 *   4. The consultation form is one compact card.
 *
 * The thing that must not move is the evidence model. Restoring a figure the
 * owner asked for is not the same as declaring it verified, and this suite
 * exists mostly to keep those two apart: `projects-delivered` renders because
 * `ownerAttestedDisplay` is recorded, while `isClaimPubliclyEvidenced` still
 * answers `false` for it and every other claim stays withheld.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  PUBLIC_CLAIM_EVIDENCE,
  PUBLIC_CLAIM_IDS,
  getOwnerAttestedClaimIds,
  getUnevidencedClaimIds,
  isClaimDisplayable,
  isClaimPubliclyEvidenced,
} from "../../legal/claim-evidence.ts";
import {
  HOME_CLAIMS,
  canQuotePublicClaim,
  publicClaimLabel,
  resolvePublicClaim,
} from "../home-r4/claims.ts";
import {
  PUBLIC_WHATSAPP,
  getPublicWhatsAppHref,
  isPublicWhatsAppConfigured,
  normalizeWhatsAppE164,
} from "../chrome/public-contact.ts";
import { DISCOVERY_TRUST_STRIP_ITEMS } from "../discovery/discovery-copy.ts";
import { CONSULTATION_SERVICE_OPTIONS } from "../../lead-intake/public/consultation-copy.ts";
import { consultationToLeadRequest } from "../../lead-intake/public/consultation-to-lead-request.ts";
import type { LeadFormAttribution } from "../../lead-intake/public/lead-form-attribution.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const HERO = "src/features/public-site/discovery/DiscoveryHeroSlider.tsx";
const COUNTER = "src/features/public-site/discovery/DiscoveryProjectsCounter.tsx";
const STRIP = "src/features/public-site/discovery/DiscoveryTrustStrip.tsx";
const DOCK = "src/features/public-site/discovery/DiscoveryStickyCta.tsx";
const CONTACT = "src/features/public-site/chrome/public-contact.ts";
const FORM = "src/features/lead-intake/public/ConsultationLeadForm.tsx";
const ADAPTER = "src/features/lead-intake/public/consultation-to-lead-request.ts";
const SERVER = "src/features/lead-intake/server/lead-intake-validation.ts";
const DISCOVERY_CSS = "src/features/public-site/discovery/discovery.css";

/* ========================================================================== */
/* 1. One figure restored, by attestation, not by verification                 */
/* ========================================================================== */

describe("the projects count is displayed without being called verified", () => {
  test("owner attestation and public evidence are different answers", () => {
    /*
     * The distinction this whole module exists for. If these two ever agree
     * for `projects-delivered`, either evidence arrived — fine, update this —
     * or somebody flipped a status to make a test pass, which is not.
     */
    assert.equal(isClaimPubliclyEvidenced("projects-delivered"), false);
    assert.equal(isClaimDisplayable("projects-delivered"), true);
    const resolved = resolvePublicClaim("projects-delivered");
    assert.equal(resolved.evidenced, false);
    assert.equal(resolved.displayable, true);
  });

  test("the attestation is recorded, dated and scoped to one claim", () => {
    const record = PUBLIC_CLAIM_EVIDENCE["projects-delivered"];
    assert.ok(record.ownerAttestedDisplay, "the grant must be recorded");
    assert.match(record.ownerAttestedDisplay!.attestedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.ownerAttestedDisplay!.note.length > 20);
    assert.deepEqual([...getOwnerAttestedClaimIds()], ["projects-delivered"]);
  });

  test("nothing became evidenced — the register is unchanged", () => {
    assert.deepEqual([...getUnevidencedClaimIds()], [...PUBLIC_CLAIM_IDS]);
    for (const id of PUBLIC_CLAIM_IDS) {
      assert.equal(isClaimPubliclyEvidenced(id), false, id);
    }
    const registry = code(read("src/features/legal/business-truth-registry.ts"));
    assert.match(registry, /structuredDataPermission: false/);
    assert.doesNotMatch(registry, /structuredDataPermission: true/);
  });

  test("only the project count came back", () => {
    assert.equal(canQuotePublicClaim("projects-delivered"), true);
    assert.equal(publicClaimLabel("projects-delivered"), "500+ Projects Delivered");
    for (const id of [
      "average-rating",
      "client-reviews",
      "client-satisfaction",
      "warranty-years",
      "custom-designs",
    ] as const) {
      assert.equal(canQuotePublicClaim(id), false, id);
    }
    assert.equal(publicClaimLabel("average-rating"), null);
    assert.equal(publicClaimLabel("client-reviews"), null);
    assert.equal(publicClaimLabel("client-satisfaction"), null);
  });

  test("an attested claim that also needs legal terms still waits for them", () => {
    // Attestation is not a bypass for a contractual promise.
    const attestedWarranty = {
      ...PUBLIC_CLAIM_EVIDENCE,
      "warranty-years": {
        ...PUBLIC_CLAIM_EVIDENCE["warranty-years"],
        ownerAttestedDisplay: { attestedOn: "2026-01-01", note: "hypothetical" },
      },
    };
    assert.equal(isClaimDisplayable("warranty-years", attestedWarranty), false);
  });

  test("the counter renders below the hero, animated, reduced-motion safe", () => {
    const counter = read(COUNTER);
    const counterCode = code(counter);
    assert.match(counter, /canQuotePublicClaim\("projects-delivered"\)/);
    assert.match(counter, /IntersectionObserver/);
    assert.match(counter, /prefers-reduced-motion/);
    // Seeded with the real figure: a useState(0) seed would ship "0+" to every
    // pre-hydration and no-JS visitor.
    assert.match(counterCode, /useState<number>\(target\)/);
    assert.doesNotMatch(counterCode, /useState\(0\)/);
    assert.equal(HOME_CLAIMS.projectsDelivered, 500);

    // Mounted by the strip, which sits after the hero on the page.
    assert.match(read(STRIP), /<DiscoveryProjectsCounter \/>/);
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.ok(
      page.indexOf("<DiscoveryHeroSlider") < page.indexOf("<DiscoveryTrustStrip"),
      "the counter's strip must come after the hero"
    );
    // And NOT inside the hero.
    assert.doesNotMatch(read(HERO), /DiscoveryProjectsCounter|DiscoveryHeroTrustBar/);
  });

  test("the strip leads with manufacturing and process, no suppressed figure", () => {
    const ids = DISCOVERY_TRUST_STRIP_ITEMS.map((item) => item.id);
    assert.deepEqual(ids.slice(0, 3), ["manufacturing", "pipeline", "consultation"]);
    for (const item of DISCOVERY_TRUST_STRIP_ITEMS) {
      assert.doesNotMatch(item.label, /4\.9|200\+|98%|100% Custom|10-Year/);
    }
    // The projects figure is rendered by the counter, not tickered past.
    assert.ok(!ids.includes("projects"));
  });
});

/* ========================================================================== */
/* 2. The hero is images and nothing else                                      */
/* ========================================================================== */

describe("the hero carries images, dots and no words", () => {
  const hero = read(HERO);
  const heroCode = code(hero);

  test("no headline, kicker, lede, badge, CTA or trust bar", () => {
    for (const gone of [
      "od-disc-hero__headline",
      "od-disc-kicker",
      "od-disc-hero__lede",
      "od-disc-hero__badge",
      "od-disc-hero__panel",
      "od-disc-hero__copy",
      "od-disc-hero__layout",
      "DiscoveryHeroTrustBar",
      "slide.headline",
      "slide.kicker",
      "slide.lede",
    ]) {
      assert.ok(!heroCode.includes(gone), `the hero must not render ${gone}`);
    }
  });

  test("no prev/next arrows", () => {
    assert.ok(!heroCode.includes("od-disc-hero__arrow"));
    assert.ok(!heroCode.includes("Previous slide"));
    assert.ok(!heroCode.includes("Next slide"));
  });

  test("the images and their focal-point cropping survive", () => {
    assert.match(heroCode, /DISCOVERY_HERO_SLIDES\.map/);
    assert.match(heroCode, /getDiscoveryAsset\(slide\.assetKey\)/);
    assert.match(heroCode, /--od-hero-focal/);
    assert.match(heroCode, /--od-hero-focal-mobile/);
    assert.match(heroCode, /<Image/);
    // Decoration, so no alt text is invented for it.
    assert.match(heroCode, /alt=""/);
  });

  test("a visually hidden H1 keeps the page's identity", () => {
    assert.match(hero, /<h1 id="od-disc-hero-title" className="od-sr-only">/);
    assert.match(hero, /DISCOVERY_HERO_PAGE_TITLE/);
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    assert.match(copy, /export const DISCOVERY_HERO_PAGE_TITLE/);
  });

  test("autoplay is 5-6 seconds and reduced motion still pauses it", () => {
    const match = heroCode.match(/const AUTOPLAY_MS = (\d+);/);
    assert.ok(match);
    const ms = Number(match![1]);
    assert.ok(ms >= 5000 && ms <= 6000, `autoplay ${ms}ms must be 5-6s`);
    assert.match(heroCode, /prefers-reduced-motion/);
    assert.match(heroCode, /reducedMotion \|\| hovered \|\| focusWithin \|\| touchPaused/);
    // The progress bar must not claim a different duration than the timer.
    assert.match(read(DISCOVERY_CSS), /od-disc-hero-progress 5\.5s/);
  });

  test("swipe and dots remain the way to move between images", () => {
    assert.match(heroCode, /onTouchStart/);
    assert.match(heroCode, /SWIPE_THRESHOLD/);
    assert.match(heroCode, /od-disc-hero__dot/);
    // Buttons in a labelled group, not tabs — there are no panels to control.
    assert.match(heroCode, /role="group"/);
    assert.doesNotMatch(heroCode, /role="tab"/);
    assert.doesNotMatch(heroCode, /aria-selected/);
    assert.match(heroCode, /aria-pressed=/);
    // Dots are labelled by position; the headlines they used to name are gone.
    assert.match(heroCode, /Show image \$\{index \+ 1\} of \$\{slideCount\}/);
  });

  test("the hero is sized as a picture, at both ends", () => {
    const css = read(DISCOVERY_CSS);
    const at = css.indexOf(".od-disc-hero.od-disc-hero--imageOnly {");
    assert.ok(at > 0, "the image-only hero needs its own sizing rule");
    const block = css.slice(at, css.indexOf("}", at));
    assert.match(block, /min-height: clamp\(18rem, 56vh, 34rem\)/);
    assert.match(css, /\.od-disc-hero\.od-disc-hero--imageOnly \{\s*\n\s*min-height: clamp\(24rem, 68vh, 42rem\)/);
  });
});

/* ========================================================================== */
/* 3. WhatsApp comes from configuration, never from a literal                  */
/* ========================================================================== */

describe("the WhatsApp CTA is configured, validated, or absent", () => {
  test("no phone number is hard-coded anywhere in the contact module", () => {
    const contact = read(CONTACT);
    assert.doesNotMatch(contact, /wa\.me\/\d/);
    assert.doesNotMatch(contact, /\+\d{8,}/);
    assert.match(contact, /NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164/);
  });

  test("only a valid E.164 number produces a link", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "   ",
      "9876543210", // no country code
      "+0123456789", // leading zero
      "+1234567", // too short
      "not-a-number",
      "+12345678901234567", // too long
    ]) {
      assert.equal(getPublicWhatsAppHref(bad), null, String(bad));
      assert.equal(isPublicWhatsAppConfigured(bad), false, String(bad));
    }
  });

  test("a valid number normalises to a wa.me URL with the service prefill", () => {
    const href = getPublicWhatsAppHref("+919876543210");
    assert.equal(
      href,
      `https://wa.me/919876543210?text=${encodeURIComponent(
        PUBLIC_WHATSAPP.prefilledMessage
      )}`
    );
    // Human spacing is tolerated; the stored form is digits only.
    assert.equal(normalizeWhatsAppE164("+91 98765 43210"), "919876543210");
    assert.equal(getPublicWhatsAppHref("+91 98765-43210"), href);
  });

  test("the prefill is a service enquiry, not marketing", () => {
    assert.equal(
      PUBLIC_WHATSAPP.prefilledMessage,
      "Hi ONEDECORE, I'd like to discuss my home interiors."
    );
    assert.doesNotMatch(PUBLIC_WHATSAPP.prefilledMessage, /offer|discount|deal/i);
  });

  test("the dock renders WhatsApp only when a link exists — never dead", () => {
    const dock = code(read(DOCK));
    assert.match(dock, /const whatsappHref = getPublicWhatsAppHref\(\)/);
    assert.match(dock, /\{whatsappHref \? \(/);
    assert.match(dock, /\) : null\}/);
    assert.match(dock, /href=\{whatsappHref\}/);
  });

  test("both dock actions carry stable hooks and nothing reads them yet", () => {
    const dock = read(DOCK);
    assert.match(dock, /data-conversion-action="whatsapp-click"/);
    assert.match(dock, /data-conversion-action="consultation-sticky"/);
    for (const tag of ["gtag(", "fbq(", "dataLayer", "googletagmanager"]) {
      assert.ok(!dock.includes(tag), `L1.1 must not add ${tag}`);
    }
  });

  test("the dock buttons clear 48px and respect the safe area", () => {
    const css = read(DISCOVERY_CSS);
    /*
     * Two media queries redeclare this selector, so neither the first nor the
     * last occurrence is the base rule. The base one is the unindented one.
     */
    const base = /^\.od-disc-dock__btn \{[^}]*\}/m.exec(css);
    assert.ok(base, "the base dock button rule must exist");
    assert.match(base![0], /min-height: 48px/);
    assert.match(css, /padding-bottom: max\(0\.55rem, env\(safe-area-inset-bottom\)\)/);
    // Desktop: a floating pill rather than a full-width bar.
    assert.match(css, /@media \(min-width: 1024px\) \{\s*\n\s*\.od-disc-dock \{/);
  });
});

/* ========================================================================== */
/* 4. One compact card                                                         */
/* ========================================================================== */

describe("the consultation form is a single step with one dropdown", () => {
  const form = read(FORM);
  const formCode = code(form);

  test("no step counter, no step state, no auto-advance", () => {
    for (const gone of [
      "currentStep",
      "CONSULTATION_STEPS",
      "data-od-consult-step",
      "Step {",
    ]) {
      assert.ok(!formCode.includes(gone), `the form must not carry ${gone}`);
    }
    assert.match(form, /data-od-consult-layout="single-step"/);
  });

  test("the qualifier question is gone from the form entirely", () => {
    for (const gone of [
      "setQualifierCode",
      "od-consult-qualifier",
      "data-od-qualifier-kind",
      "qualifier.options",
      "qualifier.placeholder",
      "qualifier.label",
    ]) {
      assert.ok(!formCode.includes(gone), `the form must not render ${gone}`);
    }
    /*
     * The one surviving mention is the adapter argument, and it is explicitly
     * null — the form asks nothing, so it sends nothing.
     */
    assert.match(formCode, /qualifierCode: null,/);
    assert.equal((formCode.match(/qualifierCode/g) ?? []).length, 1);
  });

  test("exactly one service dropdown, with the three real services", () => {
    assert.equal((formCode.match(/<select/g) ?? []).length, 1);
    assert.match(formCode, /id="od-consult-service"/);
    assert.deepEqual(
      CONSULTATION_SERVICE_OPTIONS.map((option) => option.label),
      ["Complete Home Interiors", "Modular Kitchen", "Custom Wardrobe"]
    );
    const copy = read("src/features/lead-intake/public/consultation-copy.ts");
    assert.match(copy, /CONSULTATION_SERVICE_LABEL = "What do you need\?"/);
  });

  test("contact fields and the submit are ungated", () => {
    // They used to be hidden until a qualifier was chosen.
    assert.doesNotMatch(formCode, /\{qualifierCode \? \(/);
    assert.match(formCode, /<fieldset className="od-consult-form__group">/);
    assert.match(formCode, /type="submit"/);
    assert.equal((formCode.match(/type="submit"/g) ?? []).length, 1);
    assert.match(form, /Get Free Design Consultation/);
  });

  test("the Indian mobile UX and paste normalisation survive", () => {
    assert.match(form, /data-od-lead-phone-ux="national-10"/);
    assert.match(formCode, /type="tel"/);
    assert.match(formCode, /inputMode="numeric"/);
    assert.match(formCode, /autoComplete="tel-national"/);
    assert.match(formCode, /acceptIndianMobileInput/);
    assert.match(formCode, /onPaste=/);
  });

  test("locality is optional and the note stays collapsed behind a toggle", () => {
    assert.match(form, /locality <span>\(optional\)<\/span>/i);
    assert.match(formCode, /noteOpen/);
    assert.match(formCode, /od-consult-form__note-toggle/);
  });

  test("all three consents and both legal links are preserved", () => {
    for (const kept of [
      "serviceEnquiryConsent",
      "servicePhoneConsent",
      "whatsappConsent",
      "LEAD_FORM_PRIVACY_PATH",
      "LEAD_FORM_TERMS_PATH",
    ]) {
      assert.ok(formCode.includes(kept), `the form must keep ${kept}`);
    }
    for (const forbidden of ["marketingConsent", "promotionalConsent"]) {
      assert.ok(!form.includes(forbidden), `must not fabricate ${forbidden}`);
    }
  });

  test("attribution, idempotency and the honeypot are untouched", () => {
    for (const kept of [
      "collectLeadFormAttribution",
      "fingerprintLeadPayload",
      "getOrCreateKey",
      "LEAD_FORM_HONEYPOT_FIELD",
      "formStartedAt",
    ]) {
      assert.ok(formCode.includes(kept), `the form must keep ${kept}`);
    }
  });

  test("preview and copy-only never reach the network; active submits", () => {
    assert.match(formCode, /const canNetworkSubmit = mode === "active"/);
    assert.match(formCode, /if \(!canNetworkSubmit\)/);
    const capture = code(
      read("src/features/public-site/discovery/HomeConsultationCapture.tsx")
    );
    assert.match(capture, /mode === "copy-only"/);
    assert.match(capture, /return null/);
  });

  test("the success message confirms receipt and promises nothing", () => {
    const copy = read("src/features/lead-intake/public/consultation-copy.ts");
    assert.match(
      copy,
      /"Thank you\. We received your consultation request and will follow up\."/
    );
    assert.match(formCode, /CONSULTATION_SUCCESS_MESSAGE/);
  });
});

/* ========================================================================== */
/* 5. The qualifier is optional — and still strict when it appears             */
/* ========================================================================== */

describe("an unasked qualifier is absent, not invented", () => {
  const attribution: LeadFormAttribution = { landingPath: "/" };
  const base = {
    name: "Asha Menon",
    mobile: "9876543210",
    consent: { serviceEnquiry: true, servicePhone: true } as const,
    attribution,
    antiBot: { website: "", formStartedAt: "2026-09-07T00:00:00.000Z" },
    idempotencyKey: "k-1",
  };

  test("a body with no qualifier is accepted and carries none", () => {
    const result = consultationToLeadRequest({
      ...base,
      service: "modular-kitchens",
      qualifierCode: null,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal("qualifier" in result.body.requirements, false);
    // And nothing else was invented to fill the gap.
    for (const unasked of ["property", "timeline", "rooms", "budgetComfort", "estimate"]) {
      assert.equal(unasked in result.body.requirements, false, unasked);
    }
  });

  test("a supplied qualifier is REFUSED, however valid it looks", () => {
    /*
     * The pre-merge correction upgraded this from optional to forbidden. The
     * form asks no service-specific question, so a qualifier in the payload
     * came from a stale or tampered client — and `public-consult-v2` says so in
     * both layers rather than quietly dropping it.
     */
    for (const code of ["new-kitchen", "apartment-3bhk", "made-up"]) {
      const result = consultationToLeadRequest({
        ...base,
        service: "modular-kitchens",
        qualifierCode: code,
      });
      assert.equal(result.ok, false, `${code} must be refused`);
      if (result.ok) continue;
      assert.ok(result.fields.includes("requirements.qualifier"));
    }
  });

  test("the service itself is still required", () => {
    const result = consultationToLeadRequest({
      ...base,
      service: null,
      qualifierCode: null,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.service"));
  });

  test("the server refuses it under v2 and requires it under v1", () => {
    const server = code(read(SERVER));
    // v2 and v3 share every prohibition, so the server states them once
    // against a flag both versions set.
    assert.match(server, /if \(forbidsQualifier\) \{/);
    assert.match(server, /const forbidsQualifier =/);
    // v1's strict branch survives underneath.
    assert.match(server, /isAllowedLeadQualifier\(kind, code\)/);
    assert.match(server, /LEAD_QUALIFIER_KIND_BY_SERVICE\[service as LeadServiceCode\] !== kind/);
    // Unasked fields are still rejected rather than ignored.
    assert.match(server, /"timeline",\s*\n\s*"rooms",/);
  });

  test("the adapter emits v2 and forbids rather than loosens", () => {
    const adapter = read(ADAPTER);
    assert.match(adapter, /plannerVersion: PUBLIC_CONSULT_V2_PLANNER_VERSION/);
    assert.match(adapter, /IT IS FORBIDDEN/);
    assert.doesNotMatch(adapter, /hasQualifier/);
  });
});

/* ========================================================================== */
/* 6. L1.1 introduced no tracking                                              */
/* ========================================================================== */

describe("no measurement layer arrived with this change", () => {
  test("no tag, pixel or container on any touched surface", () => {
    for (const rel of [HERO, COUNTER, STRIP, DOCK, CONTACT, FORM]) {
      const source = read(rel);
      for (const tag of [
        "googletagmanager",
        "connect.facebook.net",
        "www.google-analytics.com",
        "gtag(",
        "fbq(",
        "dataLayer",
        "GTM-",
        "next/script",
      ]) {
        assert.ok(!source.includes(tag), `${rel} must not reference ${tag}`);
      }
    }
  });

  test("attribution collection is still read-at-submit, not persisted", () => {
    const attribution = code(
      read("src/features/lead-intake/public/lead-form-attribution.ts")
    );
    assert.doesNotMatch(attribution, /localStorage|sessionStorage|document\.cookie/);
  });
});
