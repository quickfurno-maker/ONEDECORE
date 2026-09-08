/**
 * Room browsing is photo-level, and Hall is gone.
 *
 * THE CORRECTION THIS SUITE HOLDS
 *
 * Browsing by room used to be a PROJECT facet: clicking "Bedroom" returned
 * whole-home case studies that happened to contain a bedroom. A visitor who
 * picks Bedroom wants to look at bedrooms, and the only way to give each room
 * its own card under that shape was to split one delivered home into fake
 * room-level "projects".
 *
 * So rooms moved to the photographs. `Projects` remains whole-home case
 * studies; `Living Room`, `Bedroom` and `Kitchen` list real tagged images, each
 * still carrying the project it came from.
 *
 * AND THERE IS NO HALL. It read as "Hall / Living Room", which asked a visitor
 * to decide which word described their own room. Living Room is the single
 * public term — in the vocabulary, in the URLs, in the CMS selector and in both
 * database allowlists.
 *
 * The SQL half — constraints, the collision-safe Hall translation, the atomic
 * RPCs and authorization — is proven in
 * `56_portfolio_media_room_browse_test.sql`. This is the application half.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { computePortfolioReadiness, readinessSummaryLines } from "../../domain/portfolio-readiness.ts";
import {
  PORTFOLIO_ASPECT_RATIOS,
  PORTFOLIO_DEFAULT_VIEW,
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
  PORTFOLIO_ROOM_SELECT_OPTIONS,
  PORTFOLIO_VIEWS,
  PORTFOLIO_VIEW_CODES,
  focalObjectPosition,
  isPortfolioRoomCode,
  normaliseFocalValue,
  roomForView,
} from "../portfolio-rooms.ts";
import { PORTFOLIO_CATEGORIES } from "../portfolio-categories.ts";
import { roomGalleryCacheKeyParts } from "../public-cache-keys.ts";
import { mapRoomPhoto, type RoomPhotoFields } from "../public-portfolio-mapper.ts";
import { parseListingParams, parseViewParam } from "../public-request-validation.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const MIGRATION =
  "supabase/migrations/20260908160000_portfolio_media_room_browse.sql";
const PAGE = "src/app/portfolio/page.tsx";
const TABS = "src/features/portfolio/public/components/PortfolioViewTabs.tsx";
const GALLERY = "src/features/portfolio/public/components/PortfolioRoomGallery.tsx";
const DETAIL_GALLERY = "src/features/portfolio/public/components/PortfolioGallery.tsx";
const HOME_NAV = "src/features/public-site/discovery/DiscoveryPortfolioCategories.tsx";
const MANAGER = "src/features/portfolio/components/PortfolioMediaManager.tsx";
const MEDIA_ACTIONS = "src/features/portfolio/server/portfolio-media-actions.ts";
const UPLOAD = "src/app/api/admin/portfolio/media/route.ts";
const QUERIES = "src/features/portfolio/public/public-portfolio-queries.ts";
const PIPELINE = "src/features/portfolio/server/portfolio-image-pipeline.ts";

const P_UUID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const M_UUID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

function roomRow(over: Partial<RoomPhotoFields> = {}): RoomPhotoFields {
  return {
    id: M_UUID,
    project_id: P_UUID,
    media_role: "gallery",
    status: "ready",
    public_object_path: `${P_UUID}/${M_UUID}/gallery-1200.webp`,
    width_px: 1200,
    height_px: 900,
    alt_text: "A bedroom in walnut and linen",
    caption: null,
    sort_order: 3,
    created_at: "2026-09-01T10:00:00Z",
    room_category_code: "bedroom",
    focal_x: 30,
    focal_y: 70,
    portfolio_projects: {
      slug: "a-real-pune-home",
      title: "A Real Pune Home",
      status: "published",
      location_label: "Kharadi",
    },
    ...over,
  } as RoomPhotoFields;
}

/* ========================================================================== */
/* 1. The locked vocabulary                                                    */
/* ========================================================================== */

describe("Projects | Living Room | Bedroom | Kitchen", () => {
  test("the four views are exactly these, in this order", () => {
    assert.deepEqual(
      PORTFOLIO_VIEWS.map((v) => v.label),
      ["Projects", "Living Room", "Bedroom", "Kitchen"]
    );
    assert.deepEqual([...PORTFOLIO_VIEW_CODES], [
      "projects",
      "living-room",
      "bedroom",
      "kitchen",
    ]);
    assert.equal(PORTFOLIO_DEFAULT_VIEW, "projects");
  });

  test("HALL IS ABSENT from every public surface", () => {
    /*
     * Asserted against comment-stripped source: the word appears in several
     * explanations of why it was removed, and a test that trips on its own
     * documentation teaches people to delete the documentation.
     */
    for (const file of [TABS, GALLERY, DETAIL_GALLERY, HOME_NAV, PAGE, MANAGER]) {
      assert.doesNotMatch(code(read(file)), /\bhall\b/i, `${file} must not mention Hall`);
    }
    assert.equal(isPortfolioRoomCode("hall"), false);
    assert.equal(parseViewParam("hall"), "invalid");
    for (const label of Object.values(PORTFOLIO_ROOM_LABELS)) {
      assert.doesNotMatch(label, /hall/i);
    }
  });

  test("the project facet vocabulary lost Hall too", () => {
    const ids = PORTFOLIO_CATEGORIES.map((c) => c.id);
    assert.ok(!ids.includes("hall" as never));
    assert.ok(ids.includes("living-room"));
    assert.deepEqual(
      PORTFOLIO_CATEGORIES.map((c) => c.label),
      ["Complete Interiors", "Kitchen", "Living Room", "Bedroom"]
    );
  });

  test("the SQL allowlists agree with the code, and exclude Hall", () => {
    const sql = read(MIGRATION);

    const mediaCheck = /room_category_code in \(([^)]*)\)/.exec(sql);
    assert.ok(mediaCheck, "the media room allowlist must exist");
    const rooms = [...mediaCheck![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(rooms.sort(), [...PORTFOLIO_ROOM_CODES].sort());

    // Both project-level allowlists are rewritten without hall.
    assert.match(
      sql,
      /check \(category_code in \('complete-interiors', 'living-room', 'bedroom', 'kitchen'\)\)/
    );
    assert.match(sql, /where category_code = 'hall'/, "and hall rows are translated");
    assert.match(sql, /set category_code = 'living-room'/);
  });
});

/* ========================================================================== */
/* 2. The URL model                                                            */
/* ========================================================================== */

describe("?view= is canonical and ?category= is legacy", () => {
  test("no view means Projects, and Projects carries no parameter", () => {
    const parsed = parseListingParams({});
    assert.ok(parsed);
    assert.equal(parsed!.view, "projects");
    assert.equal(PORTFOLIO_VIEWS[0]!.href, "/portfolio");
  });

  test("each room view has its own canonical URL", () => {
    for (const room of PORTFOLIO_ROOM_CODES) {
      const parsed = parseListingParams({ view: room });
      assert.ok(parsed, room);
      assert.equal(parsed!.view, room);
      assert.equal(
        PORTFOLIO_VIEWS.find((v) => v.id === room)!.href,
        `/portfolio?view=${room}`
      );
    }
  });

  test("an invalid view refuses the request, so the route can 404", () => {
    for (const bogus of ["hall", "balcony", "PROJECTS", "__proto__"]) {
      assert.equal(parseListingParams({ view: bogus }), null, bogus);
    }
  });

  test("a legacy ?category= normalises onto the view it meant", () => {
    assert.equal(parseListingParams({ category: "kitchen" })!.view, "kitchen");
    assert.equal(parseListingParams({ category: "bedroom" })!.view, "bedroom");
    assert.equal(
      parseListingParams({ category: "living-room" })!.view,
      "living-room"
    );
    // The whole-home facet is what Projects is.
    assert.equal(
      parseListingParams({ category: "complete-interiors" })!.view,
      "projects"
    );
  });

  test("a CONFLICTING view and category is refused, not silently resolved", () => {
    /*
     * `?view=bedroom&category=kitchen` states two different intentions about
     * one listing. There is no defensible way to pick a winner, and picking one
     * by evaluation order is how a bug becomes permanent.
     */
    assert.equal(
      parseListingParams({ view: "bedroom", category: "kitchen" }),
      null
    );
    // Agreeing is fine.
    assert.equal(
      parseListingParams({ view: "kitchen", category: "kitchen" })!.view,
      "kitchen"
    );
  });

  test("the route redirects legacy links rather than serving two addresses", () => {
    const page = read(PAGE);
    assert.match(page, /import \{ notFound, permanentRedirect \}/);
    assert.match(page, /if \(raw\.category !== undefined\)/);
    // 308, so a crawler transfers the old URL's signals and stops asking.
    assert.match(page, /permanentRedirect\(/);
    // And the canonical link tag always names the ?view= form.
    assert.match(page, /alternates: \{ canonical \}/);
    assert.match(page, /function canonicalForView/);
  });

  test("the 404 contract from the previous phase is intact", () => {
    const page = read(PAGE);
    const meta = page.slice(
      page.indexOf("export async function generateMetadata"),
      page.indexOf("async function PortfolioProjectResults")
    );
    assert.doesNotMatch(meta, /notFound\(\)/);
    assert.match(meta, /robots: \{ index: false, follow: false \}/);

    const body = page.slice(page.indexOf("export default async function"));
    const notFoundAt = body.indexOf("notFound();");
    const suspenseAt = body.indexOf("<Suspense");
    assert.ok(notFoundAt > 0 && notFoundAt < suspenseAt);
  });
});

/* ========================================================================== */
/* 3. Room views list photographs                                              */
/* ========================================================================== */

describe("a room view returns media, not project cards", () => {
  test("the query reads portfolio_media and joins its published parent", () => {
    const q = read(QUERIES);
    assert.match(q, /export async function queryRoomGallery/);
    assert.match(q, /\.from\("portfolio_media"\)/);
    assert.match(q, /portfolio_projects!inner\(slug, title, status, location_label\)/);
    assert.match(q, /\.eq\("room_category_code", room\)/);
    assert.match(q, /\.eq\("status", "ready"\)/);
    assert.match(q, /\.eq\("portfolio_projects.status", "published"\)/);
    assert.match(q, /\.not\("public_object_path", "is", null\)/);
  });

  test("a tagged, processed photo of a published project maps", () => {
    const photo = mapRoomPhoto(roomRow());
    assert.ok(photo);
    assert.equal(photo!.roomCode, "bedroom");
    assert.equal(photo!.projectSlug, "a-real-pune-home");
    assert.equal(photo!.projectTitle, "A Real Pune Home");
    assert.equal(photo!.projectLocationLabel, "Kharadi");
    assert.equal(photo!.image.focalX, 30);
    assert.equal(photo!.image.focalY, 70);
  });

  test("an UNPUBLISHED parent excludes the photograph", () => {
    assert.equal(
      mapRoomPhoto(
        roomRow({
          portfolio_projects: {
            slug: "draft-home",
            title: "Draft Home",
            status: "draft",
            location_label: null,
          },
        })
      ),
      null
    );
  });

  test("an unprocessed photograph is excluded", () => {
    assert.equal(mapRoomPhoto(roomRow({ status: "draft" })), null);
    assert.equal(mapRoomPhoto(roomRow({ public_object_path: null })), null);
  });

  test("an UNTAGGED photograph never appears in a room view", () => {
    /*
     * NULL means "not for room browsing" — a cover, a material study, an
     * exterior. Showing it under Bedroom would be showing somebody a bedroom
     * nobody said was one.
     */
    assert.equal(mapRoomPhoto(roomRow({ room_category_code: null })), null);
    assert.equal(mapRoomPhoto(roomRow({ room_category_code: "hall" })), null);
  });

  test("every photograph keeps a route back to its project", () => {
    const gallery = read(GALLERY);
    assert.match(gallery, /\/portfolio\/\$\{photo\.projectSlug\}/);
    assert.match(gallery, /View Full Project/);
    assert.match(gallery, /photo\.projectTitle/);
  });

  test("the gallery is images, not project cards", () => {
    const gallery = code(read(GALLERY));
    assert.doesNotMatch(gallery, /PortfolioCard/);
    assert.doesNotMatch(gallery, /PortfolioGrid/);
    assert.match(gallery, /data-od-room-gallery/);
  });
});

/* ========================================================================== */
/* 4. Focal point and aspect ratios                                            */
/* ========================================================================== */

describe("one original, several crops", () => {
  test("the focal point becomes an object-position", () => {
    assert.equal(focalObjectPosition(30, 70), "30% 70%");
    assert.equal(focalObjectPosition(null, undefined), "50% 50%");
  });

  test("out-of-range and nonsense values clamp to something renderable", () => {
    assert.equal(normaliseFocalValue(-20), 0);
    assert.equal(normaliseFocalValue(140), 100);
    assert.equal(normaliseFocalValue("abc"), 50);
    assert.equal(normaliseFocalValue(33.6), 34);
  });

  test("the three display ratios are the locked ones", () => {
    assert.equal(PORTFOLIO_ASPECT_RATIOS.card, "4 / 5");
    assert.equal(PORTFOLIO_ASPECT_RATIOS.mobileFeature, "9 / 16");
    assert.equal(PORTFOLIO_ASPECT_RATIOS.hero, "16 / 9");
  });

  test("room tiles crop to 4:5 and honour the focal point", () => {
    const gallery = read(GALLERY);
    assert.match(gallery, /objectPosition: focalObjectPosition\(/);
    const css = read("src/features/public-site/theme/public-dark-theme.css");
    assert.match(css, /\.od-room-gallery__tile[\s\S]{0,400}aspect-ratio: 4 \/ 5/);
  });

  test("the lightbox shows the photograph uncropped", () => {
    const css = read("src/features/public-site/theme/public-dark-theme.css");
    assert.match(css, /\.od-lightbox__image[\s\S]{0,300}object-fit: contain/);
  });

  test("the server bounds the focal point as well as the database", () => {
    const actions = read(MEDIA_ACTIONS);
    assert.match(actions, /function parseFocal/);
    assert.match(actions, /FOCAL_MIN/);
    assert.match(actions, /FOCAL_MAX/);
    assert.match(read(MIGRATION), /focal_x between 0 and 100/);
  });
});

/* ========================================================================== */
/* 5. Cache                                                                    */
/* ========================================================================== */

describe("room galleries cache per room", () => {
  test("the room is part of the key", () => {
    const kitchen = roomGalleryCacheKeyParts("kitchen").join("|");
    const bedroom = roomGalleryCacheKeyParts("bedroom").join("|");
    assert.notEqual(kitchen, bedroom);
    assert.ok(roomGalleryCacheKeyParts("kitchen").includes("room:kitchen"));
  });

  test("a portfolio mutation expires the room galleries too", () => {
    const keys = read("src/features/portfolio/public/public-cache-keys.ts");
    assert.match(keys, /PUBLIC_CACHE_TAGS\.ROOMS/);
    const cache = read("src/features/portfolio/public/public-portfolio-cache.ts");
    assert.match(cache, /roomGalleryCacheKeyParts\(room\)/);
    assert.match(cache, /tags: \[PUBLIC_CACHE_TAGS\.ROOMS\]/);
  });

  test("nothing lists storage objects from the browser", () => {
    for (const file of [GALLERY, MANAGER]) {
      assert.doesNotMatch(code(read(file)), /storage\.from\(/);
      assert.doesNotMatch(code(read(file)), /\.list\(/);
    }
  });
});

/* ========================================================================== */
/* 6. Project detail filters                                                   */
/* ========================================================================== */

describe("the project gallery filters by room", () => {
  test("All plus only the rooms this project actually has", () => {
    const detail = read(DETAIL_GALLERY);
    assert.match(detail, /const availableRooms/);
    assert.match(
      detail,
      /PORTFOLIO_ROOM_CODES\.filter\(\(room\) =>\s*allImages\.some\(\(img\) => img\.roomCode === room\)/
    );
    assert.match(detail, />\s*All\s*</);
    // A single option is not a choice.
    assert.match(detail, /availableRooms\.length > 1/);
  });

  test("the default is All", () => {
    const detail = read(DETAIL_GALLERY);
    assert.match(detail, /useState<GalleryFilter>\("all"\)/);
  });
});

/* ========================================================================== */
/* 7. Homepage navigation                                                      */
/* ========================================================================== */

describe("the homepage offers the same four views", () => {
  test("it reads the shared vocabulary, not its own list", () => {
    const nav = read(HOME_NAV);
    assert.match(nav, /PORTFOLIO_VIEWS/);
    assert.match(nav, /href=\{view\.href\}/);
    assert.doesNotMatch(code(nav), /PORTFOLIO_CATEGORIES/);
  });

  test("the tiles link to the canonical URLs", () => {
    assert.deepEqual(
      PORTFOLIO_VIEWS.map((v) => v.href),
      [
        "/portfolio",
        "/portfolio?view=living-room",
        "/portfolio?view=bedroom",
        "/portfolio?view=kitchen",
      ]
    );
  });

  test("the artwork is decorative, because it is not a delivered project", () => {
    /*
     * These tiles carry ONEDECORE marketing artwork. Captioning one as the room
     * would state that the pictured room was delivered — the exact claim the
     * asset register forbids. The visible label does the describing.
     */
    const nav = read(HOME_NAV);
    assert.match(nav, /alt=""/);
    assert.doesNotMatch(nav, /alt=\{asset\.alt\}/);
  });
});

/* ========================================================================== */
/* 8. Admin: upload, tagging, cover, order, focus                              */
/* ========================================================================== */

describe("the CMS uploads many photographs and tags them honestly", () => {
  test("the file picker is multiple and the dropzone accepts a drop", () => {
    const manager = read(MANAGER);
    assert.match(manager, /multiple/);
    assert.match(manager, /type="file"/);
    assert.match(manager, /onDrop=\{/);
    assert.match(manager, /data-od-dropzone/);
  });

  test("per-file state is tracked, and a retry skips what succeeded", () => {
    const manager = read(MANAGER);
    assert.match(manager, /type QueueState = "queued" \| "uploading" \| "done" \| "error"/);
    assert.match(
      manager,
      /entry\.state === "queued" \|\| entry\.state === "error"/,
      "a retry must not re-send files that already uploaded"
    );
    assert.match(manager, /data-od-queue-state/);
  });

  test("the room selector offers Unclassified and the three rooms, and no Hall", () => {
    assert.deepEqual(
      PORTFOLIO_ROOM_SELECT_OPTIONS.map((o) => o.label),
      ["Unclassified", "Living Room", "Bedroom", "Kitchen"]
    );
    // Unclassified writes NULL, never a placeholder string.
    assert.equal(PORTFOLIO_ROOM_SELECT_OPTIONS[0]!.value, "");
    const manager = read(MANAGER);
    assert.match(manager, /PORTFOLIO_ROOM_SELECT_OPTIONS/);
  });

  test("bulk tagging sends one atomic call, and unclassified is null", () => {
    const actions = read(MEDIA_ACTIONS);
    assert.match(actions, /set_portfolio_media_room_category/);
    assert.match(
      actions,
      /if \(roomCode !== null && !isPortfolioRoomCode\(roomCode\)\)/,
      "an unknown room is refused server-side, not filtered out"
    );
    assert.match(actions, /error: "Unknown room category\."/);
    // The empty selector value is the one that becomes NULL, in the UI.
    assert.match(read(MANAGER), /room === "" \? null : room/);
  });

  test("cover promotion and reordering are atomic RPCs", () => {
    const actions = read(MEDIA_ACTIONS);
    assert.match(actions, /set_portfolio_project_cover/);
    assert.match(actions, /reorder_portfolio_project_media/);
    const manager = read(MANAGER);
    assert.match(manager, /Set as Project Cover/);
    assert.match(manager, /draggable/);
  });

  test("only a processed photograph can become the cover", () => {
    const manager = read(MANAGER);
    assert.match(manager, /disabled=\{isPending \|\| item\.status !== "ready"\}/);
    assert.match(read(MIGRATION), /Only processed media can become the cover/);
  });

  test("the focal editor previews the three real shapes", () => {
    const manager = read(MANAGER);
    assert.match(manager, /Project card 4:5/);
    assert.match(manager, /Mobile 9:16/);
    assert.match(manager, /Hero 16:9/);
    assert.match(manager, /data-od-focus-editor/);
    assert.match(manager, /PORTFOLIO_ASPECT_RATIOS\.card/);
  });

  test("alt text is required and never invented", () => {
    const actions = read(MEDIA_ACTIONS);
    assert.match(actions, /Alt text must be between 3 and 200 characters/);
    // No fallback that would manufacture a description.
    assert.doesNotMatch(code(actions), /altText \|\| /);
    assert.doesNotMatch(code(actions), /generateAlt|autoAlt/i);
  });
});

/* ========================================================================== */
/* 9. Formats, duplicates, privacy                                             */
/* ========================================================================== */

describe("the upload pipeline is unchanged where it matters", () => {
  test("only the formats the server can actually decode are offered", () => {
    const pipeline = read(PIPELINE);
    assert.match(pipeline, /value === "jpeg" \|\| value === "png" \|\| value === "webp"/);
    const manager = read(MANAGER);
    assert.match(manager, /image\/jpeg,image\/png,image\/webp/);
  });

  test("HEIC is refused plainly rather than pretended", () => {
    /*
     * An iPhone photo shared straight from Photos is very often HEIC, and
     * `sharp` in this deployment does not decode it. Saying so up front beats
     * an opaque failure after a 20 MiB upload.
     */
    const manager = read(MANAGER);
    assert.match(manager, /HEIC/);
    assert.doesNotMatch(read(MANAGER), /image\/hei[cf]/);
    assert.doesNotMatch(read(PIPELINE), /heic|heif/i);
  });

  test("the same file twice in one project is refused", () => {
    const upload = read(UPLOAD);
    assert.match(upload, /checksum_sha256/);
    assert.match(upload, /DUPLICATE_IMAGE/);
    assert.match(upload, /status: 409/);
    // Scoped to the project, not a global ban.
    assert.match(upload, /parent\?\.project_id === projectId/);
  });

  test("sanitisation and metadata stripping still run before storage", () => {
    const upload = read(UPLOAD);
    assert.match(upload, /createSanitisedMaster/);
    assert.match(upload, /validateImageMetadata/);
    assert.match(upload, /portfolio-originals/);
    assert.match(upload, /portfolio_media_sources/);
    // The sanitiser rotates and re-encodes, which is what drops EXIF and GPS.
    assert.match(read(PIPELINE), /\.rotate\(\)/);
  });

  test("a room and focal point may travel with the upload, validated", () => {
    const upload = read(UPLOAD);
    assert.match(upload, /isPortfolioRoomCode\(rawRoom\)/);
    assert.match(upload, /Unknown room category/);
    assert.match(upload, /normaliseFocalValue/);
  });
});

/* ========================================================================== */
/* 10. Readiness                                                               */
/* ========================================================================== */

describe("readiness blocks on what breaks the page, not on missing rooms", () => {
  const cover = {
    id: "1",
    media_role: "cover",
    status: "ready",
    alt_text: "A cover photograph",
    public_object_path: "p/m/cover-1600.webp",
    room_category_code: null,
  };
  const kitchen = {
    id: "2",
    media_role: "gallery",
    status: "ready",
    alt_text: "A kitchen photograph",
    public_object_path: "p/m2/gallery-1200.webp",
    room_category_code: "kitchen",
  };

  test("a KITCHEN-ONLY project is publishable", () => {
    /*
     * The counters are information, not requirements. Demanding all three rooms
     * would invite the owner to tag a photograph as a bedroom to turn a tick
     * green — the exact guesswork the taxonomy exists to prevent.
     */
    const readiness = computePortfolioReadiness([cover, kitchen]);
    assert.equal(readiness.isReadyToPublish, true);
    assert.deepEqual(readiness.blockers, []);
    assert.equal(readiness.roomCounts.bedroom, 0);
    assert.equal(readiness.roomCounts["living-room"], 0);
    assert.equal(readiness.roomCounts.kitchen, 1);
  });

  test("no cover blocks publishing", () => {
    const readiness = computePortfolioReadiness([kitchen]);
    assert.equal(readiness.isReadyToPublish, false);
    assert.ok(readiness.blockers.some((b) => /cover/i.test(b)));
  });

  test("an unprocessed photograph blocks publishing", () => {
    const readiness = computePortfolioReadiness([
      cover,
      { ...kitchen, status: "draft" },
    ]);
    assert.equal(readiness.isReadyToPublish, false);
    assert.ok(readiness.blockers.some((b) => /processing/i.test(b)));
  });

  test("missing alt text blocks publishing", () => {
    const readiness = computePortfolioReadiness([
      cover,
      { ...kitchen, alt_text: "" },
    ]);
    assert.equal(readiness.isReadyToPublish, false);
    assert.ok(readiness.blockers.some((b) => /alt text/i.test(b)));
  });

  test("the summary counts unclassified photographs separately", () => {
    const readiness = computePortfolioReadiness([cover, kitchen]);
    assert.equal(readiness.unclassifiedCount, 1);
    const lines = readinessSummaryLines(readiness);
    assert.deepEqual(lines, [
      "Cover ✓",
      "Living Room 0",
      "Bedroom 0",
      "Kitchen 1",
      "Unclassified 1",
      "Alt text 2/2",
      "Ready to publish",
    ]);
  });

  test("an empty project is not ready, and says why", () => {
    const readiness = computePortfolioReadiness([]);
    assert.equal(readiness.isReadyToPublish, false);
    assert.ok(readiness.blockers.length >= 1);
  });
});

/* ========================================================================== */
/* 11. One vocabulary, no drift                                                */
/* ========================================================================== */

describe("the rooms are declared once", () => {
  test("roomForView is the only mapping from a view to a room", () => {
    assert.equal(roomForView("projects"), null);
    for (const room of PORTFOLIO_ROOM_CODES) {
      assert.equal(roomForView(room), room);
    }
  });

  test("the room labels are the public wording", () => {
    assert.deepEqual(PORTFOLIO_ROOM_LABELS, {
      "living-room": "Living Room",
      bedroom: "Bedroom",
      kitchen: "Kitchen",
    });
  });

  test("no surface restates the room list", () => {
    for (const file of [GALLERY, TABS, MANAGER, HOME_NAV]) {
      const src = code(read(file));
      assert.doesNotMatch(
        src,
        /"living-room"\s*,\s*"bedroom"\s*,\s*"kitchen"/,
        `${file} must read the shared vocabulary, not restate it`
      );
    }
  });
});
