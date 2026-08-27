/**
 * Phase 9D-D2 — cart, guest COD checkout, secure tracking, admin orders UI contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  COMMERCE_BUY_NOW_STORAGE_KEY,
  COMMERCE_CART_MAX_LINES,
  COMMERCE_CART_MAX_QTY,
  COMMERCE_CART_STORAGE_KEY,
} from "../cart/cart-types.ts";
import {
  commerceCartCanonicalLines,
  emptyCommerceCartSnapshot,
  hasCommerceCartPii,
  parseCommerceCartSnapshot,
  upsertCommerceCartItem,
} from "../cart/cart-storage.ts";
import { issueCommerceReviewToken, verifyCommerceReviewToken } from "../server/commerce-review-token.ts";
import {
  COMMERCE_TRACK_COOKIE_NAME,
  issueCommerceTrackProof,
  verifyCommerceTrackProof,
} from "../server/commerce-track-proof.ts";
import { getCommerceRuntimeEnv } from "../server/commerce-runtime-env.ts";
import { TRACKING_MISMATCH_MESSAGE } from "../server/commerce-public-errors.ts";

const root = process.cwd();
const secret = "d2-test-commerce-runtime-secret-32chars-min";
process.env.ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET = secret;
const migrationDir = join(root, "supabase/migrations");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function latestMigrationName(): string {
  const files = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
  return files.at(-1) ?? "";
}

describe("Phase 9D-D2 repository contracts", () => {
  test("latest migration is CRM 2A-6 My Day read model; deferred payment M38 absent", () => {
    assert.equal(
      latestMigrationName(),
      "20260829120000_crm_my_day_read_model.sql"
    );
    assert.equal(readdirSync(migrationDir).filter((n) => n.endsWith(".sql")).length, 43);
    assert.equal(
      existsSync(join(migrationDir, "20260825140000_commerce_online_payment_adapter_foundation.sql")),
      false
    );
  });

  test("transactional shop routes exist with noindex metadata", () => {
    const cart = read("src/app/shop/cart/page.tsx");
    const checkout = read("src/app/shop/checkout/page.tsx");
    const track = read("src/app/shop/track/page.tsx");
    const order = read("src/app/shop/order/[orderReference]/page.tsx");
    assert.match(cart, /index:\s*false/);
    assert.match(checkout, /index:\s*false/);
    assert.match(track, /index:\s*false/);
    assert.match(order, /index:\s*false/);
    assert.match(order, /readCommerceTrackProofForReference/);
    assert.match(order, /getPublicCommerceOrderTrackingSnapshot/);
  });

  test("sitemap does not include cart/checkout/track/order URLs", () => {
    const sitemap = read("src/app/sitemap.ts");
    assert.doesNotMatch(sitemap, /\/shop\/cart|\/shop\/checkout|\/shop\/track|\/shop\/order/);
  });

  test("cart storage key, bounds, corrupt recovery, and canonical lines", () => {
    assert.equal(COMMERCE_CART_STORAGE_KEY, "onedecore.commerce.cart.v1");
    assert.equal(COMMERCE_BUY_NOW_STORAGE_KEY, "onedecore.commerce.buy-now.v1");
    assert.equal(COMMERCE_CART_MAX_LINES, 20);
    assert.equal(COMMERCE_CART_MAX_QTY, 20);
    const corrupt = parseCommerceCartSnapshot("{not-json");
    assert.deepEqual(corrupt.items, []);
    const wrongVersion = parseCommerceCartSnapshot(JSON.stringify({ version: 2, items: [] }));
    assert.deepEqual(wrongVersion.items, []);
    let snapshot = emptyCommerceCartSnapshot();
    snapshot = upsertCommerceCartItem(snapshot, {
      sku: "D2-BED-OAK",
      quantity: 2,
      sellingPricePaise: 99900,
    });
    assert.deepEqual(commerceCartCanonicalLines(snapshot), [{ sku: "d2-bed-oak", quantity: 2 }]);
    assert.equal(hasCommerceCartPii(snapshot), false);
    for (let i = 0; i < 25; i += 1) {
      snapshot = upsertCommerceCartItem(snapshot, { sku: `sku-${i}`, quantity: 1 });
    }
    assert.equal(snapshot.items.length, 20);
  });

  test("PDP uses exact variant SKU; listing cards do not invent SKU actions", () => {
    const pdp = read("src/features/commerce/public/components/ShopProductDetail.tsx");
    const purchase = read("src/features/commerce/public/components/ShopPurchasePanel.tsx");
    const card = read("src/features/commerce/public/components/ShopProductCard.tsx");
    assert.match(pdp, /ShopPurchasePanel/);
    assert.match(purchase, /variant\.sku/);
    assert.doesNotMatch(card, /Add to Cart|addItem|buy-now/i);
  });

  test("checkout server boundary uses M37 wrappers and review token guard", () => {
    const checkout = read("src/features/commerce/server/checkout-actions.ts");
    const queries = read("src/features/commerce/orders/order-queries.ts");
    assert.match(checkout, /quotePublicCommerceCart/);
    assert.match(checkout, /createPublicCommerceCodOrder/);
    assert.match(checkout, /consumeCommercePublicRateLimit/);
    assert.match(checkout, /verifyCommerceReviewToken/);
    assert.match(checkout, /reviewTokenMatchesQuote/);
    assert.match(checkout, /deriveCommerceRequestFingerprints/);
    assert.doesNotMatch(checkout, /sellingPricePaise|subtotalPaise|totalPaise.*formData/);
    assert.match(queries, /createAdminClient/);
    assert.doesNotMatch(read("src/features/commerce/server/order-admin-queries.ts"), /createAdminClient/);
  });

  test("tracking uses generic mismatch copy and proof cookie without PII", () => {
    const tracking = read("src/features/commerce/server/tracking-actions.ts");
    assert.match(tracking, /TRACKING_MISMATCH_MESSAGE/);
    assert.match(tracking, /setCommerceTrackProofCookie/);
    assert.match(tracking, /verifyPublicCommerceOrderTrackingIdentity/);
    assert.equal(TRACKING_MISMATCH_MESSAGE, "We couldn't verify those order details.");
    const proof = issueCommerceTrackProof("OD-O-2026-000001");
    assert.equal(COMMERCE_TRACK_COOKIE_NAME, "od_commerce_track_v1");
    assert.doesNotMatch(proof.value, /mobile|email|@|\+91/i);
    assert.ok(verifyCommerceTrackProof(proof.value, "OD-O-2026-000001"));
    assert.equal(verifyCommerceTrackProof(proof.value, "OD-O-2026-000002"), false);
    assert.equal(verifyCommerceTrackProof(`${proof.value}x`, "OD-O-2026-000001"), false);
  });

  test("review token is signed, expiring, and rejects tamper", () => {
    const { token } = issueCommerceReviewToken({
      lines: [{ sku: "d2-bed-oak", quantity: 1 }],
      pincode: "411001",
      totalPaise: 118000,
    });
    const payload = verifyCommerceReviewToken(token);
    assert.ok(payload);
    assert.equal(payload?.totalPaise, 118000);
    assert.equal(verifyCommerceReviewToken(`${token.slice(0, -1)}x`), null);
  });

  test("runtime secret validation requires >= 32 chars server-only name", () => {
    const example = read(".env.example");
    assert.match(example, /ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET=/);
    assert.match(example, /never NEXT_PUBLIC/i);
    assert.throws(() =>
      getCommerceRuntimeEnv({ ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET: "short" } as unknown as NodeJS.ProcessEnv)
    );
    assert.ok(
      getCommerceRuntimeEnv({ ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET: secret } as unknown as NodeJS.ProcessEnv)
        .publicRuntimeSecret
    );
  });

  test("HMAC domains and network precedence are locked", () => {
    const crypto = read("src/features/commerce/server/commerce-crypto.ts");
    const network = read("src/features/commerce/server/commerce-network.ts");
    const fingerprints = read("src/features/commerce/server/commerce-fingerprints.ts");
    for (const domain of [
      "commerce-network-v1",
      "commerce-phone-v1",
      "commerce-track-proof-v1",
      "commerce-quote-review-v1",
    ]) {
      assert.match(crypto, new RegExp(`"${domain}"`));
    }
    assert.match(network, /x-real-ip/);
    assert.match(network, /x-forwarded-for/);
    assert.match(network, /unknown/);
    assert.doesNotMatch(fingerprints, /console\.log.*mobile|raw.*ip/i);
  });

  test("admin orders read via session client; mutations use canonical RPCs only", () => {
    const reads = read("src/features/commerce/server/order-admin-queries.ts");
    const actions = read("src/features/commerce/server/order-admin-actions.ts");
    assert.match(reads, /createClient\(\)/);
    assert.match(actions, /transition_commerce_order_fulfilment/);
    assert.match(actions, /cancel_commerce_order/);
    assert.match(actions, /canManageOrders/);
    assert.doesNotMatch(actions, /\.from\("commerce_orders"\)\.update/);
    assert.match(read("src/features/commerce/components/CommerceAdminLinks.tsx"), /\/admin\/commerce\/orders/);
    assert.ok(existsSync(join(root, "src/app/admin/commerce/orders/page.tsx")));
  });

  test("shop header exposes cart link only in shop context", () => {
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    assert.match(header, /ShopCartLink/);
    assert.match(header, /current === "shop"/);
  });

  test("checkout success clears buy-now session only for buy-now mode", () => {
    const form = read("src/features/commerce/public/components/ShopCheckoutForm.tsx");
    assert.match(form, /clearBuyNowSession/);
    assert.match(form, /clearCart/);
    assert.match(form, /checkoutMode === "buy-now"/);
  });

  test("same-as-customer disables delivery contact only, not address fields", () => {
    const form = read("src/features/commerce/public/components/ShopCheckoutForm.tsx");
    assert.doesNotMatch(form, /<fieldset disabled=\{sameAsCustomer\}>/);
    assert.match(form, /id="recipientName"[\s\S]*disabled=\{sameAsCustomer\}/);
    assert.match(form, /id="deliveryMobile"[\s\S]*disabled=\{sameAsCustomer\}/);
    assert.match(form, /id="addressLine1" name="addressLine1" required/);
    assert.match(form, /id="locality" name="locality" required/);
  });
});
