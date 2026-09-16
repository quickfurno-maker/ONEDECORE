"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commerceErrorFromUnknown, type CommerceActionResult } from "../server/commerce-errors";
import { runVendorProductMediaUpload } from "./vendor-media";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function newKey(): string {
  return crypto.randomUUID();
}

function parseRupeesToPaise(raw: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const [rupees, paise = ""] = raw.split(".");
  const value = Number.parseInt(rupees, 10) * 100 + Number.parseInt(paise.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeSku(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function refreshVendor(productId?: string): void {
  revalidatePath("/vendor");
  revalidatePath("/vendor/products");
  if (productId) revalidatePath(`/vendor/products/${productId}`);
  revalidatePath("/admin/commerce/products");
  if (productId) revalidatePath(`/admin/commerce/products/${productId}`);
}
function readBasicProduct(formData: FormData): {
  name: string;
  description: string;
  sku: string;
  sellingPricePaise: number;
  stockStatus: string;
} {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const sku = normalizeSku(text(formData, "sku"));
  const sellingPricePaise = parseRupeesToPaise(text(formData, "sellingPriceRupees"));
  const stockStatus = text(formData, "stockStatus");
  if (name.length < 2 || description.length < 2 || sku.length < 2 || sellingPricePaise === null) {
    throw new Error("COMMERCE_VALIDATION");
  }
  if (!["in_stock", "made_to_order", "out_of_stock"].includes(stockStatus)) {
    throw new Error("COMMERCE_VALIDATION");
  }
  return { name, description, sku, sellingPricePaise, stockStatus };
}

export async function createVendorProductAction(
  formData: FormData
): Promise<CommerceActionResult<{ productId?: string }>> {
  try {
    const product = readBasicProduct(formData);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_my_vendor_commerce_product", {
      p_name: product.name,
      p_description: product.description,
      p_sku: product.sku,
      p_selling_price_paise: product.sellingPricePaise,
      p_stock_status: product.stockStatus,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    const payload = (data ?? {}) as Record<string, unknown>;
    const productId = typeof payload.product_id === "string" ? payload.product_id : undefined;
    if (!productId) throw new Error("COMMERCE_VALIDATION");
    refreshVendor(productId);
    return { success: true, message: "Product draft created.", data: { productId } };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function updateVendorProductAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const product = readBasicProduct(formData);
    const productId = text(formData, "productId");
    const lockVersion = Number.parseInt(text(formData, "lockVersion"), 10);
    if (!productId || !Number.isInteger(lockVersion)) throw new Error("COMMERCE_VALIDATION");
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_my_vendor_commerce_product", {
      p_product_id: productId,
      p_name: product.name,
      p_description: product.description,
      p_sku: product.sku,
      p_selling_price_paise: product.sellingPricePaise,
      p_stock_status: product.stockStatus,
      p_expected_lock_version: lockVersion,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    refreshVendor(productId);
    return { success: true, message: "Product saved." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function submitVendorProductAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const productId = text(formData, "productId");
    const lockVersion = Number.parseInt(text(formData, "lockVersion"), 10);
    if (!productId || !Number.isInteger(lockVersion)) throw new Error("COMMERCE_VALIDATION");
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_my_vendor_commerce_product", {
      p_product_id: productId,
      p_expected_lock_version: lockVersion,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    refreshVendor(productId);
    return { success: true, message: "Submitted for OneDecore review." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function archiveVendorProductMediaAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const mediaId = text(formData, "mediaId");
    const productId = text(formData, "productId");
    if (!mediaId || !productId) throw new Error("COMMERCE_VALIDATION");
    const supabase = await createClient();
    const { error } = await supabase.rpc("archive_my_vendor_product_media", {
      p_media_id: mediaId,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    refreshVendor(productId);
    return { success: true, message: "Image removed." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function uploadVendorProductMediaAction(
  formData: FormData
): Promise<CommerceActionResult<{ mediaId?: string }>> {
  return runVendorProductMediaUpload(formData);
}

export async function setVendorProductSalesStateAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const productId = text(formData, "productId");
    const enabled = text(formData, "enabled") === "true";
    const stockStatus = text(formData, "stockStatus");
    if (!productId || !["in_stock", "made_to_order", "out_of_stock"].includes(stockStatus)) {
      throw new Error("COMMERCE_VALIDATION");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_my_vendor_product_sales_state" as never, {
      p_product_id: productId,
      p_enabled: enabled,
      p_stock_status: stockStatus,
      p_idempotency_key: newKey(),
    } as never);
    if (error) throw error;
    refreshVendor(productId);
    return { success: true, message: enabled ? "Product sales enabled." : "Product sales paused." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function setVendorInventoryQuantityAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const productId = text(formData, "productId");
    const variantId = text(formData, "variantId");
    const stockOnHand = Number.parseInt(text(formData, "stockOnHand"), 10);
    if (!productId || !variantId || !Number.isInteger(stockOnHand) || stockOnHand < 0 || stockOnHand > 1000000) {
      throw new Error("COMMERCE_VALIDATION");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_my_vendor_inventory_quantity" as never, {
      p_variant_id: variantId,
      p_stock_on_hand: stockOnHand,
      p_idempotency_key: newKey(),
    } as never);
    if (error) throw error;
    refreshVendor(productId);
    return { success: true, message: "Stock quantity updated." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
