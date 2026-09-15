import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  COMMERCE_POLICY_BUNDLE_VERSION,
  COMMERCE_POLICY_EFFECTIVE_DATE,
  COMMERCE_POLICY_PATHS,
  COMMERCE_POLICY_VERSIONS,
  currentCommercePolicyAcceptance,
} from "../public/commerce-policy.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("E-commerce launch closeout", () => {
  test("retail policy bundle is versioned and effective", () => {
    assert.equal(COMMERCE_POLICY_EFFECTIVE_DATE, "2026-09-15");
    assert.equal(COMMERCE_POLICY_BUNDLE_VERSION, "commerce-policy-bundle-v1.0");
    assert.equal(COMMERCE_POLICY_VERSIONS.terms, "terms-of-use-v1.0");
    assert.deepEqual(currentCommercePolicyAcceptance(), {
      accepted: true,
      bundle_version: "commerce-policy-bundle-v1.0",
      terms_version: "terms-of-use-v1.0",
      shipping_delivery_version: "commerce-shipping-delivery-v1.0",
      cancellation_version: "commerce-cancellation-v1.0",
      returns_refunds_version: "commerce-returns-refunds-v1.0",
      product_warranty_version: "commerce-product-warranty-v1.0",
    });
  });

  test("all four commerce policy routes exist and fail closed for indexing", () => {
    for (const path of Object.values(COMMERCE_POLICY_PATHS)) {
      const slug = path.slice(1);
      const file = join(root, `src/app/(legal)/${slug}/page.tsx`);
      assert.ok(existsSync(file), `${path} exists`);
      const page = read(`src/app/(legal)/${slug}/page.tsx`);
      assert.match(page, /isShopPublicEnabled/);
      assert.match(page, /published: isShopPublicEnabled\(\)/);
    }
  });

  test("checkout requires policy acceptance and server records current versions", () => {
    const form = read("src/features/commerce/public/components/ShopCheckoutForm.tsx");
    const action = read("src/features/commerce/server/checkout-actions.ts");
    const queries = read("src/features/commerce/orders/order-queries.ts");
    assert.match(form, /name="policyAccepted" required/);
    assert.match(form, /Shipping & Delivery/);
    assert.match(form, /Returns & Refunds/);
    assert.match(form, /Product Warranty/);
    assert.match(action, /formData\.get\("policyAccepted"\) === "on"/);
    assert.match(action, /currentCommercePolicyAcceptance\(\)/);
    assert.match(queries, /create_public_commerce_cod_order_v2/);
    assert.match(queries, /p_policy_acceptance/);
  });

  test("policy acceptance migration is immutable, service-role-only and COD-only", () => {
    const migration = read("supabase/migrations/20260919120000_commerce_checkout_policy_acceptance.sql");
    assert.match(migration, /commerce_order_policy_acceptances/);
    assert.match(migration, /trg_commerce_order_policy_acceptances_immutable/);
    assert.match(migration, /create_public_commerce_cod_order_v2/);
    assert.match(migration, /grant execute[\s\S]*to service_role/);
    assert.match(migration, /payment provider, no M38 payment surface/i);
    assert.doesNotMatch(migration, /razorpay|stripe|cashfree|phonepe|payu/i);
  });

  test("PDP and commerce footer expose customer policy routes", () => {
    const pdp = read("src/features/commerce/public/components/ShopProductDetail.tsx");
    const nav = read("src/features/commerce/public/shell/commerce-nav.ts");
    assert.match(pdp, /COMMERCE_POLICY_PATHS\.shippingDelivery/);
    assert.match(pdp, /COMMERCE_POLICY_PATHS\.returnsRefunds/);
    assert.match(nav, /Shipping & Delivery/);
    assert.match(nav, /Cancellation/);
    assert.match(nav, /Returns & Refunds/);
    assert.match(nav, /Product Warranty/);
  });

  test("commerce policies enter sitemap only with the shop gate", () => {
    const sitemap = read("src/app/sitemap.ts");
    const shopBlock = sitemap.slice(sitemap.indexOf("if (shopPublic)"));
    assert.match(shopBlock, /shipping-delivery/);
    assert.match(shopBlock, /cancellation/);
    assert.match(shopBlock, /returns-refunds/);
    assert.match(shopBlock, /product-warranty/);
  });
});
