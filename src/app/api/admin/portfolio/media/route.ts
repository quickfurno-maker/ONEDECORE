import { NextRequest, NextResponse } from "next/server";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { MAX_FILE_SIZE_BYTES } from "@/features/portfolio/server/portfolio-image-pipeline";
import { processMediaUpload } from "@/features/portfolio/server/portfolio-media-upload";
import { invalidatePublicPortfolio } from "@/features/portfolio/public/public-portfolio-invalidation";
import {
  FOCAL_DEFAULT,
  isPortfolioRoomCode,
  normaliseFocalValue,
} from "@/features/portfolio/public/portfolio-rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validates Same-Origin request.
 */
function checkSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 1. Same-Origin Check
  if (!checkSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  // 2. Auth & Claims Check
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

  const projectId = (formData.get("projectId") as string)?.trim();
  const mediaRole = (formData.get("mediaRole") as string)?.trim();
  const altText = (formData.get("altText") as string)?.trim();
  const caption = (formData.get("caption") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  /*
   * Room and focal point may arrive with the upload so a multi-file drop can
   * be tagged once rather than image by image afterwards. Both are optional:
   * an untagged photograph is unclassified, which is a real state, and an
   * unset focal point is dead centre, which is what the browser does anyway.
   */
  const rawRoom = (formData.get("roomCategoryCode") as string)?.trim() || "";
  if (rawRoom !== "" && !isPortfolioRoomCode(rawRoom)) {
    return NextResponse.json({ error: "Unknown room category" }, { status: 400 });
  }
  const roomCategoryCode = rawRoom === "" ? null : rawRoom;

  const focalX = formData.has("focalX")
    ? normaliseFocalValue(formData.get("focalX"))
    : FOCAL_DEFAULT;
  const focalY = formData.has("focalY")
    ? normaliseFocalValue(formData.get("focalY"))
    : FOCAL_DEFAULT;

  if (!projectId || !mediaRole || !altText || !file) {
    return NextResponse.json({ error: "Missing required upload parameters" }, { status: 400 });
  }
  if (mediaRole !== "cover" && mediaRole !== "gallery") {
    return NextResponse.json({ error: "Invalid media role" }, { status: 400 });
  }
  if (altText.length < 3 || altText.length > 200) {
    return NextResponse.json({ error: "Alt text must be between 3 and 200 characters" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File size exceeds 20 MiB limit" }, { status: 400 });
  }

  // Verify project exists
  const { data: project } = await supabase
    .from("portfolio_projects")
    .select("id, slug")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  /*
   * THE UPLOAD ITSELF NOW LIVES IN `processMediaUpload`.
   *
   * Validation, sanitisation, checksum, the draft row, both buckets, the source
   * record, the flip to ready and the compensation unwind were all inline here
   * and are now shared with the room-library endpoint. Two copies of the
   * cleanup ordering was the alternative, and the cost of those drifting is an
   * orphaned storage object that nothing points at.
   *
   * This route keeps what is genuinely its own: same-origin, the permission
   * gate, the project-shaped request contract, and the cache refresh that only
   * makes sense when a project is involved.
   */
  const result = await processMediaUpload(supabase, {
    file,
    altText,
    caption,
    focalX,
    focalY,
    userId: claims.userId,
    scope: { kind: "project", projectId, mediaRole, roomCategoryCode },
  });

  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, error: result.error },
      { status: result.status }
    );
  }

  // Storage and database writes have committed. A cache refresh failure here
  // is reported as a warning rather than failing the upload.
  const invalidation = invalidatePublicPortfolio(project.slug);

  return NextResponse.json({
    success: true,
    media: result.media,
    warning: invalidation.ok ? undefined : invalidation.warning,
  });
}
