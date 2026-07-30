/**
 * R5.5 unified public dark theme — source guards.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

const root = process.cwd();
const homeCss = join(root, "src/features/public-site/home-r4/styles/home-r4.css");
const themeCss = join(
  root,
  "src/features/public-site/theme/public-dark-theme.css"
);
const page = join(root, "src/app/page.tsx");
const portfolioPage = join(root, "src/app/portfolio/page.tsx");
const card = join(
  root,
  "src/features/portfolio/public/components/PortfolioCard.tsx"
);
const grid = join(
  root,
  "src/features/portfolio/public/components/PortfolioGrid.tsx"
);
const gallery = join(
  root,
  "src/features/portfolio/public/components/PortfolioGallery.tsx"
);
const shell = join(
  root,
  "src/features/public-site/theme/PublicDarkShell.tsx"
);
const layout = join(root, "src/app/layout.tsx");
const homeShell = join(
  root,
  "src/features/public-site/home-r4/HomeShell.tsx"
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("R5.5 public dark theme tokens", () => {
  test("shared theme stylesheet exists with OD ladder", () => {
    assert.equal(existsSync(themeCss), true);
    const css = read(themeCss);
    assert.match(css, /--od-bg-page:\s*#0d0a09/);
    assert.match(css, /--od-gold:\s*#d8a24a/);
    assert.match(css, /color-scheme:\s*dark/);
    assert.match(css, /html:has\(\[data-public-dark-theme\]\)/);
    assert.doesNotMatch(css, /prefers-color-scheme/);
  });

  test("root layout imports public dark theme CSS", () => {
    assert.match(read(layout), /public-dark-theme\.css/);
  });

  test("homepage shell marks public dark theme", () => {
    assert.match(read(homeShell), /data-public-dark-theme/);
  });
});

describe("R5.5 homepage light-band removal", () => {
  test("active homepage CSS has no ivory-bg or on-light tokens", () => {
    const css = read(homeCss);
    assert.doesNotMatch(css, /--pm-ivory-bg/);
    assert.doesNotMatch(css, /--pm-on-light/);
    assert.doesNotMatch(css, /var\(--pm-ivory-bg\)/);
    assert.doesNotMatch(css, /var\(--pm-on-light/);
  });

  test("Services and FAQ use dark OD surfaces", () => {
    const css = read(homeCss);
    const services = css.slice(
      css.indexOf(".pm-services {"),
      css.indexOf(".pm-services__layout")
    );
    const faq = css.slice(css.indexOf(".pm-faq {"), css.indexOf(".pm-faq__inner"));
    assert.match(services, /--od-bg-section|--pm-ivory|var\(--od-bg/);
    assert.doesNotMatch(services, /ivory-bg|#f7efe3/);
    assert.doesNotMatch(faq, /ivory-bg|#f7efe3/);
    assert.match(faq, /--od-bg-raised|--pm-ivory/);
  });

  test("homepage remains static without featured fetch", () => {
    const source = read(page);
    assert.doesNotMatch(source, /getFeaturedProjects|force-dynamic/);
  });
});

describe("R5.5 Portfolio always-dark presentation", () => {
  test("PublicDarkShell is server component without theme state", () => {
    const source = read(shell);
    assert.doesNotMatch(source, /"use client"/);
    assert.doesNotMatch(source, /localStorage|matchMedia|useEffect/);
    assert.match(source, /data-public-dark-theme/);
  });

  test("PortfolioCard has no bg-white or dark: variants", () => {
    const source = read(card);
    assert.doesNotMatch(source, /bg-white|dark:|text-neutral-900|bg-neutral-100/);
    assert.match(source, /od-card/);
  });

  test("PortfolioGrid filters use always-dark classes", () => {
    const source = read(grid);
    assert.doesNotMatch(source, /bg-white|dark:|bg-neutral-100|bg-neutral-900/);
    assert.match(source, /od-filter/);
    assert.match(source, /od-empty/);
  });

  test("PortfolioGallery has no light figure surfaces", () => {
    const source = read(gallery);
    assert.doesNotMatch(source, /bg-neutral-50|bg-white|dark:/);
    assert.match(source, /od-figure/);
  });

  test("Portfolio listing page uses dark shell classes", () => {
    const source = read(portfolioPage);
    assert.match(source, /od-portfolio-main/);
    assert.doesNotMatch(source, /text-neutral-900|dark:text-white/);
  });
});
