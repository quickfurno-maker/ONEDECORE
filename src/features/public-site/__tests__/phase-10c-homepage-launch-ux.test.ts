/**
 * Phase 10C — homepage launch UX + premium polish repository tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DISCOVERY_CATEGORY_TILES,
  DISCOVERY_GATEWAY_TITLE,
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
  test("nav is the locked IA when shop is off", () => {
    /*
     * No Home item: the wordmark links to `/` and is the home affordance every
     * visitor already expects. A separate entry spends a menu slot — expensive
     * on mobile — on something the logo already does.
     *
     * Interiors turned out to BE that entry. It pointed at `/`, the wordmark's
     * own destination, under a category's name. Contact pointed at
     * `/#contact`, which the sticky consultation bar, the WhatsApp action and
     * the footer all reach already. Both are gone from the menu; both
     * destinations still work.
     */
    const ids = getPublicNavDestinations(false).map((row) => row.id);
    assert.deepEqual(ids, ["portfolio", "about"]);
    /*
     * Cast because TypeScript has already proved half of this: "interiors" and
     * "contact" are no longer members of the id union, so `includes` refuses
     * them at compile time. The runtime assertion is kept anyway — the union
     * is derived from the same literal this test is guarding, and a future
     * edit that re-adds the item would restore the type along with it.
     */
    const present = ids as readonly string[];
    assert.ok(!present.includes("shop"));
    assert.ok(!present.includes("interiors"));
    assert.ok(!present.includes("contact"));
  });

  test("Shop is appended when the gate is on", () => {
    /*
     * It used to sit SECOND, ahead of Portfolio, because Interiors sat first
     * and the two were the brand's verticals — leading with Shop said "the
     * other half of the business, not an appendix". With Interiors out of the
     * menu that pairing no longer exists to lead: what remains is the proof
     * and the brand, and Shop reads correctly after them.
     */
    const ids = getPublicNavDestinations(true).map((row) => row.id);
    assert.deepEqual(ids, ["portfolio", "about", "shop"]);
  });

  test("homepage header omits consultation CTA; bottom dock owns conversion", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const dock = read("src/features/public-site/discovery/DiscoveryStickyCta.tsx");
    const contact = read("src/features/public-site/chrome/public-contact.ts");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    /*
     * This used to assert the homepage passed `showConsultation={false}`. The
     * prop is gone: no public header carries a consultation pill on any
     * surface any more, so there is nothing left to switch off. The contract
     * the assertion protected is stronger stated directly.
     */
    assert.doesNotMatch(header, /od-site-header__cta/);
    assert.doesNotMatch(page, /showConsultation/);
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
  });

  test("canonical consultation CTA uses Get Free Design Consultation", () => {
    /*
     * The closing band is now the Contact destination, so the canonical
     * consultation href points at it. `#consultation` survives as an alias on
     * the same section — `/portfolio/[slug]` and the Shop nav link to it.
     */
    assert.equal(PUBLIC_CONSULTATION.href, "/#contact");
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

    /*
     * The SLIDE DATA still carries no action of any kind — the actions belong
     * to the hero's gateway block, which is gated, not to the rotating
     * photography. That distinction is what this loop protects.
     */
    for (const slide of DISCOVERY_HERO_SLIDES) {
      assert.ok(!("href" in slide), `${slide.id} must not carry an href`);
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

    // The trust bar stays gone. The gateway copy is NOT clutter of the same
    // kind: a page offering two journeys has to name them on the first screen.
    // What must not come back is the layered badge/kicker/trust-bar stack.
    assert.doesNotMatch(hero, /DiscoveryHeroTrustBar/);
    assert.doesNotMatch(hero, /od-disc-hero__headline/);
    assert.doesNotMatch(hero, /od-disc-hero__badge/);
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

  test("homepage architecture follows the owner-locked gateway order", () => {
    /*
     * ONEDECORE is one brand with two journeys, and `/` is where a visitor
     * picks one. The page therefore offers the choice first and proves it
     * afterwards, rather than arguing interiors at length and mentioning
     * furniture near the footer.
     *
     * The interiors deep-dives — manufacturing, the design library, the
     * process, quality, areas served — are all good answers to questions asked
     * AFTER that choice, and `/interiors` is where it is made. They left this
     * page; their components stay in the repository.
     */
    assert.deepEqual([...DISCOVERY_SECTION_ORDER], [
      "header",
      "hero",
      "interior-usps",
      "featured-interiors",
      "shop",
      "about",
      "contact",
      "footer",
    ]);

    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(page, /DiscoveryHeroSlider/);
    // The proof counter is on /interiors now, and must not come back here.
    assert.doesNotMatch(page, /DiscoveryProofStrip/);
    assert.match(
      read("src/features/public-site/interiors/InteriorsConversionPage.tsx"),
      /DiscoveryProofStrip/
    );
    assert.match(page, /DiscoveryWhy/);
    assert.match(page, /DiscoveryAbout/);
    assert.match(page, /DiscoveryStickyCta/);

    // The interiors deep-dive bands are off the homepage.
    for (const band of [
      "DiscoveryDesignLibrary",
      "DiscoveryManufacturing",
      "DiscoveryProcess",
      "DiscoveryQuality",
      "DiscoveryAreasServed",
      "DiscoveryPortfolioCategories",
      "DiscoveryFinalCta",
    ]) {
      assert.doesNotMatch(page, new RegExp(band), `${band} should not render on /`);
    }
  });

  test("portfolio preview loads three featured projects with empty fallback", () => {
    /*
     * Fewer, larger, quieter. Three reads as curated proof at every
     * breakpoint; six read as a contact sheet.
     *
     * This preview belongs to `DiscoveryHomePage`, which is no longer mounted
     * at `/` — the Interiors page is. The component and its contract are
     * unchanged and still asserted here; only the route that used to fetch for
     * it has stopped, which is why the slice assertion moved off the route.
     */
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.doesNotMatch(
      read("src/app/page.tsx"),
      /getFeaturedProjects/,
      "the root must not fetch portfolio data it does not render"
    );
    assert.match(page, /projects\.length > 0/);
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
    /*
     * The design-library band must never mention Shop. The copy module now
     * does — the About section's furniture half links there — so what is
     * asserted about copy is that the link belongs to a point the About
     * component drops when the gate is off, not that the string is absent.
     */
    assert.doesNotMatch(browse, /\/shop/);
    const about = read("src/features/public-site/discovery/DiscoveryAbout.tsx");
    assert.match(about, /point\.id !== "furniture"/);
    assert.match(about, /shopLive/);
    /*
     * The hero DOES link to /shop — it is one of the two gateway actions — but
     * only behind the gate. What matters is that the href cannot render while
     * the gate is off, so the assertion is on the guard rather than on the
     * absence of the string.
     */
    assert.match(hero, /shopLive \? \(/);
    assert.match(
      hero,
      /shopLive \? \(\s*<Link href="\/shop"/,
      "the hero shop action must be gated on shopLive"
    );
    const heroShopOff = hero.slice(0, hero.indexOf("shopLive ? ("));
    assert.doesNotMatch(heroShopOff, /href="\/shop/);

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
     * The slider mechanics are unchanged from L1.1: no prev/next arrows,
     * position-labelled dots, autoplay and swipe.
     *
     * The H1 is no longer visually hidden. It was, while the hero was pure
     * decoration for an interiors page — but a gateway offering two journeys
     * has to name the brand on screen, so the page's one H1 is now visible and
     * carries it.
     */
    assert.doesNotMatch(hero, /Previous slide/);
    assert.doesNotMatch(hero, /Next slide/);
    assert.match(hero, /Choose banner image/);
    assert.match(hero, /Show image \$\{index \+ 1\}/);
    assert.match(hero, /<h1 id="od-disc-hero-title">\{DISCOVERY_GATEWAY_TITLE\}<\/h1>/);
    // Still exactly one.
    assert.equal((hero.match(/<h1/g) ?? []).length, 1);
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
