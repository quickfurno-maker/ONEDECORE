import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");

const FORBIDDEN_IMPORTS = [
  "gsap",
  "framer-motion",
  "motion/react",
  "lenis",
  "three",
  "@react-three/fiber",
  "@supabase",
  "/admin/",
];

const FORBIDDEN_SECTION_MARKERS = [
  "PublicHeader",
  "PublicFooter",
  "HeroSection",
  "BrandProposition",
  "ServiceEditorialRow",
  "FeaturedPortfolioSection",
];

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Public Site C1 — Architecture guards", () => {
  test("public-site module has no forbidden third-party motion or data imports", () => {
    const files = walkTsFiles(PUBLIC_SITE_ROOT);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        assert.equal(
          source.includes(forbidden),
          false,
          `${file} must not import ${forbidden}`
        );
      }
    }
  });

  test("C1 primitives do not import higher-level homepage sections", () => {
    const primitivesDir = join(PUBLIC_SITE_ROOT, "components/primitives");
    const files = walkTsFiles(primitivesDir);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const marker of FORBIDDEN_SECTION_MARKERS) {
        assert.equal(source.includes(marker), false, `${file} must not reference ${marker}`);
      }
    }
  });

  test("no permanent preview route exists in app directory", () => {
    const previewPaths = [
      join(SRC_ROOT, "app/__phase2f-c1-preview"),
      join(SRC_ROOT, "app/phase2f-c1-preview"),
    ];
    for (const previewPath of previewPaths) {
      let exists = false;
      try {
        statSync(previewPath);
        exists = true;
      } catch {
        exists = false;
      }
      assert.equal(exists, false, `Preview route must be removed before commit: ${previewPath}`);
    }
  });

  test("public-site tokens CSS forbids amber drift and glassmorphism", () => {
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.equal(css.includes("#f59e0b"), false);
    assert.equal(css.includes("#d97706"), false);
    assert.equal(css.includes("backdrop-filter"), false);
    assert.equal(css.includes("linear-gradient"), false);
  });

  test("fonts.ts does not request runtime Google Fonts CDN", () => {
    const source = readFileSync(join(PUBLIC_SITE_ROOT, "fonts.ts"), "utf8");
    assert.equal(source.includes("fonts.googleapis.com"), false);
    assert.equal(source.includes("fonts.gstatic.com"), false);
  });
});
