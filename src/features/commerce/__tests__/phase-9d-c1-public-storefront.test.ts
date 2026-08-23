/**
 * Phase 9D-C1 — public storefront repository tests.
 * Parsers and source contracts; no live database.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { formatInrFromPaise } from "../../crm/contracts/sales-target-contracts.ts";
import {
  boundPublicSearchQuery,
  isPublicCommerceSort,
  normalizePublicSearchInput,
  parsePublicCategories,
  parsePublicPincode,
  parsePublicProductCard,
  parsePublicProductDetail,
  parsePublicProductPage,
  parsePublicSitemap,
} from "../public/public-parsers.ts";
import { PublicCommerceParseError, PublicCommerceReadError } from "../public/public-errors.ts";
import { buildProductJsonLd } from "../public/product-jsonld.ts";
import { readLocalSnapshots, toggleWishlist } from "../public/wishlist-storage.ts";
import { parseShopListingParams } from "../public/public-search-params.ts";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase/migrations/20260823140000_commerce_public_storefront_read_foundation.sql"
);

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

const publishedCard = {
  product_reference: "OD-P-2026-900001",
  name: "Published Bed",
  slug: "published-bed",
  category_name: "Beds",
  category_slug: "beds",
  short_description: "A bed",
  featured: true,
  starting_price_paise: 4250000,
  compare_at_price_paise: 5000000,
  primary_image_path: "bb111111-1111-4111-8111-111111111111/dd111111-1111-4111-8111-111111111111/derivative.webp",
  primary_image_alt: "Primary bed",
  variant_count: 1,
  availability_mode: "ready_stock",
  is_available: true,
};

describe("Phase 9D-C1 public parser contracts", () => {
  test("rejects malformed RPC category shape", () => {
    assert.throws(() => parsePublicCategories({}), PublicCommerceParseError);
  });

  test("rejects product cards that leak stock fields", () => {
    assert.throws(
      () => parsePublicProductCard({ ...publishedCard, stock_on_hand: 4 }),
      PublicCommerceParseError
    );
  });

  test("compare-at is dropped unless greater than selling price", () => {
    const card = parsePublicProductCard({
      ...publishedCard,
      compare_at_price_paise: 4250000,
    });
    assert.equal(card.compareAtPricePaise, null);
  });

  test("draft-like detail payload without published collections fails closed", () => {
    assert.throws(() => parsePublicProductDetail({ name: "Draft" }), PublicCommerceParseError);
  });

  test("null product detail is a legitimate miss, not an empty fabrication", () => {
    assert.equal(parsePublicProductDetail(null), null);
  });

  test("search page distinguishes total zero from malformed payload", () => {
    const empty = parsePublicProductPage({ items: [], total: 0 });
    assert.equal(empty.total, 0);
    assert.throws(() => parsePublicProductPage({ items: [] }), PublicCommerceParseError);
  });

  test("malformed pincode payload and zone leak fail closed", () => {
    assert.throws(() => parsePublicPincode({ serviceable: true }), PublicCommerceParseError);
    assert.throws(
      () =>
        parsePublicPincode({
          pincode: "411001",
          serviceable: true,
          eta_min_days: 3,
          eta_max_days: 7,
          zone_code: "PUNE-CORE",
        }),
      PublicCommerceParseError
    );
  });
});

describe("Phase 9D-C1 search and money", () => {
  test("query is bounded to 80 characters", () => {
    const long = "a".repeat(120);
    assert.equal(boundPublicSearchQuery(long)?.length, 80);
  });

  test("sort allowlist rejects best_selling", () => {
    assert.equal(isPublicCommerceSort("best_selling"), false);
    assert.throws(() => normalizePublicSearchInput({ sort: "best_selling" as never }), PublicCommerceParseError);
  });

  test("listing params keep shareable filter state", () => {
    const parsed = parseShopListingParams(
      { sort: "price_low_high", availability: "made_to_order", page: "2" },
      "beds"
    );
    assert.equal(parsed.categorySlug, "beds");
    assert.equal(parsed.sort, "price_low_high");
    assert.equal(parsed.availabilityMode, "made_to_order");
    assert.equal(parsed.offset, 12);
  });

  test("INR formatting from paise", () => {
    assert.equal(formatInrFromPaise(4250000), "₹42,500");
  });
});

describe("Phase 9D-C1 JSON-LD and wishlist", () => {
  test("structured data uses real variant price and no review aggregate", () => {
    const detail = parsePublicProductDetail({
      product_reference: "OD-P-2026-900001",
      name: "Published Bed",
      slug: "published-bed",
      short_description: "A bed",
      full_description: "Full",
      seo_title: null,
      seo_description: null,
      hsn_sac_code: null,
      featured: true,
      gst_inclusive_display: true,
      category: { name: "Beds", slug: "beds", parent_slug: null },
      variants: [
        {
          sku: "pub-bed-oak",
          display_name: "Oak",
          option_values: { color: "oak" },
          selling_price_paise: 4250000,
          compare_at_price_paise: 5000000,
          availability_mode: "ready_stock",
          is_available: true,
          sort_order: 0,
        },
      ],
      media: [],
      specifications: [],
      related: [],
    });
    assert.ok(detail);
    const json = buildProductJsonLd(detail, detail.variants[0]);
    assert.deepEqual((json.offers as { price: string }).price, "42500.00");
    assert.equal("aggregateRating" in json, false);
    assert.equal("review" in json, false);
  });

  test("corrupt localStorage recovers to an empty wishlist", () => {
    assert.deepEqual(readLocalSnapshots("{not-json", 40), []);
    assert.deepEqual(readLocalSnapshots("12", 40), []);
    const next = toggleWishlist([], { slug: "published-bed", name: "Bed", imagePath: null });
    assert.equal(next[0]?.slug, "published-bed");
  });
});

describe("Phase 9D-C1 repository contracts", () => {
  test("migration exists and does not grant anon table SELECT", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /list_public_commerce_categories/);
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.doesNotMatch(sql, /grant select on table public\.commerce_/i);
    assert.doesNotMatch(sql, /create table public\.commerce_orders/);
    assert.doesNotMatch(sql, /razorpay|stripe|cashfree/i);
  });

  test("shop routes exist and cart/checkout do not", () => {
    assert.equal(existsSync(join(root, "src/app/shop/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/shop/c/[slug]/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/shop/product/[slug]/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/shop/search/page.tsx")), true);
    assert.equal(existsSync(join(root, "src/app/shop/cart")), false);
    assert.equal(existsSync(join(root, "src/app/shop/checkout")), false);
  });

  test("storefront copy has no cart, buy now, or checkout CTA", () => {
    const files = walkFiles(join(root, "src/features/commerce/public")).concat(
      walkFiles(join(root, "src/app/shop"))
    );
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /Add to Cart|Buy Now|Proceed to checkout|Checkout now/i);
    }
  });

  test("zero published products have an intentional empty state", () => {
    const page = readFileSync(join(root, "src/app/shop/page.tsx"), "utf8");
    assert.match(page, /collection is being prepared/);
    assert.match(page, /No published products are available/);
    assert.doesNotMatch(page, /fake product|lorem ipsum sofa/i);
  });

  test("sitemap includes /shop and does not swallow unexpected errors", () => {
    const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
    assert.match(sitemap, /absoluteUrl\("shop"\)/);
    assert.match(sitemap, /getPublicCommerceSitemap/);
    assert.match(sitemap, /isPublicCommerceReadFailure/);
  });

  test("core read errors are not empty-list sentinels", () => {
    const src = readFileSync(join(root, "src/features/commerce/public/public-queries.ts"), "utf8");
    assert.match(src, /PublicCommerceReadError/);
    assert.doesNotMatch(src, /return \{ items: \[\], total: 0 \}/);
    assert.ok(new PublicCommerceReadError("search") instanceof PublicCommerceReadError);
  });

  test("sitemap parser keeps only provided published/active slugs", () => {
    const parsed = parsePublicSitemap({
      categories: [{ slug: "beds", updated_at: "2026-08-23T00:00:00Z" }],
      products: [{ slug: "published-bed", updated_at: "2026-08-23T00:00:00Z" }],
    });
    assert.deepEqual(
      parsed.products.map((row) => row.slug),
      ["published-bed"]
    );
  });

  test("proxy matcher still excludes public shop", () => {
    const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
    assert.match(proxy, /\/admin\/:path\*/);
    assert.doesNotMatch(proxy, /\/shop/);
  });
});
