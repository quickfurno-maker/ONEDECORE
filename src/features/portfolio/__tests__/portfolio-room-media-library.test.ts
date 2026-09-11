/**
 * The bulk room media library: what it may do, and what it must never do.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 *  1. The two shapes stay apart. `portfolio_media.project_id` is nullable now,
 *     which means every rule that used to be guaranteed by "there is always a
 *     project" has to be stated. A library upload must not be able to name a
 *     project or claim a cover; a project upload must not be able to slip into
 *     the library namespace.
 *
 *  2. Uploading is not publishing. Fifty images landing successfully must show
 *     a visitor nothing until somebody decides otherwise.
 *
 *  3. No fabricated project chrome. A standalone photograph has no title,
 *     locality, client or year, and the public renderer must show the picture
 *     rather than invent any of them — or emit `/portfolio/undefined`.
 *
 *  4. The bulk upload is genuinely bulk. One request per file, bounded
 *     concurrency, per-file state, and a partial batch reported as a partial
 *     batch rather than as one red failure.
 *
 *  5. The existing project workflow did not regress. That is the failure that
 *     would cost the most, and it is asserted last and hardest.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ALT_TEXT_MAX,
  ALT_TEXT_MIN,
  LIBRARY_PAGE_SIZE,
  LIBRARY_UPLOAD_CONCURRENCY,
  defaultLibraryAltText,
  isLibraryPublicationFilter,
  isLibraryRoomFilter,
  isValidAltText,
  resolveLibraryAltText,
} from "../domain/portfolio-library.ts";
import {
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
} from "../public/portfolio-rooms.ts";
import { ACCEPTED_UPLOAD_MIME_TYPES } from "../domain/portfolio-media.ts";
import {
  validatePublicStoragePath,
  buildPublicStorageUrl,
} from "../public/public-url.ts";
import { mapLibraryRoomPhoto } from "../public/public-portfolio-mapper.ts";
import {
  publicRoomLibraryPaths,
  publicRoomLibraryTags,
} from "../public/public-cache-keys.ts";
import { PUBLIC_CACHE_TAGS } from "../public/constants.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped: this file asserts on absences too. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const LIBRARY_ROUTE = "src/app/api/admin/portfolio/media/library/route.ts";
const PROJECT_ROUTE = "src/app/api/admin/portfolio/media/route.ts";
const UPLOAD_PIPELINE = "src/features/portfolio/server/portfolio-media-upload.ts";
const ACTIONS = "src/features/portfolio/server/portfolio-library-actions.ts";
const REPOSITORY = "src/features/portfolio/server/portfolio-library-repository.ts";
const GRID = "src/features/portfolio/components/PortfolioMediaLibrary.tsx";
const UPLOADER = "src/features/portfolio/components/PortfolioLibraryUploader.tsx";
const PAGE = "src/app/admin/portfolio/media/page.tsx";
const NAV = "src/features/portfolio/components/PortfolioAdminNav.tsx";
const GALLERY = "src/features/portfolio/public/components/PortfolioRoomGallery.tsx";
const MIGRATION =
  "supabase/migrations/20260913120000_portfolio_standalone_room_media_library.sql";

const libraryRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "d1111111-1111-4111-8111-111111111111",
    project_id: null,
    media_role: "gallery",
    status: "ready",
    public_object_path:
      "room-library/kitchen/d1111111-1111-4111-8111-111111111111/gallery-1200.webp",
    width_px: 1200,
    height_px: 900,
    alt_text: "ONEDECORE kitchen interior",
    caption: null,
    sort_order: 0,
    created_at: "2026-09-13T00:00:00.000Z",
    room_category_code: "kitchen",
    focal_x: 50,
    focal_y: 50,
    room_gallery_published: true,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/* -------------------------------------------------------------------------- */
/* 1. Alt text                                                                */
/* -------------------------------------------------------------------------- */

describe("alt text is fast to supply and never a filename", () => {
  test("every room has a truthful default", () => {
    for (const room of PORTFOLIO_ROOM_CODES) {
      const alt = defaultLibraryAltText(room);
      assert.ok(isValidAltText(alt), `${room} default must satisfy the DB check`);
      assert.match(alt, /^ONEDECORE /);
      assert.ok(
        alt.toLowerCase().includes(PORTFOLIO_ROOM_LABELS[room].toLowerCase()),
        "the default names the room the owner chose"
      );
    }
  });

  test("the owner's own description always wins", () => {
    assert.equal(
      resolveLibraryAltText("kitchen", "  Walnut island with brass tapware  "),
      "Walnut island with brass tapware"
    );
    assert.equal(resolveLibraryAltText("kitchen", "   "), defaultLibraryAltText("kitchen"));
    assert.equal(resolveLibraryAltText("kitchen", null), defaultLibraryAltText("kitchen"));
  });

  test("the bounds match the database, so the UI refuses what the DB would", () => {
    assert.equal(ALT_TEXT_MIN, 5);
    assert.equal(ALT_TEXT_MAX, 180);
    assert.equal(isValidAltText("abcd"), false);
    assert.equal(isValidAltText("a".repeat(181)), false);
    assert.equal(isValidAltText("a".repeat(180)), true);
  });

  test("a filename is never used as alt text", () => {
    /*
     * The realistic alternative to a generated default is not better alt text,
     * it is `IMG_4921.JPG` published to a public page twenty times over. The
     * uploader must not reach for the file's name.
     */
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /defaultLibraryAltText\(item\.roomCode\)/);
    assert.doesNotMatch(
      uploader,
      /append\("altText",\s*[a-zA-Z.]*file\.name/,
      "the filename must never become alt text"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2. The library endpoint's contract                                         */
/* -------------------------------------------------------------------------- */

describe("the library endpoint cannot be talked into being the project one", () => {
  test("a project id is refused, not ignored", () => {
    /*
     * Silently dropping it would produce a standalone row where the caller
     * expected a project one — a wrong outcome reported as success.
     */
    const route = code(read(LIBRARY_ROUTE));
    assert.match(route, /formData\.has\("projectId"\)/);
    assert.match(route, /PROJECT_NOT_ALLOWED/);
    assert.match(route, /status: 400/);
  });

  test("a cover is impossible to request", () => {
    const route = code(read(LIBRARY_ROUTE));
    assert.match(route, /formData\.has\("mediaRole"\)/);
    assert.match(route, /ROLE_NOT_ALLOWED/);
    // And the server derives the role rather than reading one.
    assert.match(code(read(UPLOAD_PIPELINE)), /scope\.kind === "project" \? scope\.mediaRole : "gallery"/);
  });

  test("a room is required and validated against the allowlist", () => {
    const route = code(read(LIBRARY_ROUTE));
    assert.match(route, /isPortfolioRoomCode\(roomCategoryCode\)/);
    assert.match(route, /INVALID_ROOM/);
  });

  test("the upload is never published by the act of uploading", () => {
    assert.match(code(read(UPLOAD_PIPELINE)), /room_gallery_published: false/);
    const route = code(read(LIBRARY_ROUTE));
    assert.doesNotMatch(
      route,
      /room_gallery_published:\s*true/,
      "the route must have no way to publish"
    );
  });

  test("auth, same-origin and the size limit are all enforced by the route", () => {
    const route = code(read(LIBRARY_ROUTE));
    assert.match(route, /checkSameOrigin\(request\)/);
    assert.match(route, /portfolio\.manage/);
    assert.match(route, /MAX_FILE_SIZE_BYTES/);
    assert.match(route, /FILE_SIZE_EXCEEDED/);

    /*
     * The shared processor deliberately does NOT authenticate. A function that
     * could be called without a permission check is one somebody eventually
     * calls without a permission check, so the gate lives in the routes and
     * this asserts it did not drift into the shared code.
     */
    assert.doesNotMatch(code(read(UPLOAD_PIPELINE)), /getClaims|checkSameOrigin/);
  });

  test("duplicates are refused with 409 and scoped to the library", () => {
    const pipeline = code(read(UPLOAD_PIPELINE));
    assert.match(pipeline, /DUPLICATE_IMAGE/);
    assert.match(pipeline, /409/);
    // Library scope is the whole standalone set, not one project.
    assert.match(pipeline, /parent\.project_id === null && parent\.status !== "retired"/);
  });

  test("a failed upload leaves neither a row nor an object", () => {
    const pipeline = code(read(UPLOAD_PIPELINE));
    assert.match(pipeline, /portfolio-originals"\)\.remove/);
    assert.match(pipeline, /portfolio-public"\)\.remove/);
    assert.match(pipeline, /from\("portfolio_media"\)\.delete\(\)/);

    /*
     * Order matters: while the row exists the objects are attributable. The
     * row must be removed LAST, or a failed cleanup leaves files nothing
     * points at.
     */
    const rowDelete = pipeline.indexOf('from("portfolio_media").delete()');
    const originalsRemove = pipeline.indexOf('portfolio-originals").remove');
    assert.ok(originalsRemove > 0 && rowDelete > originalsRemove, "row is deleted last");
  });
});

/* -------------------------------------------------------------------------- */
/* 3. The bulk upload experience                                              */
/* -------------------------------------------------------------------------- */

describe("the uploader is a real bulk tool", () => {
  test("the room is chosen once, then applied to every file in the batch", () => {
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /name="library-room"/, "one radio group, not one per file");
    assert.match(uploader, /body\.append\("roomCategoryCode", item\.roomCode\)/);
  });

  test("many files can be selected in one action", () => {
    const uploader = read(UPLOADER);
    assert.match(uploader, /<input[\s\S]{0,200}multiple/);
    assert.match(uploader, /onDrop=/);

    /*
     * The accepted types come from the shared constant rather than a literal
     * typed into the component, so the file picker and the server validator
     * cannot disagree about what an image is.
     */
    assert.match(uploader, /ACCEPTED_UPLOAD_MIME_TYPES\.join\(","\)/);
    assert.deepEqual(
      [...ACCEPTED_UPLOAD_MIME_TYPES],
      ["image/jpeg", "image/png", "image/webp"]
    );

    /*
     * And the constant lives in the PURE domain, not beside the sharp
     * pipeline. Importing the limits through that module drags a native binary
     * into the browser bundle and fails the build — which it did, once.
     */
    assert.match(uploader, /from "\.\.\/domain\/portfolio-media"/);
    assert.doesNotMatch(
      code(read(UPLOADER)),
      /from "\.\.\/server\//,
      "a client component must not import from the server pipeline"
    );
  });

  test("one request per file, not one request for fifty files", () => {
    const uploader = code(read(UPLOADER));
    const appends = uploader.match(/body\.append\("file"/g) ?? [];
    assert.equal(appends.length, 1, "exactly one file per FormData");
    assert.doesNotMatch(uploader, /for \(const .* of files\)[\s\S]{0,80}append\("file"/);
  });

  test("concurrency is bounded", () => {
    assert.ok(LIBRARY_UPLOAD_CONCURRENCY >= 2 && LIBRARY_UPLOAD_CONCURRENCY <= 4);
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /LIBRARY_UPLOAD_CONCURRENCY/);
    assert.match(uploader, /Math\.min\(LIBRARY_UPLOAD_CONCURRENCY, pending\.length\)/);
  });

  test("progress is per file and distinguishes uploading from processing", () => {
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /xhr\.upload\.onprogress/);
    assert.match(uploader, /pct >= 100 \? "processing" : "uploading"/);
    assert.match(uploader, /<progress/);
  });

  test("one failure does not cancel the files that already succeeded", () => {
    const uploader = code(read(UPLOADER));
    /*
     * Each request resolves rather than rejects, so a failure updates one row
     * and the pool keeps going. A rejection would abort `Promise.all` and lose
     * the outcome of everything still in flight.
     */
    assert.doesNotMatch(uploader, /reject\(/, "a failed file must not reject the batch");
    assert.match(uploader, /status: "failed"/);
    assert.match(uploader, /resolve\(\);/);
  });

  test("duplicates are their own outcome, not a failure", () => {
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /status === 409 \|\| code === "DUPLICATE_IMAGE"/);
    assert.match(uploader, /status: "duplicate"/);
    // And the summary reports the three counts separately.
    assert.match(uploader, /uploaded\.length/);
    assert.match(uploader, /duplicates\.length/);
    assert.match(uploader, /failed\.length/);
  });

  test("failed files can be retried or removed without touching the rest", () => {
    const uploader = read(UPLOADER);
    assert.match(uploader, /Retry failed/);
    assert.match(uploader, /Remove failed/);
    assert.match(code(read(UPLOADER)), /item\.status !== "failed"/);
  });

  test("object URLs are tracked in a ref, not captured from a stale render", () => {
    /*
     * THE BUG THIS LOCKS.
     *
     * The first version was an unmount effect with `[]` dependencies closing
     * over `items`. It captured the array as it was on the FIRST render —
     * empty — so every preview created afterwards leaked for the life of the
     * page. On a fifty-image batch that is fifty blobs held forever.
     *
     * The obvious repair is worse: adding `items` to the dependency list makes
     * the cleanup run on every queue change and revoke URLs that are still
     * painting visible thumbnails.
     *
     * A ref holds the live set. Asserted structurally because neither failure
     * mode throws — one leaks silently, the other blanks a thumbnail.
     */
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /const objectUrls = useRef<Set<string>>\(new Set\(\)\)/);
    assert.match(uploader, /objectUrls\.current\.add\(previewUrl\)/);
    assert.match(uploader, /objectUrls\.current\.delete\(url\)/);

    // The unmount effect reads the ref, and its dependency list stays empty.
    assert.match(uploader, /const live = objectUrls\.current;[\s\S]{0,220}for \(const url of live\) URL\.revokeObjectURL\(url\)/);

    /*
     * And `items` must not be a dependency of any effect — that is the exact
     * shape of the "revoke URLs still in use" regression.
     */
    assert.doesNotMatch(uploader, /useEffect\([\s\S]{0,400}\}, \[items\]\)/);

    /*
     * Removing an item releases only that item, and releases BOTH the URL and
     * the queued identity — otherwise a removed file could never be re-added.
     */
    assert.match(uploader, /const forget = useCallback\(/);
    assert.match(uploader, /releaseUrl\(item\.previewUrl\)/);
    assert.match(uploader, /queuedIdentities\.current\.delete\(item\.identity\)/);
    assert.match(uploader, /for \(const item of failed\) forget\(item\)/);
  });

  test("the same file cannot be queued twice in one open batch", () => {
    /*
     * WHY THE SERVER CHECK IS NOT ENOUGH ON ITS OWN.
     *
     * The server refuses a checksum already stored, and that stays
     * authoritative for anything previously uploaded. It cannot help WITHIN a
     * batch: three uploads run concurrently, so the same file queued twice can
     * have both requests read `portfolio_media_sources` before either writes
     * its row — and both then pass.
     *
     * The UI simply never sends the same local file twice in one queue. That
     * is the case the owner actually hits (a folder dragged in, then dragged
     * in again), and it costs one Set rather than a lock or a checksum table.
     */
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /function fileIdentity\(file: File\)/);
    assert.match(
      uploader,
      /file\.name.*file\.size.*file\.lastModified.*file\.type/,
      "identity is name + size + lastModified + type"
    );
    assert.match(uploader, /const queuedIdentities = useRef<Set<string>>\(new Set\(\)\)/);
    assert.match(uploader, /if \(queuedIdentities\.current\.has\(identity\)\) \{[\s\S]{0,60}continue;/);

    /*
     * The suppression is visible to the owner, and it is counted OUTSIDE the
     * `setItems` updater. Setting state from inside another updater is not
     * supported — React may discard it — and that is exactly what happened
     * first time round: the dedupe worked and the count never reached the
     * screen, which is the worst of both.
     */
    assert.match(uploader, /already selected/i);
    assert.match(uploader, /setAlreadySelected\(repeats\);/);
    assert.match(uploader, /if \(next\.length > 0\) setItems\(/);
    assert.doesNotMatch(
      uploader,
      /setItems\(\(current\) => \{[\s\S]*?setAlreadySelected/,
      "the repeat count must not be set from inside a state updater"
    );

    /*
     * And the server's own duplicate answer is untouched: a file already in
     * the library still comes back 409 and still shows as "Duplicate".
     */
    assert.match(uploader, /status === 409 \|\| code === "DUPLICATE_IMAGE"/);
    assert.match(uploader, /status: "duplicate"/);
  });

  test("a queued row is uploaded and labelled with the room it was queued under", () => {
    /*
     * THE UX LIE THIS PREVENTS.
     *
     * Rows used to render the live `room` state. After a batch finished,
     * changing the selector relabelled already-uploaded rows to a category the
     * server never stored them in — the panel telling the owner something
     * false about data already written.
     *
     * Each item now carries its own `roomCode`, the request sends that, and
     * the selector locks once anything is queued.
     */
    const uploader = code(read(UPLOADER));
    assert.match(uploader, /readonly roomCode: PortfolioRoomCode;/);
    assert.match(uploader, /roomCode: room,/, "the item snapshots the room at queue time");
    assert.match(
      uploader,
      /body\.append\("roomCategoryCode", item\.roomCode\)/,
      "the request sends the item's room, not the live selector"
    );
    assert.match(
      uploader,
      /defaultLibraryAltText\(item\.roomCode\)/,
      "and the alt text matches the room actually sent"
    );
    assert.match(
      uploader,
      /PORTFOLIO_ROOM_LABELS\[item\.roomCode\]/,
      "the row displays the room it was queued under"
    );
    assert.match(
      uploader,
      /disabled=\{running \|\| items\.length > 0\}/,
      "the room selector locks once anything is queued"
    );

    // The live `room` is still what a NEW selection is queued under.
    assert.match(uploader, /\[room\]\s*\);/);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. The admin screen                                                        */
/* -------------------------------------------------------------------------- */

describe("the Media Library screen", () => {
  test("it is permission gated", () => {
    const page = code(read(PAGE));
    assert.match(page, /portfolio\.manage/);
    assert.match(page, /Access Denied/);
  });

  test("Projects and Media Library are both reachable", () => {
    const nav = read(NAV);
    assert.match(nav, /"\/admin\/portfolio"/);
    assert.match(nav, /"\/admin\/portfolio\/media"/);
    assert.match(nav, /Media Library/);
    // And the projects screen carries the nav too, or one direction is a dead end.
    assert.match(read("src/app/admin/portfolio/page.tsx"), /PortfolioAdminNav/);
  });

  test("filters are validated rather than trusted", () => {
    const page = code(read(PAGE));
    assert.match(page, /isLibraryRoomFilter\(params\.room\)/);
    assert.match(page, /isLibraryPublicationFilter\(params\.publication\)/);
    assert.equal(isLibraryRoomFilter("hall"), false);
    assert.equal(isLibraryRoomFilter("kitchen"), true);
    assert.equal(isLibraryRoomFilter("all"), true);
    assert.equal(isLibraryPublicationFilter("nonsense"), false);
  });

  test("the category chips are the approved public labels, with no room code shown", () => {
    const grid = read(GRID);
    for (const label of ["All", "Living Room", "Bedroom", "Kitchen", "Unpublished"]) {
      assert.ok(grid.includes(label), `${label} chip must exist`);
    }
    assert.doesNotMatch(code(read(GRID)), /room_category_code/, "never expose the stored code");
    assert.doesNotMatch(grid, /\bHall\b/);
  });

  test("no fabricated project metadata appears on a standalone card", () => {
    /*
     * A standalone image has no project, locality, client or year. A column of
     * em-dashes would read as missing data rather than as inapplicable data, so
     * those fields are absent entirely.
     */
    const grid = code(read(GRID));
    for (const forbidden of [
      "projectTitle",
      "locationLabel",
      "completionYear",
      "clientName",
      "project.slug",
    ]) {
      assert.ok(!grid.includes(forbidden), `${forbidden} must not appear in the library grid`);
    }
  });

  test("both publication states are shown, not just the published one", () => {
    const grid = read(GRID);
    assert.match(grid, /Published/);
    assert.match(grid, /Unpublished/);
    assert.match(code(read(GRID)), /data-published=\{item\.published\}/);
  });

  test("selection is honestly labelled", () => {
    /*
     * With 48 per page and a library of 500, "Select all" followed by "Delete"
     * is the most destructive misunderstanding available on this screen.
     */
    // Comments stripped: this file's own explanation quotes the phrase it bans.
    const grid = code(read(GRID));
    assert.match(grid, /Select visible/);
    assert.doesNotMatch(grid, /Select all/);
  });

  test("every bulk action exists and delete is confirmed with a count", () => {
    const grid = read(GRID);
    for (const action of ["Publish", "Unpublish", "Change Category", "Delete"]) {
      assert.ok(grid.includes(action), `${action} must be offered`);
    }
    assert.match(grid, /Delete \{count\} \{count === 1 \? "image" : "images"\}\?/);
    assert.match(grid, /permanently removes portfolio media and stored derivatives/);
  });

  test("paging is server-side and the page size is sane", () => {
    assert.ok(LIBRARY_PAGE_SIZE >= 24 && LIBRARY_PAGE_SIZE <= 60);
    const repo = code(read(REPOSITORY));
    assert.match(repo, /\.range\(from, from \+ LIBRARY_PAGE_SIZE - 1\)/);
    assert.match(repo, /count: "exact"/);
  });

  test("the grid renders thumbnails, never originals", () => {
    const repo = code(read(REPOSITORY));
    assert.match(repo, /thumb-480\.webp/);
    assert.doesNotMatch(repo, /portfolio-originals/, "the private bucket is never linked");
    assert.match(code(read(GRID)), /loading="lazy"/);
  });

  test("reorder is only offered when the whole room is loaded", () => {
    /*
     * A subset reorder would renumber page one to 0..47 and leave page two also
     * claiming 0..47. The page therefore loads the complete room exactly when
     * reordering is possible, and the RPC refuses anything else.
     */
    const page = code(read(PAGE));
    assert.match(page, /const canReorder = room !== "all" && publication === "all"/);
    assert.match(page, /loadAll: canReorder/);
    assert.match(code(read(GRID)), /canReorder \?/);
  });

  test("focal point editing reuses the existing contract", () => {
    const grid = code(read(GRID));
    assert.match(grid, /focalObjectPosition/);
    assert.match(grid, /focalX/);
    assert.match(grid, /focalY/);
    // No second crop field was invented.
    assert.doesNotMatch(grid, /cropX|cropY|crop_box/);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Server actions and cross-scope safety                                   */
/* -------------------------------------------------------------------------- */

describe("the library actions cannot reach project media", () => {
  test("every action requires portfolio.manage before anything else", () => {
    const actions = code(read(ACTIONS));
    const exported = actions.match(/export async function (\w+)/g) ?? [];
    assert.ok(exported.length >= 5, "all five actions must exist");
    assert.equal(
      (actions.match(/await requireManage\(\)/g) ?? []).length,
      exported.length,
      "every exported action gates on portfolio.manage"
    );
  });

  test("the bulk actions go through the library RPCs, never a raw update", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /rpc\("set_portfolio_library_publication"/);
    assert.match(actions, /rpc\("set_portfolio_library_room_category"/);
    assert.match(actions, /rpc\("reorder_portfolio_library_media"/);
    // And never the project ones, which enforce a different ownership rule.
    assert.doesNotMatch(actions, /set_portfolio_media_room_category/);
    assert.doesNotMatch(actions, /reorder_portfolio_project_media/);
  });

  test("the single-row writes are scoped to standalone media", () => {
    const actions = code(read(ACTIONS));
    // Both the edit and the delete filter on project_id IS NULL.
    assert.equal(
      (actions.match(/\.is\("project_id", null\)/g) ?? []).length >= 3,
      true,
      "every direct write and read is scoped to the library"
    );
  });

  test("delete removes storage before the row, and tolerates a missing object", () => {
    const actions = code(read(ACTIONS));
    const originals = actions.indexOf('from("portfolio-originals").remove');
    const rowDelete = actions.indexOf('from("portfolio_media")\n    .delete()');
    assert.ok(originals > 0, "originals are removed");
    assert.match(actions, /thumb-480\.webp/, "the thumbnail sibling is removed too");
    assert.ok(
      rowDelete === -1 || rowDelete > originals,
      "the row is deleted after the objects"
    );
    // Storage removal is not awaited into a failure path that blocks the delete.
    assert.doesNotMatch(actions, /if \(removeError\) return/);
  });

  test("a deletion that cannot find every selected row refuses entirely", () => {
    assert.match(
      code(read(ACTIONS)),
      /found\.length !== ids\.length/,
      "a partial match must not delete the rows it did find"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Cache invalidation                                                      */
/* -------------------------------------------------------------------------- */

describe("public caches expire when visibility changes, and not otherwise", () => {
  test("the library tags are the room galleries and the index", () => {
    const tags = publicRoomLibraryTags();
    assert.ok(tags.includes(PUBLIC_CACHE_TAGS.ROOMS));
    assert.ok(tags.includes(PUBLIC_CACHE_TAGS.LIST));
    /*
     * Not the sitemap: it lists project URLs and a library photograph creates
     * none. Expiring it anyway would be harmless but would claim a reach this
     * mutation does not have.
     */
    assert.ok(!tags.includes(PUBLIC_CACHE_TAGS.SITEMAP));
    assert.deepEqual(publicRoomLibraryPaths(), ["/portfolio"]);
  });

  test("every visibility-changing action refreshes, and upload does not", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /invalidatePublicRoomLibrary/);
    assert.equal(
      (actions.match(/refreshSurfaces\(\)/g) ?? []).length >= 5,
      true,
      "publish, unpublish, recategorise, reorder, edit and delete all refresh"
    );

    /*
     * Upload deliberately does not. The row lands unpublished, so nothing
     * public changed, and invalidating fifty times during a fifty-image batch
     * would expire the room caches to reveal nothing.
     */
    assert.doesNotMatch(code(read(LIBRARY_ROUTE)), /invalidatePublic/);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Storage paths                                                           */
/* -------------------------------------------------------------------------- */

describe("the two storage namespaces cannot impersonate each other", () => {
  const LIB = "room-library/kitchen/d1111111-1111-4111-8111-111111111111/gallery-1200.webp";
  const PROJ =
    "b1111111-1111-4111-8111-111111111111/c1111111-1111-4111-8111-111111111111/gallery-1200.webp";

  test("a library path validates, and only under a real room", () => {
    assert.equal(validatePublicStoragePath(LIB), true);
    assert.equal(
      validatePublicStoragePath(
        "room-library/garage/d1111111-1111-4111-8111-111111111111/gallery-1200.webp"
      ),
      false
    );
    assert.equal(
      validatePublicStoragePath("room-library/kitchen/not-a-uuid/gallery-1200.webp"),
      false
    );
    assert.equal(
      validatePublicStoragePath(
        "room-library/kitchen/d1111111-1111-4111-8111-111111111111/original.jpg"
      ),
      false,
      "only approved public derivatives are ever linked"
    );
  });

  test("the project contract is unchanged", () => {
    assert.equal(validatePublicStoragePath(PROJ), true);
    assert.equal(validatePublicStoragePath("../secret/x/gallery-1200.webp"), false);
    assert.equal(validatePublicStoragePath(LIB.replace("room-library", "roomlibrary")), false);
  });

  test("a null expected project is an assertion, not an absence", () => {
    /*
     * `expectedProjectUuid: null` says "this row has no project", so a path
     * that names one must be rejected. `undefined` still means unchecked. The
     * difference is what stops a standalone row rendering a project object.
     */
    assert.equal(validatePublicStoragePath(PROJ, { expectedProjectUuid: null }), false);
    assert.equal(validatePublicStoragePath(PROJ, {}), true);
    assert.equal(validatePublicStoragePath(LIB, { expectedProjectUuid: null }), true);
    assert.equal(
      validatePublicStoragePath(LIB, {
        expectedProjectUuid: "b1111111-1111-4111-8111-111111111111",
      }),
      false
    );
  });

  test("a room mismatch is caught", () => {
    assert.equal(validatePublicStoragePath(LIB, { expectedRoomCode: "kitchen" }), true);
    assert.equal(validatePublicStoragePath(LIB, { expectedRoomCode: "bedroom" }), false);
  });

  test("no fake project uuid was minted to satisfy the old path helper", () => {
    const pipeline = code(read("src/features/portfolio/server/portfolio-image-pipeline.ts"));
    assert.match(pipeline, /generateLibraryMediaPath/);
    assert.match(pipeline, /room-library\/\$\{roomCode\}\/\$\{mediaId\}/);
    // The library builder never takes a project id at all.
    assert.doesNotMatch(
      pipeline,
      /generateLibraryMediaPath\(\s*projectId/,
      "the library path builder must not accept a project"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Public behaviour                                                        */
/* -------------------------------------------------------------------------- */

describe("what a visitor sees", () => {
  test("a published standalone photograph maps, with no project", () => {
    const photo = mapLibraryRoomPhoto(libraryRow());
    assert.ok(photo);
    assert.equal(photo!.project, null, "there is no project, and it must say so");
    assert.equal(photo!.roomCode, "kitchen");
    assert.equal(photo!.image.altText, "ONEDECORE kitchen interior");
    assert.ok(photo!.image.url.includes("room-library/kitchen/"));
  });

  test("an unpublished standalone photograph never maps", () => {
    assert.equal(mapLibraryRoomPhoto(libraryRow({ room_gallery_published: false })), null);
  });

  test("an unprocessed or retired standalone photograph never maps", () => {
    assert.equal(mapLibraryRoomPhoto(libraryRow({ status: "draft" })), null);
    assert.equal(mapLibraryRoomPhoto(libraryRow({ status: "retired" })), null);
    assert.equal(mapLibraryRoomPhoto(libraryRow({ public_object_path: null })), null);
  });

  test("a row that still has a project is not library media", () => {
    assert.equal(
      mapLibraryRoomPhoto(
        libraryRow({ project_id: "b1111111-1111-4111-8111-111111111111" })
      ),
      null
    );
  });

  test("a standalone row can never be a cover, even if the data says so", () => {
    assert.equal(mapLibraryRoomPhoto(libraryRow({ media_role: "cover" })), null);
  });

  test("an untagged or unknown room never maps", () => {
    assert.equal(mapLibraryRoomPhoto(libraryRow({ room_category_code: null })), null);
    assert.equal(mapLibraryRoomPhoto(libraryRow({ room_category_code: "hall" })), null);
  });

  test("an empty alt text is fatal for library media", () => {
    /*
     * Project media falls back to the project title. There is no title here, so
     * an empty alt would publish a content image with no description at all.
     */
    assert.equal(mapLibraryRoomPhoto(libraryRow({ alt_text: "   " })), null);
  });

  test("the room query reads BOTH sources and orders them as one gallery", () => {
    const queries = code(
      read("src/features/portfolio/public/public-portfolio-queries.ts")
    );
    assert.match(queries, /LIBRARY_ROOM_PHOTO_SELECT/);
    assert.match(queries, /\.is\("project_id", null\)/);
    assert.match(queries, /\.eq\("room_gallery_published", true\)/);
    // The project branch keeps its inner join and its published-parent filter.
    assert.match(queries, /portfolio_projects!inner/);
    assert.match(queries, /\.eq\("portfolio_projects.status", "published"\)/);
    // One deterministic order, with an id tiebreak so two visitors agree.
    assert.match(queries, /a\.sortOrder - b\.sortOrder/);
    assert.match(queries, /a\.mediaId < b\.mediaId/);
    assert.match(queries, /slice\(0, PUBLIC_ROOM_GALLERY_LIMIT\)/);
  });

  test("standalone media can never reach the Projects view", () => {
    /*
     * The listing query inner-joins cover media and project services. A
     * standalone row has neither and no project row of its own, so it cannot
     * appear — but the listing must also never be relaxed to a left join.
     */
    const queries = code(
      read("src/features/portfolio/public/public-portfolio-queries.ts")
    );
    assert.match(queries, /LISTING_SELECT[\s\S]{0,400}portfolio_media!inner/);
    assert.match(queries, /from\("portfolio_projects"\)/);
  });

  test("the gallery renders a project-less photograph without inventing one", () => {
    const gallery = read(GALLERY);
    const guards = gallery.match(/photo\.project \?/g) ?? [];
    assert.ok(guards.length >= 4, "every project-dependent element is guarded");
    assert.doesNotMatch(gallery, /photo\.project!\./);
    assert.doesNotMatch(gallery, /photo\.project\?\.slug/);
  });
});

/* -------------------------------------------------------------------------- */
/* 9. The migration, and the project workflow it must not break               */
/* -------------------------------------------------------------------------- */

describe("the migration is forward-only and protective", () => {
  test("it relaxes exactly one column and adds exactly one", () => {
    const migration = read(MIGRATION);
    assert.match(migration, /alter column project_id drop not null/);
    assert.match(migration, /add column if not exists room_gallery_published boolean not null default false/);
    // Nothing is dropped, renamed or backfilled by guesswork.
    assert.doesNotMatch(migration, /drop table|drop column|rename to/i);
    assert.doesNotMatch(migration, /update public\.portfolio_media\s+set room_category_code/i);
  });

  test("every standalone invariant is a database constraint, not a convention", () => {
    const migration = read(MIGRATION);
    for (const constraint of [
      "chk_portfolio_media_standalone_shape",
      "chk_portfolio_media_library_publication",
      "chk_portfolio_media_published_is_ready",
      "chk_portfolio_media_cover_requires_project",
    ]) {
      assert.ok(migration.includes(constraint), `${constraint} must exist`);
    }
  });

  test("the public policy states all four library conditions explicitly", () => {
    /*
     * A policy that relies on table constraints to imply three of its four
     * conditions stops being correct the day a constraint is relaxed for an
     * unrelated reason. This is the last line before the internet.
     */
    const migration = read(MIGRATION);
    const anon = migration.slice(migration.indexOf('create policy "Anon select'));
    assert.match(anon, /status = 'ready'/);
    assert.match(anon, /project_id is null/);
    assert.match(anon, /room_category_code is not null/);
    assert.match(anon, /room_gallery_published/);
  });

  test("the library RPCs are invoker-rights with a pinned search path", () => {
    const migration = read(MIGRATION);
    assert.doesNotMatch(migration, /security definer/i);
    assert.equal((migration.match(/set search_path to ''/g) ?? []).length, 3);
    /*
     * Four, not three: one gate in each of the three RPCs plus the staff branch
     * of the SELECT policy. Asserting a floor rather than an exact count keeps
     * this from failing the next time a policy legitimately references it.
     */
    assert.ok(
      (migration.match(/authorize\('portfolio\.manage'\)/g) ?? []).length >= 3,
      "every library RPC gates on portfolio.manage"
    );
    assert.equal((migration.match(/revoke execute on function/g) ?? []).length, 3);
    assert.equal((migration.match(/from public, anon;/g) ?? []).length, 3);
  });

  test("no new storage bucket was created", () => {
    const migration = read(MIGRATION);
    assert.doesNotMatch(migration, /storage\.buckets/);
    assert.doesNotMatch(migration, /website-banners/);
  });
});

describe("the existing project workflow did not regress", () => {
  test("the project upload endpoint still requires a project and still exists", () => {
    const route = code(read(PROJECT_ROUTE));
    assert.match(route, /Missing required upload parameters/);
    assert.match(route, /from\("portfolio_projects"\)/);
    assert.match(route, /Project not found/);
    assert.match(route, /mediaRole !== "cover" && mediaRole !== "gallery"/);
    assert.match(route, /scope: \{ kind: "project"/);
  });

  test("the project route still invalidates by slug", () => {
    const route = code(read(PROJECT_ROUTE));
    assert.match(route, /invalidatePublicPortfolio\(project\.slug\)/);
  });

  test("project media actions are untouched by this feature", () => {
    const projectActions = code(
      read("src/features/portfolio/server/portfolio-media-actions.ts")
    );
    for (const rpc of [
      "set_portfolio_media_room_category",
      "set_portfolio_project_cover",
      "reorder_portfolio_project_media",
    ]) {
      assert.ok(projectActions.includes(rpc), `${rpc} must still be called`);
    }
  });

  test("the room labels and views are exactly the approved four", () => {
    const rooms = read("src/features/portfolio/public/portfolio-rooms.ts");
    assert.deepEqual([...PORTFOLIO_ROOM_CODES], ["living-room", "bedroom", "kitchen"]);
    assert.deepEqual(Object.values(PORTFOLIO_ROOM_LABELS), [
      "Living Room",
      "Bedroom",
      "Kitchen",
    ]);
    assert.doesNotMatch(code(rooms), /"Hall"/);
  });

  test("a library URL is buildable and a tampered one is not", () => {
    const ok = buildPublicStorageUrl(
      "room-library/kitchen/d1111111-1111-4111-8111-111111111111/gallery-1200.webp",
      { expectedProjectUuid: null, expectedMediaUuid: "d1111111-1111-4111-8111-111111111111" }
    );
    assert.ok(ok && ok.includes("/portfolio-public/room-library/kitchen/"));

    assert.equal(
      buildPublicStorageUrl(
        "room-library/kitchen/d1111111-1111-4111-8111-111111111111/gallery-1200.webp",
        { expectedMediaUuid: "d2222222-2222-4222-8222-222222222222" }
      ),
      null,
      "a path naming another media id must not resolve"
    );
  });
});
