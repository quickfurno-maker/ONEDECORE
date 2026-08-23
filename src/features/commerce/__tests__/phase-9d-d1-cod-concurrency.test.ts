/**
 * True local concurrency proof for COD oversell protection.
 * Two independent postgres clients via the local Supabase DB container.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);
const CONTAINER = "supabase_db_OneDecore";

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

describe("Phase 9D-D1 local COD concurrency", () => {
  test("two simultaneous qty=1 COD calls against stock=1 yield one order", async (t) => {
    try {
      await execFileAsync("docker", ["inspect", CONTAINER]);
    } catch {
      t.skip("local Supabase DB container is not running");
      return;
    }

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
