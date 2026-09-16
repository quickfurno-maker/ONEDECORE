import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSanitisedMaster,
  generateDerivative,
  validateImageMetadata,
} from "@/features/portfolio/server/portfolio-image-pipeline";
import {
  COMMERCE_ORIGINAL_BUCKET,
  COMMERCE_PUBLIC_BUCKET,
  isCommerceMediaPrefix,
} from "../server/commerce-media";
import { commerceErrorFromUnknown, type CommerceActionResult } from "../server/commerce-errors";

const MAX_PUBLIC_DERIVATIVE_BYTES = 8 * 1024 * 1024;

function newKey(): string {
  return crypto.randomUUID();
}

function refresh(productId: string): void {
  revalidatePath("/vendor");
  revalidatePath("/vendor/products");
  revalidatePath(`/vendor/products/${productId}`);
  revalidatePath("/admin/commerce/vendor-review");
}
export async function runVendorProductMediaUpload(
  formData: FormData
): Promise<CommerceActionResult<{ mediaId?: string }>> {
  const productId = String(formData.get("productId") ?? "").trim();
  const file = formData.get("file");
  if (!productId || !(file instanceof File)) {
    return { success: false, message: "Product and image file are required.", code: "COMMERCE_VALIDATION" };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageMetadata(inputBuffer, file.type);
  if (!validation.valid || !validation.format || !validation.mimeType) {
    return {
      success: false,
      message: validation.error ?? "Use a valid JPEG, PNG or WebP image under 20 MiB.",
      code: "COMMERCE_VALIDATION",
    };
  }

  const supabase = await createClient();
  const { data: authz, error: authzError } = await supabase.rpc(
    "authorize_my_vendor_product_media_upload",
    { p_product_id: productId, p_idempotency_key: newKey() }
  );
  if (authzError) {
    const err = commerceErrorFromUnknown(authzError);
    return { success: false, message: err.message, code: err.code };
  }

  const payload = (authz ?? {}) as Record<string, unknown>;
  const mediaId = String(payload.media_id ?? "");
  const originalPath = String(payload.original_path ?? "");
  const publicPath = String(payload.public_path ?? "");
  if (!mediaId || !originalPath || !publicPath) {
    return { success: false, message: "Image authorization failed.", code: "COMMERCE_VALIDATION" };
  }
  if (!isCommerceMediaPrefix(productId, mediaId, originalPath) || !isCommerceMediaPrefix(productId, mediaId, publicPath)) {
    return { success: false, message: "Image paths failed validation.", code: "COMMERCE_VALIDATION" };
  }

  const { createAdminClient } = await import("@/lib/supabase/service-role");
  const admin = createAdminClient();
  try {
    const masterBuffer = await createSanitisedMaster(inputBuffer, validation.format);
    const derivative = await generateDerivative(masterBuffer, 1600, 82);
    if (derivative.fileSize > MAX_PUBLIC_DERIVATIVE_BYTES) {
      return { success: false, message: "Processed image exceeds 8 MiB.", code: "COMMERCE_VALIDATION" };
    }

    const { error: originalError } = await admin.storage
      .from(COMMERCE_ORIGINAL_BUCKET)
      .upload(originalPath, masterBuffer, { contentType: validation.mimeType, upsert: false });
    if (originalError) throw originalError;

    const { error: publicError } = await admin.storage
      .from(COMMERCE_PUBLIC_BUCKET)
      .upload(publicPath, derivative.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (publicError) throw publicError;

    const { error: finalizeError } = await supabase.rpc("finalize_my_vendor_product_media", {
      p_media_id: mediaId,
      p_original_path: originalPath,
      p_public_path: publicPath,
      p_idempotency_key: newKey(),
    });
    if (finalizeError) throw finalizeError;

    refresh(productId);
    return { success: true, message: "Image uploaded.", data: { mediaId } };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
