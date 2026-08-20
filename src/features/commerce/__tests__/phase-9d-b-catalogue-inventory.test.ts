/**
 * Phase 9D-B — commerce catalogue/inventory admin application tests.
 * Source reads and unit helpers; no live database.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { parsePaiseInteger, validateOptionValues } from "../domain/option-values.ts";
import { isPublicationReady } from "../domain/publication.ts";
import { evaluateCommerceMediaUploadAuth } from "../server/commerce-media-auth.ts";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase/migrations/20260822140000_commerce_catalogue_inventory_foundation.sql"
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

describe("Phase 9D-B RBAC and migration contracts", () => {
  test("six commerce RBAC codes exist in the foundation migration", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const code of [
      "commerce.read",
      "commerce.catalog.manage",
      "commerce.inventory.manage",
      "commerce.orders.manage",
      "commerce.payments.read",
      "commerce.settings.manage",
    ]) {
      assert.match(sql, new RegExp(`'${code.replace(".", "\\.")}'`));
    }
  });

  test("SA and SM grant comments/blocks in migration", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /r\.code = 'super_admin'/);
    assert.match(sql, /r\.code = 'sales_manager'/);
    assert.match(
      sql,
      /super_admin[\s\S]*commerce\.catalog\.manage[\s\S]*commerce\.inventory\.manage[\s\S]*commerce\.settings\.manage/
    );
    const smBlock = sql.slice(sql.indexOf("sales_manager"));
    assert.match(smBlock, /commerce\.read/);
    assert.doesNotMatch(smBlock.slice(0, 400), /commerce\.catalog\.manage/);
  });

  test("migration has no commerce_orders table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.doesNotMatch(sql, /commerce_orders/);
  });

  test("no hardcoded GST statutory seed into commerce_tax_rates", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.doesNotMatch(
      sql,
      /insert into public\.commerce_tax_rates[\s\S]{0,800}\b(18|5|12)\b/i
    );
  });

  test("inventory RPC has no reserved_qty argument", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /adjust_commerce_inventory\(p_variant_id uuid,p_delta integer,p_reason text,p_idempotency_key uuid\)/
    );
    assert.doesNotMatch(sql, /adjust_commerce_inventory\([^)]*reserved_qty/);
  });

  test("CRM records are not auto-created by the commerce migration", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.doesNotMatch(sql, /insert into public\.leads/i);
    assert.doesNotMatch(sql, /insert into public\.contacts/i);
  });
});

describe("Phase 9D-B admin surface and storefront gate", () => {
  test("no /shop route files", () => {
    const appDir = join(root, "src/app");
    const files = walkFiles(appDir);
    assert.equal(
      files.some((file) => file.replace(/\\/g, "/").includes("/shop")),
      false
    );
  });

  test("admin commerce routes exist", () => {
    for (const rel of [
      "src/app/admin/commerce/page.tsx",
      "src/app/admin/commerce/categories/page.tsx",
      "src/app/admin/commerce/products/page.tsx",
      "src/app/admin/commerce/products/[id]/page.tsx",
      "src/app/admin/commerce/settings/page.tsx",
    ]) {
      assert.equal(existsSync(join(root, rel)), true, rel);
    }
  });

  test("StorefrontDisabledBanner text", () => {
    const src = readFileSync(
      join(root, "src/features/commerce/components/StorefrontDisabledBanner.tsx"),
      "utf8"
    );
    assert.match(
      src,
      /Public \/shop is disabled\. Production remains OFF\. Checkout and payments are not in this phase\./
    );
    assert.match(src, /role="status"/);
  });

  test("sitemap has no /shop", () => {
    const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
    assert.doesNotMatch(sitemap, /\/shop/);
  });

  test("commerce feature has no razorpay or stripe", () => {
    const files = walkFiles(join(root, "src/features/commerce")).filter(
      (file) => !file.replace(/\\/g, "/").includes("/__tests__/")
    );
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /razorpay|stripe/i);
    }
  });
});

describe("Phase 9D-B option values, paise, and publication", () => {
  test("option_values validation", () => {
    assert.equal(validateOptionValues({}), null);
    assert.equal(validateOptionValues({ color: "walnut" }), null);
    assert.match(validateOptionValues({ material: "oak" }) ?? "", /color, finish, size, or upholstery/);
    assert.match(validateOptionValues({ color: "" }) ?? "", /1 and 64/);
    assert.match(validateOptionValues("x") ?? "", /object/);
  });

  test("paise is integer only", () => {
    assert.equal(parsePaiseInteger("19900"), 19900);
    assert.equal(parsePaiseInteger(19900), 19900);
    assert.equal(parsePaiseInteger("19.9"), null);
    assert.equal(parsePaiseInteger(19.9), null);
    const domain = walkFiles(join(root, "src/features/commerce/domain")).map((file) =>
      readFileSync(file, "utf8")
    );
    assert.equal(
      domain.some((src) => /selling_price_rupees|price_inr\s*\*|\/\s*100/.test(src)),
      false
    );
  });

  test("publication readiness listed", () => {
    const src = readFileSync(join(root, "src/features/commerce/domain/publication.ts"), "utf8");
    assert.match(src, /active category/i);
    assert.match(src, /selling_price_paise/);
    assert.match(src, /tax_required_for_publish/);
    assert.match(src, /primary media/i);
    assert.equal(
      isPublicationReady({
        name: "Lounge chair",
        categoryStatus: "active",
        hasActivePricedVariant: true,
        taxRequiredForPublish: true,
        hasActiveTaxRate: true,
        hasActivePrimaryMedia: true,
      }),
      true
    );
    assert.equal(
      isPublicationReady({
        name: "Lounge chair",
        categoryStatus: "active",
        hasActivePricedVariant: true,
        taxRequiredForPublish: true,
        hasActiveTaxRate: false,
        hasActivePrimaryMedia: true,
      }),
      false
    );
  });
});

describe("Phase 9D-B media privilege order", () => {
  test("evaluateCommerceMediaUploadAuth denies before privilege", () => {
    assert.deepEqual(evaluateCommerceMediaUploadAuth(false), { allowed: false });
    assert.deepEqual(evaluateCommerceMediaUploadAuth(true), { allowed: true });
  });

  test("authorize appears before createAdminClient in commerce-media source", () => {
    const src = readFileSync(join(root, "src/features/commerce/server/commerce-media.ts"), "utf8");
    const authorizeIdx = src.indexOf("authorize");
    const evalIdx = src.indexOf("evaluateCommerceMediaUploadAuth");
    const adminIdx = src.indexOf("createAdminClient");
    assert.ok(authorizeIdx >= 0 && evalIdx >= 0 && adminIdx >= 0);
    assert.ok(authorizeIdx < adminIdx);
    assert.ok(evalIdx < adminIdx);
    const deniedReturn = src.indexOf("COMMERCE_UNAUTHORIZED");
    assert.ok(deniedReturn >= 0 && deniedReturn < adminIdx);
  });
});
