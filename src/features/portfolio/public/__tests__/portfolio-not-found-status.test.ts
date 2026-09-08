/**
 * Invalid portfolio URLs must answer 404, not "200 OK — not found".
 *
 * THE BUG THIS LOCKS OUT
 *
 * `/portfolio?category=bogus`, `?service=unknown`, `?page=0` and an unknown
 * project slug all rendered the not-found BODY under an HTTP 200. In a browser
 * it looked correct, which is exactly why it survived: a crawler reads the
 * status line, not the words on the page, so each of those URLs was an
 * indexable success response whose content said "not found".
 *
 * THE CAUSE, AND WHY IT IS EASY TO REINTRODUCE
 *
 * `notFound()` can only set a status while the response headers are unsent.
 * Next starts streaming — and therefore sends the headers — the moment a
 * Suspense fallback renders, and a segment-level `loading.tsx` renders one
 * before the page has decided anything. Adding `app/portfolio/loading.tsx`
 * back, or moving the validation after the Suspense boundary, silently
 * restores the bug and changes nothing a human would notice.
 *
 * So this suite asserts the STRUCTURE that keeps it fixed, and does it by
 * reading source rather than by starting a server: the status code is a
 * property of where `notFound()` sits relative to the boundary, and that is
 * visible statically. A live-server check runs in the release smoke test.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const LISTING = "src/app/portfolio/page.tsx";
const DETAIL = "src/app/portfolio/[slug]/page.tsx";
const SKELETON = "src/features/portfolio/public/components/PortfolioSkeleton.tsx";

describe("nothing streams before the portfolio decides 404", () => {
  test("the portfolio segment has no loading.tsx", () => {
    /*
     * A `loading.tsx` is a segment-wide Suspense fallback. Its fallback renders
     * before the page body runs, which sends the headers, which freezes the
     * status at 200. The skeleton lives inside the page instead.
     */
    for (const path of [
      "src/app/portfolio/loading.tsx",
      "src/app/portfolio/[slug]/loading.tsx",
    ]) {
      assert.equal(
        existsSync(join(root, path)),
        false,
        `${path} would start streaming before the not-found decision`
      );
    }
    assert.equal(existsSync(join(root, SKELETON)), true);
  });

  test("the listing validates before it opens a Suspense boundary", () => {
    const src = read(LISTING);
    const notFoundAt = src.indexOf("notFound();");
    const suspenseAt = src.indexOf("<Suspense");
    assert.ok(notFoundAt > 0, "the listing must still refuse invalid input");
    assert.ok(suspenseAt > 0, "the skeleton must still cover the fetch");
    assert.ok(
      notFoundAt < suspenseAt,
      "notFound() must come before the Suspense boundary, or the status freezes at 200"
    );
  });

  test("the fetch is inside the boundary, not above it", () => {
    /*
     * If `getPaginatedProjects` were awaited in the page body again, the
     * skeleton would cover nothing — the page would simply block. The point of
     * the split is that the decision is fast and only the data waits.
     */
    const src = read(LISTING);
    const fetchAt = src.indexOf("getPaginatedProjects(");
    const componentAt = src.indexOf("async function PortfolioProjectResults");
    assert.ok(componentAt > 0, "the results component must exist");
    assert.ok(
      fetchAt > componentAt,
      "the paginated fetch belongs inside PortfolioProjectResults"
    );
  });
});

describe("generateMetadata describes, and the page decides", () => {
  test("neither route calls notFound() from generateMetadata", () => {
    /*
     * `notFound()` is documented for Server Components, Server Functions and
     * Route Handlers — not for metadata. Called from `generateMetadata` it
     * still rendered the not-found UI, which is what made the 200 so easy to
     * miss. Metadata now returns a noindex document and the page refuses.
     */
    for (const rel of [LISTING, DETAIL]) {
      const src = read(rel);
      const start = src.indexOf("export async function generateMetadata");
      assert.ok(start > 0, `${rel} must export generateMetadata`);
      const end = src.indexOf("\nexport default", start);
      const body = src.slice(start, end > start ? end : undefined);
      assert.doesNotMatch(
        body,
        /notFound\(\)/,
        `${rel}: generateMetadata must not call notFound()`
      );
      assert.match(
        body,
        /robots: \{ index: false, follow: false \}/,
        `${rel}: metadata must ask not to be indexed when it cannot describe the page`
      );
    }
  });

  test("the detail route's lookup is split into throwing and non-throwing", () => {
    const src = read(DETAIL);
    assert.match(src, /async function findPublishedProject/);
    assert.match(src, /async function loadPublishedProject/);
    // Metadata uses the one that returns null; the page uses the one that refuses.
    const meta = src.slice(src.indexOf("export async function generateMetadata"));
    assert.match(meta.slice(0, 400), /findPublishedProject\(params\)/);
    const page = src.slice(src.indexOf("export default async function"));
    assert.match(page.slice(0, 400), /loadPublishedProject\(params\)/);
  });

  test("the page still refuses malformed slugs before querying Supabase", () => {
    /*
     * Unchanged and still load-bearing: slug grammar is checked before the
     * database is touched, so traversal attempts never reach a query.
     */
    const src = read(DETAIL);
    const finder = src.slice(
      src.indexOf("async function findPublishedProject"),
      src.indexOf("async function loadPublishedProject")
    );
    const guardAt = finder.indexOf("isValidPortfolioSlug");
    const queryAt = finder.indexOf("getProjectBySlug");
    assert.ok(guardAt > 0 && queryAt > guardAt);
  });
});

describe("the skeleton kept its accessibility contract through the move", () => {
  test("one spoken message, outside the busy region, no live region", () => {
    const src = read(SKELETON);
    assert.match(src, /role="status"/);
    assert.match(src, /aria-busy="true"/);
    assert.match(src, /aria-label="Loading Portfolio"/);
    assert.doesNotMatch(src, /aria-live/);
    assert.match(src, /Loading ONEDECORE Portfolio projects/);
    const statusAt = src.indexOf('role="status"');
    const busyAt = src.indexOf('aria-busy="true"');
    assert.ok(statusAt >= 0 && busyAt > statusAt);
  });

  test("it renders no real project data", () => {
    const src = read(SKELETON);
    assert.doesNotMatch(src, /getPaginatedProjects|PortfolioGrid|Villa|Bandra/);
  });
});
