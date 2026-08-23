/**
 * Phase 9D-C2 — unified public journey repository tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DISCOVERY_SECTION_ORDER } from "../discovery/discovery-copy.ts";

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

describe("Phase 9D-C2 root discovery", () => {
  test("locks the 16-section order", () => {
    assert.deepEqual([...DISCOVERY_SECTION_ORDER], [
      "header",
      "hero",
      "journeys",
      "trust",
      "interiors-preview",
      "furniture-categories",
      "signature-bridge",
      "kitchen-feature",
      "featured-furniture",
      "real-homes",
      "why",
      "dual-process",
      "pincode",
      "testimonials",
      "final-cta",
      "footer",
    ]);
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(page, /data-od-discovery-order=\{DISCOVERY_SECTION_ORDER\.join/);
    assert.match(page, /How would you like to begin\?/);
    assert.match(page, /href="\/interiors"/);
    assert.match(page, /href="\/shop"/);
    assert.match(page, /\/interiors#modular-kitchen/);
    assert.match(page, /ShopPincodeChecker/);
    assert.match(page, /getPublicCommerceCategories|categories/);
    assert.match(page, /Our furniture collection is being prepared/);
    assert.doesNotMatch(page, /Add to Cart|Buy Now|Checkout/);
    assert.doesNotMatch(page, /submitLead|createLead|HomeLeadCapture/);
  });

  test("root page consumes public category and featured queries", () => {
    const page = read("src/app/page.tsx");
    assert.match(page, /getPublicCommerceCategories/);
    assert.match(page, /featuredOnly:\s*true/);
    assert.match(page, /isPublicCommerceReadFailure/);
    assert.match(page, /Interiors, Modular Kitchens & Furniture in Pune/);
    assert.doesNotMatch(page, /Complete Home Interiors in Pune/);
    assert.doesNotMatch(page, /sofa-luxe|fake-bed|₹9,999 sale/);
  });

  test("category preview uses public root categories only", () => {
    const src = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.match(src, /row\.isRoot/);
    assert.match(src, /sortOrder/);
    assert.match(src, /slice\(0, 6\)/);
    assert.doesNotMatch(src, /Beds.*Sofas.*Dining.*hardcoded/);
  });
});

describe("Phase 9D-C2 interiors conversion", () => {
  test("route and consultation/kitchen anchors exist", () => {
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), true);
    const route = read("src/app/interiors/page.tsx");
    const blocks = read("src/features/public-site/interiors/InteriorsServiceBlocks.tsx");
    const plan = read("src/features/public-site/home-r4/HomePlan.tsx");
    assert.match(route, /canonical: absoluteUrl\("interiors"\)/);
    assert.match(route, /getLeadFormMode/);
    assert.match(route, /InteriorsConversionPage/);
    assert.match(blocks, /id="modular-kitchen"/);
    assert.match(plan, /id="consultation"/);
    assert.match(plan, /HomeLeadCapture/);
    const interiorsPage = read("src/features/public-site/interiors/InteriorsConversionPage.tsx");
    assert.doesNotMatch(interiorsPage, /ShopProductCard|Add to Cart/);
    assert.match(interiorsPage, /"consultation"/);
    assert.match(interiorsPage, /"modular-kitchen"/);
  });
});

describe("Phase 9D-C2 nav seo and shop", () => {
  test("unified destinations have no cart or /modular-kitchen route", () => {
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    assert.match(nav, /label: "Interiors"/);
    assert.match(nav, /label: "Kitchens"/);
    assert.match(nav, /\/interiors#modular-kitchen/);
    assert.match(nav, /Shop Furniture/);
    assert.match(header, /Escape/);
    assert.doesNotMatch(nav, /\/modular-kitchen"/);
    assert.doesNotMatch(nav + header, /cart|Cart|Order Tracking/);
    assert.equal(existsSync(join(root, "src/app/modular-kitchen")), false);
    assert.equal(existsSync(join(root, "src/app/shop/cart")), false);
  });

  test("sitemap adds interiors and keeps shop commerce entries", () => {
    const sitemap = read("src/app/sitemap.ts");
    assert.match(sitemap, /absoluteUrl\("interiors"\)/);
    assert.match(sitemap, /absoluteUrl\("shop"\)/);
    assert.match(sitemap, /getPublicCommerceSitemap/);
  });

  test("shop keeps interiors as a secondary cross-link", () => {
    const shop = read("src/app/shop/page.tsx");
    assert.match(shop, /Planning a complete home\?/);
    assert.match(shop, /href="\/interiors"/);
    assert.doesNotMatch(shop, /HomeLeadCapture/);
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
