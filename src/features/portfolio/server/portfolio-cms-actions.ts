"use server";

import { revalidatePath } from "next/cache";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_SERVICE_CODES, type PortfolioServiceCode } from "../domain/portfolio-service";
import { invalidatePublicPortfolio } from "../public/public-portfolio-invalidation";
import { type PortfolioFormState } from "./portfolio-form-state";

/**
 * Refreshes every public surface touched by a Portfolio mutation.
 *
 * Accepts more than one slug because renaming a project has to clear the cache
 * entry for the slug it used to be served under as well as the new one.
 */
function invalidatePublicSurfaces(slugs: Array<string | null | undefined>): string | undefined {
  let warning: string | undefined;

  for (const slug of new Set(slugs.filter((s): s is string => Boolean(s)))) {
    const outcome = invalidatePublicPortfolio(slug);
    if (!outcome.ok) {
      warning = outcome.warning;
    }
  }

  return warning;
}

/**
 * Asserts authenticated staff has portfolio.manage permission.
 */
export async function requirePortfolioManage() {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    throw new Error("Unauthorized: portfolio.manage permission required");
  }
  return claims;
}

/**
 * Server Action: Create a new draft portfolio project.
 */
export async function createProjectAction(
  _previousState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  let claims;
  try {
    claims = await requirePortfolioManage();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return {
      success: false,
      message: msg,
      fieldErrors: {},
    };
  }

  const title = (formData.get("title") as string)?.trim() || "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() || "";
  const summary = (formData.get("summary") as string)?.trim() || "";
  const description = (formData.get("description") as string)?.trim() || null;
  const locationLabel = (formData.get("locationLabel") as string)?.trim() || null;
  const propertyType = (formData.get("propertyType") as string)?.trim() || null;
  const completionYearRaw = formData.get("completionYear");
  const completionYear = completionYearRaw ? parseInt(completionYearRaw as string, 10) : null;
  const seoTitle = (formData.get("seoTitle") as string)?.trim() || null;
  const seoDescription = (formData.get("seoDescription") as string)?.trim() || null;
  const services = formData.getAll("services") as PortfolioServiceCode[];

  const fieldErrors: Record<string, string[]> = {};

  if (!title || title.length < 3 || title.length > 120) {
    fieldErrors.title = ["Title must be between 3 and 120 characters."];
  }
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fieldErrors.slug = ["Slug must contain only lowercase letters, numbers, and single hyphens."];
  }
  if (!summary || summary.length < 20 || summary.length > 320) {
    fieldErrors.summary = ["Summary must be between 20 and 320 characters."];
  }
  const validServices = services.filter((s) => PORTFOLIO_SERVICE_CODES.includes(s));
  if (validServices.length < 1 || validServices.length > 3) {
    fieldErrors.services = ["Select between 1 and 3 valid services."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: project, error: insertError } = await supabase
    .from("portfolio_projects")
    .insert({
      title,
      slug,
      summary,
      description,
      location_label: locationLabel,
      property_type: propertyType,
      completion_year: completionYear,
      seo_title: seoTitle,
      seo_description: seoDescription,
      status: "draft",
      created_by: claims.userId,
      updated_by: claims.userId,
    })
    .select()
    .single();

  if (insertError || !project) {
    return {
      success: false,
      message: insertError?.message || "Failed to create project record.",
      fieldErrors: {},
    };
  }

  // Call atomic service replacement RPC
  const { error: serviceRpcError } = await supabase.rpc("replace_portfolio_project_services", {
    requested_project_id: project.id,
    requested_service_codes: validServices,
  });

  if (serviceRpcError) {
    return {
      success: false,
      message: serviceRpcError.message,
      fieldErrors: {},
    };
  }

  revalidatePath("/admin/portfolio");
  const createWarning = invalidatePublicSurfaces([slug]);

  return {
    success: true,
    message: createWarning ?? "Project created successfully.",
    fieldErrors: {},
    redirectTo: `/admin/portfolio/${project.id}`,
  };
}

/**
 * Server Action: Update portfolio project metadata and assigned services.
 */
export async function updateProjectAction(
  projectId: string,
  _previousState: PortfolioFormState,
  formData: FormData
): Promise<PortfolioFormState> {
  let claims;
  try {
    claims = await requirePortfolioManage();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return {
      success: false,
      message: msg,
      fieldErrors: {},
    };
  }

  const title = (formData.get("title") as string)?.trim() || "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() || "";
  const summary = (formData.get("summary") as string)?.trim() || "";
  const description = (formData.get("description") as string)?.trim() || null;
  const locationLabel = (formData.get("locationLabel") as string)?.trim() || null;
  const propertyType = (formData.get("propertyType") as string)?.trim() || null;
  const completionYearRaw = formData.get("completionYear");
  const completionYear = completionYearRaw ? parseInt(completionYearRaw as string, 10) : null;
  const seoTitle = (formData.get("seoTitle") as string)?.trim() || null;
  const seoDescription = (formData.get("seoDescription") as string)?.trim() || null;
  const isFeatured = formData.get("isFeatured") === "true";
  const services = formData.getAll("services") as PortfolioServiceCode[];

  const fieldErrors: Record<string, string[]> = {};

  if (!title || title.length < 3 || title.length > 120) {
    fieldErrors.title = ["Title must be between 3 and 120 characters."];
  }
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fieldErrors.slug = ["Slug must contain only lowercase letters, numbers, and single hyphens."];
  }
  if (!summary || summary.length < 20 || summary.length > 320) {
    fieldErrors.summary = ["Summary must be between 20 and 320 characters."];
  }
  const validServices = services.filter((s) => PORTFOLIO_SERVICE_CODES.includes(s));
  if (validServices.length < 1 || validServices.length > 3) {
    fieldErrors.services = ["Select between 1 and 3 valid services."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors,
    };
  }

  const supabase = await createClient();

  // Captured before the write so a slug rename can invalidate the old URL too.
  const { data: previous } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", projectId)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("portfolio_projects")
    .update({
      title,
      slug,
      summary,
      description,
      location_label: locationLabel,
      property_type: propertyType,
      completion_year: completionYear,
      seo_title: seoTitle,
      seo_description: seoDescription,
      is_featured: isFeatured,
      updated_by: claims.userId,
    })
    .eq("id", projectId);

  if (updateError) {
    return {
      success: false,
      message: updateError.message,
      fieldErrors: {},
    };
  }

  // Call atomic service replacement RPC
  const { error: serviceRpcError } = await supabase.rpc("replace_portfolio_project_services", {
    requested_project_id: projectId,
    requested_service_codes: validServices,
  });

  if (serviceRpcError) {
    return {
      success: false,
      message: serviceRpcError.message,
      fieldErrors: {},
    };
  }

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${projectId}`);
  const updateWarning = invalidatePublicSurfaces([previous?.slug, slug]);

  return {
    success: true,
    message: updateWarning ?? "Project metadata saved successfully.",
    fieldErrors: {},
  };
}

/**
 * Server Action: Change portfolio project status (publish, draft, archive) via status RPC.
 */
export async function setProjectStatusAction(
  projectId: string,
  status: "draft" | "published" | "archived"
) {
  await requirePortfolioManage();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", projectId)
    .maybeSingle();

  const { error } = await supabase.rpc("set_portfolio_project_status", {
    requested_project_id: projectId,
    requested_status: status,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${projectId}`);
  const statusWarning = invalidatePublicSurfaces([target?.slug]);

  return { success: true, warning: statusWarning };
}

/**
 * Server Action: Delete non-published project and clean up associated media storage objects.
 */
export async function deleteProjectAction(projectId: string) {
  await requirePortfolioManage();
  const supabase = await createClient();

  // 1. Verify project exists and is not published
  const { data: project } = await supabase
    .from("portfolio_projects")
    .select("status, slug")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found" };
  }
  if (project.status === "published") {
    return { error: "Cannot delete a published project. Return project to draft first." };
  }

  // 2. Fetch associated media for storage cleanup
  const { data: mediaItems } = await supabase
    .from("portfolio_media")
    .select("id, public_object_path")
    .eq("project_id", projectId);

  const { data: mediaSources } = await supabase
    .from("portfolio_media_sources")
    .select("original_object_path");

  // Clean up private master storage objects
  if (mediaSources && mediaSources.length > 0) {
    const origPaths = mediaSources.map((s) => s.original_object_path).filter(Boolean);
    if (origPaths.length > 0) {
      await supabase.storage.from("portfolio-originals").remove(origPaths);
    }
  }

  // Clean up public derivative storage objects
  if (mediaItems && mediaItems.length > 0) {
    const pubPaths: string[] = [];
    for (const item of mediaItems) {
      if (item.public_object_path) {
        pubPaths.push(item.public_object_path);
        // Include thumbnail path
        const thumbPath = item.public_object_path.replace(/(cover-1600|gallery-1200)\.webp$/, "thumb-480.webp");
        pubPaths.push(thumbPath);
      }
    }
    if (pubPaths.length > 0) {
      await supabase.storage.from("portfolio-public").remove(pubPaths);
    }
  }

  // 3. Delete database project (cascades media and services)
  const { error: deleteError } = await supabase
    .from("portfolio_projects")
    .delete()
    .eq("id", projectId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/admin/portfolio");
  const deleteWarning = invalidatePublicSurfaces([project.slug]);

  return { success: true, redirectTo: "/admin/portfolio", warning: deleteWarning };
}

/**
 * Server Action: Reorder project media sort_order.
 */
export async function reorderMediaAction(
  projectId: string,
  mediaId: string,
  direction: "up" | "down"
) {
  const claims = await requirePortfolioManage();
  const supabase = await createClient();

  const { data: mediaItems } = await supabase
    .from("portfolio_media")
    .select("id, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!mediaItems || mediaItems.length < 2) {
    return { success: true };
  }

  const currentIndex = mediaItems.findIndex((m) => m.id === mediaId);
  if (currentIndex === -1) return { error: "Media item not found" };

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= mediaItems.length) {
    return { success: true };
  }

  const currentMedia = mediaItems[currentIndex];
  const targetMedia = mediaItems[targetIndex];

  // Swap sort_orders
  await supabase
    .from("portfolio_media")
    .update({ sort_order: targetMedia.sort_order, updated_by: claims.userId })
    .eq("id", currentMedia.id);

  await supabase
    .from("portfolio_media")
    .update({ sort_order: currentMedia.sort_order, updated_by: claims.userId })
    .eq("id", targetMedia.id);

  const { data: reordered } = await supabase
    .from("portfolio_projects")
    .select("slug")
    .eq("id", projectId)
    .maybeSingle();

  revalidatePath(`/admin/portfolio/${projectId}`);
  const reorderWarning = invalidatePublicSurfaces([reordered?.slug]);

  return { success: true, warning: reorderWarning };
}
