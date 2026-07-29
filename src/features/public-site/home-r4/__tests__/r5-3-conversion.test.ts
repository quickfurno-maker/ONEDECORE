/**
 * R5.3 conversion logic unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  HOME_CLAIM_COPY,
  HOME_PUNE_AREAS,
} from "../claims.ts";
import {
  BUDGET_COMFORT_OPTIONS,
  computeEstimate,
  formatInrRange,
  roundEstimate,
  suggestBudgetComfort,
} from "../budget-config.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

describe("formatInrRange", () => {
  test("formats lakh ranges", () => {
    assert.equal(formatInrRange(450_000, 800_000), "₹4.5L – ₹8L");
  });

  test("formats sub-lakh with locale grouping", () => {
    assert.equal(formatInrRange(80_000, 150_000), "₹80,000 – ₹1.5L");
  });

  test("appends plus for open-ended", () => {
    assert.equal(formatInrRange(1_500_000, 3_000_000, true), "₹15L – ₹30L+");
  });
});

describe("roundEstimate", () => {
  test("rounds below 5 lakh to nearest 5k", () => {
    assert.equal(roundEstimate(123_456), 125_000);
  });

  test("rounds 5 lakh and above to nearest 10k", () => {
    assert.equal(roundEstimate(567_890), 570_000);
  });
});

describe("computeEstimate", () => {
  test("applies premium multiplier to 2bhk complete home", () => {
    const result = computeEstimate("complete-home", "2bhk", "premium");
    assert.ok(result);
    assert.equal(result.min, 590_000);
    assert.equal(result.max, 1_040_000);
    assert.equal(result.openEnded, false);
    assert.equal(result.label, "₹5.9L – ₹10.4L");
  });

  test("returns null for invalid ids", () => {
    assert.equal(
      computeEstimate("complete-home", "invalid", "essential"),
      null
    );
    assert.equal(
      computeEstimate("complete-home", "2bhk", "invalid" as "essential"),
      null
    );
  });

  test("marks villa open-ended", () => {
    const result = computeEstimate("complete-home", "villa", "essential");
    assert.ok(result);
    assert.equal(result.openEnded, true);
    assert.match(result.label, /\+$/);
  });
});

describe("suggestBudgetComfort", () => {
  test("maps mid-points to comfort bands", () => {
    assert.equal(suggestBudgetComfort(200_000), "under-3l");
    assert.equal(suggestBudgetComfort(450_000), "3-6l");
    assert.equal(suggestBudgetComfort(900_000), "6-12l");
    assert.equal(suggestBudgetComfort(1_500_000), "12-20l");
    assert.equal(suggestBudgetComfort(2_500_000), "20-30l");
    assert.equal(suggestBudgetComfort(3_500_000), "30l-plus");
  });

  test("BUDGET_COMFORT_OPTIONS has six bands", () => {
    assert.equal(BUDGET_COMFORT_OPTIONS.length, 6);
  });
});

describe("claims register integrity", () => {
  test("numeric HOME_CLAIMS appear in HOME_CLAIM_COPY", () => {
    assert.match(HOME_CLAIM_COPY.projectsDelivered, /500/);
    assert.match(HOME_CLAIM_COPY.rating, /4\.9/);
    assert.match(HOME_CLAIM_COPY.reviews, /200/);
    assert.match(HOME_CLAIM_COPY.warranty, /10/);
    assert.match(HOME_CLAIM_COPY.satisfaction, /98/);
    assert.match(HOME_CLAIM_COPY.customDesigns, /100/);
  });

  test("claims.ts forbids JSON-LD rating schema in comments", () => {
    const source = read("claims.ts");
    assert.match(source, /No JSON-LD aggregateRating\/Review\/Warranty/);
  });
});

describe("HOME_PUNE_AREAS", () => {
  test("has 26 unique Pune localities", () => {
    assert.equal(HOME_PUNE_AREAS.length, 26);
    assert.equal(new Set(HOME_PUNE_AREAS).size, 26);
  });
});

describe("ProductionHomePage section order", () => {
  test("R5.3 conversion sequence", () => {
    const page = read("ProductionHomePage.tsx");
    const body = page.slice(page.indexOf("return ("));
    const order = [
      "HomeHero",
      "HomeTruthMetrics",
      "HomeServicesRooms",
      "HomeBudgetEstimator",
      "HomeWhy",
      "HomeFactory",
      "HomeProcess",
      "HomeProjects",
      "HomeFaq",
      "HomePlan",
    ];
    let last = -1;
    for (const name of order) {
      const idx = body.indexOf(`<${name}`);
      assert.ok(idx > last, name);
      last = idx;
    }
  });
});
