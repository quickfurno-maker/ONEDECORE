/**
 * Phase 10C — homepage launch UX + premium polish repository tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DISCOVERY_CATEGORY_TILES,
  DISCOVERY_HERO_SLIDES,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SERVICE_CARDS,
} from "../discovery/discovery-copy.ts";
import {
  getPublicNavDestinations,
  PUBLIC_CONSULTATION,
  PUBLIC_CONSULTATION_BY_SERVICE,
} from "../chrome/public-nav.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 10C — homepage launch UX", () => {
  test("nav includes Interiors and About when shop is off", () => {
    const ids = getPublicNavDestinations(false).map((row) => row.id);
    assert.deepEqual(ids, ["home", "interiors", "portfolio", "about"]);
    assert.ok(!ids.includes("shop"));
  });

  test("nav appends Shop only when gate is on", () => {
    const ids = getPublicNavDestinations(true).map((row) => row.id);
    assert.deepEqual(ids, ["home", "interiors", "portfolio", "about", "shop"]);
  });

  test("homepage header omits consultation CTA; bottom dock owns conversion", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const dock = read("src/features/public-site/discovery/DiscoveryStickyCta.tsx");
    const contact = read("src/features/public-site/chrome/public-contact.ts");
    assert.match(page, /showConsultation=\{false\}/);
    assert.match(dock, /od-disc-dock/);
    /*
     * The dock's consultation control is a BUTTON now, not an anchor to
     * `PUBLIC_CONSULTATION.href`. There is no homepage anchor left to point at
     * — the form is a sheet — so the control opens it. The shared label is
     * still what keeps the wording consistent across every CTA.
     */
    assert.match(dock, /PUBLIC_CONSULTATION\.label/);
    assert.match(dock, /<DiscoveryConsultCta/);
    assert.doesNotMatch(dock, /href=\{PUBLIC_CONSULTATION\.href\}/);
    // WhatsApp is a floating action now; the dock owns Portfolio + consultation.
    assert.match(dock, /portfolio-sticky/);
    assert.match(dock, /consultation-sticky/);
    assert.match(
      read("src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx"),
      /getPublicWhatsAppHref/
    );
    /*
     * L1.1: the number moved from a hard-coded `null` to
     * NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164. The requirement this line encoded —
     * that no number is invented in source — is unchanged and asserted
     * directly rather than through the literal that used to guarantee it.
     */
    assert.match(contact, /NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164/);
    assert.doesNotMatch(contact, /wa\.me\/\d/);
    assert.doesNotMatch(contact, /\+\d{8,}/);
    assert.doesNotMatch(page, /showConsultation=\{true\}/);
  });

  test("canonical consultation CTA uses Get Free Design Consultation", () => {
    assert.equal(PUBLIC_CONSULTATION.href, "/#consultation");
    assert.equal(PUBLIC_CONSULTATION.label, "Get Free Design Consultation");
    assert.equal(PUBLIC_CONSULTATION.shortLabel, "Free Design Consultation");
    assert.equal(PUBLIC_CONSULTATION.mobileLabel, "Get Free Design");
  });

  test("hero slides keep their approved copy and carry NO call to action", () => {
    // The three slide narratives are unchanged; only the action clutter is gone.
    assert.equal(DISCOVERY_HERO_SLIDES.length, 3);
    assert.equal(DISCOVERY_HERO_SLIDES[0]!.kicker, "Premium interiors for Pune homes");
    assert.equal(
      DISCOVERY_HERO_SLIDES[0]!.headline,
      "Complete home interiors, designed around you."
    );
    assert.match(
      DISCOVERY_HERO_SLIDES[0]!.lede,
      /From concept and modular manufacturing to installation/
    );
    assert.equal(DISCOVERY_HERO_SLIDES[2]!.badge, "Furniture & Décor — coming soon");

    /*
     * The hero is storytelling only. Its CTAs duplicated the persistent sticky
     * dock and, on mobile, spent a large share of the first screen competing
     * with it — so the slide data no longer carries any action at all.
     */
    for (const slide of DISCOVERY_HERO_SLIDES) {
      assert.ok(!("primaryCta" in slide), `${slide.id} must not define a primaryCta`);
      assert.ok(!("secondaryCta" in slide), `${slide.id} must not define a secondaryCta`);
    }

    const heroSrc = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const copySrc = read("src/features/public-site/discovery/discovery-copy.ts");
    for (const src of [heroSrc, copySrc]) {
      assert.doesNotMatch(src, /href=["']\/shop/);
    }
  });

  test("service cards deep-link to consultation with service preselection", () => {
    assert.equal(DISCOVERY_SERVICE_CARDS.length, 3);
    // The canonical map, so a service link and its consultation target cannot
    // drift apart.
    assert.equal(
      DISCOVERY_SERVICE_CARDS[0]!.href,
      PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"]
    );
    assert.equal(
      DISCOVERY_SERVICE_CARDS[1]!.href,
      "/?service=modular-kitchens#consultation"
    );
    assert.equal(
      DISCOVERY_SERVICE_CARDS[2]!.href,
      "/?service=custom-wardrobes#consultation"
    );
    assert.equal(DISCOVERY_SERVICE_CARDS[0]!.cta, "Plan My Home");
    assert.equal(DISCOVERY_SERVICE_CARDS[1]!.cta, "Plan My Kitchen");
    assert.equal(DISCOVERY_SERVICE_CARDS[2]!.cta, "Plan My Wardrobe");
  });

  test("the service deep-link record still carries furniture coming soon without a shop route", () => {
    /*
     * The browse-tile SECTION was replaced by the design library. The tile
     * DATA survives as the canonical record of the three service deep links —
     * which `public-nav.ts` and the library rail both point at — so this
     * assertion still guards the thing it was written to guard.
     */
    assert.equal(DISCOVERY_CATEGORY_TILES.length, 4);
    const furniture = DISCOVERY_CATEGORY_TILES.find((tile) => tile.id === "furniture-decor");
    assert.ok(furniture?.comingSoon);
    assert.equal(furniture?.badge, "Coming soon");
    assert.match(furniture!.href, /#consultation/);
    assert.doesNotMatch(furniture!.href, /\/shop/);
    const kitchen = DISCOVERY_CATEGORY_TILES.find((tile) => tile.id === "modular-kitchen");
    assert.ok(kitchen?.featured);
  });

  test("wordmark uses compact MADE FOR PUNE tagline", () => {
    const mark = read("src/features/public-site/home-r4/OneDecoreWordmark.tsx");
    assert.match(mark, /MADE FOR PUNE/);
    assert.doesNotMatch(mark, /ONE VISION · COMPLETE INTERIORS/);
  });

  test("the projects counter animates, below the hero, on the attested claim", () => {
    /*
     * L1.1 moved this out of the hero. The hero carries no text at all now, so
     * the counter lives in the trust strip immediately below it — and it
     * renders because the owner ATTESTED to the project count, not because the
     * claim became evidenced. See `claim-evidence.ts`.
     */
    const counter = read(
      "src/features/public-site/motion/useCountUp.ts"
    );
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const strip = read("src/features/public-site/discovery/DiscoveryProofStrip.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");

    assert.match(counter, /IntersectionObserver/);
        assert.match(strip, /isClaimDisplayable\(metric\.claimId\)/);
    assert.match(counter, /prefers-reduced-motion/);
    assert.match(strip, /od-sr-only/);

    assert.match(css, /od-disc-proof__value/);

    // The hero itself keeps neither the trust bar nor any visible copy.
    assert.doesNotMatch(hero, /DiscoveryHeroTrustBar/);
    assert.doesNotMatch(hero, /od-disc-hero__headline/);
    assert.doesNotMatch(hero, /od-disc-kicker/);
  });

  test("homepage has no top promo strip; header leads into hero", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.doesNotMatch(page, /DiscoveryPromoStrip/);
    assert.doesNotMatch(page, /od-disc-top-chrome/);
    assert.doesNotMatch(page, /Launch benefits/i);
    assert.match(page, /PublicSiteHeader/);
    assert.match(page, /DiscoveryHeroSlider/);
  });

  test("homepage architecture follows the premium narrative order", () => {
    /*
     * Owner-directed, and two moves are locked here. `proof` is GONE from the
     * homepage: the animated counter now opens `/interiors`, where the visitor
     * has chosen to read about the work, rather than arriving before the page
     * has said what the company does. And `areas` dropped from second position
     * to just before the closing CTAs, where "do you build in my part of Pune?"
     * is a question someone is actually asking.
     */
    assert.deepEqual([...DISCOVERY_SECTION_ORDER], [
      "header",
      "hero",
      "portfolio-categories",
      "why",
      "manufacturing",
      "design-library",
      "process",
      "real-homes",
      "quality",
      "furniture",
      "areas",
      "consultation",
      "final-cta",
      "footer",
    ]);

    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const browse = read("src/features/public-site/discovery/DiscoveryDesignLibrary.tsx");
    assert.match(page, /DiscoveryHeroSlider/);
    // The proof counter is on /interiors now, and must not come back here.
    assert.doesNotMatch(page, /DiscoveryProofStrip/);
    assert.match(
      read("src/features/public-site/interiors/InteriorsConversionPage.tsx"),
      /DiscoveryProofStrip/
    );
    assert.match(page, /DiscoveryWhy/);
    assert.match(page, /DiscoveryDesignLibrary/);
    assert.match(browse, /data-od-disc-section="design-library"/);
    assert.match(page, /DiscoveryQuality/);
    assert.match(page, /DiscoveryProcess/);
    assert.match(page, /DiscoveryStickyCta/);
  });

  test("portfolio preview loads up to six featured projects with empty fallback", () => {
    const route = read("src/app/page.tsx");
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(route, /slice\(0, 6\)/);
    assert.match(page, /portfolioPreview\.length > 0/);
    assert.match(page, /od-disc-homes__empty/);
    assert.match(page, /data-od-portfolio-preview/);
  });

  test("shop-off homepage has no shop nav, search, or accidental shop href in discovery", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    const browse = read("src/features/public-site/discovery/DiscoveryDesignLibrary.tsx");
    assert.match(page, /shopEnabled=\{shopLive\}/);
    assert.match(page, /showShopSearch=\{shopLive\}/);
    assert.match(page, /shopLive \? \(/);
    for (const src of [hero, copy, browse]) {
      assert.doesNotMatch(src, /\/shop/);
    }
    const shopOffBlock = page.slice(0, page.indexOf("shopLive ? ("));
    assert.doesNotMatch(shopOffBlock, /href=["']\/shop/);
  });

  test("lead form remains the single canonical homepage engine", () => {
    /*
     * Still one engine, and now it is the SAME engine `/interiors` uses. The
     * homepage embedded its own form until the v4 consolidation; it mounts the
     * shared sheet once and embeds nothing, so "single canonical" is now true
     * across the site rather than merely within this page.
     */
    const page = read("src/app/page.tsx");
    const discovery = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    /*
     * The route no longer threads a build-time form mode. It renders the page,
     * which mounts the one consultation host; the host asks the running server
     * whether a lead can be submitted. A NEXT_PUBLIC_ flag baked into HTML
     * could not know that, and the disagreement lost a real enquiry.
     */
    assert.doesNotMatch(page, /leadFormMode/);
    assert.match(discovery, /<LeadConsultationHost/);
    assert.equal(
      (discovery.match(/<LeadConsultationHost\b/g) ?? []).length,
      1,
      "the consultation host must be mounted exactly once"
    );
    assert.doesNotMatch(discovery, /<HomeConsultationCapture\b/);
  });

  test("hero slider exposes carousel semantics, progress, and reduced-motion CSS", () => {
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(hero, /aria-roledescription="carousel"/);
    assert.match(hero, /aria-live="polite"/);
    assert.match(hero, /od-disc-hero__progress/);
    /*
     * L1.1 made the hero image-only by owner direction. The prev/next arrows
     * and the headline-labelled dots went with the copy; autoplay, swipe and
     * position-labelled dots remain, and the page keeps one H1 — visually
     * hidden, since a decorative banner cannot carry the page identity.
     */
    assert.doesNotMatch(hero, /Previous slide/);
    assert.doesNotMatch(hero, /Next slide/);
    assert.match(hero, /Choose banner image/);
    assert.match(hero, /Show image \$\{index \+ 1\}/);
    assert.match(hero, /<h1 id="od-disc-hero-title" className="od-sr-only">/);
    assert.match(css, /od-disc-dock/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /od-disc-proof__grid/);
    assert.match(css, /od-disc-hero-progress/);
  });

  test("hero autoplay stops for reduced motion and the dots keep arrow-key navigation", () => {
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    assert.match(hero, /usePrefersReducedMotion/);
    assert.match(hero, /const paused = reducedMotion \|\|/);
    assert.match(hero, /if \(paused\) return/);
    assert.doesNotMatch(hero, /window\.addEventListener\("keydown"/);
    assert.match(hero, /onDotKeyDown/);
    /*
     * Pre-merge correction: with no panels left, a `tablist` whose tabs control
     * nothing is a promise to assistive technology the page cannot keep. The
     * dots are ordinary buttons in a labelled group, and the current one says so
     * with `aria-pressed`.
     */
    // Comment-stripped: the component EXPLAINS why it stopped being a tablist.
    const heroCode = hero
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    assert.doesNotMatch(heroCode, /role="tabpanel"/);
    assert.doesNotMatch(heroCode, /role="tab"/);
    assert.doesNotMatch(heroCode, /aria-selected/);
    assert.doesNotMatch(heroCode, /aria-controls/);
    assert.match(heroCode, /role="group"/);
    assert.match(heroCode, /aria-pressed=\{index === active\}/);
  });

  test("drawer and sticky dock clean up responsive state without overlapping mobile controls", () => {
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    const dock = read("src/features/public-site/discovery/DiscoveryStickyCta.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(header, /matchMedia\("\(min-width: 1024px\)"\)/);
    assert.match(header, /window\.addEventListener\("resize", closeAtDesktop\)/);
    assert.doesNotMatch(header, /heroOverlay|scrolledPastHero/);
    assert.match(dock, /MutationObserver/);
    assert.match(dock, /drawerObserver\?\.disconnect/);
    assert.match(css, /bottom: calc\(var\(--od-disc-dock-h, 4\.25rem\) \+ 0\.45rem\)/);
    assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 44px auto 44px minmax\(0, 1fr\)/);
    assert.match(css, /@media \(min-width: 1024px\) and \(max-height: 800px\)/);
  });

  test("only the first hero image is prioritized; below-fold imagery stays lazy", () => {
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const browse = read("src/features/public-site/discovery/DiscoveryDesignLibrary.tsx");
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(hero, /priority=\{index === 0\}/);
    assert.match(hero, /loading=\{index === 0 \? "eager" : "lazy"\}/);
    assert.match(browse, /loading="lazy"/);
    assert.doesNotMatch(browse, /loading="eager"/);
    // The library rail and the manufacturing image are both below the fold.
    for (const rel of [
      "src/features/public-site/discovery/DiscoveryDesignLibrary.tsx",
      "src/features/public-site/discovery/DiscoveryManufacturing.tsx",
    ]) {
      const source = read(rel);
      assert.match(source, /loading="lazy"/);
      assert.doesNotMatch(source, /priority/);
    }
    assert.doesNotMatch(page, /eagerImage=/);
  });

  test("the premium homepage sections exist, and the replaced ones are gone", () => {
    const dir = "src/features/public-site/discovery/";
    for (const name of [
      "DiscoveryHeroSlider.tsx",
      "DiscoveryProofStrip.tsx",
      "DiscoveryWhy.tsx",
      "DiscoveryManufacturing.tsx",
      "DiscoveryDesignLibrary.tsx",
      "DiscoveryProcess.tsx",
      "DiscoveryQuality.tsx",
      "DiscoveryFinalCta.tsx",
    ]) {
      assert.ok(existsSync(join(root, dir + name)), `${name} must exist`);
    }
    /*
     * Superseded, and deleted rather than left mounted beside their
     * replacements — two versions of a section is how a homepage starts to
     * drift from itself.
     */
    for (const name of [
      "DiscoveryPromoStrip.tsx",
      "DiscoveryBenefitCards.tsx",
      "DiscoveryBrowseTiles.tsx",
      "DiscoveryTrustStrip.tsx",
      "DiscoveryProjectsCounter.tsx",
    ]) {
      assert.ok(!existsSync(join(root, dir + name)), `${name} must be removed`);
    }
  });
});
