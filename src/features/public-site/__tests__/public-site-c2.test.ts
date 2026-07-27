import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import {
  APPROVED_SERVICE_NAMES,
  HEADER_SCROLL_THRESHOLD_PX,
  HOMEPAGE_SHELL_CONFIG,
  PRODUCTION_PUBLIC_NAVIGATION,
  PRODUCTION_SHELL_CONFIG,
  PUBLIC_MAIN_ID,
  assertProductionNavigation,
  isSafeInternalHref,
} from "../config/public-navigation.ts";
import { SITE_CONFIG } from "../../../config/site.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");
const APP_ROOT = join(SRC_ROOT, "app");

function readSource(relativePath: string): string {
  return readFileSync(join(PUBLIC_SITE_ROOT, relativePath), "utf8");
}

function readAppSource(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), "utf8");
}

describe("Public Site C2 — Shell contract", () => {
  test("PublicSiteShell is a Server Component without use client", () => {
    const source = readSource("components/shell/PublicSiteShell.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /data-public-site/);
    assert.match(source, /publicSiteFontVariables/);
    assert.match(source, /<main id=\{PUBLIC_MAIN_ID\}/);
    assert.match(source, /<SkipLink/);
    assert.match(source, /<PublicHeader/);
    assert.match(source, /<PublicFooter/);
  });

  test("shell applies public token scope and stable main landmark id", () => {
    assert.equal(PUBLIC_MAIN_ID, "main-content");
    const source = readSource("components/shell/PublicSiteShell.tsx");
    assert.match(source, new RegExp(`id=\\{PUBLIC_MAIN_ID\\}`));
  });

  test("SkipLink targets the shell main landmark", () => {
    const shell = readSource("components/shell/PublicSiteShell.tsx");
    const skip = readSource("components/primitives/SkipLink.tsx");
    assert.match(shell, /targetId=\{PUBLIC_MAIN_ID\}/);
    assert.match(skip, /main-content/);
  });

  test("public route groups use segment shells for overlay and solid modes", () => {
    const passThrough = readAppSource("(public)/layout.tsx");
    assert.equal(passThrough.includes("PublicSiteShell"), false);

    const home = readAppSource("(public)/(home)/layout.tsx");
    assert.match(home, /PublicSiteShell/);
    assert.match(home, /HOMEPAGE_SHELL_CONFIG/);
    assert.match(home, /headerMode/);
    assert.equal(home.includes('"use client"'), false);

    const solid = readAppSource("(public)/(solid)/layout.tsx");
    assert.match(solid, /PublicSiteShell/);
    assert.match(solid, /PRODUCTION_SHELL_CONFIG/);
  });
});

describe("Public Site C2 — Header contract", () => {
  test("PublicHeader is a client component with scroll and mobile state", () => {
    const source = readSource("components/header/PublicHeader.tsx");
    assert.match(source, /"use client"/);
    assert.match(source, /useScrollHeader/);
    assert.match(source, /headerMode/);
    assert.match(source, /ps-header--overlay/);
    assert.match(source, /ps-header--solid/);
    assert.match(source, /ps-header--scrolled/);
  });

  test("header brand uses approved ONEDECORE name only", () => {
    const source = readSource("components/header/HeaderBrand.tsx");
    assert.match(source, /SITE_CONFIG\.name/);
    assert.equal(source.includes("ONEDECORE Interiors"), false);
    assert.equal(source.includes("legalName"), false);
  });

  test("scroll threshold matches frozen architecture", () => {
    assert.equal(HEADER_SCROLL_THRESHOLD_PX, 80);
    const hook = readSource("hooks/useScrollHeader.ts");
    assert.match(hook, /HEADER_SCROLL_THRESHOLD_PX/);
    assert.match(hook, /passive: true/);
    assert.match(hook, /removeEventListener/);
  });

  test("production portfolio routes use solid header mode", () => {
    assert.equal(PRODUCTION_SHELL_CONFIG.headerMode, "solid");
  });
});

describe("Public Site C2 — Desktop navigation", () => {
  test("DesktopNavigation uses semantic nav list semantics", () => {
    const source = readSource("components/header/DesktopNavigation.tsx");
    assert.match(source, /<nav aria-label="Primary"/);
    assert.match(source, /<ul/);
    assert.match(source, /aria-current/);
    assert.equal(source.includes('"use client"'), false);
  });

  test("production navigation only links to existing routes", () => {
    assertProductionNavigation(PRODUCTION_PUBLIC_NAVIGATION);
    const hrefs = PRODUCTION_PUBLIC_NAVIGATION.map((item) => item.href);
    assert.deepEqual(hrefs, ["/", "/portfolio"]);
    for (const item of PRODUCTION_PUBLIC_NAVIGATION) {
      assert.equal(isSafeInternalHref(item.href), true);
      assert.notEqual(item.href, "#");
    }
  });
});

describe("Public Site C2 — Mobile navigation", () => {
  test("MobileNavigation exposes menu button ARIA and focus management", () => {
    const source = readSource("components/header/MobileNavigation.tsx");
    assert.match(source, /"use client"/);
    assert.match(source, /aria-expanded/);
    assert.match(source, /aria-controls/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /useBodyScrollLock/);
    assert.match(source, /Escape/);
    assert.match(source, /FOCUSABLE_SELECTOR/);
    assert.match(source, /triggerRef\.current\?\.focus/);
    assert.match(source, /CloseIcon/);
    assert.match(source, /MenuIcon/);
  });

  test("body scroll lock restores prior inline styles on cleanup", () => {
    const source = readSource("hooks/useBodyScrollLock.ts");
    assert.match(source, /previousOverflow/);
    assert.match(source, /previousPaddingRight/);
    assert.match(source, /body\.style\.overflow = previousOverflow/);
  });

  test("reduced motion is respected in mobile navigation", () => {
    const source = readSource("components/header/MobileNavigation.tsx");
    assert.match(source, /useReducedMotion/);
    assert.match(source, /ps-mobile-nav__panel--reduced/);
  });
});

describe("Public Site C2 — Footer contract", () => {
  test("PublicFooter is a server component with semantic footer", () => {
    const source = readSource("components/footer/PublicFooter.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /<footer/);
    assert.match(source, /SITE_CONFIG\.name/);
    assert.match(source, /SITE_CONFIG\.tagline/);
  });

  test("footer excludes fake contact, legal, and social values", () => {
    const source = readSource("components/footer/PublicFooter.tsx");
    const forbidden = ["mailto:", "tel:", "@onedecore", "ONEDECORE Interiors", "Privacy Policy", "Terms"];
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `footer must not include ${token}`);
    }
    assert.equal(PRODUCTION_SHELL_CONFIG.footer.contact, null);
    assert.equal(PRODUCTION_SHELL_CONFIG.footer.legalLinks.length, 0);
    assert.equal(PRODUCTION_SHELL_CONFIG.footer.socialLinks.length, 0);
  });

  test("footer lists approved service names without future-route links", () => {
    assert.deepEqual([...APPROVED_SERVICE_NAMES], [
      "Complete Home Interiors",
      "Modular Kitchens",
      "Custom Wardrobes",
    ]);
    const source = readSource("components/footer/PublicFooter.tsx");
    assert.match(source, /APPROVED_SERVICE_NAMES/);
    assert.equal(source.includes("/services/"), false);
  });
});

describe("Public Site C2 — Safe link and CTA contract", () => {
  test("production shell omits consultation CTA until contact route exists", () => {
    assert.equal(PRODUCTION_SHELL_CONFIG.cta, null);
    assert.equal(HOMEPAGE_SHELL_CONFIG.cta, null);
    const solidLayout = readAppSource("(public)/(solid)/layout.tsx");
    assert.equal(
      solidLayout.includes("cta={null}") || solidLayout.includes("cta={cta}"),
      true
    );
  });

  test("navigation config rejects placeholder hash links", () => {
    assert.throws(() => {
      assertProductionNavigation([{ label: "Broken", href: "#" as `/${string}` }]);
    });
  });
});

describe("Public Site C2 — Architecture guards", () => {
  test("shell modules do not import Supabase or admin code", () => {
    const files = [
      "components/shell/PublicSiteShell.tsx",
      "components/header/PublicHeader.tsx",
      "components/header/MobileNavigation.tsx",
      "components/footer/PublicFooter.tsx",
      "config/public-navigation.ts",
    ];
    const forbidden = ["@supabase", "/admin/", "public-portfolio-repository"];
    for (const file of files) {
      const source = readSource(file);
      for (const token of forbidden) {
        assert.equal(source.includes(token), false, `${file} must not reference ${token}`);
      }
    }
  });

  test("no GSAP, Motion, Lenis, or Three imports in public-site module", () => {
    const forbidden = ["gsap", "framer-motion", "motion/react", "lenis", "three"];
    function walk(dir: string): string[] {
      const acc: string[] = [];
      for (const entry of readdirSync(dir)) {
        if (entry === "__tests__") continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) acc.push(...walk(full));
        else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
      }
      return acc;
    }
    for (const file of walk(PUBLIC_SITE_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const lib of forbidden) {
        assert.equal(source.includes(lib), false, `${file} must not import ${lib}`);
      }
    }
  });

  test("admin layout does not import public shell", () => {
    const adminLayout = readFileSync(join(SRC_ROOT, "app/admin/layout.tsx"), "utf8");
    assert.equal(adminLayout.includes("PublicSiteShell"), false);
    assert.equal(adminLayout.includes("data-public-site"), false);
  });

  test("brand config remains ONEDECORE without invented legal entity", () => {
    assert.equal(SITE_CONFIG.name, "ONEDECORE");
    assert.equal("legalName" in SITE_CONFIG, false);
  });
});

describe("Public Site C2 — Preview route policy", () => {
  test("preview route exists only during QA and uses overlay mode", () => {
    let exists = false;
    try {
      readAppSource("phase2f-c2-preview/page.tsx");
      exists = true;
    } catch {
      exists = false;
    }
    if (exists) {
      const preview = readAppSource("phase2f-c2-preview/page.tsx");
      assert.match(preview, /headerMode="overlay"/);
      assert.match(preview, /previewOnly: true/);
      assert.match(preview, /#preview-cta-target/);
    }
  });
});
