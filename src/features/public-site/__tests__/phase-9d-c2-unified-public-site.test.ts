/**
 * Phase 9D-C2 / public-site simplification — unified public journey repository tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DISCOVERY_MAJOR_SECTIONS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SERVICE_SECTIONS,
} from "../discovery/discovery-copy.ts";
import {
  getPublicNavDestinations,
  PUBLIC_CONSULTATION,
  PUBLIC_CONSULTATION_BY_SERVICE,
} from "../chrome/public-nav.ts";
import { HOME_PUNE_AREAS } from "../home-r4/claims.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("Public site simplification — discovery IA", () => {
  test("locks the simplified discovery section order", () => {
    /*
     * The premium homepage narrative. Each band answers the question the one
     * before it raises; `furniture` is in the list but not the story, because it
     * renders only when the Shop gate is live.
     */
    /*
     * Two owner-directed moves are locked here. `proof` is GONE from the
     * homepage: the counter opens `/interiors` instead of arriving before the
     * page has said what the company does. And `areas` dropped from second
     * position to just before the closing CTAs, where "do you build in my part
     * of Pune?" is a question someone is actually asking.
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
    assert.deepEqual([...DISCOVERY_MAJOR_SECTIONS], [
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
    ]);
    assert.equal(DISCOVERY_SERVICE_SECTIONS.length, 3);
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(page, /data-od-discovery-order=\{DISCOVERY_SECTION_ORDER\.join/);
    assert.doesNotMatch(page, /DiscoveryPromoStrip/);
    assert.doesNotMatch(page, /od-disc-top-chrome/);
    assert.match(page, /DiscoveryHeroSlider/);
    assert.match(page, /DiscoveryWhy/);
    assert.match(page, /DiscoveryDesignLibrary/);
    const library = read(
      "src/features/public-site/discovery/DiscoveryDesignLibrary.tsx"
    );
    assert.match(library, /data-od-disc-section="design-library"/);
    assert.match(page, /DiscoveryQuality/);
    assert.match(page, /data-od-disc-section="real-homes"/);
    assert.match(page, /data-od-disc-section="furniture"/);
    assert.match(page, /data-od-disc-section="consultation"/);
    assert.match(page, /shopLive \? \(/);
    assert.match(page, /PUBLIC_CONSULTATION\.label/);
    /*
     * The consultation CTA is no longer an anchor to `PUBLIC_CONSULTATION.href`.
     * There is nothing on this page to anchor TO any more — the form is a sheet
     * — so the control opens it instead. The LABEL still comes from the shared
     * nav constant, which is what kept the wording consistent in the first
     * place; only the destination stopped being a URL.
     */
    assert.match(page, /<DiscoveryConsultCta/);
    assert.doesNotMatch(page, /href=\{PUBLIC_CONSULTATION\.href\}/);
    assert.doesNotMatch(page, /Book Free Consultation/);
    assert.match(page, /href="\/portfolio"/);
    assert.doesNotMatch(page, /\/interiors#consultation/);
    assert.doesNotMatch(page, /\/interiors\?service=/);
    assert.match(page, /ShopPincodeChecker/);
    assert.match(page, /showPincode/);
    assert.doesNotMatch(page, /furniture collection is being prepared/i);
    assert.doesNotMatch(page, /DiscoveryPuneCoverage/);
    assert.doesNotMatch(page, /heroConsultant|hero-consultant-indian-woman/);
    // The sheet IS mounted here now; the estimator and the inline planner are not.
    assert.doesNotMatch(page, /HomeBudgetEstimator|HomePlannerInline/);
    assert.match(page, /HomePlannerSheet/);
    assert.doesNotMatch(page, /HomeConsultationCapture/);
    assert.match(page, /PortfolioCard/);
    assert.match(page, /data-od-portfolio-preview/);
    assert.match(css, /od-disc-library__rail/);
    assert.doesNotMatch(css, /od-disc-top-chrome/);
    assert.doesNotMatch(css, /od-disc-promo/);
    assert.match(css, /od-disc-benefit-card/);
    assert.match(css, /od-disc-band--surface|od-disc-band--deep|od-disc-band--divided/);
    assert.match(css, /prefers-reduced-motion/);
  });

  test("canonical consultation lives on homepage with service preselection", () => {
    assert.equal(PUBLIC_CONSULTATION.href, "/#consultation");
    assert.equal(
      PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
      "/?service=complete-home-interiors#consultation"
    );
    assert.equal(
      PUBLIC_CONSULTATION_BY_SERVICE["modular-kitchens"],
      "/?service=modular-kitchens#consultation"
    );
    assert.equal(
      PUBLIC_CONSULTATION_BY_SERVICE["custom-wardrobes"],
      "/?service=custom-wardrobes#consultation"
    );
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    assert.match(copy, /PUBLIC_CONSULTATION_BY_SERVICE\["complete-home-interiors"\]/);
    assert.match(copy, /PUBLIC_CONSULTATION_BY_SERVICE\["modular-kitchens"\]/);
    assert.match(copy, /PUBLIC_CONSULTATION_BY_SERVICE\["custom-wardrobes"\]/);
    /*
     * The `/interiors` link moved to the nav when the benefit cards were
     * replaced; the route is unchanged and still reachable. What this test
     * exists to prevent is a CONSULTATION path on /interiors, and that is the
     * assertion below.
     */
    assert.match(
      read("src/features/public-site/chrome/public-nav.ts"),
      /"\/interiors"/
    );
    assert.doesNotMatch(copy, /\/interiors#consultation/);
    assert.doesNotMatch(copy, /\/interiors\?service=/);
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.match(nav, /href: "\/#consultation"/);
    assert.doesNotMatch(nav, /\/interiors#consultation/);
  });

  test("homepage embeds exactly one canonical lead-form path with server leadFormMode", () => {
    const page = read("src/app/page.tsx");
    const discovery = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const wrap = read("src/features/public-site/discovery/HomeConsultationCapture.tsx");
    assert.match(page, /getLeadFormMode/);
    assert.match(page, /leadFormMode=\{leadFormMode\}/);
    /*
     * ONE PATH, AND IT IS THE SAME ONE THE INTERIORS PAGE USES.
     *
     * The homepage embedded its own form until this change. The invariant that
     * mattered - exactly one canonical lead-form path, with the mode resolved
     * on the server - is unchanged; what changed is that the path is now shared
     * with `/interiors` rather than being a second implementation of it.
     */
    assert.match(discovery, /id="consultation"/);
    assert.equal(
      (discovery.match(/<HomePlannerSheet\b/g) ?? []).length,
      1,
      "the sheet must be mounted exactly once"
    );
    assert.match(discovery, /<HomePlannerSheet leadFormMode=\{leadFormMode\} \/>/);
    assert.doesNotMatch(discovery, /<HomeConsultationCapture\b/);
    /*
      * The consultation section now mounts the ADAPTIVE form, which owns its own
      * two-field state. The legacy `PlanProvider` existed to drive the
      * multi-step planner and its estimator; keeping it here only invited the
      * property/timeline questionnaire back into a form that no longer asks
      * them. The single-canonical-path invariant is unchanged.
      */
    // Comments EXPLAIN why the provider was dropped; assert against code.
    const wrapCode = wrap
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    /*
     * The canonical form is now `PremiumRequirementForm` (public-consult-v3).
     * Asserted against COMMENT-STRIPPED source: this assertion previously passed
     * on the word appearing in a docblock, which is the same trap the note above
     * warns about.
     */
    assert.match(wrapCode, /PremiumRequirementForm/);
    assert.doesNotMatch(wrapCode, /ConsultationLeadForm/);
    assert.doesNotMatch(wrapCode, /PlanProvider/);
    assert.doesNotMatch(wrapCode, /HomeLeadCapture/);
    assert.doesNotMatch(wrap, /HomePlannerSheet|HomeBudgetEstimator|HomePlannerInline/);
    /*
     * The homepage mounts the SHEET and still mounts no estimator: the budget
     * estimator is a planning aid that belongs on the interiors page, and its
     * output is not what the lead contract asks for.
     */
    assert.doesNotMatch(discovery, /HomeBudgetEstimator|estimator/);
  });

  test("homepage hides pincode, shop search, and shop nav while shop is off", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.match(page, /showShopSearch=\{shopLive\}/);
    assert.match(page, /shopEnabled=\{shopLive\}/);
    assert.match(page, /showPincode = shopLive/);
    assert.match(header, /showShopSearch/);
    assert.match(header, /shopEnabled/);
    assert.match(header, /getPublicNavDestinations\(shopEnabled\)/);
    assert.match(nav, /getPublicNavDestinations/);
    assert.deepEqual(
      getPublicNavDestinations(false).map((row) => row.id),
      ["home", "interiors", "portfolio", "about"]
    );
    assert.deepEqual(
      getPublicNavDestinations(true).map((row) => row.id),
      ["home", "interiors", "portfolio", "about", "shop"]
    );
    assert.ok(!existsSync(join(root, "src/features/public-site/discovery/DiscoveryPuneCoverage.tsx")));
    assert.ok(HOME_PUNE_AREAS.includes("Kharadi"));
  });

  test("homepage uses owner-supplied cohesive major image set without hero reuse on services", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    const assets = read("src/features/public-site/discovery/discovery-assets.ts");
    const content = read("src/features/public-site/home-r4/content.ts");
    assert.doesNotMatch(page, /OWNER_ASSET_REQUIRED/);
    assert.match(assets, /PM_ASSETS\.hero/);
    assert.match(assets, /completeHomeInteriors/);
    assert.match(assets, /modularKitchens/);
    assert.match(assets, /customWardrobes/);
    assert.match(copy, /assetKey: "hero"/);
    assert.match(copy, /assetKey: "modularKitchens"/);
    assert.match(copy, /assetKey: "completeHomeInteriors"/);
    assert.match(content, /hero-living-warmth\.webp/);
    assert.match(content, /service-complete-home-interiors\.webp/);
    assert.match(content, /service-modular-kitchens\.webp/);
    assert.match(content, /service-custom-wardrobes\.webp/);
    assert.match(content, /bytes: 115242/);
    assert.match(content, /bytes: 183650/);
    assert.match(content, /bytes: 115712/);
    assert.match(content, /bytes: 323002/);
    assert.doesNotMatch(page, /heroConsultant/);
    assert.doesNotMatch(copy, /assetKey: "hero"[\s\S]*assetKey: "hero"/);
    assert.ok(
      existsSync(join(root, "public/assets/onedecore/home/hero-living-warmth.webp"))
    );
    assert.ok(
      existsSync(
        join(root, "public/assets/onedecore/home/service-complete-home-interiors.webp")
      )
    );
    assert.ok(
      existsSync(join(root, "public/assets/onedecore/home/service-modular-kitchens.webp"))
    );
    assert.ok(
      existsSync(join(root, "public/assets/onedecore/home/service-custom-wardrobes.webp"))
    );
  });

  test("consultation CTA uses canonical Get Free Design Consultation labels", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    const content = read("src/features/public-site/home-r4/content.ts");
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(nav, /label: "Get Free Design Consultation"/);
    assert.match(nav, /shortLabel: "Free Design Consultation"/);
    assert.match(content, /open: "Get Free Consultation"/);
    assert.match(page, /PUBLIC_CONSULTATION\.label/);
    assert.doesNotMatch(page, /Book Free Consultation/);
  });

  test("root page loads commerce, portfolio preview, and lead form mode", () => {
    const page = read("src/app/page.tsx");
    assert.match(page, /getPublicCommerceCategories/);
    assert.match(page, /featuredOnly:\s*true/);
    assert.match(page, /isShopPublicEnabled/);
    assert.match(page, /getFeaturedProjects/);
    assert.match(page, /getLeadFormMode/);
    assert.match(page, /Home Interiors, Modular Kitchens & Wardrobes/);
    assert.doesNotMatch(page, /Furniture in Pune/);
  });

  test("category preview uses public root categories only", () => {
    const src = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(src, /row\.isRoot/);
    assert.match(src, /sortOrder/);
    assert.match(src, /slice\(0, 6\)/);
  });

  test("real homes section uses portfolio preview with empty-safe behavior", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(page, /portfolioPreview\.length > 0/);
    assert.match(page, /PortfolioCard/);
    assert.match(page, /od-disc-homes__empty/);
    assert.match(page, /View Portfolio/);
  });
});

describe("Public site simplification — lead form email lock", () => {
  test("public HomeLeadCapture has no email field or email-consent UI", () => {
    const src = read("src/features/lead-intake/public/HomeLeadCapture.tsx");
    assert.doesNotMatch(src, /type="email"/);
    assert.doesNotMatch(src, /name="email"/);
    assert.doesNotMatch(src, /consentServiceEmail/);
    assert.doesNotMatch(src, /serviceEmailConsent/);
    assert.doesNotMatch(src, /setEmail/);
    assert.match(src, /consentServicePhone/);
    assert.match(src, /consentWhatsapp/);
    assert.match(src, /const \[whatsappConsent, setWhatsappConsent\] = useState\(false\)/);
    assert.doesNotMatch(src, /setWhatsappConsent\(true\)/);
  });

  test("public lead request omits email and email consent when absent", () => {
    const src = read("src/features/lead-intake/public/HomeLeadCapture.tsx");
    assert.doesNotMatch(src, /email:\s*hasEmail/);
    assert.doesNotMatch(src, /serviceEmail:\s*true/);
    assert.match(src, /serviceEnquiry:\s*true/);
    assert.match(src, /servicePhone:\s*true/);
  });
});

describe("Public site simplification — interiors and portfolio", () => {
  test("/interiors route is retained, and offers the same canonical form", () => {
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), true);
    const route = read("src/app/interiors/page.tsx");
    const blocks = read("src/features/public-site/interiors/InteriorsServiceBlocks.tsx");
    const plan = read("src/features/public-site/home-r4/HomePlan.tsx");
    assert.match(route, /InteriorsConversionPage/);
    assert.match(blocks, /id="modular-kitchen"/);
    assert.match(plan, /id="consultation"/);
    // Its OWN form is gone; the section opens the shared sheet.
    assert.doesNotMatch(plan, /HomeLeadCapture/);
    assert.match(plan, /openPlanner/);
  });

  test("portfolio detail CTA targets homepage consultation", () => {
    const detail = read("src/app/portfolio/[slug]/page.tsx");
    assert.match(detail, /Get Free Consultation/);
    assert.match(detail, /href="\/#consultation"/);
    assert.doesNotMatch(detail, /\/interiors#consultation/);
  });

  test("HomeLeadCapture can preselect canonical service from query string", () => {
    const src = read("src/features/lead-intake/public/HomeLeadCapture.tsx");
    assert.match(src, /URLSearchParams/);
    assert.match(src, /get\("service"\)/);
    assert.match(src, /plan\.setService/);
  });
});

describe("Public site simplification — nav seo and shop", () => {
  test("locked nav is Home | Interiors | Portfolio | About | conditional Shop", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    assert.match(nav, /label: "Home"/);
    assert.match(nav, /label: "Interiors"/);
    assert.match(nav, /label: "Portfolio"/);
    assert.match(nav, /label: "About"/);
    assert.match(nav, /label: "Shop"/);
    assert.doesNotMatch(nav, /label: "Kitchens"/);
    assert.match(header, /Escape/);
    assert.match(header, /ShopCartLink/);
    assert.match(header, /current === "shop"/);
    assert.match(header, /getPublicNavDestinations/);
    assert.equal(existsSync(join(root, "src/app/modular-kitchen")), false);
    assert.equal(existsSync(join(root, "src/app/shop/cart/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), true);
  });

  test("sitemap adds interiors and keeps shop commerce entries", () => {
    const sitemap = read("src/app/sitemap.ts");
    assert.match(sitemap, /absoluteUrl\("interiors"\)/);
    assert.match(sitemap, /absoluteUrl\("shop"\)/);
  });

  test("shop cross-links to homepage interiors journey, not primary /interiors CTA", () => {
    const shop = read("src/app/shop/page.tsx");
    assert.match(shop, /Planning a complete home\?/);
    assert.match(shop, /href="\/"/);
    assert.doesNotMatch(shop, /href="\/interiors"/);
    assert.doesNotMatch(shop, /HomeLeadCapture/);
  });

  test("closed mobile drawer is not focusable and open drawer inerts background", () => {
    const css = read("src/features/public-site/chrome/public-site-chrome.css");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    const closed = css.slice(
      css.indexOf(".od-site-header__drawer {"),
      css.indexOf(".od-site-header__drawer[data-open]")
    );
    const opened = css.slice(
      css.indexOf(".od-site-header__drawer[data-open]"),
      css.indexOf(".od-site-header__drawerNav")
    );
    assert.match(closed, /visibility:\s*hidden/);
    assert.match(opened, /visibility:\s*visible/);
    assert.match(header, /Escape/);
    assert.match(header, /inert = true/);
  });

  test("public footer is compact with legal utility links and no marketing email", () => {
    const footer = read("src/features/public-site/chrome/PublicSiteFooter.tsx");
    const css = read("src/features/public-site/chrome/public-site-chrome.css");
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.match(footer, /getPublicNavDestinations\(shopEnabled\)/);
    assert.match(footer, /PUBLIC_CONSULTATION\.href/);
    assert.match(footer, /od-site-footer__links--inline/);
    assert.match(footer, /od-site-footer__links--legal/);
    assert.match(footer, /od-site-footer__col--explore/);
    assert.match(footer, /od-site-footer__col--legal/);
    assert.match(nav, /Data Rights/);
    assert.match(nav, /Communication Consent/);
    assert.match(nav, /Warranty/);
    assert.doesNotMatch(footer, /\/admin/);
    assert.doesNotMatch(footer, /Landing Lab/i);
    assert.doesNotMatch(footer, /mailto:/);
    assert.doesNotMatch(footer, /onedecore@gmail\.com/);
    assert.doesNotMatch(footer, /Email us/i);
    assert.match(css, /od-site-footer__links--legal/);
    assert.match(css, /grid-template-columns:\s*1fr 1fr/);
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /@media \(min-width: 560px\) and \(max-width: 959px\)/);
    assert.match(css, /@media \(max-width: 559px\)/);
  });

  test("normal public marketing UI has no mailto or sales email CTA", () => {
    const dirs = [
      "src/features/public-site/discovery",
      "src/features/public-site/chrome",
      "src/features/portfolio/public/components",
      "src/app/shop",
    ];
    for (const dir of dirs) {
      for (const file of walkFiles(join(root, dir))) {
        if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
        const src = readFileSync(file, "utf8");
        assert.doesNotMatch(src, /mailto:/);
        assert.doesNotMatch(src, /Email us/i);
      }
    }
  });

  test("legal pages may retain published privacy/grievance email as governance exception", () => {
    const privacy = read("src/features/legal/privacy-policy-content.ts");
    const identity = read("src/features/legal/business-identity.ts");
    assert.match(privacy, /privacyEmail/);
    assert.match(identity, /onedecore@gmail\.com/);
  });

  test("public discovery and interiors copy has no cart CTA", () => {
    const files = walkFiles(join(root, "src/features/public-site/discovery")).concat(
      walkFiles(join(root, "src/features/public-site/interiors")),
      walkFiles(join(root, "src/features/public-site/chrome"))
    );
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /Add to Cart|Buy Now|Proceed to checkout/i);
    }
  });
});
