/**
 * Homepage project-proof selector tests (node:test).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import type { PublicPortfolioCard } from "../../../portfolio/public/types.ts";
import {
  HOME_PROJECT_PROOF_MODE,
  selectHomepageProjectProof,
} from "../project-proof.ts";

const root = process.cwd();

function card(overrides: Partial<PublicPortfolioCard> = {}): PublicPortfolioCard {
  return {
    slug: "published-featured-villa",
    title: "Published Featured Villa",
    summary: "Fixture summary must never appear as homepage proof.",
    locationLabel: "Bandra, Mumbai",
    propertyType: "4 BHK Villa",
    completionYear: 2026,
    isFeatured: true,
    services: [],
    cover: {
      url: "https://example.com/cover.webp",
      altText: "Cover",
      caption: null,
      width: 1600,
      height: 1000,
      role: "cover",
    },
    ...overrides,
  };
}

describe("selectHomepageProjectProof", () => {
  test("production default is pending", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
  });

  test("pending mode returns an empty array even when cards contain covers", () => {
    const featured = [card(), card({ slug: "second", title: "Second" })];
    const proof = selectHomepageProjectProof(featured);
    assert.deepEqual(proof, []);
    assert.equal(proof.length, 0);
  });

  test("does not mutate the input", () => {
    const featured = Object.freeze([card()]);
    const before = JSON.stringify(featured);
    selectHomepageProjectProof(featured);
    assert.equal(JSON.stringify(featured), before);
  });

  test("source has no title/locality/year special-case filter", () => {
    const source = readFileSync(
      join(root, "src/features/public-site/home-r4/project-proof.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /Published Featured Villa|Bandra|4 BHK|completionYear|locationLabel|title ===/);
    assert.match(source, /HOME_PROJECT_PROOF_MODE/);
    assert.match(source, /owner approval/);
  });

  test("imports only PublicPortfolioCard type and leaves Portfolio contracts alone", () => {
    const source = readFileSync(
      join(root, "src/features/public-site/home-r4/project-proof.ts"),
      "utf8"
    );
    assert.match(
      source,
      /import type \{ PublicPortfolioCard \} from ["']@\/features\/portfolio\/public\/types["']/
    );
    assert.doesNotMatch(source, /public-portfolio-cache|public-portfolio-repository/);
    assert.equal((source.match(/^import /gm) ?? []).length, 1);
  });
});
