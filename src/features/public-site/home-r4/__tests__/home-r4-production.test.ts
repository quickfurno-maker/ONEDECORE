/**
 * Production homepage source guards (node:test).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";

const root = process.cwd();
const homeR4 = join(root, "src/features/public-site/home-r4");
const pagePath = join(root, "src/app/page.tsx");

function read(path: string) {
  return readFileSync(path, "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("home-r4 production guards", () => {
  test("does not import design-concepts", () => {
    const files = walk(homeR4).filter((f) => /\.(ts|tsx|css)$/.test(f));
    for (const file of files) {
      assert.doesNotMatch(read(file), /from ["'][^"']*design-concepts/);
      assert.doesNotMatch(read(file), /@\/features\/design-concepts/);
    }
  });

  test("uses production home marker and not concept markers", () => {
    const shell = read(join(homeR4, "HomeShell.tsx"));
    assert.match(shell, /data-public-home-r4/);
    assert.doesNotMatch(shell, /data-design-concept/);
    assert.doesNotMatch(shell, /dc-review/);
    assert.doesNotMatch(shell, /PM_REVIEW/);
  });

  test("uses Copy My Interior Brief and not fake lead submit", () => {
    const content = read(join(homeR4, "content.ts"));
    const plan = read(join(homeR4, "HomePlan.tsx"));
    assert.match(content, /Copy My Interior Brief/);
    assert.doesNotMatch(content, /Request a Design Call/);
    assert.match(plan, /clipboard|onCopy|submitLabel/);
    assert.doesNotMatch(plan, /markSubmitted/);
    assert.doesNotMatch(plan, /privacyConsent/);
  });

  test("points marketing assets at production path", () => {
    const content = read(join(homeR4, "content.ts"));
    assert.match(content, /\/assets\/onedecore\/home\//);
    assert.doesNotMatch(content, /\/marketing\/r4\//);
    const assets = [
      "hero-living-warmth.webp",
      "service-complete-home-interiors.webp",
      "service-modular-kitchens.webp",
      "service-custom-wardrobes.webp",
      "material-travertine-bronze.webp",
      "material-oak-joinery.webp",
      "material-fluted-texture.webp",
      "support-dusk-detail.webp",
    ];
    for (const name of assets) {
      assert.equal(
        existsSync(join(root, "public/assets/onedecore/home", name)),
        true,
        name
      );
    }
  });

  test("homepage is static and remains indexable without Portfolio fetch", () => {
    const page = read(pagePath);
    assert.doesNotMatch(page, /getFeaturedProjects/);
    assert.doesNotMatch(page, /force-dynamic/);
    assert.doesNotMatch(page, /featured/);
    assert.match(page, /ProductionHomePage/);
    assert.doesNotMatch(page, /loadConceptFeatured/);
    assert.doesNotMatch(page, /design-concepts/);
    assert.doesNotMatch(page, /noindex/);
    assert.match(page, /index:\s*true/);
    assert.match(page, /Complete Home Interiors in Pune/);
  });

  test("homepage no longer mounts HomeProjects or project-preview copy", () => {
    const production = read(join(homeR4, "ProductionHomePage.tsx"));
    const content = read(join(homeR4, "content.ts"));
    assert.doesNotMatch(production, /HomeProjects/);
    assert.doesNotMatch(production, /featured/);
    assert.match(production, /HomeReviews/);
    assert.doesNotMatch(content, /Our Work/);
    assert.doesNotMatch(content, /Selected Work/);
    assert.doesNotMatch(
      content,
      /Real ONEDECORE project stories are being prepared/
    );
    assert.match(content, /View Portfolio/);
    assert.match(content, /Client Reviews/);
  });

  test("claims config is the single source for approved metrics", () => {
    const content = read(join(homeR4, "content.ts"));
    const claims = read(join(homeR4, "claims.ts"));
    assert.match(content, /from "\.\/claims\.ts"/);
    assert.match(claims, /projectsDelivered: 500/);
    assert.match(claims, /No JSON-LD aggregateRating\/Review\/Warranty/);
  });

  test("does not keep design-concepts runtime tree", () => {
    assert.equal(existsSync(join(root, "src/features/design-concepts")), false);
    assert.equal(existsSync(join(root, "src/app/design-concepts")), false);
  });
});
