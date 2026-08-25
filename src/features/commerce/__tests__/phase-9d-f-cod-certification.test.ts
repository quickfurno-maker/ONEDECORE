/**
 * Phase 9D-F — COD-only storefront certification contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { shopListingHasQueryDuplicates, serializeJsonLd } from "../public/shop-seo.ts";
import { buildProductJsonLd } from "../public/product-jsonld.ts";
import { parsePublicProductDetail } from "../public/public-parsers.ts";
import {
  issueCommerceTrackProof,
  verifyCommerceTrackProof,
} from "../server/commerce-track-proof.ts";
import { getCommerceRuntimeEnv } from "../server/commerce-runtime-env.ts";

const root = process.cwd();
const secret = "d2-test-commerce-runtime-secret-32chars-min";
process.env.ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET = secret;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function latestMigrationName(): string {
  const files = readdirSync(join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? "";
}

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) acc.push(full);
    else if (entry.name === "package.json") acc.push(full);
  }
  return acc;
}

describe("Phase 9D-F baseline and payment absence", () => {
  test("latest migration remains M37 and M38 is absent", () => {
    assert.equal(latestMigrationName(), "20260824140000_commerce_order_cod_checkout_foundation.sql");
    assert.equal(readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).length, 38);
    assert.equal(
      existsSync(join(root, "supabase/migrations/20260825140000_commerce_online_payment_adapter_foundation.sql")),
      false
    );
  });

  test("no payment provider package, webhook, or runtime adapter on main", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      assert.doesNotMatch(name, /razorpay|stripe|cashfree|phonepe|payu/i);
    }
    assert.equal(existsSync(join(root, "src/app/api/webhooks/commerce")), false);
    const checkout = read("src/features/commerce/server/checkout-actions.ts");
    const form = read("src/features/commerce/public/components/ShopCheckoutForm.tsx");
    const admin = read("src/features/commerce/components/CommerceOrderDetailPanel.tsx");
    assert.match(checkout, /paymentMethod:\s*"cod"/);
    assert.doesNotMatch(checkout, /placeOnline|razorpay|stripe/i);
    assert.match(form, /Cash on delivery only/);
    assert.match(form, /Place COD order/);
    assert.doesNotMatch(form, /UPI|card|net banking|Pay now|Razorpay/i);
    assert.doesNotMatch(admin, /refund|capture payment|mark paid/i);
    const commerceSrc = walkTs(join(root, "src/features/commerce"))
      .concat(walkTs(join(root, "src/app/shop")))
      .filter((file) => !file.includes(`${join("features", "commerce", "__tests__")}`));
    for (const file of commerceSrc) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /razorpay|stripe|cashfree|phonepe|payu/i);
    }
  });

  test("production shop remains OFF and campaign production gate default is false", () => {
    const banner = read("src/features/commerce/components/StorefrontDisabledBanner.tsx");
    assert.match(
      banner,
      /Public \/shop stays OFF until ONEDECORE_SHOP_PUBLIC_ENABLED=true\. Guest COD is fail-closed while the gate is off; online payments remain deferred to Phase 9D-E\./
    );
    const example = read(".env.example");
    assert.match(example, /ONEDECORE_PROVIDER_DATA_SHARING_ENABLED=false/);
    assert.match(example, /ONEDECORE_SHOP_PUBLIC_ENABLED=false/);
    assert.doesNotMatch(example, /NEXT_PUBLIC_ONEDECORE_SHOP_PUBLIC_ENABLED|PRODUCTION_ACTIVATION=ON/);
  });
});

describe("Phase 9D-F SEO and robots", () => {
  test("transactional routes are noindex nofollow and absent from sitemap", () => {
    const cart = read("src/app/shop/cart/page.tsx");
    const checkout = read("src/app/shop/checkout/page.tsx");
    const track = read("src/app/shop/track/page.tsx");
    const order = read("src/app/shop/order/[orderReference]/page.tsx");
    const search = read("src/app/shop/search/page.tsx");
    for (const src of [cart, checkout, track, order]) {
      assert.match(src, /index:\s*false/);
      assert.match(src, /follow:\s*false/);
    }
    assert.match(search, /index:\s*false/);
    const sitemap = read("src/app/sitemap.ts");
    assert.match(sitemap, /absoluteUrl\("shop"\)/);
    assert.doesNotMatch(sitemap, /\/shop\/cart|\/shop\/checkout|\/shop\/track|\/shop\/order|\/shop\/search/);
  });

  test("robots keeps admin and API disallows", () => {
    const robots = read("src/app/robots.ts");
    assert.match(robots, /\/admin\//);
    assert.match(robots, /\/api\/admin\//);
    assert.match(robots, /\/auth\//);
  });

  test("indexable shop/category/PDP/home/interiors expose canonical and Open Graph", () => {
    const shop = read("src/app/shop/page.tsx");
    const category = read("src/app/shop/c/[slug]/page.tsx");
    const product = read("src/app/shop/product/[slug]/page.tsx");
    const home = read("src/app/page.tsx");
    const interiors = read("src/app/interiors/page.tsx");
    assert.match(shop, /shopOpenGraph/);
    assert.match(shop, /canonical: absoluteUrl\("shop"\)/);
    assert.match(category, /shopOpenGraph/);
    assert.match(category, /shopListingHasQueryDuplicates/);
    assert.match(product, /shopOpenGraph/);
    assert.match(home, /openGraph:/);
    assert.match(interiors, /openGraph:/);
    assert.match(interiors, /canonical: absoluteUrl\("interiors"\)/);
  });

  test("filtered listing query params are treated as non-indexable duplicates", () => {
    assert.equal(shopListingHasQueryDuplicates({}), false);
    assert.equal(shopListingHasQueryDuplicates({ utm_source: "ad" }), false);
    assert.equal(shopListingHasQueryDuplicates({ sort: "price_low_high" }), true);
    assert.equal(shopListingHasQueryDuplicates({ page: "2" }), true);
    assert.equal(shopListingHasQueryDuplicates({ q: "bed" }), true);
  });

  test("product JSON-LD uses INR from variant paise and never invents reviews", () => {
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
    assert.equal((json.offers as { priceCurrency: string }).priceCurrency, "INR");
    assert.equal((json.offers as { price: string }).price, "42500.00");
    assert.equal("aggregateRating" in json, false);
    assert.equal("review" in json, false);
    assert.match(serializeJsonLd({ name: "</script>x" }), /\\u003c\/script>x/);
  });
});

describe("Phase 9D-F security and accessibility contracts", () => {
  test("commerce runtime secret is server-only and fail-closed", () => {
    const example = read(".env.example");
    assert.match(example, /ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET=/);
    assert.match(example, /never NEXT_PUBLIC/);
    assert.doesNotMatch(example, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
    assert.throws(() =>
      getCommerceRuntimeEnv({ ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET: "short" } as unknown as NodeJS.ProcessEnv)
    );
  });

  test("tracking proof cookie is httpOnly, rejects tamper and expiry, and carries no PII", () => {
    const cookie = read("src/features/commerce/server/commerce-track-cookie.ts");
    assert.match(cookie, /httpOnly:\s*true/);
    assert.match(cookie, /sameSite:\s*"lax"/);
    const proof = issueCommerceTrackProof("OD-O-2026-000001");
    assert.doesNotMatch(proof.value, /mobile|email|@|\+91/i);
    assert.equal(verifyCommerceTrackProof(proof.value, "OD-O-2026-000001"), true);
    assert.equal(verifyCommerceTrackProof(`${proof.value}x`, "OD-O-2026-000001"), false);
    const parsed = JSON.parse(Buffer.from(proof.value, "base64url").toString("utf8")) as {
      payload: { expiresAt: number };
      signature: string;
    };
    parsed.payload.expiresAt = Date.now() - 1000;
    const expired = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
    assert.equal(verifyCommerceTrackProof(expired, "OD-O-2026-000001"), false);
  });

  test("order snapshot and tracking do not put raw mobile in the URL or public view", () => {
    const snapshot = read("src/features/commerce/public/components/ShopOrderSnapshotView.tsx");
    const track = read("src/features/commerce/server/tracking-actions.ts");
    const trackForm = read("src/features/commerce/public/components/ShopTrackForm.tsx");
    assert.doesNotMatch(snapshot, /mobileE164|customerMobile/);
    assert.match(track, /TRACKING_MISMATCH_MESSAGE/);
    assert.doesNotMatch(track, /redirect\(.*mobile/);
    assert.match(trackForm, /searchParams.get\("order"\)/);
    assert.doesNotMatch(trackForm, /searchParams.get\("mobile"\)/);
  });

  test("admin order mutations stay session-RPC and never leak SQLSTATE copy", () => {
    const actions = read("src/features/commerce/server/order-admin-actions.ts");
    assert.match(actions, /createClient\(\)/);
    assert.match(actions, /transition_commerce_order_fulfilment/);
    assert.match(actions, /cancel_commerce_order/);
    assert.match(actions, /staffSafeOrderError/);
    assert.doesNotMatch(actions, /SQLSTATE|PostgREST|message: normalized\.code/);
    assert.doesNotMatch(actions, /createAdminClient/);
  });

  test("checkout has no browser price authority and public errors hide internals", () => {
    const checkout = read("src/features/commerce/server/checkout-actions.ts");
    const errors = read("src/features/commerce/server/commerce-public-errors.ts");
    assert.doesNotMatch(checkout, /sellingPricePaise|subtotalPaise|totalPaise.*formData/);
    assert.match(errors, /toCommercePublicMessage/);
    assert.doesNotMatch(errors, /SQLSTATE/);
  });

  test("document language, labelled purchase controls, and drawer Escape remain", () => {
    assert.match(read("src/app/layout.tsx"), /<html lang="en">/);
    const purchase = read("src/features/commerce/public/components/ShopPurchasePanel.tsx");
    const cart = read("src/features/commerce/public/components/ShopCartView.tsx");
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    const pincode = read("src/features/commerce/public/components/ShopPincodeChecker.tsx");
    assert.match(purchase, /aria-label="Decrease quantity"/);
    assert.match(purchase, /htmlFor=\{`qty-\$\{variant\.sku\}`\}/);
    assert.match(cart, /aria-label=\{`Decrease quantity for/);
    assert.match(header, /event\.key === "Escape"/);
    assert.match(pincode, /Final cash-on-delivery availability is confirmed at checkout/);
    assert.doesNotMatch(pincode, /Ordering is not enabled yet/);
    assert.match(read("src/features/commerce/public/shop.css"), /min-height: 2\.75rem/);
  });

  test("category breadcrumbs use parent name, not slug", () => {
    const category = read("src/app/shop/c/[slug]/page.tsx");
    assert.match(category, /parentName/);
    assert.doesNotMatch(category, /\{loaded\.category\.parentSlug\}<\/Link>/);
  });

  test("commerce logs do not print raw mobile or service-role secrets", () => {
    const files = walkTs(join(root, "src/features/commerce"));
    for (const file of files) {
      if (file.includes(`${join("__tests__")}`)) continue;
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /console\.(log|info|debug|error|warn)\(/);
    }
  });
});
