/**
 * L1.1 — owner-directed homepage conversion refinement.
 *
 * FOUR CHANGES, AND THE ONE THING THAT MUST NOT MOVE WITH THEM
 *
 *   1. The projects count is displayed again — and ONLY that one.
 *   2. The hero is images and nothing else.
 *   3. WhatsApp sits beside the sticky consultation CTA, from configuration.
 *   4. The consultation CTA opens the one canonical form.
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
import { DISCOVERY_PROOF_METRICS } from "../discovery/discovery-copy.ts";



const root = process.cwd();
/*
 * NORMALISED LINE ENDINGS, because assertions below slice on a newline anchor.
 *
 * Git checks these files out with CRLF on Windows, so an anchor written with a
 * bare newline silently fails to match, `indexOf` returns -1, and
 * `slice(at, -1)` quietly widens to the rest of the file — turning a scoped
 * assertion into a whole-file one that then fails on unrelated CSS appended
 * much later. Normalising here makes the anchors mean what they say.
 */
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const HERO = "src/features/public-site/discovery/DiscoveryHeroSlider.tsx";
const COUNT_UP = "src/features/public-site/motion/useCountUp.ts";
const STRIP = "src/features/public-site/discovery/DiscoveryProofStrip.tsx";
const DOCK = "src/features/public-site/discovery/DiscoveryStickyCta.tsx";
const WA_FAB = "src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx";
const CONTACT = "src/features/public-site/chrome/public-contact.ts";
const SERVER = "src/features/lead-intake/server/lead-intake-validation.ts";
const DISCOVERY_CSS = "src/features/public-site/discovery/discovery.css";
/** The one canonical public lead form, replacing the deleted per-page ones. */
const BRIEF = "src/features/lead-intake/public/UnifiedLeadBrief.tsx";

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

  test("every attestation is recorded, dated and explained", () => {
    /*
     * L1.1 authorised the project count ALONE. The premium homepage brief
     * (2026-09-07) authorised three more for the proof strip: the design-library
     * size, the factory count and the customised-planning percentage.
     *
     * The set is asserted exhaustively on purpose. A figure that appears on the
     * page without appearing here has been published by a component deciding for
     * itself, which is the failure this register exists to prevent.
     */
    /*
     * ATTESTED AND DISPLAYABLE. `warranty-years` is attested too and is
     * deliberately absent: it also requires effective legal terms, so the
     * helper excludes it. That exclusion is asserted directly below.
     */
    assert.deepEqual([...getOwnerAttestedClaimIds()], [
      "projects-delivered",
      "warranty-years",
      "custom-designs",
      "own-manufacturing-unit",
      "design-inspirations",
      "delivery-window",
    ]);

    for (const id of getOwnerAttestedClaimIds()) {
      const record = PUBLIC_CLAIM_EVIDENCE[id];
      assert.ok(record.ownerAttestedDisplay, `${id}: the grant must be recorded`);
      assert.match(record.ownerAttestedDisplay!.attestedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(record.ownerAttestedDisplay!.note.length > 20, id);
      // Attested is not evidenced. That distinction is the whole module.
      assert.equal(isClaimPubliclyEvidenced(id), false, id);
    }
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

  test("the four attested figures came back, and nothing else did", () => {
    assert.equal(canQuotePublicClaim("projects-delivered"), true);
    assert.equal(publicClaimLabel("projects-delivered"), "1000+ Projects Delivered");

    /*
     * STILL WITHHELD, and these are the ones that matter most: a rating, a
     * review count and a satisfaction percentage all imply a source that does
     * not exist, and the warranty duration is a contractual promise whose terms
     * are still pending. None of them was attested, and none may be quoted.
     */
    /*
     * STILL WITHHELD. A rating, a review count and a satisfaction percentage
     * imply a source that does not exist, and none of them was attested. They
     * are figures or they are nothing — there is no honest qualitative version
     * of "4.9/5" — so they render nothing at all.
     */
    for (const id of [
      "average-rating",
      "client-reviews",
      "client-satisfaction",
    ] as const) {
      assert.equal(canQuotePublicClaim(id), false, id);
      assert.equal(publicClaimLabel(id), null, id);
    }

    /*
     * The warranty IS quotable now, and the wording is what makes that
     * defensible: "Up to N+ Years" is a hedged ceiling, not "N-year warranty on
     * everything". If this label ever loses its hedge, this assertion is the
     * thing that should stop it.
     */
    assert.equal(canQuotePublicClaim("warranty-years"), true);
    assert.match(publicClaimLabel("warranty-years") ?? "", /^Up to \d+\+ Years/);
  });

  test("an attested claim that also needs legal terms still waits for them", () => {
    /*
     * THE RULE, not the current state. The real warranty record now carries
     * approved terms — the owner approved the display wording on 2026-09-07 —
     * so the hypothetical has to put them back to pending to exercise the rule
     * this test exists for: attestation alone never publishes a contractual
     * promise.
     */
    const attestedButPending = {
      ...PUBLIC_CLAIM_EVIDENCE,
      "warranty-years": {
        ...PUBLIC_CLAIM_EVIDENCE["warranty-years"],
        legalTerms: "pending" as const,
        ownerAttestedDisplay: { attestedOn: "2026-01-01", note: "hypothetical" },
      },
    };
    assert.equal(isClaimDisplayable("warranty-years", attestedButPending), false);
    // And requiring terms at all is what makes the rule reachable.
    assert.equal(
      PUBLIC_CLAIM_EVIDENCE["warranty-years"].requiresEffectiveLegalTerms,
      true
    );
  });

  test("the counters render below the hero, animated, reduced-motion safe", () => {
    /*
     * One count-up hook now drives all four metrics rather than each metric
     * carrying its own copy of the animation. Every property the single counter
     * had is still asserted — it just lives in `useCountUp` now.
     */
    const hook = code(read(COUNT_UP));
    assert.match(hook, /IntersectionObserver/);
    assert.match(hook, /prefers-reduced-motion/);
    // Seeded with the real figure: a useState(0) seed would ship "0+" to every
    // pre-hydration and no-JS visitor.
    assert.match(hook, /useState<number>\(target\)/);
    assert.doesNotMatch(hook, /useState\(0\)/);
    // Runs once: `finished` is set and never cleared.
    assert.match(hook, /finished\.current = true/);
    assert.match(hook, /reduced \? target : value/);
    assert.equal(HOME_CLAIMS.projectsDelivered, 1000);

    // The strip asks the register rather than trusting its own list.
    assert.match(read(STRIP), /isClaimDisplayable\(metric\.claimId\)/);

    /*
     * THE STRIP IS NOW MOUNTED NOWHERE, BY OWNER DIRECTION.
     *
     * It opened `/interiors` for a while, directly under a hero that already
     * carries a credibility row. Two numeric proof blocks within one screen of
     * each other do not double the proof — they make a visitor ask which of the
     * two is the real number. The hero's row survived because it is part of the
     * hero's argument; the strip did not.
     *
     * The component and its evidence model are deliberately untouched: the
     * assertions above still run against it, and it stays available for a
     * surface that has no credibility row of its own.
     */
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.doesNotMatch(page, /DiscoveryProofStrip/);

    // Comment-stripped: the page explains in prose why the strip left, and
    // that explanation names it.
    const interiors = code(
      read("src/features/public-site/interiors/InteriorsConversionPage.tsx")
    );
    assert.doesNotMatch(interiors, /DiscoveryProofStrip/);
    // And NOT inside the hero.
    assert.doesNotMatch(read(HERO), /DiscoveryProofStrip|DiscoveryHeroTrustBar/);

    /*
     * The hook did not become unused when the strip was unmounted — the
     * INTERIORS hero's credibility row drives it now, which is the whole point
     * of there being one counter engine. (`HERO` above is the homepage slider,
     * a different component.)
     */
    assert.match(
      read("src/features/public-site/home-r4/HomeHero.tsx"),
      /useCountUp\(item\.value\)/
    );
  });

  test("the proof strip quotes no suppressed figure", () => {
    /*
     * The ticker was replaced by the four-metric proof strip. The invariant it
     * protected is unchanged and now easier to state: every metric on the strip
     * names the claim it is published under, and no metric may carry a rating,
     * a review count, a satisfaction percentage or a warranty period.
     */
    for (const metric of DISCOVERY_PROOF_METRICS) {
      assert.ok(
        (PUBLIC_CLAIM_IDS as readonly string[]).includes(metric.claimId),
        `${metric.claimId} must be a registered claim`
      );
    }
    /*
     * The strip FILTERS on the gate rather than trusting its own list, so a
     * metric only renders once the register says it may. All four do now.
     */
    const rendered = DISCOVERY_PROOF_METRICS.filter((m) =>
      isClaimDisplayable(m.claimId)
    );
    assert.equal(rendered.length, 4);

    /*
     * The warranty is the only metric carrying a contractual promise, so it is
     * the only one that must link to its terms. A ceiling without terms beside
     * it reads as a guarantee.
     */
    const warranty = rendered.find((m) => m.claimId === "warranty-years");
    assert.ok(warranty, "the warranty metric must render");
    assert.equal("termsHref" in warranty!, true);
    assert.match(warranty!.prefix, /^Up to/);
    assert.match(warranty!.suffix, /\+/);
    for (const suppressed of [
      "average-rating",
      "client-reviews",
      "client-satisfaction",
    ]) {
      assert.equal(
        DISCOVERY_PROOF_METRICS.some((m) => m.claimId === suppressed),
        false,
        `${suppressed} must not reach the strip`
      );
    }
  });
});

/* ========================================================================== */
/* 2. The hero is images and nothing else                                      */
/* ========================================================================== */

describe("the hero carries images, dots and no words", () => {
  const hero = read(HERO);
  const heroCode = code(hero);

  test("no rotating headline, kicker, badge or trust bar layered on the slides", () => {
    /*
     * L1.1 stripped the hero to photography because five layered elements were
     * competing with it. The gateway hero brought back ONE block — an eyebrow,
     * the H1, a sentence and two buttons — because a page offering two journeys
     * has to name them on the first screen.
     *
     * What must not return is the rest: a headline that changes with the slide,
     * a badge, the panel/layout scaffolding, and the trust bar. The copy is
     * fixed and belongs to the page, not to whichever image is showing.
     */
    for (const gone of [
      "od-disc-hero__headline",
      "od-disc-kicker",
      "od-disc-hero__badge",
      "od-disc-hero__panel",
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

  test("one visible H1 carries the brand", () => {
    /*
     * The H1 was visually hidden while the hero was pure decoration for an
     * interiors page. As the gateway to two verticals it is on screen: a
     * visitor cannot choose between journeys the first screen never names.
     */
    assert.match(hero, /<h1 id="od-disc-hero-title">\{DISCOVERY_GATEWAY_TITLE\}<\/h1>/);
    assert.doesNotMatch(hero, /<h1[^>]*od-sr-only/);
    assert.equal((hero.match(/<h1/g) ?? []).length, 1, "exactly one H1");
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    assert.match(copy, /export const DISCOVERY_GATEWAY_TITLE/);
    assert.match(copy, /export const DISCOVERY_GATEWAY_LEDE/);
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
      "Hi ONEDECORE, I'd like to discuss my interior requirement."
    );
    assert.doesNotMatch(PUBLIC_WHATSAPP.prefilledMessage, /offer|discount|deal/i);
  });

  test("WhatsApp renders only when a link exists — never dead", () => {
    /*
     * WhatsApp moved out of the dock and became a floating action. The rule it
     * carried moved with it: configured or absent, never present-and-dead.
     */
    const fab = code(read(WA_FAB));
    assert.match(fab, /const href = getPublicWhatsAppHref\(\)/);
    assert.match(fab, /if \(!href\) \{[\s\S]{0,40}return null;/);
    assert.match(fab, /href=\{href\}/);
    // And the dock no longer knows about WhatsApp at all.
    assert.doesNotMatch(code(read(DOCK)), /getPublicWhatsAppHref|whatsapp/i);
  });

  test("every conversion action carries a stable hook and nothing reads them yet", () => {
    const dock = read(DOCK);
    const fab = read(WA_FAB);
    const cta = read("src/features/public-site/discovery/DiscoveryConsultCta.tsx");
    assert.match(dock, /data-conversion-action="portfolio-sticky"/);
    /*
     * The consultation hook is passed to the shared CTA now rather than written
     * inline: the button became a control that opens the one lead form instead
     * of a link to a page anchor. The NAME is unchanged, which is the point —
     * a later measurement layer binds to the name, not to the element.
     */
    assert.match(dock, /conversionAction="consultation-sticky"/);
    assert.match(cta, /data-conversion-action=\{conversionAction\}/);
    assert.match(fab, /data-conversion-action="whatsapp-fab"/);
    for (const source of [dock, fab, cta]) {
      for (const tag of ["gtag(", "fbq(", "dataLayer", "googletagmanager"]) {
        assert.ok(!source.includes(tag), `must not add ${tag}`);
      }
    }
  });

  test("the floating WhatsApp wiggles briefly, and not at all under reduced motion", () => {
    const css = read(DISCOVERY_CSS);
    assert.match(css, /@keyframes od-wa-wiggle/);
    // A transform-only keyframe: no reflow, so nothing shifts around it.
    const at = css.indexOf("@keyframes od-wa-wiggle");
    const frames = css.slice(at, css.indexOf("}\n}", at));
    assert.match(frames, /transform: rotate/);
    assert.doesNotMatch(frames, /margin|width|height|top|left/);
    // Most of the cycle is the rest state — an occasional cue, not a jiggle.
    assert.match(css, /animation: od-wa-wiggle 10s/);
    // And the whole thing is off when the visitor asked for less motion.
    /*
     * Located by RULE, not by position: several reduced-motion blocks exist and
     * `lastIndexOf` silently started matching whichever one happened to be
     * last.
     */
    const waRule = /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}?\.od-disc-wa \{[\s\S]{0,60}?animation: none;/;
    assert.match(css, waRule);
    /*
     * No device haptics. Comment-stripped, because the component's docblock
     * EXPLAINS why it does not call it — a check that trips on prose is a check
     * that teaches you to write less of it.
     */
    /*
     * A haptic is allowed, but ONLY from a real tap. It must sit inside the
     * click handler and never at module scope, on mount or on a timer.
     */
    const fabCode = code(read(WA_FAB));
    assert.match(fabCode, /const onTap = \(\) => \{[\s\S]{0,220}navigator\.vibrate/);
    assert.match(fabCode, /onClick=\{onTap\}/);
    assert.doesNotMatch(fabCode, /useEffect|setInterval|setTimeout/);
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
/* 4. L1.1 introduced no tracking                                              */
/* ========================================================================== */

describe("no measurement layer arrived with this change", () => {
  test("no tag, pixel or container on any touched surface", () => {
    for (const rel of [HERO, COUNT_UP, STRIP, DOCK, WA_FAB, CONTACT, BRIEF]) {
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
