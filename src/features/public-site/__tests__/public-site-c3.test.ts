import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import {
  HOMEPAGE_SHELL_CONFIG,
  PRODUCTION_SHELL_CONFIG,
} from "../config/public-navigation.ts";
import { SITE_CONFIG } from "../../../config/site.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");
const APP_ROOT = join(SRC_ROOT, "app");
const REPO_ROOT = join(SRC_ROOT, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(PUBLIC_SITE_ROOT, relativePath), "utf8");
}

function readAppSource(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), "utf8");
}

const FORBIDDEN_CLAIMS = [
  "award-winning",
  "best ",
  "trusted by",
  "luxury leader",
  "timeless",
  "masterpiece",
  "across India",
  "Book a Design Consultation",
  "/contact",
  'href="#"',
];

describe("Public Site C3 — HeroSection contract", () => {
  test("HeroSection is a Server Component without use client", () => {
    const source = readSource("components/home/HeroSection.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /export function HeroSection/);
    assert.match(source, /id="homepage-hero-section"/);
    assert.match(source, /className="ps-hero"/);
  });

  test("hero renders exact approved tagline as single H1", () => {
    const copy = readSource("content/homepage.ts");
    assert.match(copy, /h1: SITE_CONFIG\.tagline/);
    assert.equal(SITE_CONFIG.tagline, "One Vision. Complete Interiors.");
    const source = readSource("components/home/HeroSection.tsx");
    assert.match(source, /<h1/);
    assert.match(source, /HOMEPAGE_COPY\.h1/);
    assert.equal((source.match(/<h1/g) ?? []).length, 1);
  });

  test("hero exposes only Explore Our Work CTA to /portfolio", () => {
    const copy = readSource("content/homepage.ts");
    assert.match(copy, /Explore Our Work/);
    assert.match(copy, /ctaHref: "\/portfolio"/);
    const source = readSource("components/home/HeroSection.tsx");
    assert.match(source, /SecondaryLink/);
    assert.match(source, /hero-portfolio-cta-button/);
    assert.equal(source.includes("PrimaryButton"), false);
    assert.equal(source.includes("consultation"), false);
  });

  test("hero copy excludes unsupported marketing claims", () => {
    const sources = [
      readSource("content/homepage.ts"),
      readSource("components/home/HeroSection.tsx"),
    ].join("\n");
    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(sources.toLowerCase().includes(claim.toLowerCase()), false, claim);
    }
  });

  test("hero image uses approved local asset without remote hotlink", () => {
    const asset = readSource("config/home-hero.ts");
    const source = readSource("components/home/HeroSection.tsx");
    assert.match(source, /HOMEPAGE_HERO_ASSET/);
    assert.match(source, /priority/);
    assert.match(source, /sizes="100vw"/);
    assert.match(source, /fill/);
    assert.equal(source.includes("http://"), false);
    assert.equal(source.includes("https://"), false);
    assert.match(asset, /\/marketing\/hero\/homepage-hero-architectural\.webp/);
    assert.match(asset, /provenanceCategory: "C"/);
    assert.equal(asset.includes("http://"), false);
    assert.equal(asset.includes("https://"), false);
    assert.equal(asset.includes("supabase"), false);
    assert.equal(asset.includes("/storage/v1/"), false);
  });

  test("hero asset provenance stays category C marketing artwork", () => {
    const asset = readSource("config/home-hero.ts");
    assert.match(asset, /not a photograph of a\s+\* completed client project/);
    assert.match(asset, /Public-repository redistribution permitted/);
    assert.equal(/completed project photograph of ONEDECORE/i.test(asset), false);
  });

  test("hero asset contract records dimensions, bytes and focal points", () => {
    const asset = readSource("config/home-hero.ts");
    assert.match(asset, /width: 1920/);
    assert.match(asset, /height: 1280/);
    assert.match(asset, /focalPoint: "58% 45%"/);
    assert.match(asset, /mobileFocalPoint: "66% 50%"/);
    assert.match(asset, /bytes: 188526/);
    const assetPath = join(REPO_ROOT, "public/marketing/hero/homepage-hero-architectural.webp");
    assert.equal(existsSync(assetPath), true);
    const bytes = statSync(assetPath).size;
    assert.equal(bytes, 188_526);
    assert.ok(bytes >= 120_000, "hero must retain material detail");
    assert.ok(bytes <= 200_000, "hero must stay inside the asset weight budget");
    const header = readFileSync(assetPath).subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(header.subarray(8, 12).toString("ascii"), "WEBP");
  });

  test("hero alt text describes abstract material artwork, not a project", () => {
    const asset = readSource("config/home-hero.ts");
    assert.match(asset, /alt: "Abstract architectural composition/);
    for (const banned of ["project", "client", "home in", "apartment", "villa"]) {
      const altLine = asset.split("\n").find((line) => line.includes("alt:")) ?? "";
      assert.equal(altLine.toLowerCase().includes(banned), false, banned);
    }
  });

  test("hero focal points drive object-position through CSS variables", () => {
    const hero = readSource("components/home/HeroSection.tsx");
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.match(hero, /"--ps-hero-focal": HOMEPAGE_HERO_ASSET\.focalPoint/);
    assert.match(hero, /"--ps-hero-focal-mobile": HOMEPAGE_HERO_ASSET\.mobileFocalPoint/);
    assert.match(css, /object-position: var\(--ps-hero-focal,/);
    assert.match(
      css,
      /@media \(max-width: 767px\)[\s\S]*?object-position: var\(--ps-hero-focal-mobile,/
    );
  });

  test("hero uses a directional scrim without glassmorphism or full-frame wash", () => {
    const hero = readSource("components/home/HeroSection.tsx");
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.match(hero, /ps-hero__scrim/);
    assert.match(css, /--color-hero-scrim-deep: rgba\(24, 21, 18, 0\.66\)/);
    assert.match(css, /--color-hero-supporting: #f0ece6/);
    assert.match(css, /\.ps-hero__scrim[\s\S]*?linear-gradient\(\s*to right/);
    assert.match(
      css,
      /@media \(max-width: 767px\)[\s\S]*?\.ps-hero__scrim[\s\S]*?linear-gradient\(\s*to top/
    );
    assert.match(css, /\.ps-hero__supporting\s*\{\s*color: var\(--color-hero-supporting\)/);
    assert.equal(css.includes("backdrop-filter"), false);
    assert.equal(hero.includes("backdrop-filter"), false);
    assert.equal(hero.includes("--color-dark-section-muted"), false);
  });

  test("hero motion is isolated to HeroMediaMotion client island", () => {
    const hero = readSource("components/home/HeroSection.tsx");
    const motion = readSource("components/home/HeroMediaMotion.tsx");
    assert.equal(hero.includes('"use client"'), false);
    assert.match(motion, /"use client"/);
    assert.match(motion, /ps-hero__media--motion/);
    assert.match(motion, /useReducedMotion/);
  });

  test("hero CSS removes mobile scale and honours reduced motion", () => {
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.match(css, /ps-hero-scale-in/);
    assert.match(css, /@media \(max-width: 767px\)[\s\S]*ps-hero__media--motion/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*ps-hero__media--motion/);
  });
});

describe("Public Site C3 — Overlay header activation", () => {
  test("homepage shell config uses overlay header mode", () => {
    assert.equal(HOMEPAGE_SHELL_CONFIG.headerMode, "overlay");
    assert.equal(PRODUCTION_SHELL_CONFIG.headerMode, "solid");
  });

  test("home route group layout wires overlay shell", () => {
    const layout = readAppSource("(public)/(home)/layout.tsx");
    assert.match(layout, /HOMEPAGE_SHELL_CONFIG/);
    assert.match(layout, /headerMode=\{headerMode\}/);
    assert.equal(layout.includes('"use client"'), false);
  });

  test("portfolio route group layout wires solid shell", () => {
    const layout = readAppSource("(public)/(solid)/layout.tsx");
    assert.match(layout, /PRODUCTION_SHELL_CONFIG/);
    assert.match(layout, /headerMode=\{headerMode\}/);
  });

  test("public pass-through layout does not duplicate shells", () => {
    const layout = readAppSource("(public)/layout.tsx");
    assert.equal(layout.includes("PublicSiteShell"), false);
  });
});

describe("Public Site C3 — BrandProposition contract", () => {
  test("BrandProposition is a Server Component", () => {
    const source = readSource("components/home/BrandProposition.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /EditorialSectionHeading/);
    assert.match(source, /as="h2"/);
  });

  test("brand proposition uses restrained factual copy", () => {
    const copy = readSource("content/homepage.ts");
    assert.match(copy, /Interior design with clarity and craft/);
    assert.match(copy, /Pune/);
    assert.match(copy, /complete home interiors/i);
    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(copy.toLowerCase().includes(claim.toLowerCase()), false, claim);
    }
  });

  test("BrandProposition does not import Supabase", () => {
    const source = readSource("components/home/BrandProposition.tsx");
    assert.equal(source.includes("@supabase"), false);
    assert.match(source, /Section/);
    assert.match(source, /Container/);
  });
});

describe("Public Site C3 — Homepage composition", () => {
  test("homepage composes hero, proposition, and featured portfolio only", () => {
    const page = readAppSource("(public)/(home)/page.tsx");
    assert.match(page, /HeroSection/);
    assert.match(page, /BrandProposition/);
    assert.match(page, /FeaturedPortfolioSection/);
    assert.equal(page.includes("ServiceEditorialRow"), false);
    assert.equal(page.includes("TODO"), false);
  });

  test("featured portfolio import path is unchanged", () => {
    const page = readAppSource("(public)/(home)/page.tsx");
    assert.match(
      page,
      /@\/features\/portfolio\/public\/components\/FeaturedPortfolioSection/
    );
  });
});

describe("Public Site C3 — Portfolio and admin preservation", () => {
  test("portfolio repository files are untouched by C3", () => {
    const portfolioRoot = join(SRC_ROOT, "features/portfolio/public");
    const c3Touches = [
      "public-portfolio-repository.ts",
      "public-portfolio-cache.ts",
      "public-portfolio-queries.ts",
      "public-portfolio-mapper.ts",
    ];
    for (const file of c3Touches) {
      const full = join(portfolioRoot, file);
      const stat = statSync(full);
      assert.ok(stat.mtimeMs > 0);
    }
  });

  test("hero replacement introduces no new runtime dependency", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8")
    ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
      "@supabase/ssr",
      "@supabase/supabase-js",
      "next",
      "react",
      "react-dom",
      "server-only",
      "sharp",
    ]);
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const forbidden of ["gsap", "motion", "framer-motion", "lenis", "three"]) {
      assert.equal(forbidden in all, false, forbidden);
    }
  });

  test("no forbidden motion libraries in public-site module", () => {
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
});

describe("Public Site C3 — Preview route policy", () => {
  test("no permanent C3 preview route exists before commit", () => {
    let exists = false;
    try {
      readAppSource("phase2f-c3-preview/page.tsx");
      exists = true;
    } catch {
      exists = false;
    }
    assert.equal(exists, false);
  });
});

describe("Public Site C3 — Primary CTA deferral", () => {
  test("shell configs keep consultation CTA null until /contact exists", () => {
    assert.equal(HOMEPAGE_SHELL_CONFIG.cta, null);
    assert.equal(PRODUCTION_SHELL_CONFIG.cta, null);
    const hero = readSource("components/home/HeroSection.tsx");
    assert.equal(hero.includes("/contact"), false);
  });
});
