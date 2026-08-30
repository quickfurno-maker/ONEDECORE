/**
 * Phase 10E — interior-first launch closeout regression tests.
 *
 * Locks the three launch-certification defects repaired in this phase:
 *  1. hero trust metrics must be truthful in the server-rendered / no-JS HTML;
 *  2. Shop utilities (search, cart) must stay fail-closed with the Shop gate,
 *     including on the /shop inactive boundary;
 *  3. the Shop-OFF boundary must not show internal engineering/gate wording.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { HOME_CLAIMS } from "../home-r4/claims.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 10E — interior launch closeout", () => {
  test("hero trust counters seed from the approved claim, not zero", () => {
    const trust = read(
      "src/features/public-site/discovery/DiscoveryHeroTrustBar.tsx"
    );
    // Server render must emit the real claim; a useState(0) seed would ship
    // "0+ Projects Delivered" / "0.0/5" to every pre-hydration and no-JS visitor.
    assert.match(trust, /useState\(target\)/);
    assert.doesNotMatch(trust, /useState\(0\)/);
    // Values still come from the single claims source of truth.
    assert.match(trust, /HOME_CLAIMS\.projectsDelivered/);
    assert.match(trust, /HOME_CLAIMS\.rating/);
    // Motion behaviour is unchanged.
    assert.match(trust, /IntersectionObserver/);
    assert.match(trust, /prefers-reduced-motion/);
  });

  test("interiors metric counter keeps the same truthful server-render seed", () => {
    const counter = read(
      "src/features/public-site/home-r4/VerifiedMetricCounter.tsx"
    );
    assert.match(counter, /useState\(value\)/);
    assert.doesNotMatch(counter, /useState\(0\)/);
  });

  test("approved claims stay non-zero so the seeded render is meaningful", () => {
    assert.ok(HOME_CLAIMS.projectsDelivered > 0);
    assert.ok(HOME_CLAIMS.rating > 0);
  });

  test("shop search and cart utilities are gated on shopEnabled", () => {
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    assert.match(
      header,
      /const showSearch =\s*\n?\s*shopEnabled && \(current === "shop" \|\| \(current === "home" && showShopSearch\)\);/
    );
    assert.match(header, /const showCart = shopEnabled && current === "shop";/);
    // No remaining commerce utility that keys off `current` alone.
    assert.doesNotMatch(header, /\{current === "shop" \? \(?\s*<ShopCartLink/);
    assert.doesNotMatch(
      header,
      /const showSearch = current === "shop" \|\| \(current === "home" && showShopSearch\)/
    );
  });

  test("the header's only commerce links are the two gated utilities", () => {
    const header = read("src/features/public-site/chrome/PublicSiteHeader.tsx");
    // Desktop bar + mobile drawer, and nothing else.
    assert.deepEqual(header.match(/href="\/shop[^"]*"/g), [
      'href="/shop/search"',
      'href="/shop/search"',
    ]);
    assert.equal((header.match(/<ShopCartLink/g) ?? []).length, 2);
    // Both search links sit in a showSearch branch, both carts in showCart.
    assert.equal((header.match(/\{showSearch \? \(/g) ?? []).length, 2);
    assert.equal((header.match(/showCart \? /g) ?? []).length, 2);
  });

  test("gated utility predicates: OFF hides everything, ON is unchanged", () => {
    // Mirrors PublicSiteHeader. Legacy behaviour is what shipped before the
    // gate was applied; ON must be identical, OFF must be fully closed.
    const legacySearch = (current: string, showShopSearch: boolean) =>
      current === "shop" || (current === "home" && showShopSearch);
    const showSearch = (
      shopEnabled: boolean,
      current: string,
      showShopSearch: boolean
    ) => shopEnabled && legacySearch(current, showShopSearch);
    const showCart = (shopEnabled: boolean, current: string) =>
      shopEnabled && current === "shop";

    const currents = ["home", "interiors", "portfolio", "shop", "about", "none"];
    for (const current of currents) {
      for (const showShopSearch of [true, false]) {
        // Gate OFF: no commerce utility may render on any public route.
        assert.equal(showSearch(false, current, showShopSearch), false);
        assert.equal(showCart(false, current), false);
        // Gate ON: behaviour is exactly the pre-fix behaviour.
        assert.equal(
          showSearch(true, current, showShopSearch),
          legacySearch(current, showShopSearch)
        );
        assert.equal(showCart(true, current), current === "shop");
      }
    }
  });

  test("shop-off boundary uses customer copy, not internal gate terminology", () => {
    const inactive = read(
      "src/features/commerce/public/components/ShopPublicInactive.tsx"
    );
    for (const term of [
      /gated/i,
      /production activation/i,
      /not activated/i,
      /owner enables/i,
      /fail-closed/i,
      /ONEDECORE_SHOP_PUBLIC_ENABLED/,
      /feature flag/i,
    ]) {
      assert.doesNotMatch(inactive, term);
    }
    assert.match(inactive, /Coming soon/);
    // Still routes the visitor to the launch conversion path.
    assert.match(inactive, /href="\/interiors"/);
    assert.match(inactive, /href="\/portfolio"/);
  });

  test("shop-off boundary makes no price, stock, delivery or discount claim", () => {
    const inactive = read(
      "src/features/commerce/public/components/ShopPublicInactive.tsx"
    );
    for (const term of [/₹/, /discount/i, /% off/i, /in stock/i, /free delivery/i]) {
      assert.doesNotMatch(inactive, term);
    }
  });
});
