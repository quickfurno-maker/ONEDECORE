import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import {
  validateImageMetadata,
  createSanitisedMaster,
  generateDerivative,
  generateMediaPath,
  MAX_FILE_SIZE_BYTES,
} from "@/features/portfolio/server/portfolio-image-pipeline";
import { invalidatePublicPortfolio } from "@/features/portfolio/public/public-portfolio-invalidation";

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

  let mediaId: string | null = null;
  let masterObjectPath: string | null = null;
  let primaryObjectPath: string | null = null;
  let thumbObjectPath: string | null = null;

  const supabase = await createClient();

  try {
    const formData = await request.formData();
    const projectId = (formData.get("projectId") as string)?.trim();
    const mediaRole = (formData.get("mediaRole") as string)?.trim();
    const altText = (formData.get("altText") as string)?.trim();
    const caption = (formData.get("caption") as string)?.trim() || null;
    const file = formData.get("file") as File | null;

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

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // 3. Image Validation
    const validation = await validateImageMetadata(inputBuffer, file.type);
    if (!validation.valid || !validation.format || !validation.extension || !validation.mimeType) {
      const is415 =
        validation.code === "UNSUPPORTED_IMAGE_FORMAT" ||
        validation.code === "ANIMATED_IMAGE_NOT_ALLOWED";
      return NextResponse.json(
        { code: validation.code, error: validation.error },
        { status: is415 ? 415 : 400 }
      );
    }

    // 4. Generate Master (Sanitised, Auto-oriented, Metadata-stripped)
    const masterBuffer = await createSanitisedMaster(inputBuffer, validation.format);
    const masterChecksum = crypto.createHash("sha256").update(masterBuffer).digest("hex");

    // 5. Generate Server Media UUID & Paths
    mediaId = crypto.randomUUID();
    masterObjectPath = generateMediaPath(projectId, mediaId, `original.${validation.extension}`);

    const maxPrimaryWidth = mediaRole === "cover" ? 1600 : 1200;
    const primaryFilename = mediaRole === "cover" ? "cover-1600.webp" : "gallery-1200.webp";
    primaryObjectPath = generateMediaPath(projectId, mediaId, primaryFilename);
    thumbObjectPath = generateMediaPath(projectId, mediaId, "thumb-480.webp");

    // 6. Insert Draft Media Row
    const { error: draftInsertError } = await supabase
      .from("portfolio_media")
      .insert({
        id: mediaId,
        project_id: projectId,
        media_role: mediaRole,
        status: "draft",
        alt_text: altText,
        caption: caption,
        created_by: claims.userId,
        updated_by: claims.userId,
      });

    if (draftInsertError) {
      return NextResponse.json({ error: "Failed to create media record" }, { status: 500 });
    }

    // 7. Upload Private Master to portfolio-originals
    const { error: masterUploadError } = await supabase.storage
      .from("portfolio-originals")
      .upload(masterObjectPath, masterBuffer, {
        contentType: validation.mimeType,
        upsert: false,
      });

    if (masterUploadError) {
      throw new Error(`Master upload failed: ${masterUploadError.message}`);
    }

    // 8. Generate & Upload Primary Derivative to portfolio-public
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

    // 9. Generate & Upload Thumbnail Derivative to portfolio-public
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

    // 10. Insert portfolio_media_sources
    const { error: sourceInsertError } = await supabase
      .from("portfolio_media_sources")
      .insert({
        media_id: mediaId,
        original_bucket: "portfolio-originals",
        original_object_path: masterObjectPath,
        original_file_name: file.name,
        original_mime_type: validation.mimeType,
        original_file_size_bytes: masterBuffer.length,
        checksum_sha256: masterChecksum,
        uploaded_by: claims.userId,
      });

    if (sourceInsertError) {
      throw new Error(`Media source insertion failed: ${sourceInsertError.message}`);
    }

    // 11. Update Media Row to Ready Status
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
        updated_by: claims.userId,
      })
      .eq("id", mediaId)
      .select()
      .single();

    if (readyUpdateError || !finalMedia) {
      throw new Error(`Media status ready update failed: ${readyUpdateError?.message}`);
    }

    // Storage and database writes have committed. A cache refresh failure here
    // is reported as a warning rather than failing the upload.
    const invalidation = invalidatePublicPortfolio(project.slug);

    return NextResponse.json({
      success: true,
      media: finalMedia,
      warning: invalidation.ok ? undefined : invalidation.warning,
    });
  } catch (err: unknown) {
    // 12. Best-Effort Compensation Cleanup on Failure
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
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
