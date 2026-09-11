import { NextRequest, NextResponse } from "next/server";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { MAX_FILE_SIZE_BYTES } from "@/features/portfolio/server/portfolio-image-pipeline";
import { processMediaUpload } from "@/features/portfolio/server/portfolio-media-upload";
import {
  FOCAL_DEFAULT,
  isPortfolioRoomCode,
  normaliseFocalValue,
} from "@/features/portfolio/public/portfolio-rooms";
import {
  isValidAltText,
  resolveLibraryAltText,
} from "@/features/portfolio/domain/portfolio-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standalone room-library upload: one file, one room, no project.
 *
 * WHY A SECOND ENDPOINT RATHER THAN A FLAG ON THE FIRST
 *
 * The project endpoint's contract is "a projectId is required and the project
 * must exist". Making that conditional would turn its clearest invariant into a
 * branch, and a request that omitted the discriminator by mistake would land in
 * whichever branch the default happened to be. Two endpoints cannot be confused
 * with each other: this one has no way to name a project and no way to ask for
 * a cover, because it never reads those fields.
 *
 * ONE FILE PER REQUEST, DELIBERATELY
 *
 * The admin uploads fifty images as fifty bounded requests, not one 300MB
 * multipart body. That is what makes per-file progress real, lets one corrupt
 * file fail alone, makes retry mean something, and keeps server memory to the
 * few images actually in flight.
 */

function checkSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!checkSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload request" }, { status: 400 });
  }

  /*
   * A room is REQUIRED here, unlike the project route where "unclassified" is a
   * real answer for a cover or a material detail. A standalone row has no
   * project to be found through, so an untagged one appears in no room view and
   * in no admin filter — it would exist only in the database.
   */
  const roomCategoryCode = (formData.get("roomCategoryCode") as string)?.trim() ?? "";
  if (!isPortfolioRoomCode(roomCategoryCode)) {
    return NextResponse.json(
      { code: "INVALID_ROOM", error: "Choose a room before uploading." },
      { status: 400 }
    );
  }

  /*
   * Anything that would make this a project upload is refused rather than
   * ignored. A caller sending `projectId` believes it will be honoured, and
   * silently dropping it would produce a standalone row where they expected a
   * project one — a wrong outcome reported as success.
   */
  if (formData.has("projectId")) {
    return NextResponse.json(
      {
        code: "PROJECT_NOT_ALLOWED",
        error: "The media library does not accept a project. Use the project upload instead.",
      },
      { status: 400 }
    );
  }
  if (formData.has("mediaRole")) {
    return NextResponse.json(
      {
        code: "ROLE_NOT_ALLOWED",
        error: "Library media is always a gallery image and can never be a project cover.",
      },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { code: "FILE_REQUIRED", error: "No file was received." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { code: "FILE_SIZE_EXCEEDED", error: "File size exceeds 20 MiB limit." },
      { status: 400 }
    );
  }

  const altText = resolveLibraryAltText(roomCategoryCode, formData.get("altText") as string | null);
  if (!isValidAltText(altText)) {
    return NextResponse.json(
      { code: "INVALID_ALT_TEXT", error: "Alt text must be between 5 and 180 characters." },
      { status: 400 }
    );
  }

  const caption = ((formData.get("caption") as string) ?? "").trim() || null;
  const focalX = formData.has("focalX")
    ? normaliseFocalValue(formData.get("focalX"))
    : FOCAL_DEFAULT;
  const focalY = formData.has("focalY")
    ? normaliseFocalValue(formData.get("focalY"))
    : FOCAL_DEFAULT;

  const result = await processMediaUpload(supabase, {
    file,
    altText,
    caption,
    focalX,
    focalY,
    userId: claims.userId,
    scope: { kind: "library", roomCategoryCode },
  });

  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status });
  }

  /*
   * NO CACHE INVALIDATION HERE, AND THAT IS THE POINT.
   *
   * The row lands unpublished, so no public surface changed. Invalidating
   * anyway would expire the room caches fifty times during a fifty-image batch
   * to reveal nothing. The refresh happens where visibility actually changes:
   * publish, unpublish, recategorise, reorder and delete.
   */
  return NextResponse.json({ success: true, media: result.media });
}
