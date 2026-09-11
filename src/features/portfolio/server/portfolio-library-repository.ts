import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildPublicStorageUrl } from "../public/public-url";
import {
  FOCAL_DEFAULT,
  isPortfolioRoomCode,
  normaliseFocalValue,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms";
import {
  LIBRARY_PAGE_SIZE,
  type LibraryPublicationFilter,
  type LibraryRoomFilter,
} from "../domain/portfolio-library";

/**
 * The admin read for the Media Library.
 *
 * FILTERING AND PAGING HAPPEN IN THE DATABASE
 *
 * The grid is designed for hundreds of images. Fetching them all and slicing in
 * the browser would work at twenty and quietly become a several-megabyte
 * response at five hundred, so the room filter, the publication filter and the
 * window are all expressed as query terms and the total comes back as a count
 * rather than as a length.
 *
 * THUMBNAILS, NOT ORIGINALS
 *
 * Every row resolves to the 480px derivative. The originals bucket is private
 * and the primary derivative is 1200px — rendering forty-eight of either in a
 * grid would download tens of megabytes to draw postage stamps.
 */

export interface LibraryMediaItem {
  readonly id: string;
  readonly roomCode: PortfolioRoomCode;
  readonly thumbUrl: string | null;
  readonly fullUrl: string | null;
  readonly altText: string;
  readonly caption: string | null;
  readonly published: boolean;
  readonly status: string;
  readonly focalX: number;
  readonly focalY: number;
  readonly sortOrder: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly createdAt: string;
}

export interface LibraryMediaPage {
  readonly items: readonly LibraryMediaItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly counts: Readonly<Record<PortfolioRoomCode | "all" | "unpublished", number>>;
}

const LIBRARY_SELECT =
  "id, room_category_code, public_object_path, alt_text, caption, room_gallery_published, status, focal_x, focal_y, sort_order, width_px, height_px, created_at";

type LibraryRow = {
  id: string;
  room_category_code: string | null;
  public_object_path: string | null;
  alt_text: string;
  caption: string | null;
  room_gallery_published: boolean;
  status: string;
  focal_x: number;
  focal_y: number;
  sort_order: number;
  width_px: number | null;
  height_px: number | null;
  created_at: string;
};

/**
 * The 480px sibling of a stored primary derivative.
 *
 * Derived rather than stored because the pipeline is the only writer of these
 * paths and always writes both next to each other. `buildPublicStorageUrl`
 * still validates the result against the derivative allowlist, so a malformed
 * stored path yields null instead of a broken `<img>`.
 */
function thumbPathFor(publicObjectPath: string): string {
  return publicObjectPath.replace(/[^/]+$/, "thumb-480.webp");
}

function mapRow(row: LibraryRow): LibraryMediaItem | null {
  if (!isPortfolioRoomCode(row.room_category_code)) return null;

  const fullUrl = row.public_object_path
    ? buildPublicStorageUrl(row.public_object_path, {
        expectedProjectUuid: null,
        expectedMediaUuid: row.id,
        expectedRoomCode: row.room_category_code,
      })
    : null;

  const thumbUrl = row.public_object_path
    ? buildPublicStorageUrl(thumbPathFor(row.public_object_path), {
        expectedProjectUuid: null,
        expectedMediaUuid: row.id,
        expectedRoomCode: row.room_category_code,
      })
    : null;

  return {
    id: row.id,
    roomCode: row.room_category_code,
    thumbUrl,
    fullUrl,
    altText: row.alt_text,
    caption: row.caption,
    published: row.room_gallery_published === true,
    status: row.status,
    focalX: normaliseFocalValue(row.focal_x ?? FOCAL_DEFAULT),
    focalY: normaliseFocalValue(row.focal_y ?? FOCAL_DEFAULT),
    sortOrder: row.sort_order ?? 0,
    width: row.width_px,
    height: row.height_px,
    createdAt: row.created_at,
  };
}

export async function fetchLibraryMedia(options: {
  readonly room: LibraryRoomFilter;
  readonly publication: LibraryPublicationFilter;
  readonly page: number;
  /**
   * Reordering needs the complete room in one response — see the RPC's
   * complete-set contract. Only ever set when a single room is selected.
   */
  readonly loadAll?: boolean;
}): Promise<LibraryMediaPage> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(options.page) || 1);

  let query = supabase
    .from("portfolio_media")
    .select(LIBRARY_SELECT, { count: "exact" })
    .is("project_id", null)
    .neq("status", "retired");

  if (options.room !== "all") query = query.eq("room_category_code", options.room);
  if (options.publication === "published") query = query.eq("room_gallery_published", true);
  if (options.publication === "unpublished") query = query.eq("room_gallery_published", false);

  query = query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (!options.loadAll) {
    const from = (page - 1) * LIBRARY_PAGE_SIZE;
    query = query.range(from, from + LIBRARY_PAGE_SIZE - 1);
  }

  const { data, count, error } = await query;

  const items: LibraryMediaItem[] = [];
  if (!error && data) {
    for (const row of data as unknown as LibraryRow[]) {
      const item = mapRow(row);
      if (item) items.push(item);
    }
  }

  const total = count ?? items.length;

  return {
    items,
    total,
    page,
    pageSize: options.loadAll ? total : LIBRARY_PAGE_SIZE,
    hasNextPage: !options.loadAll && page * LIBRARY_PAGE_SIZE < total,
    counts: await fetchLibraryCounts(supabase),
  };
}

/**
 * Filter-chip counts.
 *
 * One grouped read rather than four `count` queries: the numbers are decoration
 * on a screen that has already done its real query, and four extra round trips
 * for them would be the most expensive thing on the page.
 */
async function fetchLibraryCounts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<LibraryMediaPage["counts"]> {
  const empty = {
    all: 0,
    "living-room": 0,
    bedroom: 0,
    kitchen: 0,
    unpublished: 0,
  } as Record<PortfolioRoomCode | "all" | "unpublished", number>;

  const { data, error } = await supabase
    .from("portfolio_media")
    .select("room_category_code, room_gallery_published")
    .is("project_id", null)
    .neq("status", "retired");

  if (error || !data) return empty;

  for (const row of data as unknown as {
    room_category_code: string | null;
    room_gallery_published: boolean;
  }[]) {
    empty.all += 1;
    if (!row.room_gallery_published) empty.unpublished += 1;
    if (isPortfolioRoomCode(row.room_category_code)) empty[row.room_category_code] += 1;
  }

  return empty;
}
