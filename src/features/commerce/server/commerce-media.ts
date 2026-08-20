import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSanitisedMaster,
  generateDerivative,
  validateImageMetadata,
} from "@/features/portfolio/server/portfolio-image-pipeline";
import { commerceErrorFromUnknown, type CommerceActionResult } from "./commerce-errors";
import { evaluateCommerceMediaUploadAuth } from "./commerce-media-auth";

export const COMMERCE_ORIGINAL_BUCKET = "commerce-product-originals";
export const COMMERCE_PUBLIC_BUCKET = "commerce-product-public";
const MAX_PUBLIC_DERIVATIVE_BYTES = 8 * 1024 * 1024;

export function isCommerceMediaPrefix(productId: string, mediaId: string, path: string): boolean {
  return path.startsWith(`${productId}/${mediaId}/`);
}

function newKey(): string {
  return crypto.randomUUID();
}

export async function runCommerceProductMediaUpload(
  formData: FormData
): Promise<CommerceActionResult<{ mediaId?: string }>> {
  const supabase = await createClient();
  const authorizeRes = await supabase.rpc("authorize", {
    requested_permission: "commerce.catalog.manage",
  });
  const auth = evaluateCommerceMediaUploadAuth(!authorizeRes.error && authorizeRes.data === true);
  if (!auth.allowed) {
    return {
      success: false,
      message: "You do not have commerce catalogue authority to upload media.",
      code: "COMMERCE_UNAUTHORIZED",
    };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const variantRaw = String(formData.get("variantId") ?? "").trim();
  const variantId = variantRaw === "" ? null : variantRaw;
  const altText = String(formData.get("altText") ?? "").trim();
  const isPrimary =
    formData.get("isPrimary") === "true" || formData.get("isPrimary") === "on" || formData.get("isPrimary") === "1";
  const sortRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = sortRaw === "" ? 0 : Number.parseInt(sortRaw, 10);
  const file = formData.get("file");

  if (!productId || !(file instanceof File)) {
    return { success: false, message: "Product and image file are required.", code: "COMMERCE_VALIDATION" };
  }
  if (!Number.isInteger(sortOrder)) {
    return { success: false, message: "sortOrder must be a whole number.", code: "COMMERCE_VALIDATION" };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageMetadata(inputBuffer, file.type);
  if (!validation.valid || !validation.format || !validation.mimeType || !validation.extension) {
    return {
      success: false,
      message: validation.error ?? "The image is not a valid JPEG, PNG, or WebP under 20 MiB.",
      code: "COMMERCE_VALIDATION",
    };
  }

  const { data: authz, error: authzError } = await supabase.rpc("authorize_commerce_product_media_upload", {
    p_product_id: productId,
    p_variant_id: variantId,
    p_alt_text: altText,
    p_is_primary: isPrimary,
    p_sort_order: sortOrder,
    p_idempotency_key: newKey(),
  });
  if (authzError) {
    const err = commerceErrorFromUnknown(authzError);
    return { success: false, message: err.message, code: err.code };
  }

  const payload = (authz ?? {}) as unknown as Record<string, unknown>;
  const mediaId = String(payload.media_id ?? "");
  const originalPath = String(payload.original_path ?? "");
  const publicPath = String(payload.public_path ?? "");
  if (!mediaId || !originalPath || !publicPath) {
    return { success: false, message: "Media authorization did not return storage paths.", code: "COMMERCE_VALIDATION" };
  }
  if (!isCommerceMediaPrefix(productId, mediaId, originalPath) || !isCommerceMediaPrefix(productId, mediaId, publicPath)) {
    return { success: false, message: "Media paths failed prefix checks.", code: "COMMERCE_VALIDATION" };
  }

  const { createAdminClient } = await import("@/lib/supabase/service-role");
  const admin = createAdminClient();

  try {
    const masterBuffer = await createSanitisedMaster(inputBuffer, validation.format);
    const derivative = await generateDerivative(masterBuffer, 1600, 82);
    if (derivative.fileSize > MAX_PUBLIC_DERIVATIVE_BYTES) {
      return {
        success: false,
        message: "Public derivative exceeds 8 MiB.",
        code: "COMMERCE_VALIDATION",
      };
    }

    const { error: originalUploadError } = await admin.storage
      .from(COMMERCE_ORIGINAL_BUCKET)
      .upload(originalPath, masterBuffer, {
        contentType: validation.mimeType,
        upsert: false,
      });
    if (originalUploadError) throw originalUploadError;

    const { error: publicUploadError } = await admin.storage.from(COMMERCE_PUBLIC_BUCKET).upload(publicPath, derivative.buffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (publicUploadError) throw publicUploadError;

    const { error: finalizeError } = await supabase.rpc("finalize_commerce_product_media", {
      p_media_id: mediaId,
      p_original_path: originalPath,
      p_public_path: publicPath,
      p_idempotency_key: newKey(),
    });
    if (finalizeError) throw finalizeError;

    revalidatePath("/admin/commerce/products");
    revalidatePath(`/admin/commerce/products/${productId}`);
    return { success: true, message: "Media uploaded.", data: { mediaId } };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
