/**
 * True local concurrency proofs for COD oversell and public rate-limit admission.
 * Two independent postgres clients via the local Supabase DB container.
 * Dedicated CI execution must fail if the container is absent — never skip.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);
const CONTAINER = "supabase_db_OneDecore";

async function assertLocalDbAvailable(): Promise<void> {
  try {
    await execFileAsync("docker", ["inspect", CONTAINER]);
  } catch {
    throw new Error(
      `D1 concurrency requires local container ${CONTAINER}. ` +
        (process.env.ONEDECORE_REQUIRE_D1_CONCURRENCY === "1"
          ? "ONEDECORE_REQUIRE_D1_CONCURRENCY=1 is set."
          : "Start local Supabase before npm run test:phase-9d-d1-concurrency.")
    );
  }
}

async function psql(sql: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync("docker", [
    "exec",
    "-i",
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-c",
    sql,
  ]);
  if (stderr && /ERROR/i.test(stderr)) throw new Error(stderr);
  return stdout.trim();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("Phase 9D-D1 local COD concurrency", () => {
  test("two simultaneous qty=1 COD calls against stock=1 yield one order", async () => {
    await assertLocalDbAvailable();

    const suffix = Date.now().toString(36);
    const seq = String(Date.now()).slice(-6);
    const sku = `d1-race-${suffix}`;
    const actor = "9d111111-1111-1111-1111-111111111111";
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const taxId = crypto.randomUUID();
    const keyA = crypto.randomUUID();
    const keyB = crypto.randomUUID();

    await psql(`
      insert into auth.users (id, instance_id, email, aud, role)
      values ('${actor}', '00000000-0000-0000-0000-000000000000', 'sa-d1-${suffix}@onedecore.local', 'authenticated', 'authenticated')
      on conflict (id) do nothing;
      update public.profiles set status = 'active' where id = '${actor}';
      insert into public.commerce_tax_rates (id, code, name, rate_basis_points, is_active, created_by)
      values ('${taxId}', 'GST18${seq}', 'GST 18', 1800, true, '${actor}');
      insert into public.commerce_categories (id, category_reference, name, slug, status, created_by)
      values ('${categoryId}', 'OD-CC-2026-${seq}', 'Race ${suffix}', 'race-${suffix}', 'active', '${actor}');
      insert into public.commerce_products (
        id, product_reference, category_id, name, slug, status, tax_rate_id, created_by, published_at
      ) values (
        '${productId}', 'OD-P-2026-${seq}', '${categoryId}', 'Race Bed', 'race-bed-${suffix}',
        'published', '${taxId}', '${actor}', now()
      );
      insert into public.commerce_product_variants (
        id, product_id, sku, option_values, selling_price_paise, availability_mode, status, created_by
      ) values (
        '${variantId}', '${productId}', '${sku}', '{"color":"oak"}'::jsonb, 100000, 'ready_stock', 'active', '${actor}'
      );
      insert into public.commerce_inventory (variant_id, stock_on_hand, reserved_qty)
      values ('${variantId}', 1, 0)
      on conflict (variant_id) do update set stock_on_hand = 1, reserved_qty = 0;
      insert into public.commerce_pincodes (pincode, serviceable, eta_min_days, eta_max_days)
      values ('412888', true, 3, 7)
      on conflict (pincode) do update set serviceable = true;
    `);

    const seeded = await psql(
      `select stock_on_hand::text from public.commerce_inventory where variant_id = '${variantId}'`
    );
    assert.equal(seeded, "1", `ready-stock seed must be 1, got ${seeded}`);

    const callSql = (key: string) => `
      select create_public_commerce_cod_order(
        '[{"sku":"${sku}","quantity":1}]'::jsonb,
        '{"name":"Race Guest","mobile":"+919811110001"}'::jsonb,
        '{"recipient_name":"Race Guest","mobile":"+919811110001","address_line_1":"12 FC Road","locality":"Shivaji","city":"Pune","state":"Maharashtra","pincode":"412888"}'::jsonb,
        '${key}'
      )::text;
    `;

    const [first, second] = await Promise.allSettled([psql(callSql(keyA)), psql(callSql(keyB))]);
    const texts = [first, second].map((result) =>
      result.status === "fulfilled" ? result.value : String(result.reason)
    );
    const successes = texts.filter((text) => text.includes("OD-O-")).length;
    const unavailable = texts.filter((text) => text.includes("COMMERCE_INVENTORY_UNAVAILABLE")).length;
    assert.equal(successes, 1, `expected one success, got ${texts.join(" | ")}`);
    assert.equal(unavailable, 1, `expected one inventory miss, got ${texts.join(" | ")}`);

    const stock = await psql(
      `select stock_on_hand || ',' || reserved_qty from public.commerce_inventory where variant_id = '${variantId}'`
    );
    assert.equal(stock, "0,0");
    const orders = await psql(`select count(*)::text from public.commerce_order_items where sku = '${sku}'`);
    assert.equal(orders, "1");
  });
});

describe("Phase 9D-D1 local rate-limit concurrency", () => {
  test("checkout phone boundary admits exactly one of two simultaneous calls", async () => {
    await assertLocalDbAvailable();
    const nonce = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    const networkHash = sha256Hex(`d1-checkout-net-${nonce}`);
    const phoneHash = sha256Hex(`d1-checkout-phone-${nonce}`);

    await psql(`
      insert into private.commerce_public_request_attempts (
        operation, network_fingerprint_hash, phone_fingerprint_hash
      )
      select 'checkout', '${networkHash}', '${phoneHash}'
      from generate_series(1, 4);
    `);

    const callSql = `
      select consume_commerce_public_rate_limit('checkout', '${networkHash}', '${phoneHash}')::text;
    `;
    const [first, second] = await Promise.allSettled([psql(callSql), psql(callSql)]);
    const texts = [first, second].map((result) =>
      result.status === "fulfilled" ? result.value : String(result.reason)
    );
    const parsed = texts.map((text) => {
      const match = text.match(/\{.*\}/);
      assert.ok(match, `expected json result, got ${text}`);
      return JSON.parse(match[0]) as { allowed: boolean; retry_after_seconds: number };
    });
    const allowed = parsed.filter((row) => row.allowed).length;
    const blocked = parsed.filter((row) => !row.allowed).length;
    assert.equal(allowed, 1, `expected one allowed checkout, got ${texts.join(" | ")}`);
    assert.equal(blocked, 1, `expected one blocked checkout, got ${texts.join(" | ")}`);
    assert.ok(
      parsed.some((row) => !row.allowed && row.retry_after_seconds > 0),
      "blocked checkout must return retry_after_seconds > 0"
    );

    const phoneCount = await psql(`
      select count(*)::text
      from private.commerce_public_request_attempts
      where operation = 'checkout' and phone_fingerprint_hash = '${phoneHash}'
    `);
    const networkCount = await psql(`
      select count(*)::text
      from private.commerce_public_request_attempts
      where operation = 'checkout' and network_fingerprint_hash = '${networkHash}'
    `);
    assert.equal(phoneCount, "5");
    assert.equal(networkCount, "5");
  });

  test("network-only track admits exactly one of two simultaneous calls at the cap", async () => {
    await assertLocalDbAvailable();
    const nonce = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    const networkHash = sha256Hex(`d1-track-net-${nonce}`);

    await psql(`
      insert into private.commerce_public_request_attempts (
        operation, network_fingerprint_hash, phone_fingerprint_hash
      )
      select 'track', '${networkHash}', null
      from generate_series(1, 19);
    `);

    const callSql = `
      select consume_commerce_public_rate_limit('track', '${networkHash}', null)::text;
    `;
    const [first, second] = await Promise.allSettled([psql(callSql), psql(callSql)]);
    const texts = [first, second].map((result) =>
      result.status === "fulfilled" ? result.value : String(result.reason)
    );
    const parsed = texts.map((text) => {
      const match = text.match(/\{.*\}/);
      assert.ok(match, `expected json result, got ${text}`);
      return JSON.parse(match[0]) as { allowed: boolean; retry_after_seconds: number };
    });
    assert.equal(parsed.filter((row) => row.allowed).length, 1, `expected one allowed track, got ${texts.join(" | ")}`);
    assert.equal(parsed.filter((row) => !row.allowed).length, 1, `expected one blocked track, got ${texts.join(" | ")}`);

    const networkCount = await psql(`
      select count(*)::text
      from private.commerce_public_request_attempts
      where operation = 'track' and network_fingerprint_hash = '${networkHash}'
    `);
    assert.equal(networkCount, "20");
  });
});
