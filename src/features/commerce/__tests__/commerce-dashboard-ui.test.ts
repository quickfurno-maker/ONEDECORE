/**
 * Commerce Operations Suite dashboard UI contracts.
 * Source reads and domain helpers; no live database.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCommerceDashboardSnapshot, applyCommerceActionLabels } from "../domain/commerce-dashboard.ts";
import {
  assembleCommerceSettings,
  assertCommerceReadList,
  CommerceReadError,
  countProductsByCategory,
  readCommerceInventoryList,
  readCommerceProductRow,
} from "../domain/commerce-read.ts";

const root = process.cwd();

describe("Commerce dashboard UI phase gates", () => {
  test("overview does not include order or payment widgets", () => {
    const page = readFileSync(join(root, "src/app/admin/commerce/page.tsx"), "utf8");
    const view = readFileSync(
      join(root, "src/features/commerce/components/CommerceDashboardView.tsx"),
      "utf8"
    );
    const sidebar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminSidebar.tsx"),
      "utf8"
    );
    const combined = `${page}\n${view}\n${sidebar}`;
    assert.doesNotMatch(combined, /\bAOV\b|Abandoned cart|Refund rate|Orders Today|Record Payment/i);
    assert.doesNotMatch(sidebar, /\/admin\/commerce\/orders/);
    assert.doesNotMatch(sidebar, /\/admin\/commerce\/payments/);
    assert.doesNotMatch(sidebar, /\/admin\/commerce\/inventory/);
    assert.match(page, /Catalogue, inventory and storefront readiness/);
    assert.match(page, /\+ Add Product/);
    assert.match(page, /Manage Categories/);
    assert.doesNotMatch(page, /QuickActionsMenu/);
  });

  test("storefront banner copy is unchanged", () => {
    const src = readFileSync(
      join(root, "src/features/commerce/components/StorefrontDisabledBanner.tsx"),
      "utf8"
    );
    assert.match(
      src,
      /Public \/shop is disabled\. Production remains OFF\. Checkout and payments are not in this phase\./
    );
  });

  test("snapshot uses catalogue truth and omits invented low-stock", () => {
    const domain = readFileSync(
      join(root, "src/features/commerce/domain/commerce-dashboard.ts"),
      "utf8"
    );
    assert.doesNotMatch(domain, /stock\s*<\s*5/);
    assert.doesNotMatch(domain, /readinessPercent|82%/);
    const snapshot = buildCommerceDashboardSnapshot({
      products: [
        {
          id: "p1",
          product_reference: "OD-1",
          name: "Milano Sofa",
          slug: "milano-sofa",
          status: "published",
          featured: true,
          category_id: "c1",
          tax_rate_id: "t1",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "c1",
          name: "Sofas",
          parent_category_id: null,
          status: "active",
          seo_title: "Sofas",
          seo_description: null,
          sort_order: 0,
        },
      ],
      variants: [
        {
          id: "v1",
          product_id: "p1",
          sku: "od-sf-001",
          status: "active",
          availability_mode: "ready_stock",
          selling_price_paise: 1990000,
        },
      ],
      media: [
        {
          product_id: "p1",
          status: "active",
          is_primary: true,
          public_path: "commerce/public/p1.webp",
        },
      ],
      taxRates: [{ id: "t1", is_active: true }],
      taxRequiredForPublish: true,
      gstInclusiveDisplay: true,
      shippingPresent: true,
      pincodes: [
        {
          pincode: "560001",
          serviceable: true,
          zone_code: "BLR",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      inventory: [
        { variant_id: "v1", stock_on_hand: 4, reserved_qty: 1, available_qty: 3 },
      ],
      inventoryStatus: "ok",
    });
    assert.equal(snapshot.health.published, 1);
    assert.equal(snapshot.kpis.some((item) => item.label === "Published Products"), true);
    assert.equal(snapshot.kpis.some((item) => /sales|revenue|orders/i.test(item.label)), false);
    assert.equal(snapshot.inventory?.availableUnits, 3);
    assert.equal(snapshot.inventory?.reservedUnits, 1);
    assert.equal(snapshot.inventory?.zeroStock, 0);
    assert.equal(snapshot.featured[0]?.name, "Milano Sofa");
    assert.equal(snapshot.coverage.serviceable, 1);
    assert.equal(snapshot.readiness.readyPublished, 1);
  });
});

describe("Commerce dashboard read truth", () => {
  test("successful empty query is empty catalogue, not unavailable", () => {
    const rows = assertCommerceReadList({ data: [], error: null }, "commerce_products");
    assert.deepEqual(rows, []);
    const snapshot = buildCommerceDashboardSnapshot({
      products: [],
      categories: [],
      variants: [],
      media: [],
      taxRates: [],
      taxRequiredForPublish: true,
      gstInclusiveDisplay: true,
      shippingPresent: true,
      pincodes: [],
      inventory: [],
      inventoryStatus: "ok",
    });
    assert.equal(snapshot.health.published, 0);
    assert.equal(snapshot.inventory?.zeroStock, 0);
  });

  test("failed query throws unavailable instead of empty catalogue", () => {
    assert.throws(
      () => assertCommerceReadList({ data: null, error: { message: "relation does not exist" } }, "commerce_products"),
      (error: unknown) =>
        error instanceof CommerceReadError &&
        error.message === "Commerce data unavailable" &&
        !String(error.message).includes("relation does not exist")
    );
  });

  test("failed inventory query is unavailable, not zero stock", () => {
    const inventory = readCommerceInventoryList({ data: null, error: { message: "permission denied" } });
    assert.equal(inventory.status, "unavailable");
    const snapshot = buildCommerceDashboardSnapshot({
      products: [],
      categories: [],
      variants: [
        {
          id: "v1",
          product_id: "p1",
          sku: "od-sf-001",
          status: "active",
          availability_mode: "ready_stock",
          selling_price_paise: 100,
        },
      ],
      media: [],
      taxRates: [],
      taxRequiredForPublish: true,
      gstInclusiveDisplay: true,
      shippingPresent: true,
      pincodes: [],
      inventory: null,
      inventoryStatus: "unavailable",
    });
    assert.equal(snapshot.inventory, null);
    assert.equal(snapshot.inventoryStatus, "unavailable");
    assert.equal(snapshot.kpis.some((item) => item.id === "zero-stock"), false);
  });
});

describe("Commerce dashboard read-only actions", () => {
  test("commerce.read without manage flags uses view wording", () => {
    const snapshot = buildCommerceDashboardSnapshot({
      products: [
        {
          id: "p1",
          product_reference: "OD-1",
          name: "Milano Sofa",
          slug: "milano-sofa",
          status: "draft",
          featured: true,
          category_id: "c1",
          tax_rate_id: null,
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "c1",
          name: "Sofas",
          parent_category_id: null,
          status: "active",
          seo_title: null,
          seo_description: null,
          sort_order: 0,
        },
      ],
      variants: [],
      media: [],
      taxRates: [],
      taxRequiredForPublish: true,
      gstInclusiveDisplay: true,
      shippingPresent: false,
      pincodes: [],
      inventory: [],
      inventoryStatus: "ok",
    });
    const labeled = applyCommerceActionLabels(snapshot.attention, {
      canManageCatalog: false,
      canManageInventory: false,
      canManageSettings: false,
    });
    for (const item of labeled) {
      assert.doesNotMatch(item.actionLabel, /Fix Media|Adjust Inventory|Manage Pincodes|Manage Settings|^Variants$|^Publication$/);
      assert.match(item.actionLabel, /^View /);
      assert.match(item.href, /^\/admin\/commerce\//);
    }
    const view = readFileSync(
      join(root, "src/features/commerce/components/CommerceDashboardView.tsx"),
      "utf8"
    );
    assert.match(view, /canManageCatalog/);
    assert.match(view, /canManageInventory/);
    assert.match(view, /canManageSettings/);
  });
});

describe("Commerce settings and category read truth", () => {
  test("failed tax rates query is not zero tax rates", () => {
    assert.throws(
      () =>
        assembleCommerceSettings({
          taxRates: { data: null, error: { message: "relation does not exist" } },
          taxSettings: { data: null, error: null },
          shipping: { data: null, error: null },
          pincodes: { data: [], error: null },
        }),
      (error: unknown) => error instanceof CommerceReadError && error.context === "commerce_tax_rates"
    );
  });

  test("failed pincode query is not zero pincodes", () => {
    assert.throws(
      () =>
        assembleCommerceSettings({
          taxRates: { data: [], error: null },
          taxSettings: { data: null, error: null },
          shipping: { data: null, error: null },
          pincodes: { data: null, error: { message: "permission denied" } },
        }),
      (error: unknown) => error instanceof CommerceReadError && error.context === "commerce_pincodes"
    );
  });

  test("failed shipping read is not treated as unconfigured shipping", () => {
    assert.throws(
      () =>
        assembleCommerceSettings({
          taxRates: { data: [], error: null },
          taxSettings: { data: { gst_inclusive_display: true, tax_required_for_publish: true }, error: null },
          shipping: { data: null, error: { message: "timeout" } },
          pincodes: { data: [], error: null },
        }),
      (error: unknown) => error instanceof CommerceReadError && error.context === "commerce_shipping_settings"
    );
    const emptyShipping = assembleCommerceSettings({
      taxRates: { data: [], error: null },
      taxSettings: { data: { gst_inclusive_display: true, tax_required_for_publish: true }, error: null },
      shipping: { data: null, error: null },
      pincodes: { data: [], error: null },
    });
    assert.equal(emptyShipping.shipping, null);
  });

  test("failed categories query is not an empty category tree", () => {
    assert.throws(
      () => assertCommerceReadList({ data: null, error: { message: "could not find table" } }, "commerce_categories"),
      (error: unknown) => error instanceof CommerceReadError && error.context === "commerce_categories"
    );
  });

  test("failed products query is not category product count 0", () => {
    assert.throws(
      () => assertCommerceReadList({ data: null, error: { message: "could not find table" } }, "commerce_products"),
      CommerceReadError
    );
    const counts = countProductsByCategory([]);
    assert.deepEqual(counts, {});
  });

  test("successful empty categories and pincodes remain empty", () => {
    const categories = assertCommerceReadList({ data: [], error: null }, "commerce_categories");
    const settings = assembleCommerceSettings({
      taxRates: { data: [], error: null },
      taxSettings: { data: null, error: null },
      shipping: { data: null, error: null },
      pincodes: { data: [], error: null },
    });
    assert.deepEqual(categories, []);
    assert.equal(settings.pincodes.length, 0);
    assert.equal(settings.taxRates.length, 0);
  });

  test("product not-found is distinct from product-read failure", () => {
    assert.deepEqual(readCommerceProductRow({ data: null, error: null }, "commerce_products"), {
      status: "not_found",
    });
    assert.throws(
      () => readCommerceProductRow({ data: null, error: { message: "db down" } }, "commerce_products"),
      (error: unknown) =>
        error instanceof CommerceReadError && !String(error.message).includes("db down")
    );
  });

  test("generic error UI contains no raw Postgres or Supabase message", () => {
    const ui = readFileSync(
      join(root, "src/features/commerce/components/CommerceDataUnavailable.tsx"),
      "utf8"
    );
    assert.match(ui, /Commerce data unavailable/);
    assert.doesNotMatch(ui, /postgres|supabase|relation does not exist|42P01|PGRST/i);
    const error = new CommerceReadError("commerce_tax_rates");
    assert.equal(error.message, "Commerce data unavailable");
    assert.doesNotMatch(error.message, /postgres|supabase/i);
  });
});
