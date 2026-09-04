/**
 * Phase 10 â€” COD production readiness contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  isShopPublicEnabled,
  SHOP_PUBLIC_ENABLED_ENV,
} from "../server/shop-public-gate.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 10 COD production readiness", () => {
  test("shop public gate fails closed and is not NEXT_PUBLIC", () => {
    assert.equal(SHOP_PUBLIC_ENABLED_ENV, "ONEDECORE_SHOP_PUBLIC_ENABLED");
    assert.equal(isShopPublicEnabled({}), false);
    assert.equal(isShopPublicEnabled({ ONEDECORE_SHOP_PUBLIC_ENABLED: "false" }), false);
    assert.equal(isShopPublicEnabled({ ONEDECORE_SHOP_PUBLIC_ENABLED: "1" }), false);
    assert.equal(isShopPublicEnabled({ ONEDECORE_SHOP_PUBLIC_ENABLED: "true" }), true);
    const example = read(".env.example");
    assert.match(example, /ONEDECORE_SHOP_PUBLIC_ENABLED=false/);
    assert.doesNotMatch(example, /NEXT_PUBLIC_ONEDECORE_SHOP_PUBLIC_ENABLED/);
  });

  test("shop layout and checkout/track enforce the public gate", () => {
    const layout = read("src/app/shop/layout.tsx");
    const shopPage = read("src/app/shop/page.tsx");
    const categoryPage = read("src/app/shop/c/[slug]/page.tsx");
    const productPage = read("src/app/shop/product/[slug]/page.tsx");
    const checkout = read("src/features/commerce/server/checkout-actions.ts");
    const tracking = read("src/features/commerce/server/tracking-actions.ts");
    const sitemap = read("src/app/sitemap.ts");
    assert.match(layout, /isShopPublicEnabled/);
    assert.match(layout, /ShopPublicInactive/);
    assert.match(shopPage, /isShopPublicEnabled/);
    assert.match(categoryPage, /isShopPublicEnabled/);
    assert.match(productPage, /isShopPublicEnabled/);
    assert.match(checkout, /isShopPublicEnabled/);
    assert.match(tracking, /isShopPublicEnabled/);
    assert.match(sitemap, /isShopPublicEnabled/);
    assert.match(sitemap, /force-dynamic/);
    assert.match(sitemap, /if \(shopPublic\)/);
  });

  test("homepage discovery commerce fails closed before public catalogue reads", () => {
    const page = read("src/app/page.tsx");
    assert.match(
      page,
      /import\s+\{\s*isShopPublicEnabled\s*\}\s+from\s+"@\/features\/commerce\/server\/shop-public-gate"/
    );
    assert.match(page, /getPublicCommerceCategories/);
    assert.match(page, /getPublicCommerceProducts/);
    assert.doesNotMatch(page, /ONEDECORE_SHOP_PUBLIC_ENABLED/);

    const loaderStart = page.indexOf("async function loadDiscoveryCommerce");
    assert.ok(loaderStart >= 0, "loadDiscoveryCommerce must exist");
    const loader = page.slice(loaderStart);
    const gateIdx = loader.search(/if\s*\(\s*!isShopPublicEnabled\s*\(\s*\)\s*\)/);
    const categoriesIdx = loader.indexOf("getPublicCommerceCategories");
    const productsIdx = loader.indexOf("getPublicCommerceProducts");
    assert.ok(gateIdx >= 0, "homepage must call isShopPublicEnabled() before commerce reads");
    assert.ok(categoriesIdx >= 0, "homepage must retain getPublicCommerceCategories for shop-ON");
    assert.ok(productsIdx >= 0, "homepage must retain getPublicCommerceProducts for shop-ON");
    assert.ok(
      gateIdx < categoriesIdx && gateIdx < productsIdx,
      "isShopPublicEnabled() must precede public commerce category/product reads"
    );
    assert.match(loader, /return\s*\{\s*ok:\s*false\s*\}/);
  });

  test("server action body size limit is 21mb", () => {
    const nextConfig = read("next.config.ts");
    const experimental = nextConfig.match(
      /experimental:\s*\{[\s\S]*?serverActions:\s*\{[\s\S]*?bodySizeLimit:\s*"([^"]+)"/
    );
    assert.equal(experimental?.[1], "21mb");
  });

  test("security headers and health probe exist without payment routes", () => {
    const nextConfig = read("next.config.ts");
    const health = read("src/app/api/health/route.ts");
    assert.match(nextConfig, /X-Content-Type-Options/);
    assert.match(nextConfig, /Referrer-Policy/);
    assert.match(nextConfig, /X-Frame-Options/);
    assert.match(nextConfig, /Permissions-Policy/);
    assert.doesNotMatch(nextConfig, /Content-Security-Policy/);
    assert.match(health, /ok:\s*true/);
    assert.match(health, /no-store/);
    assert.equal(existsSync(join(root, "src/app/api/webhooks/commerce")), false);
    assert.equal(
      readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).length,
      56
    );
  });

  test("activating shop cannot require payment provider env", () => {
    const example = read(".env.example");
    assert.doesNotMatch(example, /RAZORPAY|STRIPE|CASHFREE|PHONEPE|PAYU/i);
    assert.match(example, /ONEDECORE_CAMPAIGN_EXECUTION_MODE=disabled/);
    assert.match(example, /ONEDECORE_PROVIDER_DATA_SHARING_ENABLED=false/);
  });
});
