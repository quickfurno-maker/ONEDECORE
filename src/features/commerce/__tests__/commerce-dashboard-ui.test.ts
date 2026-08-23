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
import {
  basisPointsToPercentInput,
  mapPercentFieldToBasisPoints,
  mapRupeesFieldToPaise,
  paiseToRupeesInput,
  percentStringToBasisPoints,
  rupeesStringToPaise,
} from "../ui/operator-units.ts";
import { captureDrawerRestorationTarget, isDrawerEscapeKey, restoreDrawerFocus } from "../ui/drawer-keys.ts";
import { shouldShowCatalogueOnboardingEmpty } from "../ui/product-empty-state.ts";

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

  test("overview header and catalogue health follow category-first onboarding", () => {
    const page = readFileSync(join(root, "src/app/admin/commerce/page.tsx"), "utf8");
    const view = readFileSync(
      join(root, "src/features/commerce/components/CommerceDashboardView.tsx"),
      "utf8"
    );
    assert.match(page, /graph\.categories\.length/);
    assert.match(page, /Create Category/);
    assert.match(page, /href="\/admin\/commerce\/categories"/);
    assert.match(page, /href="\/admin\/commerce\/products"/);
    assert.match(page, /hasCategories=\{hasCategories\}/);
    assert.match(page, /graphLoaded/);
    assert.match(page, /permissions\.canManageCatalog && graphLoaded/);
    assert.doesNotMatch(page, /role === "super_admin"/);
    assert.match(view, /hasCategories/);
    assert.match(view, /canManageCatalog && hasCategories/);
    assert.match(view, /canManageCatalog && !hasCategories/);
    assert.match(view, /Create a category before adding products/);
    assert.match(view, /href="\/admin\/commerce\/categories"/);
    assert.match(view, />\s*Create Category\s*</);
    assert.match(view, /href="\/admin\/commerce\/products"/);
    assert.match(view, />\s*Add Product\s*</);
    assert.doesNotMatch(view, /healthTotal === 0[\s\S]*canManageCatalog \? \(/);
    assert.doesNotMatch(`${page}\n${view}`, /\bAOV\b|Abandoned cart|\/shop activation|Orders Today|Record Payment/i);
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

describe("Commerce operations workspace UX", () => {
  test("product create form is on-demand, not in the products page flow", () => {
    const page = readFileSync(join(root, "src/app/admin/commerce/products/page.tsx"), "utf8");
    const workspace = readFileSync(
      join(root, "src/features/commerce/components/ProductsWorkspace.tsx"),
      "utf8"
    );
    assert.doesNotMatch(page, /ProductCreateForm/);
    assert.match(workspace, /CommerceActionDrawer/);
    assert.match(workspace, /ProductCreateForm/);
    assert.match(workspace, /canManageCatalog/);
    assert.match(workspace, /Create Category/);
    assert.match(workspace, /Create your first category before adding products/);
    assert.match(workspace, /Build your furniture catalogue/);
  });

  test("category create form is on-demand and example names are display-only", () => {
    const page = readFileSync(join(root, "src/app/admin/commerce/categories/page.tsx"), "utf8");
    const workspace = readFileSync(
      join(root, "src/features/commerce/components/CategoriesWorkspace.tsx"),
      "utf8"
    );
    const classes = readFileSync(join(root, "src/features/commerce/ui/commerce-classes.ts"), "utf8");
    const actions = readFileSync(join(root, "src/features/commerce/server/commerce-actions.ts"), "utf8");
    const tree = readFileSync(join(root, "src/features/commerce/components/CategoryTree.tsx"), "utf8");
    assert.doesNotMatch(page, /CategoryForm/);
    assert.match(workspace, /CommerceActionDrawer/);
    assert.match(workspace, /Create First Category/);
    assert.match(classes, /Sofas.*Beds.*Dining.*Chairs.*Storage/);
    assert.doesNotMatch(actions, /Sofas|Beds|Dining/);
    assert.match(tree, /parent_category_id === null/);
    assert.match(tree, /parent_category_id === id/);
    assert.doesNotMatch(tree, /drag/i);
  });

  test("settings and operator forms use rupees and percent, not storage units", () => {
    const settingsPage = readFileSync(join(root, "src/app/admin/commerce/settings/page.tsx"), "utf8");
    const workspace = readFileSync(
      join(root, "src/features/commerce/components/SettingsWorkspace.tsx"),
      "utf8"
    );
    const shipping = readFileSync(
      join(root, "src/features/commerce/components/ShippingSettingsForm.tsx"),
      "utf8"
    );
    const taxRate = readFileSync(join(root, "src/features/commerce/components/TaxRateForm.tsx"), "utf8");
    const taxSettings = readFileSync(
      join(root, "src/features/commerce/components/TaxSettingsForm.tsx"),
      "utf8"
    );
    const category = readFileSync(join(root, "src/features/commerce/components/CategoryForm.tsx"), "utf8");
    const variant = readFileSync(join(root, "src/features/commerce/components/VariantForm.tsx"), "utf8");
    const product = readFileSync(
      join(root, "src/features/commerce/components/ProductGeneralForm.tsx"),
      "utf8"
    );
    const combined = `${shipping}\n${taxRate}\n${category}\n${variant}\n${product}\n${workspace}`;
    assert.match(settingsPage, /SettingsWorkspace/);
    assert.match(shipping, /Default shipping charge \(₹\)/);
    assert.match(taxRate, /Rate \(%\)/);
    assert.match(workspace, /Locked ON/);
    assert.match(workspace, /No tax rates configured/);
    assert.match(workspace, /No pincodes configured/);
    assert.match(workspace, /pincode-level/);
    assert.match(taxSettings, /GST-inclusive pricing — locked for ONEDECORE MVP/);
    assert.doesNotMatch(taxSettings, /gstInclusiveDisplay/);
    assert.doesNotMatch(combined, /Rate \(basis points\)|Shipping override \(paise\)|Selling price \(paise\)|Default shipping charge \(paise\)|\bbps\)/);
    assert.match(shipping, /defaultShippingChargePaise/);
    assert.match(taxRate, /rateBasisPoints/);
  });

  test("rupee and percent conversions are exact", () => {
    assert.equal(rupeesStringToPaise("499"), 49900);
    assert.equal(rupeesStringToPaise("499.50"), 49950);
    assert.equal(rupeesStringToPaise("499.5"), 49950);
    assert.equal(rupeesStringToPaise("499.555"), null);
    assert.equal(rupeesStringToPaise("-1"), null);
    assert.equal(paiseToRupeesInput(49900), "499");
    assert.equal(paiseToRupeesInput(49950), "499.50");
    assert.equal(percentStringToBasisPoints("18"), 1800);
    assert.equal(percentStringToBasisPoints("18.25"), 1825);
    assert.equal(percentStringToBasisPoints("100.01"), null);
    assert.equal(basisPointsToPercentInput(1800), "18");
    assert.equal(basisPointsToPercentInput(1825), "18.25");
    const money = new FormData();
    money.set("shippingChargeRupeesOverride", "12.50");
    assert.equal(mapRupeesFieldToPaise(money, "shippingChargeRupeesOverride", "shippingChargePaiseOverride", false), null);
    assert.equal(money.get("shippingChargePaiseOverride"), "1250");
    const percent = new FormData();
    percent.set("ratePercent", "18");
    assert.equal(mapPercentFieldToBasisPoints(percent, "ratePercent", "rateBasisPoints"), null);
    assert.equal(percent.get("rateBasisPoints"), "1800");
  });

  test("commerce subnav and sidebar preserve current-route and focus-visible", () => {
    const links = readFileSync(
      join(root, "src/features/commerce/components/CommerceAdminLinks.tsx"),
      "utf8"
    );
    const sidebar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminSidebar.tsx"),
      "utf8"
    );
    const drawer = readFileSync(
      join(root, "src/features/commerce/components/CommerceActionDrawer.tsx"),
      "utf8"
    );
    const tokens = readFileSync(join(root, "src/features/admin-ops/tokens.css"), "utf8");
    assert.match(links, /usePathname/);
    assert.match(links, /aria-current=\{current \? "page"/);
    assert.match(sidebar, /groupActive/);
    assert.match(sidebar, /focus-visible:outline/);
    assert.match(sidebar, /ops-scrollbar/);
    assert.match(tokens, /scrollbar-color/);
    assert.match(tokens, /::-webkit-scrollbar/);
    assert.match(drawer, /role="dialog"/);
    assert.match(drawer, /aria-modal="true"/);
    assert.match(drawer, /isDrawerEscapeKey/);
    assert.match(drawer, /captureDrawerRestorationTarget/);
    assert.match(drawer, /restoreDrawerFocus/);
    assert.doesNotMatch(drawer, /triggerRef/);
    assert.equal(isDrawerEscapeKey("Escape"), true);
    assert.equal(isDrawerEscapeKey("Enter"), false);
  });
});

const idleFilters = {
  q: "",
  status: "all",
  category: "all",
  featured: "all",
  mode: "all",
  media: "all",
};

describe("Commerce catalogue empty-state truth", () => {
  test("unfiltered empty catalogue uses onboarding empty state", () => {
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 0,
        filters: idleFilters,
      }),
      true
    );
    const page = readFileSync(join(root, "src/app/admin/commerce/products/page.tsx"), "utf8");
    const workspace = readFileSync(
      join(root, "src/features/commerce/components/ProductsWorkspace.tsx"),
      "utf8"
    );
    assert.match(page, /shouldShowCatalogueOnboardingEmpty/);
    assert.doesNotMatch(page, /catalogueEmpty=\{workspace\.products\.length === 0\}/);
    assert.match(workspace, /Build your furniture catalogue/);
  });

  test("q active with zero results is filtered empty, not onboarding", () => {
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 0,
        filters: { ...idleFilters, q: "missing-sku" },
      }),
      false
    );
  });

  test("status active with zero results is filtered empty, not onboarding", () => {
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 0,
        filters: { ...idleFilters, status: "published" },
      }),
      false
    );
  });

  test("category active with zero rows is filtered empty, not onboarding", () => {
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 3,
        filters: { ...idleFilters, category: "sofas" },
      }),
      false
    );
  });

  test("featured, mode, and media active with zero rows are filtered empty, not onboarding", () => {
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 2,
        filters: { ...idleFilters, featured: "true" },
      }),
      false
    );
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 2,
        filters: { ...idleFilters, mode: "ready_stock" },
      }),
      false
    );
    assert.equal(
      shouldShowCatalogueOnboardingEmpty({
        rowCount: 0,
        returnedProductCount: 2,
        filters: { ...idleFilters, media: "missing" },
      }),
      false
    );
  });
});

describe("Commerce drawer focus restoration origin", () => {
  test("header Add Product opener is restored on close and Escape", () => {
    const header = mockFocusable("header");
    const emptyState = mockFocusable("empty");
    let target = captureDrawerRestorationTarget({
      wasOpen: false,
      isOpen: true,
      currentlyFocused: header,
      existingTarget: null,
    });
    assert.equal(target, header);
    target = captureDrawerRestorationTarget({
      wasOpen: true,
      isOpen: true,
      currentlyFocused: emptyState,
      existingTarget: target,
    });
    assert.equal(target, header);
    assert.equal(isDrawerEscapeKey("Escape"), true);
    assert.equal(restoreDrawerFocus(target), true);
    assert.equal(header.focusCalls, 1);
    assert.equal(emptyState.focusCalls, 0);
  });

  test("empty-state Add Product and Create First Category restore their own buttons", () => {
    const emptyAdd = mockFocusable("empty-add");
    const createFirst = mockFocusable("create-first");
    const emptyTarget = captureDrawerRestorationTarget({
      wasOpen: false,
      isOpen: true,
      currentlyFocused: emptyAdd,
      existingTarget: null,
    });
    assert.equal(emptyTarget, emptyAdd);
    assert.equal(restoreDrawerFocus(emptyTarget), true);
    const createTarget = captureDrawerRestorationTarget({
      wasOpen: false,
      isOpen: true,
      currentlyFocused: createFirst,
      existingTarget: null,
    });
    assert.equal(createTarget, createFirst);
    assert.equal(restoreDrawerFocus(createTarget), true);
    assert.equal(emptyAdd.focusCalls, 1);
    assert.equal(createFirst.focusCalls, 1);
  });

  test("category Edit and settings Manage restore the exact opener after panel switches", () => {
    const edit = mockFocusable("edit");
    const manage = mockFocusable("manage");
    const innerAddRate = mockFocusable("inner-add-rate");
    const categoryTarget = captureDrawerRestorationTarget({
      wasOpen: false,
      isOpen: true,
      currentlyFocused: edit,
      existingTarget: null,
    });
    assert.equal(
      captureDrawerRestorationTarget({
        wasOpen: true,
        isOpen: true,
        currentlyFocused: innerAddRate,
        existingTarget: categoryTarget,
      }),
      edit
    );
    assert.equal(restoreDrawerFocus(categoryTarget), true);
    const settingsTarget = captureDrawerRestorationTarget({
      wasOpen: false,
      isOpen: true,
      currentlyFocused: manage,
      existingTarget: null,
    });
    assert.equal(
      captureDrawerRestorationTarget({
        wasOpen: true,
        isOpen: true,
        currentlyFocused: innerAddRate,
        existingTarget: settingsTarget,
      }),
      manage
    );
    assert.equal(restoreDrawerFocus(settingsTarget), true);
    assert.equal(edit.focusCalls, 1);
    assert.equal(manage.focusCalls, 1);
    assert.equal(innerAddRate.focusCalls, 0);
    const products = readFileSync(
      join(root, "src/features/commerce/components/ProductsWorkspace.tsx"),
      "utf8"
    );
    const categories = readFileSync(
      join(root, "src/features/commerce/components/CategoriesWorkspace.tsx"),
      "utf8"
    );
    const settings = readFileSync(
      join(root, "src/features/commerce/components/SettingsWorkspace.tsx"),
      "utf8"
    );
    assert.doesNotMatch(`${products}\n${categories}\n${settings}`, /triggerRef/);
  });
});

describe("Commerce server-action type boundary", () => {
  test("commerce-actions does not re-export CommerceActionResult at runtime", () => {
    const src = readFileSync(join(root, "src/features/commerce/server/commerce-actions.ts"), "utf8");
    assert.match(src, /^"use server";/m);
    assert.doesNotMatch(src, /export type \{ CommerceActionResult \}/);
    assert.doesNotMatch(src, /export type \{[^}]*CommerceActionResult/);
    assert.match(src, /type CommerceActionResult/);
    assert.match(src, /from "\.\/commerce-errors"/);
    assert.match(src, /export async function upsertCommerceCategoryAction/);
    const actionExports = src.match(/^export async function \w+Action\(/gm) ?? [];
    assert.equal(actionExports.length > 0, true);
    for (const line of actionExports) {
      assert.match(line, /^export async function /);
    }
  });
});

function mockFocusable(id: string) {
  return {
    id,
    isConnected: true,
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
  };
}