import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  PORTFOLIO_DEFAULT_VIEW,
  PORTFOLIO_PROJECTS_HREF,
  PORTFOLIO_PROJECTS_VIEW,
  PORTFOLIO_PUBLIC_VIEW_ORDER,
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_VIEWS,
  portfolioViewHref,
} from "../portfolio-rooms.ts";
import { parseListingParams } from "../public-request-validation.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const PAGE = "src/app/portfolio/page.tsx";
const TABS = "src/features/portfolio/public/components/PortfolioViewTabs.tsx";
const GRID = "src/features/portfolio/public/components/PortfolioGrid.tsx";
const GALLERY =
  "src/features/portfolio/public/components/PortfolioRoomGallery.tsx";
const CSS = "src/features/public-site/theme/public-dark-theme.css";

/** Source with comments stripped, so prose about a thing is not the thing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
 * ============================================================================
 * WHAT THIS FILE IS FOR
 *
 * The public portfolio became a gallery: one navigation row instead of two,
 * Kitchen instead of Projects as the bare `/portfolio`, and a dense grid of
 * square photographs instead of a vertical feed of captioned cards.
 *
 * Three of those are the kind of change that reverts itself quietly. A second
 * filter row is the natural thing to add back when someone wants to filter. A
 * caption is the natural thing to add back when someone wants the project
 * named. And `/portfolio` is the natural thing to type when someone means "all
 * projects" — which now sends the visitor somewhere else entirely. So each is
 * asserted as an ABSENCE or an exact string, not left to review.
 * ============================================================================
 */

/* ========================================================================== */
/* 1. The public tab order and the default view                                */
/* ========================================================================== */

describe("one navigation row: Kitchen | Living Room | Bedroom | Projects", () => {
  test("the tab order is exactly this", () => {
    assert.deepEqual(
      PORTFOLIO_VIEWS.map((v) => v.label),
      ["Kitchen", "Living Room", "Bedroom", "Projects"]
    );
    assert.deepEqual(
      [...PORTFOLIO_PUBLIC_VIEW_ORDER],
      ["kitchen", "living-room", "bedroom", "projects"]
    );
  });

  test("Projects is LAST, not first", () => {
    assert.equal(PORTFOLIO_VIEWS.at(-1)!.id, "projects");
    assert.notEqual(PORTFOLIO_VIEWS[0]!.id, "projects");
  });

  test("a bare /portfolio resolves to Kitchen", () => {
    assert.equal(PORTFOLIO_DEFAULT_VIEW, "kitchen");
    assert.equal(parseListingParams({})!.view, "kitchen");
    assert.equal(parseListingParams({ page: "1" })!.view, "kitchen");
  });

  test("Kitchen's canonical URL is the bare path", () => {
    assert.equal(portfolioViewHref("kitchen"), "/portfolio");
    assert.equal(PORTFOLIO_VIEWS.find((v) => v.id === "kitchen")!.href, "/portfolio");
    // And the old spelling still answers, so existing links do not 404.
    assert.equal(parseListingParams({ view: "kitchen" })!.view, "kitchen");
  });

  test("the other three views are addressed explicitly", () => {
    assert.equal(
      PORTFOLIO_VIEWS.find((v) => v.id === "living-room")!.href,
      "/portfolio?view=living-room"
    );
    assert.equal(
      PORTFOLIO_VIEWS.find((v) => v.id === "bedroom")!.href,
      "/portfolio?view=bedroom"
    );
    assert.equal(
      PORTFOLIO_VIEWS.find((v) => v.id === "projects")!.href,
      "/portfolio?view=projects"
    );
    assert.equal(PORTFOLIO_PROJECTS_HREF, "/portfolio?view=projects");
    assert.equal(PORTFOLIO_PROJECTS_VIEW, "projects");
  });

  test("the tabs are real links with aria-current, not client state", () => {
    const tabs = read(TABS);
    assert.match(tabs, /<nav className="od-portfolio-views"/);
    assert.match(tabs, /aria-label="Portfolio views"/);
    assert.match(tabs, /href=\{view\.href\}/);
    assert.match(tabs, /aria-current=\{isActive \? "page" : undefined\}/);
    // Buttons swapping state would break back/forward and open-in-new-tab.
    assert.doesNotMatch(code(tabs), /"use client"|onClick=/);
  });

  test("the mobile rail scrolls on one line rather than wrapping", () => {
    const css = read(CSS);
    const rail = css.slice(css.indexOf(".od-portfolio-views__rail {"));
    assert.match(rail.slice(0, 400), /overflow-x: auto/);
    assert.doesNotMatch(rail.slice(0, 400), /flex-wrap: wrap/);
    // 44px minimum target survives the redesign.
    assert.match(css, /\.od-portfolio-views__tab[\s\S]{0,400}min-height: 44px/);
  });
});

/* ========================================================================== */
/* 2. The duplicate second filter row is gone                                  */
/* ========================================================================== */

describe("there is no second public filter row", () => {
  test("PortfolioGrid renders no category rail at all", () => {
    const grid = code(read(GRID));
    assert.doesNotMatch(grid, /portfolio-filter-tabs/);
    assert.doesNotMatch(grid, /od-portfolio-filters/);
    assert.doesNotMatch(grid, /od-filter/);
    assert.doesNotMatch(grid, /PORTFOLIO_CATEGORIES/);
    assert.doesNotMatch(grid, /All Projects</);
    assert.doesNotMatch(grid, /Complete Interiors/);
  });

  test("no public component renders those controls anywhere else", () => {
    for (const file of [PAGE, TABS, GALLERY]) {
      const src = code(read(file));
      assert.doesNotMatch(src, /portfolio-filter-tabs/, file);
      assert.doesNotMatch(src, /od-portfolio-filters/, file);
    }
  });

  test("the retired styles were removed, not just orphaned", () => {
    /*
     * A stylesheet that still knows how to draw the rail is an invitation to
     * bring it back. The rules are gone; only the note explaining why remains,
     * which is why this reads comment-stripped CSS.
     */
    const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /\.od-portfolio-filters\s*\{/);
    assert.doesNotMatch(css, /\.od-filter\s*\{/);
    assert.doesNotMatch(css, /\.od-filter\[data-active\]/);
  });

  test("the CLASSIFICATION behind it was not deleted", () => {
    /*
     * This was a presentation change. The category vocabulary, the stored
     * column and the legacy `?category=` contract all still work — removing a
     * control is not the same as removing the data, and a visitor arriving on
     * an old link must still land somewhere real.
     */
    assert.equal(
      parseListingParams({ category: "complete-interiors" })!.view,
      "projects"
    );
    assert.equal(parseListingParams({ category: "bedroom" })!.view, "bedroom");
    assert.equal(parseListingParams({ category: "nonsense" }), null);
    // And the page still answers an old link with one permanent redirect.
    assert.match(read(PAGE), /permanentRedirect\(portfolioViewHref\(parsed\.view\)\)/);
  });
});

/* ========================================================================== */
/* 3. Projects pagination keeps its view                                       */
/* ========================================================================== */

describe("project pagination never falls back to the bare path", () => {
  test("every URL the grid builds carries view=projects", () => {
    const grid = read(GRID);
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * `buildUrl` used to emit the bare `/portfolio` whenever no parameter
     * happened to be set, which was correct while `/portfolio` meant Projects.
     * It now means Kitchen — so page 2 → page 1 would have dropped a visitor
     * out of the projects listing and into the kitchen photographs.
     */
    assert.match(grid, /params\.set\("view", "projects"\);/);
    assert.doesNotMatch(
      code(grid),
      /return query \? `\/portfolio\?\$\{query\}` : "\/portfolio"/
    );
    // No code path returns a bare /portfolio from the builder.
    const builder = grid.slice(
      grid.indexOf("const buildUrl"),
      grid.indexOf("return (")
    );
    assert.doesNotMatch(builder, /"\/portfolio"/);
    assert.match(builder, /return `\/portfolio\?\$\{params\.toString\(\)\}`;/);
  });

  test("page 1 and page 2 both resolve to the projects view", () => {
    assert.equal(parseListingParams({ view: "projects" })!.view, "projects");
    const page2 = parseListingParams({ view: "projects", page: "2" });
    assert.equal(page2!.view, "projects");
    assert.equal(page2!.page, 2);
  });

  test("the empty-listing reset targets the projects view by name", () => {
    const grid = read(GRID);
    assert.match(
      grid,
      /id="portfolio-empty-reset-button"\s*\n\s*href=\{PORTFOLIO_PROJECTS_HREF\}/
    );
    // The consultation fallback is untouched: an empty portfolio has no reset.
    assert.match(grid, /portfolio-empty-consultation-button/);
  });
});

/* ========================================================================== */
/* 4. The room explanatory copy is gone, and not replaced                      */
/* ========================================================================== */

describe("a room view has a heading and a grid, and no paragraph between", () => {
  test("the old sentence is gone", () => {
    assert.doesNotMatch(
      read(PAGE),
      /Every image opens the project it came from/,
      "a room-library photograph has no project to open"
    );
  });

  test("the REJECTED replacement was not introduced", () => {
    /*
     * The owner rejected replacement explanatory copy explicitly. Deleting one
     * sentence and writing another is the obvious thing to do here, so the
     * specific rejected wording is pinned as an absence.
     */
    for (const file of [PAGE, GALLERY]) {
      assert.doesNotMatch(
        read(file),
        /Browse photographs from ONEDECORE interiors/,
        file
      );
      assert.doesNotMatch(read(file), /Tap any image to view it larger/, file);
    }
  });

  test("the lede renders only for the projects view", () => {
    const page = read(PAGE);
    assert.match(page, /\{room \? null : \(/);
    assert.match(page, /className="od-portfolio-lede"/);
  });

  test("the eyebrow and the room heading pattern survive", () => {
    const page = read(PAGE);
    assert.match(page, /ONEDECORE Portfolio<\/p>/);
    assert.match(
      page,
      /\$\{PORTFOLIO_ROOM_LABELS\[room\]\} interiors we’ve delivered across Pune\./
    );
  });
});

/* ========================================================================== */
/* 5. The Instagram grid                                                       */
/* ========================================================================== */

describe("the room grid is dense, square and image-only", () => {
  test("3 columns on mobile, 4 on tablet, 5 on desktop", () => {
    const css = read(CSS);
    const grid = css.slice(
      css.indexOf(".od-room-gallery {"),
      css.indexOf(".od-room-gallery__item")
    );
    // Mobile-first: the unqualified rule is the phone.
    assert.match(grid, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(
      grid,
      /@media \(min-width: 641px\)[\s\S]{0,160}repeat\(4, minmax\(0, 1fr\)\)/
    );
    assert.match(
      grid,
      /@media \(min-width: 1025px\)[\s\S]{0,160}repeat\(5, minmax\(0, 1fr\)\)/
    );
  });

  test("the gap is a hairline and does not scale with the viewport", () => {
    const css = read(CSS);
    const grid = css.slice(
      css.indexOf(".od-room-gallery {"),
      css.indexOf(".od-room-gallery__item")
    );
    assert.match(grid, /gap: 3px/);
    assert.doesNotMatch(grid, /gap: clamp\(/, "a scaling gutter rebuilds the cards");
  });

  test("tiles are square, unrounded, and cannot overflow their column", () => {
    const css = read(CSS);
    const tile = css.slice(
      css.indexOf(".od-room-gallery__tile {"),
      css.indexOf(".od-room-gallery__image")
    );
    assert.match(tile, /aspect-ratio: 1 \/ 1/);
    assert.match(tile, /max-width: 100%/);
    assert.match(tile, /border-radius: 0/);
    assert.doesNotMatch(tile, /aspect-ratio: 4 \/ 5/);
    // A grid item's default min-width: auto is the usual cause of side-scroll.
    assert.match(css, /\.od-room-gallery__item[\s\S]{0,300}min-width: 0/);
  });

  test("the closed tile carries the photograph and NOTHING else", () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * Half these photographs are room-library uploads with no project. A
     * caption strip could therefore render on some tiles and not others, which
     * reads as the unnamed ones being broken or lesser. The tile is the image.
     */
    const gallery = code(read(GALLERY));
    const tile = gallery.slice(
      gallery.indexOf('className="od-room-gallery__tile"'),
      gallery.indexOf("</ul>")
    );
    assert.doesNotMatch(tile, /od-room-gallery__meta/);
    assert.doesNotMatch(tile, /od-room-gallery__project/);
    assert.doesNotMatch(tile, /od-room-gallery__where/);
    assert.doesNotMatch(tile, /photo\.project/);
    assert.doesNotMatch(tile, /locationLabel/);
    assert.doesNotMatch(tile, /roomLabel/);
    assert.doesNotMatch(tile, /<Link/);
  });

  test("the metadata styles were removed with the markup", () => {
    const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /\.od-room-gallery__meta\s*\{/);
    assert.doesNotMatch(css, /\.od-room-gallery__project\s*\{/);
    assert.doesNotMatch(css, /\.od-room-gallery__where\s*\{/);
  });

  test("Next/Image sizes match the real grid, and lazy loading stays", () => {
    const gallery = read(GALLERY);
    assert.match(
      gallery,
      /"\(max-width: 640px\) 33vw, \(max-width: 1024px\) 25vw, 20vw"/,
      "sizes must describe a thumbnail, not a half-width card"
    );
    assert.match(gallery, /sizes=\{ROOM_THUMBNAIL_SIZES\}/);
    assert.match(gallery, /loading="lazy"/);
    // Still Next/Image, still no gallery dependency.
    assert.match(gallery, /import Image from "next\/image"/);
  });

  test("no third-party gallery or carousel package was added", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const names = Object.keys(pkg.dependencies ?? {}).join(" ");
    assert.doesNotMatch(
      names,
      /lightbox|lightgallery|photoswipe|swiper|carousel|fancybox|slick|embla|keen-slider/i
    );
  });

  test("the focal point still does the cropping", () => {
    const gallery = read(GALLERY);
    assert.match(
      gallery,
      /objectPosition: focalObjectPosition\(\s*photo\.image\.focalX,\s*photo\.image\.focalY\s*\)/
    );
    assert.match(read(CSS), /\.od-room-gallery__image[\s\S]{0,200}object-fit: cover/);
  });

  test("the loading skeleton reserves the same geometry", () => {
    /*
     * The heading and the tab rail render outside Suspense, so a skeleton that
     * also drew an eyebrow, a title and a filter row painted a second set of
     * furniture under the real one — a duplicate row on every load, which is
     * the exact thing this change removes.
     */
    const skeleton = read(
      "src/features/portfolio/public/components/PortfolioSkeleton.tsx"
    );
    assert.doesNotMatch(code(skeleton), /od-loading__filters|od-loading__header/);
    assert.match(skeleton, /variant === "room"/);
    assert.match(skeleton, /od-skeleton--tile/);
    const css = read(CSS);
    assert.match(
      css,
      /\.od-loading__tiles[\s\S]{0,200}repeat\(3, minmax\(0, 1fr\)\)/
    );
    assert.match(css, /\.od-skeleton--tile[\s\S]{0,160}aspect-ratio: 1 \/ 1/);
  });
});

/* ========================================================================== */
/* 6. Standalone vs project-linked, in the grid and in the lightbox            */
/* ========================================================================== */

describe("a standalone photograph is never dressed up as a project", () => {
  test("nothing invents a title, a locality or a project URL", () => {
    const gallery = code(read(GALLERY));
    assert.doesNotMatch(gallery, /photo\.project!\./);
    assert.doesNotMatch(gallery, /photo\.project\?\.slug/);
    // The only project link in the file is inside a guard, in the lightbox.
    const links = gallery.match(/\/portfolio\/\$\{photo\.project\.slug\}/g) ?? [];
    assert.equal(links.length, 1);
  });

  test("the project link and title live behind the same null check", () => {
    const gallery = read(GALLERY);
    const foot = gallery.slice(gallery.indexOf('className="od-lightbox__foot"'));
    assert.match(foot, /\{photo\.project \? \(/);
    assert.match(foot, /View Full Project/);
    assert.match(foot, /\{photo\.project\.title\}/);
  });

  test("the two sources are indistinguishable in the closed grid", () => {
    /*
     * There is no branch inside the tile at all, which is the strongest form
     * of this guarantee: a library photograph and a project photograph render
     * through identical markup because there is only one path through it.
     */
    const gallery = code(read(GALLERY));
    const tile = gallery.slice(
      gallery.indexOf('className="od-room-gallery__tile"'),
      gallery.indexOf("</ul>")
    );
    assert.doesNotMatch(tile, /\?\s*\(/);
    assert.doesNotMatch(tile, /&&/);
  });
});

/* ========================================================================== */
/* 7. The lightbox                                                             */
/* ========================================================================== */

describe("the lightbox keeps its contract and gains navigation", () => {
  test("dialog semantics, Escape, focus trap, restore and scroll lock", () => {
    const gallery = read(GALLERY);
    assert.match(gallery, /role="dialog"/);
    assert.match(gallery, /aria-modal="true"/);
    assert.match(gallery, /event\.key === "Escape"/);
    assert.match(gallery, /document\.body\.style\.overflow = "hidden"/);
    assert.match(gallery, /restoreTo\.current\?\.focus\?\.\(\)/);
    assert.match(gallery, /event\.key !== "Tab"/);
    assert.match(gallery, /aria-label="Close image"/);
  });

  test("the photograph is shown at its natural ratio, not the square crop", () => {
    assert.match(read(CSS), /\.od-lightbox__image[\s\S]{0,300}object-fit: contain/);
  });

  test("Previous / Next and the arrow keys step through the room", () => {
    const gallery = read(GALLERY);
    assert.match(gallery, /aria-label="Previous image"/);
    assert.match(gallery, /aria-label="Next image"/);
    assert.match(gallery, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowRight"/);
    assert.match(gallery, /stepRef\.current\(event\.key === "ArrowLeft" \? -1 : 1\)/);
    // Wraps rather than dead-ending at either edge.
    assert.match(gallery, /\(current \+ delta \+ photos\.length\) % photos\.length/);
  });

  test("a room of one photograph gets no navigation at all", () => {
    assert.match(read(GALLERY), /onStep=\{photos\.length > 1 \? step : undefined\}/);
    assert.match(read(GALLERY), /\{onStep \? \(/);
  });

  test("stepping does not re-arm the mount effect", () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * If the focus effect depended on `onStep` it would re-run on every step,
     * re-snapshotting `restoreTo` from the Next button that is focused at that
     * moment. Closing would then restore focus into a dialog that no longer
     * exists instead of to the tile the visitor opened. The handler reads the
     * current callback from a ref instead.
     */
    const gallery = read(GALLERY);
    assert.match(gallery, /const stepRef = useRef\(onStep\);/);
    assert.match(gallery, /\}, \[onClose\]\);/);
    assert.doesNotMatch(gallery, /\}, \[onClose, onStep\]\);/);
    /*
     * And the ref is tracked in an effect, not assigned during render —
     * writing a ref while rendering makes the component impure and the React
     * Compiler rejects it outright.
     */
    assert.match(gallery, /stepRef\.current = onStep;\s*\n\s*\}, \[onStep\]\);/);
    assert.doesNotMatch(gallery, /\n\s*stepRef\.current = onStep;\s*\n\s*\n/);
  });
});

/* ========================================================================== */
/* 8. Empty states                                                             */
/* ========================================================================== */

describe("an empty view offers something real", () => {
  test("an empty room points at the projects view, not at itself", () => {
    /*
     * A bare `/portfolio` would now return a visitor looking at an empty
     * Kitchen to the page they are already standing on.
     */
    const gallery = read(GALLERY);
    assert.match(gallery, /portfolio-room-empty-state/);
    assert.match(gallery, /href=\{PORTFOLIO_PROJECTS_HREF\}/);
    assert.match(gallery, /View all projects/);
    const empty = gallery.slice(
      gallery.indexOf("portfolio-room-empty-state"),
      gallery.indexOf("od-room-gallery\"")
    );
    assert.doesNotMatch(empty, /href="\/portfolio"/);
  });

  test("an empty room does NOT substitute project cards", () => {
    const gallery = code(read(GALLERY));
    assert.doesNotMatch(gallery, /PortfolioCard/);
    assert.doesNotMatch(gallery, /PortfolioGrid/);
    assert.doesNotMatch(gallery, /getPaginatedProjects/);
  });

  test("the honest project empty state is unchanged", () => {
    const grid = read(GRID);
    assert.match(grid, /Project photography is on its way/);
    assert.match(grid, /PUBLIC_CONSULTATION\.href/);
  });
});

/* ========================================================================== */
/* 9. Nothing underneath the presentation moved                                */
/* ========================================================================== */

describe("this was a presentation change and nothing else", () => {
  test("no migration was added for it", () => {
    /*
     * Asserted structurally rather than by counting files, so the test keeps
     * meaning something after the next unrelated migration lands: none of the
     * files this change touched may contain schema DDL.
     */
    for (const file of [PAGE, GRID, GALLERY, TABS, "src/features/portfolio/public/portfolio-rooms.ts"]) {
      assert.doesNotMatch(
        read(file),
        /\b(create table|alter table|create policy|grant )\b/i,
        file
      );
    }
  });

  test("the room vocabulary and the DB-facing constants are untouched", () => {
    assert.deepEqual([...PORTFOLIO_ROOM_CODES], ["living-room", "bedroom", "kitchen"]);
  });

  test("the public page reads the cache, not storage, and stays dynamic", () => {
    const page = read(PAGE);
    assert.match(page, /getRoomGallery/);
    assert.match(page, /getPaginatedProjects/);
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.doesNotMatch(code(page), /storage\.from\(|service_role/);
  });

  test("the 404-before-streaming contract still holds", () => {
    const page = read(PAGE);
    const body = page.slice(page.indexOf("export default async function"));
    const notFoundAt = body.indexOf("notFound();");
    const suspenseAt = body.indexOf("<Suspense");
    assert.ok(notFoundAt > 0 && notFoundAt < suspenseAt);
  });
});
