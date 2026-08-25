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
import { getPublicNavDestinations } from "../chrome/public-nav.ts";
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
    assert.deepEqual([...DISCOVERY_SECTION_ORDER], [
      "header",
      "hero",
      "complete-home",
      "modular-kitchen",
      "wardrobes",
      "why",
      "real-homes",
      "furniture",
      "consultation",
      "footer",
    ]);
    assert.deepEqual([...DISCOVERY_MAJOR_SECTIONS], [
      "hero",
      "complete-home",
      "modular-kitchen",
      "wardrobes",
      "why",
      "real-homes",
      "furniture",
      "consultation",
    ]);
    assert.equal(DISCOVERY_SERVICE_SECTIONS.length, 3);
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(page, /data-od-discovery-order=\{DISCOVERY_SECTION_ORDER\.join/);
    assert.match(page, /data-od-disc-section="hero"/);
    assert.match(page, /data-od-disc-section=\{service\.id\}/);
    assert.match(page, /data-od-disc-section="why"/);
    assert.match(page, /data-od-disc-section="real-homes"/);
    assert.match(page, /data-od-disc-section="furniture"/);
    assert.match(page, /data-od-disc-section="consultation"/);
    assert.match(page, /shopLive \? \(/);
    assert.match(page, /PUBLIC_CONSULTATION\.label/);
    assert.match(page, /PUBLIC_CONSULTATION\.href/);
    assert.doesNotMatch(page, /Book Free Consultation/);
    assert.match(page, /href="\/portfolio"/);
    assert.match(page, /service\.href/);
    const copy = read("src/features/public-site/discovery/discovery-copy.ts");
    assert.match(copy, /\/interiors\?service=modular-kitchens#consultation/);
    assert.match(copy, /\/interiors\?service=custom-wardrobes#consultation/);
    assert.match(read("src/features/public-site/chrome/public-nav.ts"), /\/interiors#consultation/);
    assert.match(page, /ShopPincodeChecker/);
    assert.match(page, /showPincode/);
    assert.doesNotMatch(page, /furniture collection is being prepared/i);
    assert.doesNotMatch(page, /DiscoveryPuneCoverage/);
    assert.doesNotMatch(page, /od-disc-hero__portrait|od-disc-hero__inset/);
    assert.doesNotMatch(page, /heroConsultant|hero-consultant-indian-woman/);
    assert.doesNotMatch(page, /submitLead|createLead|HomeLeadCapture/);
    assert.match(css, /od-disc-service/);
    assert.match(css, /od-disc-band--surface|od-disc-band--deep|od-disc-band--divided/);
    assert.match(css, /prefers-reduced-motion/);
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
      ["home", "portfolio"]
    );
    assert.deepEqual(
      getPublicNavDestinations(true).map((row) => row.id),
      ["home", "portfolio", "shop"]
    );
    assert.ok(!existsSync(join(root, "src/features/public-site/discovery/DiscoveryPuneCoverage.tsx")));
    assert.ok(HOME_PUNE_AREAS.includes("Kharadi"));
  });

  test("homepage hero uses living-warmth and does not reuse it on service sections", () => {
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    const content = read("src/features/public-site/home-r4/content.ts");
    assert.match(page, /HOMEPAGE_HERO = PM_ASSETS\.hero/);
    assert.match(page, /HOMEPAGE_HERO\.path/);
    assert.match(content, /hero-living-warmth\.webp/);
    assert.match(page, /completeHomeInteriors/);
    assert.match(page, /modularKitchens/);
    assert.match(page, /customWardrobes/);
    assert.doesNotMatch(page, /heroConsultant/);
    assert.doesNotMatch(page, /hero-consultant-indian-woman/);
    assert.doesNotMatch(page, /SERVICE_ASSETS[\s\S]*PM_ASSETS\.hero/);
  });

  test("consultation CTA uses canonical Get Free Consultation labels", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    const content = read("src/features/public-site/home-r4/content.ts");
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(nav, /label: "Get Free Consultation"/);
    assert.match(nav, /shortLabel: "Free Consultation"/);
    assert.match(content, /open: "Get Free Consultation"/);
    assert.match(page, /PUBLIC_CONSULTATION\.label/);
    assert.doesNotMatch(page, /Book Free Consultation/);
  });

  test("root page consumes public category and featured queries behind shop gate", () => {
    const page = read("src/app/page.tsx");
    assert.match(page, /getPublicCommerceCategories/);
    assert.match(page, /featuredOnly:\s*true/);
    assert.match(page, /isShopPublicEnabled/);
  });

  test("category preview uses public root categories only", () => {
    const src = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(src, /row\.isRoot/);
    assert.match(src, /sortOrder/);
    assert.match(src, /slice\(0, 6\)/);
  });
});

describe("Public site simplification — interiors and portfolio", () => {
  test("route and consultation/kitchen anchors exist", () => {
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), true);
    const route = read("src/app/interiors/page.tsx");
    const blocks = read("src/features/public-site/interiors/InteriorsServiceBlocks.tsx");
    const plan = read("src/features/public-site/home-r4/HomePlan.tsx");
    assert.match(route, /InteriorsConversionPage/);
    assert.match(blocks, /id="modular-kitchen"/);
    assert.match(plan, /id="consultation"/);
    assert.match(plan, /HomeLeadCapture/);
  });

  test("portfolio detail exposes canonical consultation CTA", () => {
    const detail = read("src/app/portfolio/[slug]/page.tsx");
    assert.match(detail, /Get Free Consultation/);
    assert.match(detail, /\/interiors#consultation/);
  });

  test("PlanProvider can preselect canonical service from query string", () => {
    const src = read("src/features/public-site/home-r4/PlanContext.tsx");
    assert.match(src, /URLSearchParams/);
    assert.match(src, /get\("service"\)/);
    assert.match(src, /PM_PLANNER\.services/);
  });
});

describe("Public site simplification — nav seo and shop", () => {
  test("locked nav is Home | Portfolio | conditional Shop", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    assert.match(nav, /label: "Home"/);
    assert.match(nav, /label: "Portfolio"/);
    assert.match(nav, /label: "Shop"/);
    assert.doesNotMatch(nav, /label: "Interiors"/);
    assert.doesNotMatch(nav, /label: "Kitchens"/);
    assert.doesNotMatch(nav, /label: "About"/);
    assert.match(header, /Escape/);
    assert.match(header, /ShopCartLink/);
    assert.match(header, /current === "shop"/);
    assert.equal(existsSync(join(root, "src/app/modular-kitchen")), false);
    assert.equal(existsSync(join(root, "src/app/shop/cart/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), true);
  });

  test("sitemap adds interiors and keeps shop commerce entries", () => {
    const sitemap = read("src/app/sitemap.ts");
    assert.match(sitemap, /absoluteUrl\("interiors"\)/);
    assert.match(sitemap, /absoluteUrl\("shop"\)/);
  });

  test("shop keeps interiors as a secondary cross-link", () => {
    const shop = read("src/app/shop/page.tsx");
    assert.match(shop, /Planning a complete home\?/);
    assert.match(shop, /href="\/interiors"/);
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

  test("public footer is compact with legal utility links", () => {
    const footer = read("src/features/public-site/chrome/PublicSiteFooter.tsx");
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.match(footer, /getPublicNavDestinations\(shopEnabled\)/);
    assert.match(footer, /PUBLIC_CONSULTATION\.href/);
    assert.match(nav, /Data Rights/);
    assert.match(nav, /Communication Consent/);
    assert.match(nav, /Warranty/);
    assert.doesNotMatch(footer, /\/admin/);
    assert.doesNotMatch(footer, /Landing Lab/i);
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
