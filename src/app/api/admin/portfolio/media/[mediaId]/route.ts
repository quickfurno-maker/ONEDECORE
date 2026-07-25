import { NextRequest, NextResponse } from "next/server";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  if (!checkSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mediaId } = await params;
  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Fetch media item with project status check
  const { data: mediaItem } = await supabase
    .from("portfolio_media")
    .select("id, project_id, media_role, status, public_object_path, portfolio_projects!inner(status)")
    .eq("id", mediaId)
    .maybeSingle();

  if (!mediaItem) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  // Published cover protection check
  const projectStatus = (mediaItem.portfolio_projects as unknown as { status: string })?.status;
  if (projectStatus === "published" && mediaItem.media_role === "cover" && mediaItem.status === "ready") {
    return NextResponse.json(
      { error: "Cannot delete ready cover image of a published project. Return project to draft first." },
      { status: 400 }
    );
  }

  // 2. Fetch master source path
  const { data: source } = await supabase
    .from("portfolio_media_sources")
    .select("original_object_path")
    .eq("media_id", mediaId)
    .maybeSingle();

  // 3. Delete Storage objects first
  if (source?.original_object_path) {
    await supabase.storage.from("portfolio-originals").remove([source.original_object_path]);
  }
  if (mediaItem.public_object_path) {
    const thumbPath = mediaItem.public_object_path.replace(/(cover-1600|gallery-1200)\.webp$/, "thumb-480.webp");
    await supabase.storage.from("portfolio-public").remove([mediaItem.public_object_path, thumbPath]);
  }

  // 4. Delete database record
  const { error: deleteError } = await supabase
    .from("portfolio_media")
    .delete()
    .eq("id", mediaId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
