"use server";

import { revalidatePath } from "next/cache";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { invalidatePublicPortfolio } from "../public/public-portfolio-invalidation";
import {
  FOCAL_MAX,
  FOCAL_MIN,
  isPortfolioRoomCode,
  type PortfolioRoomCode,
} from "../public/portfolio-rooms";

/**
 * Media management for the portfolio CMS: room tagging, cover, order, focus,
 * and the alt text a photograph needs before it may be published.
 *
 * EVERY MUTATION GOES THROUGH AN RPC THAT RE-CHECKS AUTHORISATION
 *
 * These actions validate their input and then call a `SECURITY INVOKER`
 * function that validates it again against `portfolio.manage` and against the
 * project the media belongs to. The duplication is deliberate: a server action
 * is reachable by anyone who can reach the app, and the database is the only
 * place that can be sure who is asking.
 *
 * WHY THE SET OPERATIONS ARE ATOMIC
 *
 * Tagging fourteen photographs as "Bedroom" from the browser as fourteen
 * separate updates leaves a half-tagged grid whenever one fails, and the editor
 * has no way to tell which. Each of these sends the whole intention once.
 */

export interface MediaActionResult {
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
}

async function requireManage() {
  const claims = await getClaims();
  if (
    !claims ||
    !claims.isActive ||
    !claims.permissions.includes("portfolio.manage")
  ) {
    throw new Error("Unauthorized");
  }
  return claims;
}

/** Refresh the admin editor and every public surface the change can reach. */
async function refreshSurfaces(projectId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", projectId)
    .maybeSingle();

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${projectId}`);

  if (!data?.slug) return undefined;
  const invalidation = invalidatePublicPortfolio(data.slug);
  return invalidation.ok ? undefined : invalidation.warning;
}

/* ========================================================================== */
/* Room tagging                                                                */
/* ========================================================================== */

/**
 * Tag a selection of one project's photographs with a room, or clear it.
 *
 * `null` means unclassified and is a real answer: a cover, a material detail or
 * an exterior belongs to no room, and forcing one on it would put the
 * photograph in front of somebody who asked for bedrooms.
 *
 * An unrecognised room is REFUSED rather than dropped. Dropping it would report
 * success for a state the editor did not choose.
 */
export async function setMediaRoomCategoryAction(
  projectId: string,
  mediaIds: string[],
  roomCode: string | null
): Promise<MediaActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (roomCode !== null && !isPortfolioRoomCode(roomCode)) {
    return { success: false, error: "Unknown room category." };
  }
  if (mediaIds.length === 0) {
    return { success: false, error: "Select at least one photograph." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_portfolio_media_room_category", {
    requested_project_id: projectId,
    requested_media_ids: mediaIds,
    requested_room_code: roomCode as PortfolioRoomCode | null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const warning = await refreshSurfaces(projectId);
  return {
    success: true,
    message:
      warning ??
      `${mediaIds.length} photograph${mediaIds.length === 1 ? "" : "s"} updated.`,
  };
}

/* ========================================================================== */
/* Cover                                                                       */
/* ========================================================================== */

/**
 * Promote one processed photograph to project cover.
 *
 * The previous cover is demoted in the same transaction, which is what keeps
 * the single-cover unique index satisfied at every point a concurrent reader
 * could look. A published project refuses this and says so — its ready cover is
 * guarded, and returning the project to draft first is the intended path.
 */
export async function setProjectCoverAction(
  projectId: string,
  mediaId: string
): Promise<MediaActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_portfolio_project_cover", {
    requested_project_id: projectId,
    requested_media_id: mediaId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const warning = await refreshSurfaces(projectId);
  return { success: true, message: warning ?? "Cover updated." };
}

/* ========================================================================== */
/* Ordering                                                                    */
/* ========================================================================== */

/**
 * Rewrite the whole order from a drag-and-drop result.
 *
 * The complete list is sent, not a swap: a partial list would leave the omitted
 * rows holding stale positions that collide with the new ones. The RPC refuses
 * an incomplete array for exactly that reason, and refuses ids from another
 * project, so a reorder can never reach across projects.
 */
export async function reorderProjectMediaAction(
  projectId: string,
  orderedMediaIds: string[]
): Promise<MediaActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (orderedMediaIds.length === 0) {
    return { success: true, message: "Nothing to reorder." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_portfolio_project_media", {
    requested_project_id: projectId,
    requested_media_ids: orderedMediaIds,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const warning = await refreshSurfaces(projectId);
  return { success: true, message: warning ?? "Order saved." };
}

/* ========================================================================== */
/* Focal point, alt text and caption                                           */
/* ========================================================================== */

function parseFocal(value: unknown, field: string): number | { error: string } {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { error: `${field} must be a whole number.` };
  }
  if (n < FOCAL_MIN || n > FOCAL_MAX) {
    return { error: `${field} must be between ${FOCAL_MIN} and ${FOCAL_MAX}.` };
  }
  return n;
}

/**
 * Save the editable metadata of one photograph.
 *
 * Alt text is REQUIRED and is not defaulted from anything. A generated
 * description would be a claim about a photograph nobody looked at, and alt
 * text is read aloud to somebody who cannot check it. The caption is optional
 * and is stored exactly as written — captions state facts about a delivered
 * project, and this code is in no position to invent one.
 *
 * The focal point is bounded here and again by a check constraint. It is
 * presentation metadata, so a bad value is a rendering bug rather than a
 * security one, but a number outside 0-100 would silently push the subject out
 * of frame on every card.
 */
export async function updateMediaDetailsAction(
  projectId: string,
  mediaId: string,
  input: {
    readonly altText: string;
    readonly caption: string | null;
    readonly focalX: number;
    readonly focalY: number;
  }
): Promise<MediaActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const altText = input.altText.trim();
  if (altText.length < 3 || altText.length > 200) {
    return {
      success: false,
      error: "Alt text must be between 3 and 200 characters.",
    };
  }

  const caption = input.caption?.trim() || null;
  if (caption && caption.length > 300) {
    return { success: false, error: "Caption must be 300 characters or fewer." };
  }

  const focalX = parseFocal(input.focalX, "Horizontal focus");
  if (typeof focalX !== "number") return { success: false, error: focalX.error };
  const focalY = parseFocal(input.focalY, "Vertical focus");
  if (typeof focalY !== "number") return { success: false, error: focalY.error };

  const claims = await getClaims();
  const supabase = await createClient();

  /*
   * Scoped by project as well as id. The id alone would be enough for the row,
   * but pairing them means a stale editor tab cannot write into a project it is
   * no longer looking at.
   */
  const { error } = await supabase
    .from("portfolio_media")
    .update({
      alt_text: altText,
      caption,
      focal_x: focalX,
      focal_y: focalY,
      updated_by: claims!.userId,
    })
    .eq("id", mediaId)
    .eq("project_id", projectId);

  if (error) {
    return { success: false, error: error.message };
  }

  const warning = await refreshSurfaces(projectId);
  return { success: true, message: warning ?? "Photo details saved." };
}
