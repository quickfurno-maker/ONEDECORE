/**
 * Phase 9D-D1 — COD order engine repository contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { CommerceOrderError, normalizeCommerceOrderError } from "../orders/order-errors.ts";
import { parseCommerceCartQuote, parseCommerceCodOrderReceipt } from "../orders/order-parsers.ts";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase/migrations/20260824140000_commerce_order_cod_checkout_foundation.sql"
);

describe("Phase 9D-D1 repository contracts", () => {
  test("M37 exists and does not add payment tables or provider adapters", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /create table public\.commerce_orders/);
    assert.match(sql, /create_public_commerce_cod_order/);
    assert.match(sql, /quote_public_commerce_cart/);
    assert.match(sql, /consume_commerce_public_rate_limit/);
    assert.match(sql, /network_fingerprint_hash/);
    assert.doesNotMatch(sql, /create table public\.commerce_payments/);
    assert.doesNotMatch(sql, /razorpay|stripe|cashfree|phonepe/i);
    assert.doesNotMatch(sql, /grant execute on function public\.create_public_commerce_cod_order[^\n]+ to anon/);
    assert.doesNotMatch(sql, /grant execute on function public\.quote_public_commerce_cart[^\n]+ to anon/);
  });

  test("D1 does not add cart checkout or track UI routes", () => {
    assert.equal(existsSync(join(root, "src/app/shop/cart")), false);
    assert.equal(existsSync(join(root, "src/app/shop/checkout")), false);
    assert.equal(existsSync(join(root, "src/app/shop/track")), false);
    assert.equal(existsSync(join(root, "src/app/shop/order")), false);
  });

  test("quote parser rejects stock leakage", () => {
    assert.throws(
      () =>
        parseCommerceCartQuote({
          lines: [],
          subtotal_paise: 0,
          discount_paise: 0,
          tax_paise: 0,
          shipping_paise: 0,
          total_paise: 0,
          pincode: "411001",
          serviceable: true,
          eta_min_days: 1,
          eta_max_days: 3,
          assembly_install_note: null,
          cod_allowed: true,
          stock_on_hand: 4,
        }),
      /malformed/
    );
  });

  test("COD receipt parser requires confirmed snapshot only", () => {
    const receipt = parseCommerceCodOrderReceipt({
      order_reference: "OD-O-2026-000001",
      status: "confirmed",
      total_paise: 123000,
    });
    assert.equal(receipt.orderReference, "OD-O-2026-000001");
    assert.throws(
      () => parseCommerceCodOrderReceipt({ order_reference: "OD-O-2026-000001", status: "pending_payment", total_paise: 1 }),
      /malformed/
    );
  });

  test("normalizes SQL error messages to the stable D1 set", () => {
    const err = normalizeCommerceOrderError({ message: "COMMERCE_INVENTORY_UNAVAILABLE" });
    assert.ok(err instanceof CommerceOrderError);
    assert.equal(err.code, "COMMERCE_INVENTORY_UNAVAILABLE");
  });

  test("generated types include exact M37 FK relationships and the seven public RPCs", () => {
    const types = readFileSync(join(root, "src/types/database.generated.ts"), "utf8");
    for (const name of [
      "commerce_orders_contact_id_fkey",
      "commerce_order_items_order_id_fkey",
      "commerce_order_items_product_id_fkey",
      "commerce_order_items_variant_id_fkey",
      "commerce_order_delivery_order_id_fkey",
      "commerce_order_events_order_id_fkey",
      "commerce_order_events_actor_profile_id_fkey",
    ]) {
      assert.match(types, new RegExp(name));
    }
    for (const rpc of [
      "quote_public_commerce_cart",
      "create_public_commerce_cod_order",
      "verify_public_commerce_order_tracking_identity",
      "get_public_commerce_order_tracking_snapshot",
      "consume_commerce_public_rate_limit",
      "transition_commerce_order_fulfilment",
      "cancel_commerce_order",
    ]) {
      assert.match(types, new RegExp(`${rpc}: \\{`));
    }
  });
});
