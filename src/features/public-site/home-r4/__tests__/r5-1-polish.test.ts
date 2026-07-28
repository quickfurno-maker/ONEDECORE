/**
 * R5.1 correction unit/source guards.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  completedStepCount,
  ensureRoom,
  getNextIncompleteStep,
  type PlanSnapshot,
} from "../plan-state.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

function empty(): PlanSnapshot {
  return {
    service: null,
    property: null,
    timeline: null,
    rooms: [],
    name: "",
    mobile: "",
    locality: "",
    message: "",
    whatsappConsent: false,
    privacyConsent: false,
  };
}

describe("R5.1 atomic plan prospective steps", () => {
  test("empty + kitchen opens at step 2", () => {
    const rooms = ensureRoom([], "kitchen");
    const prospective = {
      ...empty(),
      service: "modular-kitchens" as const,
      rooms,
    };
    assert.equal(getNextIncompleteStep(prospective), 2);
  });

  test("empty + bedroom storage opens at step 2 without duplicate rooms", () => {
    let rooms = ensureRoom([], "bedrooms");
    rooms = ensureRoom(rooms, "wardrobes");
    rooms = ensureRoom(rooms, "bedrooms");
    rooms = ensureRoom(rooms, "wardrobes");
    assert.deepEqual(rooms, ["bedrooms", "wardrobes"]);
    assert.equal(
      getNextIncompleteStep({
        ...empty(),
        service: "custom-wardrobes",
        rooms,
      }),
      2
    );
  });

  test("empty + living opens at step 1", () => {
    const prospective = {
      ...empty(),
      rooms: ensureRoom([], "living"),
    };
    assert.equal(getNextIncompleteStep(prospective), 1);
  });

  test("complete core + dining opens at step 4", () => {
    const prospective = {
      ...empty(),
      service: "complete-home-interiors" as const,
      property: "apartment-3bhk" as const,
      timeline: "within-3-months" as const,
      rooms: ensureRoom(["living"], "dining"),
    };
    assert.equal(getNextIncompleteStep(prospective), 4);
    assert.equal(completedStepCount(prospective), 4);
  });

  test("PlanContext exposes addAreaToPlanAndOpen and RoomExplorer uses it", () => {
    assert.match(read("PlanContext.tsx"), /addAreaToPlanAndOpen/);
    assert.match(read("PlanContext.tsx"), /prospective/);
    assert.match(read("HomeRoomExplorer.tsx"), /addAreaToPlanAndOpen/);
    assert.doesNotMatch(
      read("HomeRoomExplorer.tsx"),
      /openPlanner\(getNextIncompleteStep\(\)\)/
    );
  });

  test("confirmation timer is cleaned up", () => {
    const source = read("HomeRoomExplorer.tsx");
    assert.match(source, /timerRef/);
    assert.match(source, /clearTimeout/);
    assert.match(source, /return \(\) =>/);
  });
});

describe("R5.1 tab semantics and wordmark", () => {
  test("useRovingTabs helper exists with Home/End and focus", () => {
    const source = read("useRovingTabs.ts");
    assert.match(source, /ArrowRight/);
    assert.match(source, /Home/);
    assert.match(source, /End/);
    assert.match(source, /\.focus\(/);
  });

  for (const file of [
    "HomeRoomExplorer.tsx",
    "HomeScopeIncluded.tsx",
    "HomeProcess.tsx",
    "HomeMaterials.tsx",
    "HomeApproach.tsx",
  ]) {
    test(`${file} uses roving tabs and stable panel`, () => {
      const source = read(file);
      assert.match(source, /useRovingTabs/);
      assert.match(source, /panelId/);
      assert.match(source, /aria-controls=\{panelId\}/);
    });
  }

  test("Approach has four USP tabs and journey is not a tablist", () => {
    const source = read("HomeApproach.tsx");
    assert.match(source, /pm-approach__journey/);
    assert.match(source, /role="tablist"/);
    assert.match(source, /What you can expect/);
    assert.match(source, /<ol className="pm-approach__journey"/);
    assert.equal((source.match(/role="tab"/g) ?? []).length, 1);
  });

  test("OneDecoreWordmark is shared across nav drawer footer", () => {
    assert.equal(existsSync(join(home, "OneDecoreWordmark.tsx")), true);
    const mark = read("OneDecoreWordmark.tsx");
    assert.match(mark, /ONE VISION · COMPLETE INTERIORS/);
    assert.match(mark, /ONEDECORE — One Vision\. Complete Interiors\. Home/);
    assert.doesNotMatch(mark, /QuickFurno|Luxury Interiors/i);
    assert.match(read("HomeNavigation.tsx"), /OneDecoreWordmark/);
    assert.match(read("HomeFooter.tsx"), /OneDecoreWordmark/);
    assert.match(read("HomeNavigation.tsx"), /size="drawer"/);
  });

  test("conversion hooks exist", () => {
    const blob =
      read("HomeHero.tsx") +
      read("HomeServices.tsx") +
      read("HomeRoomExplorer.tsx") +
      read("HomeScopeIncluded.tsx") +
      read("HomeProcess.tsx") +
      read("HomeReadiness.tsx") +
      read("HomePlan.tsx") +
      read("HomeStickyActions.tsx");
    for (const action of [
      "hero-start-plan",
      "service-start-plan",
      "room-add",
      "scope-build-brief",
      "process-start-plan",
      "readiness-continue",
      "brief-copy",
      "portfolio-view",
    ]) {
      assert.match(blob, new RegExp(action));
    }
  });

  test("noscript fallbacks present for interactive sections", () => {
    for (const file of [
      "HomeRoomExplorer.tsx",
      "HomeScopeIncluded.tsx",
      "HomeApproach.tsx",
      "HomeProcess.tsx",
      "HomeMaterials.tsx",
    ]) {
      assert.match(read(file), /<noscript>/);
    }
  });

  test("scroll progress component exists", () => {
    const source = read("HomeScrollProgress.tsx");
    assert.match(source, /role="progressbar"/);
    assert.match(source, /requestAnimationFrame/);
    assert.match(read("HomeShell.tsx"), /HomeScrollProgress/);
  });
});
