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
    assert.match(dock, /PUBLIC_CONSULTATION\.href/);
    assert.match(dock, /getPublicWhatsAppHref/);
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

  test("browse tiles include furniture coming soon without shop route", () => {
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
      "src/features/public-site/discovery/DiscoveryProjectsCounter.tsx"
    );
    const hero = read("src/features/public-site/discovery/DiscoveryHeroSlider.tsx");
    const strip = read("src/features/public-site/discovery/DiscoveryTrustStrip.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");

    assert.match(counter, /IntersectionObserver/);
    assert.match(counter, /HOME_CLAIMS\.projectsDelivered/);
    assert.match(counter, /canQuotePublicClaim\("projects-delivered"\)/);
    assert.match(counter, /prefers-reduced-motion/);
    assert.match(counter, /od-sr-only/);
    assert.match(strip, /<DiscoveryProjectsCounter \/>/);
    assert.match(css, /od-disc-projects/);

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

  test("homepage architecture uses slider, trust, benefits, browse, about, process", () => {
    assert.deepEqual([...DISCOVERY_SECTION_ORDER], [
      "header",
      "hero",
      "trust",
      "benefits",
      "browse",
      "real-homes",
      "about",
      "process",
      "furniture",
      "consultation",
      "footer",
    ]);

    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const browse = read("src/features/public-site/discovery/DiscoveryBrowseTiles.tsx");
    assert.match(page, /DiscoveryHeroSlider/);
    assert.match(page, /DiscoveryTrustStrip/);
    assert.match(page, /DiscoveryBenefitCards/);
    assert.match(page, /DiscoveryBrowseTiles/);
    assert.match(browse, /data-od-disc-section="browse"/);
    assert.match(page, /id="about"/);
    assert.match(page, /data-od-disc-section="process"/);
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
    const browse = read("src/features/public-site/discovery/DiscoveryBrowseTiles.tsx");
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
    const page = read("src/app/page.tsx");
    const discovery = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(page, /getLeadFormMode/);
    assert.match(discovery, /<HomeConsultationCapture mode=\{leadFormMode\} \/>/);
    assert.equal((discovery.match(/<HomeConsultationCapture\b/g) ?? []).length, 1);
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
    assert.match(css, /od-disc-trust-strip/);
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
    const browse = read("src/features/public-site/discovery/DiscoveryBrowseTiles.tsx");
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(hero, /priority=\{index === 0\}/);
    assert.match(hero, /loading=\{index === 0 \? "eager" : "lazy"\}/);
    assert.match(browse, /loading="lazy"/);
    assert.doesNotMatch(browse, /loading="eager"/);
    assert.doesNotMatch(page, /eagerImage=/);
  });

  test("premium polish components exist", () => {
    assert.ok(existsSync(join(root, "src/features/public-site/discovery/DiscoveryHeroTrustBar.tsx")));
    assert.ok(existsSync(join(root, "src/features/public-site/discovery/DiscoveryHeroSlider.tsx")));
    assert.ok(!existsSync(join(root, "src/features/public-site/discovery/DiscoveryPromoStrip.tsx")));
    assert.ok(existsSync(join(root, "src/features/public-site/discovery/DiscoveryBenefitCards.tsx")));
    assert.ok(existsSync(join(root, "src/features/public-site/discovery/DiscoveryBrowseTiles.tsx")));
  });
});
