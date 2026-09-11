"use server";

import { revalidatePath } from "next/cache";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { invalidatePublicRoomLibrary } from "../public/public-portfolio-invalidation";
import {
  FOCAL_MAX,
  FOCAL_MIN,
  isPortfolioRoomCode,
  normaliseFocalValue,
} from "../public/portfolio-rooms";
import { isValidAltText } from "../domain/portfolio-library";

/**
 * Bulk management for standalone room-library media.
 *
 * EVERY MUTATION GOES THROUGH AN RPC THAT RE-CHECKS EVERYTHING
 *
 * These actions validate their input and then call a `SECURITY INVOKER`
 * function that validates it again — against `portfolio.manage`, against the
 * standalone shape, and against the room. The duplication is the point: a
 * server action is reachable by anyone who can reach the app, and the database
 * is the only party that can be certain who is asking.
 *
 * WHY THE LIBRARY HAS ITS OWN FUNCTIONS RATHER THAN FLAGS ON THE PROJECT ONES
 *
 * `set_portfolio_media_room_category` takes a project id and refuses anything
 * outside it. Making that id optional would turn an ownership check into a
 * branch, and one caller passing null would gain the ability to retag the whole
 * table. The library functions assert the opposite — `project_id is null` — so
 * neither family can reach the other's rows whatever ids it is handed.
 *
 * ALL-OR-NOTHING, EVERY TIME
 *
 * Selecting eighteen photographs and publishing twelve of them is the worst
 * available outcome: the owner sees a success and has no way to learn which six
 * are missing. Each RPC counts what it matched before it writes anything.
 */

export interface LibraryActionResult {
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
  readonly warning?: string;
}

async function requireManage() {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    throw new Error("Unauthorized");
  }
  return claims;
}

/**
 * Refresh the admin screen and the public room galleries.
 *
 * A cache failure is a warning, never a failed mutation: the write has already
 * committed, and reporting failure would invite the owner to repeat an action
 * that already happened.
 */
function refreshSurfaces(): string | undefined {
  revalidatePath("/admin/portfolio/media");
  const invalidation = invalidatePublicRoomLibrary();
  return invalidation.ok ? undefined : invalidation.warning;
}

/** Rejects anything that is not a plausible uuid before it reaches the database. */
function normaliseIds(mediaIds: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const id of mediaIds) {
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) seen.add(id);
  }
  return [...seen];
}

/* ========================================================================== */
/* Publication                                                                 */
/* ========================================================================== */

/**
 * Publish or unpublish a selection.
 *
 * Publishing is the only action here that can make something visible to the
 * public, so it is the one with the extra guard: the RPC refuses the whole
 * batch if any selected row is not `ready`. Unpublishing has no such condition
 * — removing something from view is always allowed to succeed.
 */
export async function setLibraryPublicationAction(
  mediaIds: readonly string[],
  published: boolean
): Promise<LibraryActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const ids = normaliseIds(mediaIds);
  if (ids.length === 0) {
    return { success: false, error: "Select at least one image." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_portfolio_library_publication", {
    requested_media_ids: ids,
    requested_published: published,
  });

  if (error) {
    return {
      success: false,
      error: error.message.includes("not ready")
        ? "Some selected images are still processing. Wait for them to finish, then publish again."
        : "Could not update publication. Refresh and try again.",
    };
  }

  const warning = refreshSurfaces();
  return {
    success: true,
    message: published
      ? `Published ${ids.length} ${ids.length === 1 ? "image" : "images"}.`
      : `Unpublished ${ids.length} ${ids.length === 1 ? "image" : "images"}.`,
    warning,
  };
}

/* ========================================================================== */
/* Category                                                                    */
/* ========================================================================== */

/**
 * Move a selection to another room.
 *
 * There is no "unclassified" option, unlike the project equivalent: a
 * standalone row without a room violates the table's shape constraint, because
 * it would appear in no room view and no admin filter — a row that exists only
 * in the database.
 *
 * The stored objects are NOT moved. The room lives in the path for human
 * legibility only; the column is the truth, and rewriting storage keys on a
 * retag would turn a metadata edit into a bulk copy that can half-fail.
 */
export async function setLibraryRoomCategoryAction(
  mediaIds: readonly string[],
  roomCode: string
): Promise<LibraryActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPortfolioRoomCode(roomCode)) {
    return { success: false, error: "Choose a valid room." };
  }

  const ids = normaliseIds(mediaIds);
  if (ids.length === 0) {
    return { success: false, error: "Select at least one image." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_portfolio_library_room_category", {
    requested_media_ids: ids,
    requested_room_code: roomCode,
  });

  if (error) {
    return { success: false, error: "Could not change category. Refresh and try again." };
  }

  const warning = refreshSurfaces();
  return {
    success: true,
    message: `Moved ${ids.length} ${ids.length === 1 ? "image" : "images"}.`,
    warning,
  };
}

/* ========================================================================== */
/* Order                                                                       */
/* ========================================================================== */

/**
 * Set the order of one room's library.
 *
 * The complete active set for that room must be supplied. A subset would let a
 * paginated screen renumber page one to 0..47 and leave page two also claiming
 * 0..47 — an order that depends on which rows the database happened to return
 * first. The admin loads the whole room before it allows a reorder, and the RPC
 * enforces that rather than trusting it.
 */
export async function reorderLibraryMediaAction(
  roomCode: string,
  orderedMediaIds: readonly string[]
): Promise<LibraryActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPortfolioRoomCode(roomCode)) {
    return { success: false, error: "Choose a valid room." };
  }

  /*
   * Order-preserving de-duplication, not `normaliseIds`: this is the one action
   * where the sequence IS the payload, and a Set built by that helper would be
   * insertion-ordered by luck rather than by contract.
   */
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of orderedMediaIds) {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0) {
    return { success: false, error: "Nothing to reorder." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_portfolio_library_media", {
    requested_room_code: roomCode,
    requested_media_ids: ids,
  });

  if (error) {
    return {
      success: false,
      error: error.message.includes("complete room set")
        ? "The list changed while you were reordering. Refresh and try again."
        : "Could not save the new order. Refresh and try again.",
    };
  }

  const warning = refreshSurfaces();
  return { success: true, message: "Order saved.", warning };
}

/* ========================================================================== */
/* Per-image details                                                           */
/* ========================================================================== */

/**
 * Edit one image's alt text, caption and focal point.
 *
 * Written directly rather than through an RPC because it touches exactly one
 * row and carries no cross-row invariant — the atomicity the bulk functions
 * need is not a property a single UPDATE can lack. RLS still enforces
 * `portfolio.manage`, and the `project_id is null` filter is what keeps this
 * action inside the library.
 */
export async function updateLibraryMediaAction(
  mediaId: string,
  input: {
    readonly altText: string;
    readonly caption: string | null;
    readonly focalX: number;
    readonly focalY: number;
  }
): Promise<LibraryActionResult> {
  let claims;
  try {
    claims = await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) {
    return { success: false, error: "Unknown image." };
  }

  const altText = input.altText.trim();
  if (!isValidAltText(altText)) {
    return { success: false, error: "Alt text must be between 5 and 180 characters." };
  }

  const caption = (input.caption ?? "").trim();
  if (caption.length > 500) {
    return { success: false, error: "Caption must be 500 characters or fewer." };
  }

  const focalX = normaliseFocalValue(input.focalX);
  const focalY = normaliseFocalValue(input.focalY);
  if (focalX < FOCAL_MIN || focalX > FOCAL_MAX || focalY < FOCAL_MIN || focalY > FOCAL_MAX) {
    return { success: false, error: "Focal point must be within the image." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_media")
    .update({
      alt_text: altText,
      caption: caption.length > 0 ? caption : null,
      focal_x: focalX,
      focal_y: focalY,
      updated_by: claims.userId,
    })
    .eq("id", mediaId)
    .is("project_id", null);

  if (error) {
    return { success: false, error: "Could not save changes. Refresh and try again." };
  }

  const warning = refreshSurfaces();
  return { success: true, message: "Saved.", warning };
}

/* ========================================================================== */
/* Delete                                                                      */
/* ========================================================================== */

/**
 * Permanently delete a selection, including its stored objects.
 *
 * ORDER: STORAGE FIRST, ROW LAST.
 *
 * While the row exists, its objects are attributable — the paths are derivable
 * from the row. Deleting the row first and then failing to remove the objects
 * leaves files in a bucket that nothing references and nobody can trace. So the
 * objects go first, and a storage failure is tolerated: a missing object must
 * never leave an undeletable row behind, which is the state that would force
 * somebody into the database by hand.
 *
 * `portfolio_media_sources` follows by ON DELETE CASCADE.
 */
export async function deleteLibraryMediaAction(
  mediaIds: readonly string[]
): Promise<LibraryActionResult> {
  try {
    await requireManage();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const ids = normaliseIds(mediaIds);
  if (ids.length === 0) {
    return { success: false, error: "Select at least one image." };
  }

  const supabase = await createClient();

  /*
   * Read the objects BEFORE deleting, and read them scoped to standalone rows.
   * The `is("project_id", null)` filter is what stops a guessed project-media
   * uuid being deleted through the library screen.
   */
  const { data: rows, error: readError } = await supabase
    .from("portfolio_media")
    .select("id, public_object_path, portfolio_media_sources(original_object_path)")
    .in("id", ids)
    .is("project_id", null);

  if (readError) {
    return { success: false, error: "Could not load the selected images." };
  }

  const found = rows ?? [];
  if (found.length !== ids.length) {
    return {
      success: false,
      error: "Some selected images are no longer in the library. Refresh and try again.",
    };
  }

  const publicPaths: string[] = [];
  const originalPaths: string[] = [];
  for (const row of found) {
    if (row.public_object_path) {
      publicPaths.push(row.public_object_path);
      /*
       * The thumbnail is a sibling of the primary derivative and is not stored
       * on the row. Deriving it is safe because the pipeline is the only writer
       * of these paths and always writes both.
       */
      publicPaths.push(row.public_object_path.replace(/[^/]+$/, "thumb-480.webp"));
    }
    const sources = row.portfolio_media_sources as unknown as
      | { original_object_path: string }[]
      | { original_object_path: string }
      | null;
    if (Array.isArray(sources)) {
      for (const source of sources) originalPaths.push(source.original_object_path);
    } else if (sources) {
      originalPaths.push(sources.original_object_path);
    }
  }

  if (originalPaths.length > 0) {
    await supabase.storage.from("portfolio-originals").remove(originalPaths);
  }
  if (publicPaths.length > 0) {
    await supabase.storage.from("portfolio-public").remove(publicPaths);
  }

  const { error: deleteError } = await supabase
    .from("portfolio_media")
    .delete()
    .in("id", ids)
    .is("project_id", null);

  if (deleteError) {
    return { success: false, error: "Could not delete. Refresh and try again." };
  }

  const warning = refreshSurfaces();
  return {
    success: true,
    message: `Deleted ${ids.length} ${ids.length === 1 ? "image" : "images"}.`,
    warning,
  };
}
