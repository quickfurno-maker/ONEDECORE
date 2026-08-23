/**
 * R5.4 final homepage — static conversion, reviews, work removal, a11y.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { HOME_CLAIMS } from "../claims.ts";
import {
  canShowVerifiedExcerpts,
  HOME_REVIEW_MODE,
  HOME_REVIEW_SOURCE_URL,
  HOME_REVIEW_SUMMARY,
  HOME_VERIFIED_REVIEWS,
} from "../reviews.ts";
import { HOME_PROJECT_PROOF_MODE } from "../project-proof.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");
const pagePath = join(root, "src/app/page.tsx");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

describe("R5.4 static homepage", () => {
  test("page.tsx has no getFeaturedProjects or force-dynamic", () => {
    const page = readFileSync(pagePath, "utf8");
    const interiors = readFileSync(join(root, "src/app/interiors/page.tsx"), "utf8");
    assert.doesNotMatch(page, /getFeaturedProjects/);
    assert.doesNotMatch(page, /force-dynamic/);
    assert.match(page, /DiscoveryHomePage/);
    assert.match(interiors, /getLeadFormMode/);
    assert.match(interiors, /<InteriorsConversionPage leadFormMode=\{leadFormMode\} \/>/);
  });

  test("ProductionHomePage has no featured prop or HomeProjects", () => {
    const page = read("ProductionHomePage.tsx");
    assert.doesNotMatch(page, /featured/);
    assert.doesNotMatch(page, /HomeProjects/);
    assert.doesNotMatch(page, /PublicPortfolioCard/);
    assert.match(page, /HomeReviews/);
  });
});

describe("R5.4 reviews data model", () => {
  test("aggregate values derive from claims.ts", () => {
    assert.equal(HOME_REVIEW_SUMMARY.rating, HOME_CLAIMS.rating);
    assert.equal(HOME_REVIEW_SUMMARY.count, HOME_CLAIMS.reviews);
    assert.equal(
      HOME_REVIEW_SUMMARY.satisfactionPercent,
      HOME_CLAIMS.clientSatisfactionPercent
    );
    assert.equal(HOME_CLAIMS.rating, 4.9);
    assert.equal(HOME_CLAIMS.reviews, 200);
    assert.equal(HOME_CLAIMS.clientSatisfactionPercent, 98);
  });

  test("aggregate-only mode with empty verified list", () => {
    assert.equal(HOME_REVIEW_MODE, "aggregate-only");
    assert.equal(HOME_VERIFIED_REVIEWS.length, 0);
    assert.equal(HOME_REVIEW_SOURCE_URL, null);
    assert.equal(canShowVerifiedExcerpts(), false);
  });

  test("HomeReviews has no named quotes, avatars, or schema", () => {
    const source = read("HomeReviews.tsx");
    const reviews = read("reviews.ts");
    assert.match(source, /id=\{PM_SECTION_IDS\.reviews\}/);
    assert.match(source, /aria-label=\{PM_REVIEWS\.starLabel\}/);
    assert.match(read("content.ts"), /out of 5 average rating/);
    assert.match(read("content.ts"), /HOME_CLAIMS\.rating/);
    assert.doesNotMatch(source, /Verified Client/);
    assert.doesNotMatch(source, /QuickFurno/);
    assert.doesNotMatch(source, /avatar|initials/i);
    assert.doesNotMatch(source, /₹\d/);
    assert.doesNotMatch(source, /aggregateRating|application\/ld\+json/);
    assert.doesNotMatch(reviews, /aggregateRating/);
    assert.match(source, /data-conversion-action="reviews-start-plan"/);
    assert.match(source, /data-conversion-action="portfolio-view"/);
    assert.match(source, /<noscript>/);
  });
});

describe("R5.4 work removal and claim ownership", () => {
  test("active content has no Our Work / Selected Work copy", () => {
    const content = read("content.ts");
    const production = read("ProductionHomePage.tsx");
    assert.doesNotMatch(content, /Our Work|Selected Work/);
    assert.doesNotMatch(production, /HomeProjects/);
    assert.doesNotMatch(read("styles/home-r4.css"), /\.pm-projects/);
  });

  test("proof metrics do not own 98% or warranty; reviews owns rating claims", () => {
    const content = read("content.ts");
    const proofBlock = content.slice(
      content.indexOf("PM_PROOF_METRICS"),
      content.indexOf("PM_PROOF_COPY")
    );
    assert.doesNotMatch(proofBlock, /clientSatisfactionPercent|warrantyYears/);
    assert.match(content, /PM_REVIEWS/);
    assert.match(content, /Average Client Rating/);
    assert.match(content, /Client Satisfaction/);
  });

  test("Why ONEDECORE has exactly four operating principles", () => {
    const content = read("content.ts");
    const why = content.slice(
      content.indexOf("export const PM_WHY"),
      content.indexOf("export const PM_FACTORY")
    );
    assert.equal((why.match(/id: "/g) ?? []).length, 4);
    assert.doesNotMatch(why, /10-Year Warranty|Own Manufacturing|98%/);
    assert.match(read("HomeWhy.tsx"), /useRovingTabs/);
    assert.match(read("HomeWhy.tsx"), /role="tablist"/);
  });

  test("project proof mode unchanged", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
  });
});

describe("R5.4 navigation and FAQ", () => {
  test("Reviews replaces Work; Portfolio direct link exists", () => {
    const content = read("content.ts");
    const nav = read("HomeNavigation.tsx");
    assert.match(content, /label: "Reviews"/);
    assert.doesNotMatch(content, /label: "Work"/);
    assert.doesNotMatch(content, /#projects/);
    assert.match(nav, /href="\/portfolio"/);
    assert.match(nav, /data-conversion-action="portfolio-view"/);
    assert.match(nav, /role=\{open \? "dialog" : undefined\}/);
    assert.match(nav, /aria-modal=\{open \? true : undefined\}/);
    assert.match(nav, /overflow = "hidden"/);
    assert.match(nav, /focusables\[0\]\?\.focus/);
    assert.match(nav, /Escape/);
    assert.match(nav, /pm-drawer__close/);
    assert.match(nav, /toggleRef\.current\?\.focus/);
  });

  test("FAQ is ten questions, closed by default, with reviews + portfolio", () => {
    const content = read("content.ts");
    assert.equal((content.match(/question:/g) ?? []).length, 10);
    assert.match(content, /How are ONEDECORE’s ratings and review count presented/);
    assert.match(content, /Where can I explore ONEDECORE projects/);
    assert.doesNotMatch(content, /Can every design be customised/);
    assert.match(read("HomeFaq.tsx"), /useState<string \| null>\(null\)/);
  });

  test("reduced-motion scroll helper exists", () => {
    const source = read("scroll-to-section.ts");
    assert.match(source, /prefers-reduced-motion/);
    assert.match(source, /behavior: reduced \? "auto" : "smooth"/);
    assert.match(read("HomeHero.tsx"), /scrollToHomeSection/);
  });
});
