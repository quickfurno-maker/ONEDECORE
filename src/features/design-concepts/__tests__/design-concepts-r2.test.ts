import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONCEPTS_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");
const REPO_ROOT = join(SRC_ROOT, "..");
const APP_CONCEPTS = join(SRC_ROOT, "app/design-concepts");

const CONCEPT_ROUTE_FILES = [
  "page.tsx",
  "layout.tsx",
  "cinematic-coffee-luxe/page.tsx",
  "modern-architectural/page.tsx",
  "luxury-design-tech/page.tsx",
] as const;

const CONCEPT_CSS_FILES = [
  "foundation.css",
  "index-page.css",
  "cinematic.css",
  "architectural.css",
  "design-tech.css",
] as const;

function walk(dir: string, match: RegExp, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, match, acc);
    } else if (match.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Every tracked concept source file: feature module plus the app routes. */
function conceptSourceFiles(): string[] {
  return [
    ...walk(CONCEPTS_ROOT, /\.(ts|tsx)$/),
    ...walk(APP_CONCEPTS, /\.(ts|tsx)$/),
  ];
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function label(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

/**
 * Every rule selector in a stylesheet, including rules nested inside `@media`
 * and `@supports`. Keyframe steps are skipped because `from`/`to`/percentages
 * are not element selectors.
 */
function ruleSelectors(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  const stack: string[] = [];
  let buffer = "";

  for (const char of withoutComments) {
    if (char === "{") {
      const current = buffer.trim();
      const parent = stack[stack.length - 1] ?? "";
      const insideKeyframes = parent.startsWith("@keyframes");
      const ancestorsAreAtRules = stack.every((entry) => entry.startsWith("@"));

      if (!current.startsWith("@") && ancestorsAreAtRules && !insideKeyframes) {
        selectors.push(current);
      }
      stack.push(current);
      buffer = "";
    } else if (char === "}") {
      stack.pop();
      buffer = "";
    } else {
      buffer += char;
    }
  }

  return selectors.filter(Boolean);
}

describe("Design concepts R2 — preview isolation", () => {
  test("every concept route is noindex, nofollow", () => {
    for (const file of CONCEPT_ROUTE_FILES) {
      const source = read(join(APP_CONCEPTS, file));
      assert.match(
        source,
        /robots:\s*\{[\s\S]*?index:\s*false[\s\S]*?follow:\s*false/,
        `${file} must declare robots index:false and follow:false`
      );
    }
  });

  test("concept routes are absent from the sitemap and robots allowances", () => {
    const sitemap = read(join(SRC_ROOT, "app/sitemap.ts"));
    assert.equal(
      sitemap.includes("design-concepts"),
      false,
      "sitemap must never enumerate the concept review routes"
    );

    const robots = read(join(SRC_ROOT, "app/robots.ts"));
    assert.equal(robots.includes("design-concepts"), false);
  });

  test("concept sources link only to routes that exist", () => {
    const allowedExact = new Set([
      "/",
      "/portfolio",
      "/design-concepts",
      "/design-concepts/cinematic-coffee-luxe",
      "/design-concepts/modern-architectural",
      "/design-concepts/luxury-design-tech",
    ]);
    const allowedPrefixes = ["/portfolio/", "/marketing/"];

    for (const file of conceptSourceFiles()) {
      const source = read(file);
      for (const [, value] of source.matchAll(/["'`](\/[A-Za-z0-9\-_./${}]*)["'`]/g)) {
        if (allowedExact.has(value)) continue;
        if (allowedPrefixes.some((prefix) => value.startsWith(prefix))) continue;
        assert.fail(`${label(file)} links to a route that does not exist: ${value}`);
      }
    }
  });

  test("concept sources never link to unbuilt routes or empty anchors", () => {
    // Anchored to a quote so asset paths such as /marketing/services/... pass.
    const unbuiltRoute =
      /["'`]\/(services|process|contact|about|privacy|terms)(?=["'`/])/;

    for (const file of conceptSourceFiles()) {
      const source = read(file);
      const match = source.match(unbuiltRoute);
      assert.equal(
        match,
        null,
        `${label(file)} links to a route that Phase 2F has not built yet: ${match?.[0]}`
      );

      for (const needle of ['href="#"', "href={'#'}", 'href={"#"}']) {
        assert.equal(
          source.includes(needle),
          false,
          `${label(file)} must not use a placeholder anchor`
        );
      }
    }
  });

  test("concept sources are independent of the QuickFurno reference", () => {
    for (const file of [...conceptSourceFiles(), ...CONCEPT_CSS_FILES.map((name) => join(CONCEPTS_ROOT, "styles", name))]) {
      const source = read(file).toLowerCase();
      assert.equal(
        source.includes("quickfurno"),
        false,
        `${label(file)} must not reference QuickFurno`
      );
    }
  });

  test("concepts load no remote images or runtime font CDNs", () => {
    const forbiddenHosts = [
      "pexels.com",
      "unsplash.com",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      "cdn.",
    ];

    for (const file of [...conceptSourceFiles(), ...CONCEPT_CSS_FILES.map((name) => join(CONCEPTS_ROOT, "styles", name))]) {
      const source = read(file);
      for (const host of forbiddenHosts) {
        assert.equal(
          source.includes(host),
          false,
          `${label(file)} must not reference ${host}`
        );
      }
      assert.equal(
        /["'`]https?:\/\//.test(source),
        false,
        `${label(file)} must not hardcode an absolute URL`
      );
    }
  });

  test("concepts make no unsupported marketing claims", () => {
    const forbidden = [
      "testimonial",
      "5-star",
      "customer review",
      "verified review",
      "award-winning",
      "warranty",
      "guarantee",
      "years of experience",
      "happy customer",
      "projects delivered",
      "clients served",
      "free consultation",
      "book a call",
      "whatsapp",
      "+91",
      "₹",
    ];

    for (const file of conceptSourceFiles()) {
      const source = read(file).toLowerCase();
      for (const needle of forbidden) {
        assert.equal(
          source.includes(needle),
          false,
          `${label(file)} must not contain "${needle}"`
        );
      }
    }
  });

  test("concepts add no animation dependency and no admin coupling", () => {
    const forbiddenImport =
      /from\s+["'](gsap|framer-motion|motion\/react|lenis|three|@react-three\/fiber|swiper)["']/;

    for (const file of conceptSourceFiles()) {
      const source = read(file);
      assert.equal(
        forbiddenImport.test(source),
        false,
        `${label(file)} must not import an animation library`
      );
      assert.equal(
        source.includes("/admin"),
        false,
        `${label(file)} must not reference the admin area`
      );
    }
  });
});

describe("Design concepts R2 — production is untouched", () => {
  test("production homepage still renders the approved seven sections in order", () => {
    const homepage = read(join(SRC_ROOT, "app/(public)/(home)/page.tsx"));
    const expectedOrder = [
      "<HeroSection />",
      "<BrandProposition />",
      "<ServicesSection />",
      "<FeaturedPortfolioSection />",
      "<ProcessSection />",
      "<MaterialStorySection />",
      "<TrustSection />",
    ];

    let cursor = -1;
    for (const marker of expectedOrder) {
      const index = homepage.indexOf(marker);
      assert.ok(index > cursor, `homepage must still render ${marker} in order`);
      cursor = index;
    }

    assert.match(homepage, /export const dynamic = "force-dynamic";/);
    assert.equal(
      homepage.includes("design-concepts"),
      false,
      "the production homepage must not import concept code"
    );
  });

  test("production shell and tokens do not import concept code", () => {
    const productionFiles = [
      join(SRC_ROOT, "app/layout.tsx"),
      join(SRC_ROOT, "app/globals.css"),
      join(SRC_ROOT, "app/(public)/layout.tsx"),
      join(SRC_ROOT, "app/(public)/(home)/layout.tsx"),
      join(SRC_ROOT, "app/(public)/(solid)/layout.tsx"),
      join(SRC_ROOT, "styles/public-site-tokens.css"),
      join(SRC_ROOT, "features/public-site/components/shell/PublicSiteShell.tsx"),
    ];

    for (const file of productionFiles) {
      const source = read(file);
      assert.equal(
        source.includes("design-concepts"),
        false,
        `${label(file)} must not reference the concept preview area`
      );
    }
  });

  test("concept stylesheets are scoped so they cannot reach production markup", () => {
    const allowedPrefixes = [
      "[data-design-concept]",
      "[data-concept=",
      "[data-dc-reveal]",
      ".dc-",
      ".dcx-",
    ];

    for (const name of CONCEPT_CSS_FILES) {
      const path = join(CONCEPTS_ROOT, "styles", name);
      const css = read(path);

      assert.equal(
        css.includes("[data-public-site]"),
        false,
        `${name} must not target the production shell`
      );

      for (const selectorGroup of ruleSelectors(css)) {
        for (const selector of selectorGroup.split(",")) {
          const trimmed = selector.trim();
          if (!trimmed) continue;
          assert.ok(
            allowedPrefixes.some((prefix) => trimmed.startsWith(prefix)),
            `${name} has an unscoped selector: ${trimmed}`
          );
        }
      }
    }
  });

  test("concepts reuse the cached portfolio read exactly once and add no query", () => {
    const files = conceptSourceFiles();
    const callSites = files.filter((file) => read(file).includes("getFeaturedProjects("));

    assert.deepEqual(
      callSites.map(label),
      ["src/features/design-concepts/server/featured.ts"],
      "only the shared server helper may call getFeaturedProjects"
    );

    const forbidden = [
      "fetchFeaturedProjects",
      "queryFeaturedProjects",
      "getPaginatedProjects",
      "createPublicAnonClient",
      "createClient",
      "unstable_cache",
    ];

    for (const file of files) {
      const source = read(file);
      for (const needle of forbidden) {
        assert.equal(
          source.includes(needle),
          false,
          `${label(file)} must not bypass the cached portfolio read via ${needle}`
        );
      }
    }
  });

  test("portfolio public contract files are not modified by the concept work", () => {
    const cache = read(
      join(SRC_ROOT, "features/portfolio/public/public-portfolio-cache.ts")
    );
    for (const exported of [
      "getFeaturedProjects",
      "getPaginatedProjects",
      "getProjectBySlug",
      "getSitemapEntries",
    ]) {
      assert.ok(
        cache.includes(`export function ${exported}`),
        `${exported} must remain exported from the public cache`
      );
    }

    const types = read(join(SRC_ROOT, "features/portfolio/public/types.ts"));
    for (const exported of [
      "PublicPortfolioCard",
      "PublicPortfolioProject",
      "PublicPortfolioImage",
      "PublicPortfolioPaginatedCards",
      "PublicSitemapEntry",
    ]) {
      assert.ok(types.includes(exported), `${exported} must remain in the public DTOs`);
    }
  });
});

describe("Design concepts R2 — dependency and schema drift", () => {
  test("no package drift", () => {
    const pkg = JSON.parse(read(join(REPO_ROOT, "package.json"))) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
      "@supabase/ssr",
      "@supabase/supabase-js",
      "next",
      "react",
      "react-dom",
      "server-only",
      "sharp",
    ]);

    assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
      "@tailwindcss/postcss",
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "eslint",
      "eslint-config-next",
      "supabase",
      "tailwindcss",
      "typescript",
    ]);
  });

  test("no migration drift", () => {
    const migrations = readdirSync(join(REPO_ROOT, "supabase/migrations")).filter(
      (entry) => entry.endsWith(".sql")
    );
    assert.equal(migrations.length, 8, "R2 must not add or remove migrations");
  });
});

describe("Design concepts R2 — typography and motion contract", () => {
  test("concepts use Plus Jakarta Sans with a Raleway wordmark only", () => {
    const fonts = read(join(CONCEPTS_ROOT, "fonts.ts"));
    assert.ok(fonts.includes("Plus_Jakarta_Sans"));
    assert.ok(fonts.includes("Raleway"));
    assert.equal(
      fonts.includes("Cormorant"),
      false,
      "Cormorant Garamond is not part of the concept typography"
    );

    for (const file of conceptSourceFiles()) {
      assert.equal(
        read(file).includes("Cormorant"),
        false,
        `${label(file)} must not use Cormorant Garamond`
      );
    }
  });

  test("the Raleway wordmark keeps its split weight treatment", () => {
    const wordmark = read(join(CONCEPTS_ROOT, "shared/Wordmark.tsx"));
    assert.ok(wordmark.includes("dc-wordmark__one"));
    assert.ok(wordmark.includes("dc-wordmark__decore"));

    const foundation = read(join(CONCEPTS_ROOT, "styles/foundation.css"));
    assert.match(foundation, /\.dc-wordmark__one\s*\{[^}]*font-weight:\s*200/);
    assert.match(foundation, /\.dc-wordmark__decore\s*\{[^}]*font-weight:\s*800/);
  });

  test("every concept honours reduced motion and runs no infinite animation", () => {
    for (const name of CONCEPT_CSS_FILES) {
      const css = read(join(CONCEPTS_ROOT, "styles", name));
      assert.equal(
        css.includes("infinite"),
        false,
        `${name} must not declare an infinite animation`
      );
    }

    const foundation = read(join(CONCEPTS_ROOT, "styles/foundation.css"));
    assert.ok(
      foundation.includes("@media (prefers-reduced-motion: reduce)"),
      "the shared foundation must neutralise motion for reduced-motion visitors"
    );

    const runtime = read(join(CONCEPTS_ROOT, "shared/RevealRuntime.tsx"));
    assert.ok(runtime.includes("prefers-reduced-motion"));
    assert.ok(
      runtime.includes("observer.disconnect()"),
      "the reveal observer must be cleaned up"
    );
  });

  test("only navigation and the reveal runtime are Client Components", () => {
    const clientFiles = conceptSourceFiles()
      .filter((file) => read(file).trimStart().startsWith('"use client"'))
      .map(label)
      .sort();

    assert.deepEqual(clientFiles, [
      "src/features/design-concepts/shared/ConceptNav.tsx",
      "src/features/design-concepts/shared/RevealRuntime.tsx",
    ]);
  });
});
