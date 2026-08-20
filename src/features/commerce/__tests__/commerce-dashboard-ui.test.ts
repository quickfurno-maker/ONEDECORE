/**
 * Commerce Operations Suite dashboard UI contracts.
 * Source reads and domain helpers; no live database.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildCommerceDashboardSnapshot } from "../domain/commerce-dashboard.ts";

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
