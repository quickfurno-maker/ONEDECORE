import {
  PORTFOLIO_ROOM_CODES,
  PORTFOLIO_ROOM_LABELS,
  isPortfolioRoomCode,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms.ts";

/**
 * Is this project ready to be published?
 *
 * WHAT READINESS IS, AND WHAT IT IS NOT
 *
 * It is: a usable cover, every photograph processed, and alt text on all of
 * them. Those are the things whose absence produces a broken or inaccessible
 * public page.
 *
 * It is NOT a demand for all three rooms. A kitchen-only project is a real
 * project, and a checklist that insisted on a bedroom would be inviting the
 * owner to tag a photograph as a bedroom to make a green tick appear — which is
 * precisely the guesswork the room taxonomy exists to prevent.
 *
 * The room counts are therefore INFORMATION, not requirements. They tell the
 * owner what the public will find under each tab; they never block publishing.
 *
 * Pure and free of `server-only` so the counters can be asserted directly.
 */

export interface ReadinessMediaInput {
  readonly id: string;
  readonly media_role: string;
  readonly status: string;
  readonly alt_text: string | null;
  readonly public_object_path: string | null;
  readonly room_category_code: string | null;
}

export interface PortfolioReadiness {
  readonly hasUsableCover: boolean;
  readonly totalMedia: number;
  readonly processedMedia: number;
  readonly unprocessedMedia: number;
  readonly mediaWithAltText: number;
  readonly roomCounts: Readonly<Record<PortfolioRoomCode, number>>;
  readonly unclassifiedCount: number;
  readonly isReadyToPublish: boolean;
  /** Human-readable reasons publishing is blocked. Empty when ready. */
  readonly blockers: readonly string[];
}

function hasAltText(row: ReadinessMediaInput): boolean {
  return (row.alt_text?.trim().length ?? 0) >= 3;
}

export function computePortfolioReadiness(
  media: readonly ReadinessMediaInput[]
): PortfolioReadiness {
  const roomCounts: Record<PortfolioRoomCode, number> = {
    "living-room": 0,
    bedroom: 0,
    kitchen: 0,
  };
  let unclassifiedCount = 0;
  let processedMedia = 0;
  let mediaWithAltText = 0;

  for (const row of media) {
    if (isPortfolioRoomCode(row.room_category_code)) {
      roomCounts[row.room_category_code] += 1;
    } else {
      unclassifiedCount += 1;
    }
    if (row.status === "ready") processedMedia += 1;
    if (hasAltText(row)) mediaWithAltText += 1;
  }

  /*
   * A cover counts only when it could actually be shown: processed, and with a
   * public object behind it. A cover row that never finished uploading looks
   * like a cover in the grid and renders as a hole on the site.
   */
  const hasUsableCover = media.some(
    (row) =>
      row.media_role === "cover" &&
      row.status === "ready" &&
      Boolean(row.public_object_path) &&
      hasAltText(row)
  );

  const totalMedia = media.length;
  const unprocessedMedia = totalMedia - processedMedia;

  const blockers: string[] = [];
  if (totalMedia === 0) {
    blockers.push("Add at least one photograph.");
  }
  if (!hasUsableCover) {
    blockers.push("Set a processed cover photograph with alt text.");
  }
  if (unprocessedMedia > 0) {
    blockers.push(
      `${unprocessedMedia} photograph${unprocessedMedia === 1 ? " is" : "s are"} still processing or failed.`
    );
  }
  const missingAlt = totalMedia - mediaWithAltText;
  if (missingAlt > 0) {
    blockers.push(
      `${missingAlt} photograph${missingAlt === 1 ? "" : "s"} still need alt text.`
    );
  }

  return {
    hasUsableCover,
    totalMedia,
    processedMedia,
    unprocessedMedia,
    mediaWithAltText,
    roomCounts,
    unclassifiedCount,
    isReadyToPublish: blockers.length === 0,
    blockers,
  };
}

/** The compact status line, in the order the owner reads it. */
export function readinessSummaryLines(
  readiness: PortfolioReadiness
): readonly string[] {
  return [
    `Cover ${readiness.hasUsableCover ? "✓" : "—"}`,
    ...PORTFOLIO_ROOM_CODES.map(
      (room) => `${PORTFOLIO_ROOM_LABELS[room]} ${readiness.roomCounts[room]}`
    ),
    `Unclassified ${readiness.unclassifiedCount}`,
    `Alt text ${readiness.mediaWithAltText}/${readiness.totalMedia}`,
    readiness.isReadyToPublish ? "Ready to publish" : "Not ready",
  ];
}
