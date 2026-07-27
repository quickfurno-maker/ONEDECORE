import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import {
  SERVICE_STORIES,
  SERVICES_SECTION_COPY,
} from "../content/services.ts";
import { SERVICE_MARKETING_ASSETS } from "../config/service-assets.ts";
import { FEATURED_PORTFOLIO_COPY } from "../../portfolio/public/content/featured-portfolio.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");
const APP_ROOT = join(SRC_ROOT, "app");
const REPO_ROOT = join(SRC_ROOT, "..");
const PORTFOLIO_PUBLIC = join(SRC_ROOT, "features/portfolio/public");

function readPs(relativePath: string): string {
  return readFileSync(join(PUBLIC_SITE_ROOT, relativePath), "utf8");
}

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), "utf8");
}

function readPortfolio(relativePath: string): string {
  return readFileSync(join(PORTFOLIO_PUBLIC, relativePath), "utf8");
}

const FORBIDDEN_CLAIMS = [
  "award-winning",
  "best ",
  "luxury leader",
  "warranty",
  "OWNER CONTENT REQUIRED",
];

describe("Public Site C4 — ServicesSection contract", () => {
  test("ServicesSection is a Server Component without use client", () => {
    const source = readPs("components/home/ServicesSection.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /export function ServicesSection/);
    assert.match(source, /id="homepage-services-section"/);
    assert.match(source, /aria-labelledby="homepage-services-heading"/);
    assert.equal(source.includes("@supabase"), false);
    assert.equal(source.includes("fetch("), false);
  });

  test("services section uses exactly three rows in stable order", () => {
    assert.equal(SERVICE_STORIES.length, 3);
    assert.deepEqual(
      SERVICE_STORIES.map((s) => s.id),
      ["complete-home-interiors", "modular-kitchens", "custom-wardrobes"]
    );
    assert.deepEqual(
      SERVICE_STORIES.map((s) => s.imagePosition),
      ["left", "right", "left"]
    );
    const section = readPs("components/home/ServicesSection.tsx");
    assert.match(section, /SERVICE_STORIES\.map/);
    assert.equal(section.includes("ctaHref"), false);
  });

  test("approved section and service copy is exact and claim-free", () => {
    assert.equal(SERVICES_SECTION_COPY.overline, "Our Services");
    assert.equal(
      SERVICES_SECTION_COPY.heading,
      "Interiors, considered as one complete vision"
    );
    assert.match(SERVICES_SECTION_COPY.introduction, /Three focused services/);
    assert.equal(SERVICE_STORIES[0].title, "Complete Home Interiors");
    assert.equal(SERVICE_STORIES[1].title, "Modular Kitchens");
    assert.equal(SERVICE_STORIES[2].title, "Custom Wardrobes");
    assert.match(SERVICE_STORIES[0].description, /coordinated interior journey/);
    assert.match(SERVICE_STORIES[1].description, /kitchen systems/);
    assert.match(SERVICE_STORIES[2].description, /wardrobe compositions/);
    const blob = [
      JSON.stringify(SERVICES_SECTION_COPY),
      JSON.stringify(SERVICE_STORIES),
    ].join("\n");
    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(blob.toLowerCase().includes(claim.toLowerCase()), false, claim);
    }
  });

  test("production homepage does not render active /services links", () => {
    const section = readPs("components/home/ServicesSection.tsx");
    const row = readPs("components/home/ServiceEditorialRow.tsx");
    const page = readApp("(public)/(home)/page.tsx");
    assert.equal(section.includes("/services/"), false);
    assert.equal(page.includes("/services/"), false);
    assert.equal(section.includes('href="#'), false);
    assert.equal(row.includes('href="#"'), false);
    // future routes exist in typed content only
    assert.match(JSON.stringify(SERVICE_STORIES), /\/services\/complete-home-interiors/);
  });
});

describe("Public Site C4 — ServiceEditorialRow contract", () => {
  test("ServiceEditorialRow is a Server Component with optional CTA", () => {
    const source = readPs("components/home/ServiceEditorialRow.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.match(source, /ctaHref\?:/);
    assert.match(source, /\{ctaHref \? \(/);
    assert.match(source, /SecondaryLink/);
    assert.match(source, /ImageFrame/);
    assert.match(source, /ratio="service"/);
    assert.equal(source.includes("@supabase"), false);
  });

  test("optional CTA renders when explicitly supplied", () => {
    const source = readPs("components/home/ServiceEditorialRow.tsx");
    assert.match(source, /ctaHref/);
    assert.match(source, /service-cta-\$\{service\.id\}/);
    // Production ServicesSection never passes ctaHref
    const section = readPs("components/home/ServicesSection.tsx");
    assert.equal(/ctaHref\s*=/.test(section), false);
  });

  test("row uses 4:3 image contract and local assets only", () => {
    for (const asset of Object.values(SERVICE_MARKETING_ASSETS)) {
      assert.equal(asset.width / asset.height, 4 / 3);
      assert.ok(asset.width >= 1600);
      assert.equal(asset.provenanceCategory, "C");
      assert.equal(asset.publicRedistribution, true);
      assert.equal(asset.depictsCompletedProject, false);
      assert.ok(asset.bytes <= 120_000, `${asset.id} ${asset.bytes}`);
      assert.ok(asset.path.startsWith("/marketing/services/"));
      assert.equal(asset.path.includes("http"), false);
      assert.equal(asset.path.includes("supabase"), false);
      assert.equal(asset.path.includes("/storage/"), false);
      const disk = join(REPO_ROOT, "public", asset.path.slice(1));
      assert.equal(existsSync(disk), true, disk);
      assert.equal(statSync(disk).size, asset.bytes);
      const header = readFileSync(disk).subarray(0, 12);
      assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
      assert.equal(header.subarray(8, 12).toString("ascii"), "WEBP");
    }
  });

  test("service assets never claim completed project photography", () => {
    const config = readPs("config/service-assets.ts");
    assert.match(config, /Not photographs of completed client work/);
    assert.match(config, /Public-repository redistribution permitted/);
    for (const asset of Object.values(SERVICE_MARKETING_ASSETS)) {
      assert.match(asset.alt, /Abstract/i);
      assert.equal(/project|client residence|villa/i.test(asset.alt), false);
    }
  });
});

describe("Public Site C4 — Featured Portfolio presentation", () => {
  test("featured section still fetches exactly once via getFeaturedProjects", () => {
    const source = readPortfolio("components/FeaturedPortfolioSection.tsx");
    assert.match(source, /await getFeaturedProjects\(\)/);
    assert.equal((source.match(/await getFeaturedProjects\(\)/g) ?? []).length, 1);
    assert.equal(source.includes("fetchFeaturedProjects"), false);
    assert.equal(source.includes("createPublicAnonClient"), false);
    assert.equal(source.includes('"use client"'), false);
  });

  test("featured editorial copy matches approved C4 wording", () => {
    assert.equal(FEATURED_PORTFOLIO_COPY.overline, "Selected Work");
    assert.equal(
      FEATURED_PORTFOLIO_COPY.heading,
      "A closer look at spaces shaped with intention"
    );
    assert.equal(FEATURED_PORTFOLIO_COPY.exploreLabel, "Explore Our Work");
    assert.equal(
      FEATURED_PORTFOLIO_COPY.emptyHeading,
      "Curated work will appear here as projects are published."
    );
    assert.equal(
      FEATURED_PORTFOLIO_COPY.emptyBody,
      "Explore the portfolio as the ONEDECORE project library grows."
    );
    const source = readPortfolio("components/FeaturedPortfolioSection.tsx");
    assert.equal(source.includes("Featured Portfolio"), false);
    assert.equal(source.includes("Browse Portfolio Directory"), false);
    assert.equal(source.includes("amber"), false);
    assert.equal(source.includes("rounded-xl"), false);
    assert.equal(source.includes("shadow-md"), false);
  });

  test("featured layout classes cover zero through many project counts", () => {
    const source = readPortfolio("components/FeaturedPortfolioSection.tsx");
    assert.match(source, /ps-featured-grid--one/);
    assert.match(source, /ps-featured-grid--two/);
    assert.match(source, /ps-featured-grid--three/);
    assert.match(source, /ps-featured-grid--many/);
    assert.match(source, /featured-empty-state/);
    assert.match(source, /href="\/portfolio"/);
  });

  test("PortfolioCard listing default is preserved; featured uses editorial variant", () => {
    const card = readPortfolio("components/PortfolioCard.tsx");
    assert.match(card, /variant\?: PortfolioCardVariant/);
    assert.match(card, /variant = "listing"/);
    assert.match(card, /featuredEditorial/);
    assert.match(card, /data-variant="featuredEditorial"/);
    assert.match(card, /data-variant="listing"/);
    // Featured badge only in listing path
    const featuredBadgeIdx = card.indexOf("Featured");
    const editorialIdx = card.indexOf("featuredEditorial");
    assert.ok(featuredBadgeIdx > editorialIdx);
    assert.match(card, /amber-500/); // listing only
    const featured = readPortfolio("components/FeaturedPortfolioSection.tsx");
    assert.match(featured, /variant="featuredEditorial"/);
    const listing = readPortfolio("components/PortfolioGrid.tsx");
    assert.equal(listing.includes("featuredEditorial"), false);
  });

  test("Portfolio data contracts remain frozen", () => {
    const types = readPortfolio("types.ts");
    assert.match(types, /export type PublicPortfolioCard/);
    assert.match(types, /cover: PublicPortfolioImage/);
    const cache = readPortfolio("public-portfolio-cache.ts");
    assert.match(cache, /getFeaturedProjects/);
    assert.match(cache, /PUBLIC_CACHE_TAGS\.FEATURED/);
    const repo = readPortfolio("public-portfolio-repository.ts");
    assert.match(repo, /fetchFeaturedProjects/);
    const queries = readPortfolio("public-portfolio-queries.ts");
    assert.match(queries, /MAX_HOMEPAGE_FEATURED/);
    const constants = readPortfolio("constants.ts");
    assert.match(constants, /MAX_HOMEPAGE_FEATURED\s*=\s*6/);
  });
});

describe("Public Site C4 — Architecture guards", () => {
  test("no permanent C4 preview route", () => {
    assert.equal(existsSync(join(APP_ROOT, "phase2f-c4-preview")), false);
  });

  test("no forbidden motion libraries or package changes", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    for (const forbidden of ["gsap", "framer-motion", "lenis", "three", "embla-carousel"]) {
      assert.equal(forbidden in pkg.dependencies, false, forbidden);
    }
    const servicesDir = join(PUBLIC_SITE_ROOT, "components/home");
    for (const file of readdirSync(servicesDir)) {
      if (!/Service|service/.test(file)) continue;
      const source = readFileSync(join(servicesDir, file), "utf8");
      assert.equal(/from\s+["']gsap/.test(source), false, `${file} gsap`);
      assert.equal(/from\s+["']framer-motion/.test(source), false, `${file} framer`);
      assert.equal(/from\s+["']lenis/.test(source), false, `${file} lenis`);
      assert.equal(/from\s+["']three["']/.test(source), false, `${file} three`);
    }
  });

  test("homepage order is hero → proposition → services → featured", () => {
    const page = readApp("(public)/(home)/page.tsx");
    const body = page.slice(page.indexOf("return"));
    const order = [
      "<HeroSection",
      "<BrandProposition",
      "<ServicesSection",
      "<FeaturedPortfolioSection",
    ];
    let cursor = -1;
    for (const name of order) {
      const idx = body.indexOf(name);
      assert.ok(idx > cursor, name);
      cursor = idx;
    }
    assert.equal(page.includes("ProcessSection"), false);
    assert.equal(page.includes("MaterialStory"), false);
    assert.equal(page.includes("TrustSection"), false);
    assert.equal(page.includes("ConsultationBand"), false);
  });

  test("CSS provides service alternation and featured editorial layouts", () => {
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.match(css, /\.ps-service-row--image-left/);
    assert.match(css, /\.ps-service-row--image-right/);
    assert.match(css, /\.ps-featured-grid--three/);
    assert.match(css, /\.ps-featured-card/);
    assert.equal(css.includes("amber-"), false);
  });
});
