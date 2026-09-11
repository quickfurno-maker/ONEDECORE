import "server-only";
import crypto from "crypto";
import type { createClient } from "@/lib/supabase/server";
import {
  validateImageMetadata,
  createSanitisedMaster,
  generateDerivative,
  generateMediaPath,
  generateLibraryMediaPath,
} from "./portfolio-image-pipeline";

/**
 * The one implementation of "turn an uploaded file into a ready media row".
 *
 * WHY THIS WAS EXTRACTED
 *
 * The project upload route already did all of this: validate, sanitise,
 * checksum, insert a draft row, put the master in the private bucket, generate
 * and upload two derivatives, record the source, flip to ready, and unwind
 * every one of those steps if any later one fails. Adding a second upload
 * endpoint for the room library meant either calling that logic or copying it,
 * and copying ~150 lines whose whole purpose is cleanup ordering is how the two
 * paths end up compensating differently six months from now — one of them
 * leaking an orphaned object that nobody notices because the DB row is gone.
 *
 * So the steps live here once and the two routes differ only in what they are
 * allowed to write: a project id and a role, or a room and a publication flag.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Authentication, same-origin, and the HTTP shape of the response. Those are
 * the route's job, and a function that could be called without them would be a
 * function someone eventually calls without them.
 */

/**
 * The request-scoped server client, typed from the factory that produces it.
 *
 * Not a hand-written `SupabaseClient<...>`: the generated `Database` type is
 * what makes every insert below checked against the real columns, and a
 * hand-rolled generic silently degrades all of them to `never` — which is
 * exactly what the first version of this file did, turning a typed insert into
 * an unchecked one.
 */
type Client = Awaited<ReturnType<typeof createClient>>;

export type MediaUploadScope =
  | {
      readonly kind: "project";
      readonly projectId: string;
      readonly mediaRole: "cover" | "gallery";
      readonly roomCategoryCode: string | null;
    }
  | {
      readonly kind: "library";
      /** Required: a standalone row without a room is invisible everywhere. */
      readonly roomCategoryCode: string;
    };

export interface MediaUploadInput {
  readonly file: File;
  readonly altText: string;
  readonly caption: string | null;
  readonly focalX: number;
  readonly focalY: number;
  readonly scope: MediaUploadScope;
  readonly userId: string;
}

export type MediaUploadFailure = {
  readonly ok: false;
  readonly status: number;
  readonly code: string;
  readonly error: string;
};

export type MediaUploadSuccess = {
  readonly ok: true;
  readonly mediaId: string;
  readonly media: Record<string, unknown>;
};

export type MediaUploadResult = MediaUploadSuccess | MediaUploadFailure;

const fail = (status: number, code: string, error: string): MediaUploadFailure => ({
  ok: false,
  status,
  code,
  error,
});

/**
 * Runs the upload, compensating on any failure.
 *
 * The compensation order is the reverse of the creation order and is the reason
 * this function owns its own try/catch rather than letting the caller handle
 * errors: by the time an exception reaches a route handler, the knowledge of
 * which objects were written has already been lost.
 */
export async function processMediaUpload(
  supabase: Client,
  input: MediaUploadInput
): Promise<MediaUploadResult> {
  const { file, altText, caption, focalX, focalY, scope, userId } = input;

  let mediaId: string | null = null;
  let masterObjectPath: string | null = null;
  let primaryObjectPath: string | null = null;
  let thumbObjectPath: string | null = null;

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const validation = await validateImageMetadata(inputBuffer, file.type);
    if (!validation.valid || !validation.format || !validation.extension || !validation.mimeType) {
      const is415 =
        validation.code === "UNSUPPORTED_IMAGE_FORMAT" ||
        validation.code === "ANIMATED_IMAGE_NOT_ALLOWED";
      return fail(
        is415 ? 415 : 400,
        validation.code ?? "INVALID_IMAGE",
        validation.error ?? "Image validation failed."
      );
    }

    const masterBuffer = await createSanitisedMaster(inputBuffer, validation.format);
    const masterChecksum = crypto.createHash("sha256").update(masterBuffer).digest("hex");

    /*
     * DUPLICATE SCOPE DIFFERS BY KIND, ON PURPOSE.
     *
     * Project: the same photograph in two different projects is legitimate —
     * a supplier shot reused across two homes — so the check is per project.
     *
     * Library: there is only one library, and the same photograph appearing
     * twice in it is never what anyone wanted. It should be retagged, not
     * re-uploaded, so a repeat is refused across the whole standalone set.
     *
     * Both compare the SANITISED master, so two exports differing only in EXIF
     * are correctly recognised as the same picture.
     */
    const { data: duplicates } = await supabase
      .from("portfolio_media_sources")
      .select("media_id, portfolio_media!inner(project_id, status)")
      .eq("checksum_sha256", masterChecksum);

    const duplicateRows = (duplicates ?? []) as unknown as {
      portfolio_media: { project_id: string | null; status: string } | null;
    }[];

    const isDuplicate = duplicateRows.some((row) => {
      const parent = row.portfolio_media;
      if (!parent) return false;
      if (scope.kind === "project") return parent.project_id === scope.projectId;
      // Retired rows are tombstones, not gallery members; they must not block
      // a re-upload of a photograph the owner deliberately removed.
      return parent.project_id === null && parent.status !== "retired";
    });

    if (isDuplicate) {
      return fail(
        409,
        "DUPLICATE_IMAGE",
        scope.kind === "project"
          ? "This photograph is already in this project."
          : "This photograph is already in the media library."
      );
    }

    mediaId = crypto.randomUUID();

    const mediaRole = scope.kind === "project" ? scope.mediaRole : "gallery";
    const maxPrimaryWidth = mediaRole === "cover" ? 1600 : 1200;
    const primaryFilename = mediaRole === "cover" ? "cover-1600.webp" : "gallery-1200.webp";

    const path = (filename: string) =>
      scope.kind === "project"
        ? generateMediaPath(scope.projectId, mediaId!, filename)
        : generateLibraryMediaPath(scope.roomCategoryCode, mediaId!, filename);

    masterObjectPath = path(`original.${validation.extension}`);
    primaryObjectPath = path(primaryFilename);
    thumbObjectPath = path("thumb-480.webp");

    const { error: draftInsertError } = await supabase.from("portfolio_media").insert({
      id: mediaId,
      project_id: scope.kind === "project" ? scope.projectId : null,
      media_role: mediaRole,
      status: "draft",
      alt_text: altText,
      caption,
      room_category_code: scope.roomCategoryCode,
      focal_x: focalX,
      focal_y: focalY,
      /*
       * Never derived from the caller. A standalone image becomes public
       * because somebody published it, not because its upload succeeded.
       */
      room_gallery_published: false,
      created_by: userId,
      updated_by: userId,
    });

    if (draftInsertError) {
      /*
       * The message is logged, never returned. It is a Postgres error string
       * and can name columns and constraints; the caller gets a stable code.
       *
       * Worth logging rather than swallowing: the failure that cost the most
       * time here was `42501 permission denied for table portfolio_media`,
       * which names the TABLE even though the cause was one ungranted COLUMN.
       * Without this line it surfaced only as "Failed to create media record".
       */
      console.error(
        `[portfolio-upload] DRAFT_INSERT_FAILED code=${draftInsertError.code ?? "?"} ${draftInsertError.message}`
      );
      return fail(500, "MEDIA_RECORD_FAILED", "Failed to create media record");
    }

    const { error: masterUploadError } = await supabase.storage
      .from("portfolio-originals")
      .upload(masterObjectPath, masterBuffer, {
        contentType: validation.mimeType,
        upsert: false,
      });
    if (masterUploadError) {
      throw new Error(`Master upload failed: ${masterUploadError.message}`);
    }

    const primaryRes = await generateDerivative(masterBuffer, maxPrimaryWidth, 82);
    const { error: primaryUploadError } = await supabase.storage
      .from("portfolio-public")
      .upload(primaryObjectPath, primaryRes.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (primaryUploadError) {
      throw new Error(`Primary derivative upload failed: ${primaryUploadError.message}`);
    }

    const thumbRes = await generateDerivative(masterBuffer, 480, 78);
    const { error: thumbUploadError } = await supabase.storage
      .from("portfolio-public")
      .upload(thumbObjectPath, thumbRes.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (thumbUploadError) {
      throw new Error(`Thumbnail derivative upload failed: ${thumbUploadError.message}`);
    }

    const { error: sourceInsertError } = await supabase.from("portfolio_media_sources").insert({
      media_id: mediaId,
      original_bucket: "portfolio-originals",
      original_object_path: masterObjectPath,
      original_file_name: file.name,
      original_mime_type: validation.mimeType,
      original_file_size_bytes: masterBuffer.length,
      checksum_sha256: masterChecksum,
      uploaded_by: userId,
    });
    if (sourceInsertError) {
      throw new Error(`Media source insertion failed: ${sourceInsertError.message}`);
    }

    const { data: finalMedia, error: readyUpdateError } = await supabase
      .from("portfolio_media")
      .update({
        status: "ready",
        public_bucket: "portfolio-public",
        public_object_path: primaryObjectPath,
        width_px: primaryRes.width,
        height_px: primaryRes.height,
        file_size_bytes: primaryRes.fileSize,
        mime_type: "image/webp",
        updated_by: userId,
      })
      .eq("id", mediaId)
      .select()
      .single();

    if (readyUpdateError || !finalMedia) {
      throw new Error(`Media status ready update failed: ${readyUpdateError?.message}`);
    }

    return { ok: true, mediaId, media: finalMedia as Record<string, unknown> };
  } catch (err: unknown) {
    /*
     * Best-effort compensation, widest-blast-radius first.
     *
     * The row goes last: while it exists the storage objects are attributable,
     * and deleting it first would turn a failed cleanup into an orphan nobody
     * can trace back. Every step is allowed to fail silently — this path is
     * already handling a failure, and throwing here would replace a useful
     * error with a misleading one.
     */
    if (masterObjectPath) {
      await supabase.storage.from("portfolio-originals").remove([masterObjectPath]);
    }
    if (primaryObjectPath || thumbObjectPath) {
      const pubRemove = [primaryObjectPath, thumbObjectPath].filter(Boolean) as string[];
      await supabase.storage.from("portfolio-public").remove(pubRemove);
    }
    if (mediaId) {
      await supabase.from("portfolio_media").delete().eq("id", mediaId);
    }

    const message = err instanceof Error ? err.message : "Image processing failed";
    return fail(500, "UPLOAD_FAILED", `Upload failed: ${message}`);
  }
}
