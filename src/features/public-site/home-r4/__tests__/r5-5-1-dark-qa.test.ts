/**
 * R5.5.1 Portfolio dark QA corrections — source guards.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

const root = process.cwd();
const theme = join(root, "src/features/public-site/theme");
const portfolioApp = join(root, "src/app/portfolio");
const components = join(root, "src/features/portfolio/public/components");

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("R5.5.1 Portfolio loading", () => {
  test("loading boundary exists with dark skeleton contract", () => {
    const path = join(portfolioApp, "loading.tsx");
    assert.equal(existsSync(path), true);
    const source = read(path);
    assert.match(source, /aria-busy="true"/);
    assert.match(source, /Loading ONEDECORE Portfolio projects/);
    assert.match(source, /Loading Portfolio/);
    assert.match(source, /od-skeleton-card/);
    assert.equal((source.match(/od-skeleton-card/g) ?? []).length, 1);
    assert.match(source, /length: 6/);
    assert.doesNotMatch(source, /Villa|Bandra|QuickFurno|getPaginatedProjects/);
  });
});

describe("R5.5.1 Portfolio error", () => {
  test("error boundary is client recovery without raw message", () => {
    const path = join(portfolioApp, "error.tsx");
    assert.equal(existsSync(path), true);
    const source = read(path);
    assert.match(source, /"use client"/);
    assert.match(source, /reset\(\)/);
    assert.match(source, /Try Again/);
    assert.match(source, /href="\/portfolio"/);
    assert.match(source, /href="\/"/);
    assert.doesNotMatch(source, /error\.message|error\.stack/);
    assert.match(source, /We could not load the Portfolio/);
  });
});

describe("R5.5.1 PublicDarkShell a11y", () => {
  test("skip link and public-content target exist", () => {
    const source = read(join(theme, "PublicDarkShell.tsx"));
    assert.match(source, /className="od-skip"/);
    assert.match(source, /href="#public-content"/);
    assert.match(source, /id="public-content"/);
    assert.match(source, /tabIndex=\{-1\}/);
    assert.match(source, /Get Price Estimate/);
    assert.match(source, /aria-current="page"/);
  });
});

describe("R5.5.1 filters and cards", () => {
  test("filters use labelled nav and aria-current", () => {
    const source = read(join(components, "PortfolioGrid.tsx"));
    assert.match(source, /aria-label="Filter Portfolio by service"/);
    assert.match(source, /aria-current=\{!activeService \? "page" : undefined\}/);
    assert.match(source, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(source, /href=\{buildUrl\(1, null\)\}/);
  });

  test("card has sizes and no empty meta span", () => {
    const source = read(join(components, "PortfolioCard.tsx"));
    assert.match(source, /sizes=\{CARD_SIZES\}|sizes="/);
    assert.doesNotMatch(source, /: <span \/>/);
    assert.match(source, /hasMeta/);
  });

  test("gallery has responsive sizes", () => {
    const source = read(join(components, "PortfolioGallery.tsx"));
    assert.match(source, /sizes="\(max-width: 639px\) 100vw/);
  });
});

describe("R5.5.1 CSS hardening", () => {
  test("reduced motion, fallbacks, contrast, nested state", () => {
    const css = read(join(theme, "public-dark-theme.css"));
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /background:\s*rgba\(8,\s*7,\s*6,\s*0\.92\)/);
    assert.match(css, /--od-text-subtle:\s*#9b8b79/);
    assert.match(css, /\.od-public-content/);
    assert.match(css, /\.od-public-content > \.od-state/);
    assert.match(css, /\.od-portfolio-main--detail/);
    assert.match(css, /od-skeleton-shimmer/);
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  });

  test("detail page has no inline presentation styles", () => {
    const source = read(join(portfolioApp, "[slug]/page.tsx"));
    assert.doesNotMatch(source, /style=\{\{/);
    assert.match(source, /od-portfolio-main--detail/);
    assert.match(source, /od-detail-gallery-wrap/);
  });
});
