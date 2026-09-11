/**
 * Interiors contact actions — header cleanup, Call Now, and the WhatsApp FAB.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 * Three things that are easy to break by accident and expensive to notice:
 *
 *  1. A dead CTA. Both contact channels come from `NEXT_PUBLIC_*` variables
 *     that are unset in most environments, so "renders nothing" is the correct
 *     behaviour far more often than "renders a button". A regression here does
 *     not throw and does not fail a build — it ships a button that opens
 *     nothing on the one surface where a visitor is trying to reach a human.
 *
 *  2. A second WhatsApp implementation. Two copies would be two places to keep
 *     the validated href, the reduced-motion handling and the tap haptic in
 *     step, and the copy nobody is looking at is the one that drifts.
 *
 *  3. Calling and chat quietly becoming the same setting. They share a number
 *     today. The day they do not, a shortcut taken here would dial the wrong
 *     line, and the failure would be invisible from the code.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  getPublicPhoneHref,
  getPublicWhatsAppHref,
  isPublicPhoneConfigured,
  normalizeE164Digits,
  normalizeWhatsAppE164,
  PUBLIC_PHONE,
  PUBLIC_PHONE_E164_ENV,
} from "../chrome/public-contact.ts";
import { ONEDECORE_ENV_CONTRACT } from "../../../config/env-contract.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Source with comments stripped, so prose about a pattern is not the pattern. */
function code(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SHELL = "src/features/public-site/home-r4/HomeShell.tsx";
const STICKY = "src/features/public-site/home-r4/HomeStickyActions.tsx";
const CONTACT = "src/features/public-site/chrome/public-contact.ts";
const INTERIORS = "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const HOMEPAGE = "src/features/public-site/discovery/DiscoveryHomePage.tsx";
const FAB = "src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx";

/* -------------------------------------------------------------------------- */
/* 1. The phone channel is configuration, validated                            */
/* -------------------------------------------------------------------------- */

describe("the public phone number is configured, validated, or absent", () => {
  test("a valid E.164 number becomes an exact tel: href", () => {
    assert.equal(getPublicPhoneHref("+917720000553"), "tel:+917720000553");
    assert.equal(isPublicPhoneConfigured("+917720000553"), true);
  });

  test("tel: keeps the leading +, wa.me drops it", () => {
    /*
     * Not cosmetic. The international prefix is what lets a handset dial the
     * number from outside India, and `wa.me` treats a `+` in the path as part
     * of the number and fails to resolve it. One validator, two renderings.
     */
    assert.equal(getPublicPhoneHref("+917720000553"), "tel:+917720000553");
    assert.match(
      getPublicWhatsAppHref("+917720000553") ?? "",
      /^https:\/\/wa\.me\/917720000553\?text=/
    );
  });

  test("human spacing and dashes normalise the same way for both channels", () => {
    assert.equal(getPublicPhoneHref("+91 77200 00553"), "tel:+917720000553");
    assert.equal(getPublicPhoneHref(" +91-77200-00553 "), "tel:+917720000553");
    assert.equal(normalizeE164Digits("+91 (77200) 00553"), "917720000553");
  });

  test("anything that is not a plausible E.164 number yields null", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "   ",
      "917720000553", // no leading +
      "+0917720000553", // E.164 forbids a leading zero
      "+9177", // too short
      "+9177200005531234567", // too long
      "+91772000055a",
      "tel:+917720000553",
      "wa.me/917720000553",
      42 as unknown as string,
    ]) {
      assert.equal(getPublicPhoneHref(bad), null, String(bad));
      assert.equal(isPublicPhoneConfigured(bad as string), false, String(bad));
    }
  });

  test("the existing WhatsApp helper is unchanged by the refactor", () => {
    // `normalizeWhatsAppE164` is now an alias over the shared validator. Its
    // contract — digits without the `+`, or null — must be exactly what it was.
    assert.equal(normalizeWhatsAppE164("+91 98765 43210"), "919876543210");
    assert.equal(normalizeWhatsAppE164("919876543210"), null);
    assert.equal(normalizeWhatsAppE164(undefined), null);
    assert.equal(
      getPublicWhatsAppHref("+919876543210"),
      getPublicWhatsAppHref("+91 98765-43210")
    );
    assert.equal(getPublicWhatsAppHref("+0919876543210"), null);
  });

  test("calling is not derived from the WhatsApp variable", () => {
    /*
     * The two numbers match today. Reading one from the other would encode
     * that coincidence as a rule, and a landline published for calls would
     * then silently redirect chat — a failure with no visible symptom.
     */
    const source = code(read(CONTACT));
    const phoneFn = source.slice(source.indexOf("export function getPublicPhoneHref"));
    assert.doesNotMatch(phoneFn, /WHATSAPP/);
    assert.match(phoneFn, /NEXT_PUBLIC_ONEDECORE_PHONE_E164/);
    assert.equal(PUBLIC_PHONE_E164_ENV, "NEXT_PUBLIC_ONEDECORE_PHONE_E164");
  });

  test("no number is invented in the contact module", () => {
    const source = read(CONTACT);
    assert.doesNotMatch(source, /tel:\+\d/);
    assert.doesNotMatch(source, /\+\d{8,}/);
  });

  test("the phone key is registered in the environment contract", () => {
    const entry = ONEDECORE_ENV_CONTRACT.find(
      (row) => row.name === "NEXT_PUBLIC_ONEDECORE_PHONE_E164"
    );
    assert.ok(entry, "NEXT_PUBLIC_ONEDECORE_PHONE_E164 must be registered");
    assert.equal(entry.scope, "public");
    assert.equal(entry.sensitivity, "public");
    // Absent is a supported state: the CTA is simply not rendered.
    assert.equal(entry.lifecycle, "optional");
    assert.equal(entry.inEnvExample, true);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. The Interiors header drops the consultation pill                         */
/* -------------------------------------------------------------------------- */

describe("the Interiors header carries navigation, not a second CTA", () => {
  test("the shell turns the consultation pill off rather than forking the header", () => {
    const shell = code(read(SHELL));
    assert.match(shell, /showConsultation=\{false\}/);
    // Still the shared header, still the interiors current state, still gated.
    assert.match(shell, /<PublicSiteHeader/);
    assert.match(shell, /current="interiors"/);
    assert.match(shell, /shopEnabled=\{shopEnabled\}/);
  });

  test("the header still supports the control it is being given", () => {
    const header = code(read("src/features/public-site/chrome/PublicSiteHeader.tsx"));
    assert.match(header, /showConsultation = true/);
    assert.match(header, /showConsultation \?/);
  });

  test("wordmark, navigation and drawer are untouched", () => {
    const shell = code(read(SHELL));
    assert.match(shell, /PublicSiteFooter/);
    const header = code(read("src/features/public-site/chrome/PublicSiteHeader.tsx"));
    assert.match(header, /OneDecoreWordmark/);
    assert.match(header, /od-site-header__toggle/);
    assert.match(header, /od-site-header__drawer/);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. The sticky bar: Free Consultation | Call Now                             */
/* -------------------------------------------------------------------------- */

describe("the Interiors sticky bar offers consultation and a call", () => {
  test("Call Now is a real anchor to the configured number", () => {
    const sticky = code(read(STICKY));
    assert.match(sticky, /getPublicPhoneHref/);
    assert.match(sticky, /const callHref = getPublicPhoneHref\(\)/);
    assert.match(sticky, /href=\{callHref\}/);
    assert.match(sticky, /data-conversion-action="sticky-call"/);
    // A same-tab tel anchor: no target, no router Link, no click handler.
    assert.doesNotMatch(sticky, /href=\{callHref\}[\s\S]{0,220}target=/);
  });

  test("the number is never written into the markup", () => {
    const sticky = read(STICKY);
    assert.doesNotMatch(sticky, /tel:\+\d/);
    assert.doesNotMatch(sticky, /\+\d{8,}/);
  });

  test("a missing or invalid number renders no dead button", () => {
    const sticky = code(read(STICKY));
    // The anchor is behind the href, not merely styled differently.
    assert.match(sticky, /\{callHref \?\s*\(/);
    assert.match(sticky, /\)\s*:\s*null\}/);
  });

  test("the Estimate shortcut is gone from the bar but not from the page", () => {
    const sticky = code(read(STICKY));
    assert.doesNotMatch(sticky, /sticky-estimate/);
    assert.doesNotMatch(sticky, /estimateHref/);
    /*
     * The estimator section itself still renders on /interiors. It is `R5Budget`
     * since the retention redesign — the shortcut was removed because the
     * section is reachable by scrolling, and that reasoning only holds while
     * some budget section is on the page.
     */
    assert.match(code(read(INTERIORS)), /<R5Budget \/>/);
  });

  test("the primary consultation action is untouched", () => {
    const sticky = code(read(STICKY));
    assert.match(sticky, /data-conversion-action="sticky-continue"/);
    assert.match(sticky, /openPlanner\(getNextIncompleteStep\(\)\)/);
    assert.match(sticky, /PM_CTA\.continuePlan : PM_STICKY\.plan/);
  });

  test("the call label is copy, and it is not an emoji", () => {
    assert.equal(PUBLIC_PHONE.label, "Call Now");
    assert.match(PUBLIC_PHONE.ariaLabel, /Call ONEDECORE/);
    // The glyph is decorative; the anchor's own text is the accessible name.
    const sticky = read(STICKY);
    assert.match(sticky, /aria-hidden="true"/);
    assert.doesNotMatch(sticky, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Exactly one WhatsApp FAB per surface                                     */
/* -------------------------------------------------------------------------- */

describe("the WhatsApp FAB is one component, mounted once per surface", () => {
  test("/interiors mounts exactly one instance", () => {
    const page = code(read(INTERIORS));
    assert.equal(
      (page.match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length,
      1,
      "/interiors must mount exactly one WhatsApp FAB"
    );
    assert.match(page, /import \{ DiscoveryWhatsAppFab \}/);
  });

  test("the common homepage still mounts exactly one instance", () => {
    const page = code(read(HOMEPAGE));
    assert.equal(
      (page.match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length,
      1,
      "the homepage must keep exactly one WhatsApp FAB"
    );
  });

  test("there is no second FAB implementation", () => {
    /*
     * Both surfaces import the same module. A page building its own `wa.me`
     * anchor would be a second copy of the validated href, the aria label and
     * the reduced-motion handling — and the copy nobody looks at is the one
     * that drifts.
     */
    for (const rel of [INTERIORS, HOMEPAGE]) {
      assert.doesNotMatch(
        read(rel),
        /wa\.me|api\.whatsapp\.com/,
        `${rel} must not build its own WhatsApp link`
      );
    }
  });

  test("the FAB's own guarantees are unchanged", () => {
    const fab = code(read(FAB));
    assert.match(fab, /const href = getPublicWhatsAppHref\(\)/);
    assert.match(fab, /if \(!href\) \{\s*return null;/);
    assert.match(fab, /target="_blank"/);
    assert.match(fab, /rel="noopener noreferrer"/);
    assert.match(fab, /aria-label=\{PUBLIC_WHATSAPP\.ariaLabel\}/);
    assert.match(fab, /data-conversion-action="whatsapp-fab"/);
    assert.match(fab, /navigator\.vibrate\?\.\(25\)/);
  });

  test("/interiors reuses the shared FAB styles rather than restyling it", () => {
    const page = read(INTERIORS);
    assert.match(page, /discovery\.css/);
    const interiorsCss = read("src/features/public-site/interiors/interiors.css");
    assert.doesNotMatch(interiorsCss, /od-disc-wa/);
  });

  test("the FAB clears the Interiors sticky bar at every width it is visible", () => {
    /*
     * `discovery.css` drops the FAB to its desktop offset at 1024px, sized for
     * the homepage dock. `.pm-sticky` is still on screen until 1080px, so
     * without a page-scoped override the button would sit on top of Call Now
     * for 56px of viewport width — narrow enough to miss in QA and wide enough
     * to hit real tablets.
     */
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(css, /\[data-public-home-r4\] \.od-disc-wa \{/);
    assert.match(css, /inset-block-end: calc\(5\.25rem \+ env\(safe-area-inset-bottom\)\)/);
    assert.match(
      css,
      /@media \(min-width: 1080px\) \{\s*\[data-public-home-r4\] \.od-disc-wa/
    );
    // The sticky bar's own hide breakpoint is the one being tracked.
    assert.match(css, /@media \(min-width: 1080px\) \{\s*\[data-public-home-r4\] \.pm-sticky \{\s*display: none/);
  });

  test("the FAB stays round when focused inside the Interiors shell", () => {
    /*
     * `home-foundation.css` sets `border-radius: 4px` on every focused element
     * in this shell, at a specificity the component cannot beat on its own. A
     * round button that becomes a rounded square on focus changes shape at the
     * exact moment a keyboard visitor is trying to locate it.
     */
    const foundation = read(
      "src/features/public-site/home-r4/styles/home-foundation.css"
    );
    assert.match(foundation, /\[data-public-home-r4\] :focus-visible \{[^}]*border-radius: 4px/);
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(
      css,
      /\[data-public-home-r4\] \.od-disc-wa:focus-visible \{\s*border-radius: 50%;\s*\}/
    );
  });

  test("the homepage FAB clears the dock instead of sitting on it", () => {
    /*
     * From 768px up the dock stops being a full-width bar and becomes a pill in
     * the bottom-right — the corner the FAB occupies. Measured on the built
     * page, the old desktop offset overlapped "Get Free Design Consultation" at
     * 768, 1024, 1440 and 1920, clipping the label at every one.
     */
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(
      css,
      /@media \(min-width: 768px\) \{\s*\.od-disc-wa \{[^}]*inset-block-end: calc\(clamp\(1rem, 2\.5vw, 1\.5rem\) \+ 4\.75rem\)/
    );
    assert.match(
      css,
      /@media \(min-width: 1024px\) \{\s*\.od-disc-wa \{[^}]*inset-block-end: calc\(1\.5rem \+ 4\.75rem\)/
    );
    // The old overlapping offset must not come back.
    assert.doesNotMatch(css, /inset-block-end: clamp\(1\.5rem, 4vw, 2\.5rem\)/);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. The homepage CTA hierarchy                                               */
/* -------------------------------------------------------------------------- */

/**
 * Three surfaces, one action each — and none of them duplicated.
 *
 *   hero          Get Free Consultation
 *   floating      WhatsApp
 *   sticky bottom Free Consultation | Call Now
 *
 * The failure this locks is not a crash. It is the page quietly growing a
 * second competing button, or losing one of the three, and nobody noticing
 * until conversions move.
 */
describe("the homepage offers one action per surface", () => {
  const HERO = "src/features/public-site/home-r4/HomeHero.tsx";
  const STICKY = "src/features/public-site/home-r4/HomeStickyActions.tsx";

  test("the hero carries exactly one call to action", () => {
    const hero = code(read(HERO));
    assert.match(hero, /data-conversion-action="hero-start-plan"/);
    assert.match(hero, /\{PM_HERO\.primaryCta\}/);
    /*
     * "Get Price Estimate" is gone from the hero. Two buttons of equal weight
     * above the fold ask a visitor to choose before they have read anything.
     */
    assert.doesNotMatch(hero, /hero-estimate/);
    assert.doesNotMatch(hero, /PM_HERO\.secondaryCta/);
    assert.doesNotMatch(hero, /Get Price Estimate/);
    // One button in the actions row, so no empty slot is left behind.
    const actions = /<div className="pm-hero__actions">([\s\S]*?)<\/div>/.exec(hero);
    assert.ok(actions, "the hero actions row must exist");
    assert.equal(
      (actions[1].match(/<button/g) ?? []).length,
      1,
      "exactly one hero CTA"
    );
  });

  test("the estimator itself was not removed with the button", () => {
    /*
     * Only the hero shortcut went. The section, its anchor and its own
     * conversion hook are untouched — the road stayed, the fork went.
     */
    const page = code(read(INTERIORS));
    // The estimator became the Budget Explorer; the section still exists and
    // still opens the one canonical planner.
    assert.match(page, /<R5Budget \/>/);
    assert.match(
      code(read("src/features/public-site/homepage-r5/sections/R5Budget.tsx")),
      /openPlanner\(getNextIncompleteStep\(\)\)/
    );
  });

  test("the sticky bar carries exactly Free Consultation and Call Now", () => {
    const sticky = code(read(STICKY));
    assert.match(sticky, /data-conversion-action="sticky-continue"/);
    assert.match(sticky, /data-conversion-action="sticky-call"/);
    assert.doesNotMatch(sticky, /sticky-estimate/);
    // Both actions come from shared config, not from a literal in the markup.
    assert.match(sticky, /PM_CTA\.continuePlan : PM_STICKY\.plan/);
    assert.match(sticky, /PUBLIC_PHONE\.label/);
    assert.match(sticky, /href=\{callHref\}/);
    assert.doesNotMatch(sticky, /tel:\+\d/);
  });

  test("the sticky bar opens the canonical form, not a second one", () => {
    const sticky = code(read(STICKY));
    assert.match(sticky, /openPlanner\(getNextIncompleteStep\(\)\)/);
    assert.doesNotMatch(sticky, /<form|LeadConsultationHost/);
    // The hero opens the same planner through the same context.
    assert.match(code(read(HERO)), /openPlanner\(getNextIncompleteStep\(\)\)/);
    // And the page mounts exactly one host.
    assert.equal(
      (code(read(INTERIORS)).match(/<LeadConsultationHost>/g) ?? []).length,
      1
    );
  });

  test("both contact destinations come from the central config", () => {
    const contact = read("src/features/public-site/chrome/public-contact.ts");
    assert.match(contact, /NEXT_PUBLIC_ONEDECORE_PHONE_E164/);
    assert.match(contact, /NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164/);
    // Neither number is written into a component.
    for (const rel of [
      "src/features/public-site/home-r4/HomeStickyActions.tsx",
      "src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx",
      "src/features/public-site/home-r4/HomeHero.tsx",
    ]) {
      assert.doesNotMatch(read(rel), /\+91\d|wa\.me\/\d/, rel);
    }
  });

  test("the narrow sticky bar keeps its labels on one line", () => {
    /*
     * At 320px "Free Consultation" wrapped inside its button, taking the bar
     * from 71px to 92px — and the WhatsApp FAB sits at a fixed clearance above
     * it, so the taller bar slid underneath the button. The collision looked
     * like a stacking bug and was a text-wrapping one.
     */
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(
      css,
      /@media \(max-width: 22\.5rem\) \{[\s\S]*?\.pm-sticky__btn \{[\s\S]*?white-space: nowrap/
    );
  });
});
