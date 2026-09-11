import {
  PORTFOLIO_ROOM_LABELS,
  isPortfolioRoomCode,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms.ts";

/**
 * Standalone room-library rules that both the server and the browser need.
 *
 * Pure: no Supabase, no React, no `server-only`. The upload route, the admin
 * uploader and the tests all read the same definitions rather than three
 * copies that agree until one of them is edited.
 */

/**
 * DEFAULT ALT TEXT, AND WHY IT IS NOT THE FILENAME.
 *
 * `portfolio_media.alt_text` is NOT NULL with a 5-180 character check, so every
 * upload must carry something. Making the owner type twenty descriptions before
 * twenty files can start uploading would mean they never use the bulk path, and
 * the realistic outcome of that is not better alt text — it is `IMG_4921.JPG`
 * pasted twenty times, which is worse than useless to a screen reader and is
 * published to the public site.
 *
 * So the default is truthful, generic and derived from the room the owner
 * already chose: it describes what the picture is, claims nothing that could be
 * false, and reads acceptably aloud. Every item can then be given a specific
 * description afterwards, one at a time, by somebody looking at it.
 *
 * A filename is never used. It leaks camera and workflow details onto a public
 * page and describes nothing.
 */
export function defaultLibraryAltText(room: PortfolioRoomCode): string {
  return `ONEDECORE ${PORTFOLIO_ROOM_LABELS[room].toLowerCase()} interior`;
}

/** The alt text stored for a library upload: the owner's, or the room default. */
export function resolveLibraryAltText(
  room: PortfolioRoomCode,
  supplied: string | null | undefined
): string {
  const trimmed = (supplied ?? "").trim();
  return trimmed.length > 0 ? trimmed : defaultLibraryAltText(room);
}

/** Matches `chk_portfolio_media_alt_text`, so the UI refuses what the DB would. */
export const ALT_TEXT_MIN = 5;
export const ALT_TEXT_MAX = 180;

export function isValidAltText(value: string): boolean {
  const length = value.trim().length;
  return length >= ALT_TEXT_MIN && length <= ALT_TEXT_MAX;
}

/**
 * How many uploads run at once.
 *
 * Not one: fifty sequential round trips over a domestic connection is minutes
 * of watching a progress bar. Not fifty: each one holds a full-resolution
 * buffer plus two sharp pipelines in server memory, and the point of separate
 * requests is that memory stays bounded. Three is enough to saturate a normal
 * uplink while keeping at most three images in flight.
 */
export const LIBRARY_UPLOAD_CONCURRENCY = 3;

/** Admin grid page size. Large enough to bulk-manage, small enough to render. */
export const LIBRARY_PAGE_SIZE = 48;

export type LibraryPublicationFilter = "all" | "published" | "unpublished";

export function isLibraryPublicationFilter(
  value: unknown
): value is LibraryPublicationFilter {
  return value === "all" || value === "published" || value === "unpublished";
}

export type LibraryRoomFilter = "all" | PortfolioRoomCode;

export function isLibraryRoomFilter(value: unknown): value is LibraryRoomFilter {
  return value === "all" || isPortfolioRoomCode(value);
}

/* ========================================================================== */
/* The shapes the admin screen renders                                        */
/* ========================================================================== */

/**
 * DEFINED HERE, NOT IN THE REPOSITORY THAT PRODUCES THEM.
 *
 * `portfolio-library-repository` opens with `import "server-only"`. Importing
 * its types from a client component works today — `import type` erases — but it
 * points the client module graph at a server-only file, and the day someone
 * changes that import to a value import the failure is a build error at best
 * and a confusing runtime one at worst.
 *
 * So the DTOs live in this pure module. The repository imports them to describe
 * what it returns, and the browser imports them to describe what it receives.
 * Neither side reaches across the boundary for a type.
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
