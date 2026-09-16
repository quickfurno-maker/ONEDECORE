import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Commerce vendor operational control", () => {
  test("vendor portal is private and admin-owned", () => {
    const login = read("src/app/vendor/login/page.tsx");
    const nav = read("src/features/commerce/vendor/components/VendorNav.tsx");
    assert.match(login, /created and controlled by OneDecore administration/i);
    assert.match(nav, /Dashboard/);
    assert.match(nav, /My Products/);
    assert.match(nav, /Stock/);
    assert.match(nav, /Add Product/);
    assert.doesNotMatch(nav, /Account|Profile|Register/i);
    assert.equal(existsSync(join(root, "src/app/vendor/register")), false);
  });

  test("vendor login fails closed before portal access", () => {
    const route = read("src/app/vendor/login/submit/route.ts");
    assert.match(route, /sameOrigin\(request\)/);
    assert.match(route, /MAX_BODY_BYTES/);
    assert.match(route, /safeVendorRedirect/);
    assert.match(route, /signInWithPassword/);
    assert.match(route, /get_my_commerce_vendor/);
    assert.match(route, /signOut\(\)/);
    assert.match(route, /no-cache, no-store/);
  });

  test("vendors cannot self-manage credentials or account lifecycle", () => {
    const actions = read("src/features/commerce/vendor/vendor-actions.ts");
    assert.doesNotMatch(actions, /auth\.updateUser|changeVendorPassword|resetPassword/);
    assert.doesNotMatch(actions, /set_commerce_vendor_status|create_commerce_vendor/);
    assert.equal(existsSync(join(root, "src/app/vendor/(portal)/account/page.tsx")), false);
  });

  test("admin owns vendor account creation, credentials and lifecycle", () => {
    const actions = read("src/features/commerce/vendor/vendor-admin-actions.ts");
    assert.match(actions, /auth\.admin\.createUser/);
    assert.match(actions, /create_commerce_vendor/);
    assert.match(actions, /auth\.admin\.updateUserById/);
    assert.match(actions, /set_commerce_vendor_status/);
    assert.match(actions, /deleteUser/);
  });

  test("vendor stock workspace owns quantity and sales availability only", () => {
    const stock = read("src/features/commerce/vendor/components/VendorStockWorkspace.tsx");
    const actions = read("src/features/commerce/vendor/vendor-actions.ts");
    assert.match(stock, /Stock quantity/);
    assert.match(stock, /Pause sales/);
    assert.match(stock, /Enable sales/);
    assert.match(stock, /reserved unit/);
    assert.match(actions, /set_my_vendor_inventory_quantity/);
    assert.match(actions, /set_my_vendor_product_sales_state/);
  });

  test("database migration enforces ownership and checkout availability", () => {
    const migration = read("supabase/migrations/20260920140000_commerce_vendor_operational_controls.sql");
    assert.match(migration, /vendor_sales_enabled boolean not null default true/);
    assert.match(migration, /set_my_vendor_product_sales_state/);
    assert.match(migration, /set_my_vendor_inventory_quantity/);
    assert.match(migration, /private\.commerce_require_vendor\(\)/);
    assert.match(migration, /p_stock_on_hand < i\.reserved_qty/);
    assert.match(migration, /p\.vendor_id = v_vendor/);
    assert.match(migration, /p\.vendor_sales_enabled is not true/);
    assert.match(migration, /COMMERCE_ORDER_UNAVAILABLE/);
  });

  test("vendor login authorization is isolated from staff profile activation", () => {
    const migration = read("supabase/migrations/20260920143000_commerce_vendor_login_auth_boundary.sql");
    assert.match(migration, /r\.code = 'commerce_vendor'/);
    assert.match(migration, /p\.code = 'commerce\.vendor\.access'/);
    assert.match(migration, /v\.status = 'active'/);
    assert.doesNotMatch(migration, /private\.has_permission\('commerce\.vendor\.access'\)/);
    const staffAuth = read("supabase/migrations/20260903160000_staff_phone_login_credentials.sql");
    assert.match(staffAuth, /prof\.status = 'active'/);
  });
  test("admin review stays separate from publication", () => {
    const review = read("src/features/commerce/vendor/components/VendorReviewPanel.tsx");
    const adminPage = read("src/app/admin/commerce/vendor-review/page.tsx");
    assert.match(review, /Approve/);
    assert.match(review, /Request changes/);
    assert.match(review, /Reject/);
    assert.match(review, /Assign an active category/);
    assert.match(adminPage, /Vendor Review/);
    assert.doesNotMatch(review, /Publish product|publishCommerceProductAction/);
  });
});
