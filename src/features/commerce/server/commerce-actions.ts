"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";
import { parsePaiseInteger, validateOptionValues } from "../domain/option-values";
import {
  CommerceActionError,
  commerceErrorFromUnknown,
  type CommerceActionResult,
} from "./commerce-errors";

function newKey(): string {
  return crypto.randomUUID();
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

function optionalText(formData: FormData, name: string): string | null {
  return emptyToNull(text(formData, name));
}

function optionalUuid(formData: FormData, name: string): string | null {
  return optionalText(formData, name);
}

function requiredText(formData: FormData, name: string): string {
  const value = text(formData, name);
  if (!value) throw new CommerceActionError("COMMERCE_VALIDATION", `${name} is required.`);
  return value;
}

function parseOptionalInt(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (raw === "") return null;
  const parsed = parsePaiseInteger(raw);
  if (parsed === null) {
    throw new CommerceActionError("COMMERCE_VALIDATION", `${name} must be a whole number.`);
  }
  return parsed;
}

function parseRequiredInt(formData: FormData, name: string): number {
  const value = parseOptionalInt(formData, name);
  if (value === null) throw new CommerceActionError("COMMERCE_VALIDATION", `${name} is required.`);
  return value;
}

function parseOptionalPaise(formData: FormData, name: string): number | null {
  const value = parseOptionalInt(formData, name);
  if (value !== null && value < 0) {
    throw new CommerceActionError("COMMERCE_VALIDATION", `${name} must be a non-negative integer in paise.`);
  }
  return value;
}

function parseRequiredPaise(formData: FormData, name: string): number {
  const value = parseOptionalPaise(formData, name);
  if (value === null) throw new CommerceActionError("COMMERCE_VALIDATION", `${name} is required.`);
  return value;
}

function parseNullableBoolean(formData: FormData, name: string): boolean | null {
  const raw = text(formData, name);
  if (raw === "") return null;
  if (raw === "true" || raw === "on" || raw === "1") return true;
  if (raw === "false" || raw === "off" || raw === "0") return false;
  throw new CommerceActionError("COMMERCE_VALIDATION", `${name} is invalid.`);
}

function parseCheckboxBoolean(formData: FormData, name: string): boolean {
  const raw = formData.get(name);
  return raw === "true" || raw === "on" || raw === "1";
}

function parseOptionValuesFromForm(formData: FormData): Record<string, string> {
  const jsonRaw = optionalText(formData, "optionValues");
  if (jsonRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonRaw) as unknown;
    } catch {
      throw new CommerceActionError("COMMERCE_VALIDATION", "option_values must be valid JSON.");
    }
    const error = validateOptionValues(parsed);
    if (error) throw new CommerceActionError("COMMERCE_VALIDATION", error);
    return parsed as Record<string, string>;
  }
  const obj: Record<string, string> = {};
  for (const key of ["color", "finish", "size", "upholstery"] as const) {
    const value = text(formData, key);
    if (value) obj[key] = value;
  }
  const error = validateOptionValues(obj);
  if (error) throw new CommerceActionError("COMMERCE_VALIDATION", error);
  return obj;
}

async function runRpc(
  name: string,
  args: Record<string, unknown>,
  paths: readonly string[],
  successMessage: string
): Promise<CommerceActionResult<Record<string, unknown>>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(name as never, args as never);
    if (error) throw error;
    for (const path of paths) revalidatePath(path);
    return {
      success: true,
      message: successMessage,
      data: (data ?? {}) as Record<string, unknown>,
    };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

async function guarded<T>(work: () => Promise<CommerceActionResult<T>>): Promise<CommerceActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

function productPaths(productId?: string | null): string[] {
  const paths = ["/admin/commerce", "/admin/commerce/products"];
  if (productId) paths.push(`/admin/commerce/products/${productId}`);
  return paths;
}

export async function upsertCommerceCategoryAction(
  formData: FormData
): Promise<CommerceActionResult<{ id?: string }>> {
  return guarded(() =>
    runRpc(
    "upsert_commerce_category",
    {
      p_id: optionalUuid(formData, "id"),
      p_name: requiredText(formData, "name"),
      p_slug: requiredText(formData, "slug").toLowerCase(),
      p_parent_id: optionalUuid(formData, "parentId"),
      p_short_description: optionalText(formData, "shortDescription"),
      p_seo_title: optionalText(formData, "seoTitle"),
      p_seo_description: optionalText(formData, "seoDescription"),
      p_sort_order: parseOptionalInt(formData, "sortOrder") ?? 0,
      p_shipping_charge_paise_override: parseOptionalPaise(formData, "shippingChargePaiseOverride"),
      p_cod_allowed_override: parseNullableBoolean(formData, "codAllowedOverride"),
      p_free_shipping_eligible_override: parseNullableBoolean(formData, "freeShippingEligibleOverride"),
      p_idempotency_key: newKey(),
    },
    ["/admin/commerce", "/admin/commerce/categories"],
    optionalUuid(formData, "id") ? "Category saved." : "Category created."
    )
  );
}

export async function setCommerceCategoryStatusAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() =>
    runRpc(
    "set_commerce_category_status",
    {
      p_id: requiredText(formData, "id"),
      p_status: requiredText(formData, "status"),
      p_idempotency_key: newKey(),
    },
    ["/admin/commerce", "/admin/commerce/categories"],
    "Category status updated."
    )
  );
}

export async function createCommerceProductAction(
  formData: FormData
): Promise<CommerceActionResult<{ productId?: string }>> {
  return guarded(async () => {
    const result = await runRpc(
      "create_commerce_product",
      {
        p_category_id: requiredText(formData, "categoryId"),
        p_name: requiredText(formData, "name"),
        p_slug: requiredText(formData, "slug").toLowerCase(),
        p_short_description: optionalText(formData, "shortDescription"),
        p_full_description: optionalText(formData, "fullDescription") ?? "",
        p_idempotency_key: newKey(),
      },
      ["/admin/commerce", "/admin/commerce/products"],
      "Product draft created."
    );
    const productId = typeof result.data?.id === "string" ? result.data.id : undefined;
    if (result.success && productId) {
      revalidatePath(`/admin/commerce/products/${productId}`);
      return { ...result, data: { productId } };
    }
    return result;
  });
}

export async function updateCommerceProductAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const id = requiredText(formData, "id");
    return runRpc(
      "update_commerce_product",
      {
        p_id: id,
        p_category_id: requiredText(formData, "categoryId"),
        p_name: requiredText(formData, "name"),
        p_slug: requiredText(formData, "slug").toLowerCase(),
        p_short_description: optionalText(formData, "shortDescription"),
        p_full_description: optionalText(formData, "fullDescription") ?? "",
        p_tax_rate_id: optionalUuid(formData, "taxRateId"),
        p_hsn_sac_code: optionalText(formData, "hsnSacCode"),
        p_shipping_charge_paise_override: parseOptionalPaise(formData, "shippingChargePaiseOverride"),
        p_cod_allowed_override: parseNullableBoolean(formData, "codAllowedOverride"),
        p_free_shipping_eligible_override: parseNullableBoolean(formData, "freeShippingEligibleOverride"),
        p_seo_title: optionalText(formData, "seoTitle"),
        p_seo_description: optionalText(formData, "seoDescription"),
        p_featured: parseCheckboxBoolean(formData, "featured"),
        p_expected_lock_version: parseRequiredInt(formData, "lockVersion"),
        p_idempotency_key: newKey(),
      },
      productPaths(id),
      "Product saved."
    );
  });
}

export async function publishCommerceProductAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const id = requiredText(formData, "id");
    return runRpc(
      "publish_commerce_product",
      {
        p_id: id,
        p_expected_lock_version: parseRequiredInt(formData, "lockVersion"),
        p_idempotency_key: newKey(),
      },
      productPaths(id),
      "Product published in catalogue. Public /shop remains disabled."
    );
  });
}

export async function archiveCommerceProductAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const id = requiredText(formData, "id");
    return runRpc(
      "archive_commerce_product",
      {
        p_id: id,
        p_expected_lock_version: parseRequiredInt(formData, "lockVersion"),
        p_idempotency_key: newKey(),
      },
      productPaths(id),
      "Product archived."
    );
  });
}

export async function upsertCommerceProductVariantAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = requiredText(formData, "productId");
    return runRpc(
      "upsert_commerce_product_variant",
      {
        p_id: optionalUuid(formData, "id"),
        p_product_id: productId,
        p_sku: requiredText(formData, "sku").toLowerCase(),
        p_option_values: parseOptionValuesFromForm(formData) as Json,
        p_display_name: optionalText(formData, "displayName"),
        p_selling_price_paise: parseRequiredPaise(formData, "sellingPricePaise"),
        p_compare_at_price_paise: parseOptionalPaise(formData, "compareAtPricePaise"),
        p_availability_mode: optionalText(formData, "availabilityMode") ?? "ready_stock",
        p_sort_order: parseOptionalInt(formData, "sortOrder") ?? 0,
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      optionalUuid(formData, "id") ? "Variant saved." : "Variant created."
    );
  });
}

export async function setCommerceVariantStatusAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = optionalUuid(formData, "productId");
    return runRpc(
      "set_commerce_variant_status",
      {
        p_id: requiredText(formData, "id"),
        p_status: requiredText(formData, "status"),
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      "Variant status updated."
    );
  });
}

export async function replaceCommerceProductSpecificationsAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = requiredText(formData, "productId");
    const raw = text(formData, "specs");
    let specs: unknown;
    try {
      specs = JSON.parse(raw || "[]") as unknown;
    } catch {
      return Promise.resolve({
        success: false,
        message: "Specifications must be a JSON array.",
        code: "COMMERCE_VALIDATION" as const,
      });
    }
    if (!Array.isArray(specs)) {
      return Promise.resolve({
        success: false,
        message: "Specifications must be a JSON array.",
        code: "COMMERCE_VALIDATION" as const,
      });
    }
    return runRpc(
      "replace_commerce_product_specifications",
      {
        p_product_id: productId,
        p_specs: specs as Json,
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      "Specifications saved."
    );
  });
}

export async function replaceCommerceRelatedProductsAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = requiredText(formData, "productId");
    const raw = text(formData, "relatedIds");
    const relatedIds = raw
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    return runRpc(
      "replace_commerce_related_products",
      {
        p_product_id: productId,
        p_related_ids: relatedIds,
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      "Related products saved."
    );
  });
}

export async function adjustCommerceInventoryAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = optionalUuid(formData, "productId");
    return runRpc(
      "adjust_commerce_inventory",
      {
        p_variant_id: requiredText(formData, "variantId"),
        p_delta: parseRequiredInt(formData, "delta"),
        p_reason: requiredText(formData, "reason"),
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      "Inventory adjusted."
    );
  });
}

export async function upsertCommerceTaxRateAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() =>
    runRpc(
      "upsert_commerce_tax_rate",
      {
        p_id: optionalUuid(formData, "id"),
        p_code: requiredText(formData, "code"),
        p_name: requiredText(formData, "name"),
        p_rate_basis_points: parseRequiredInt(formData, "rateBasisPoints"),
        p_description: optionalText(formData, "description"),
        p_is_active: parseNullableBoolean(formData, "isActive") ?? parseCheckboxBoolean(formData, "isActive"),
        p_idempotency_key: newKey(),
      },
      ["/admin/commerce", "/admin/commerce/settings"],
      "Tax rate saved."
    )
  );
}

export async function updateCommerceTaxSettingsAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() =>
    runRpc(
      "update_commerce_tax_settings",
      {
        p_tax_required_for_publish: parseCheckboxBoolean(formData, "taxRequiredForPublish"),
        p_idempotency_key: newKey(),
      },
      ["/admin/commerce", "/admin/commerce/settings"],
      "Tax settings saved."
    )
  );
}

export async function upsertCommercePincodeAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() =>
    runRpc(
      "upsert_commerce_pincode",
      {
        p_pincode: requiredText(formData, "pincode"),
        p_serviceable: parseCheckboxBoolean(formData, "serviceable"),
        p_zone_code: optionalText(formData, "zoneCode"),
        p_eta_min_days: parseOptionalInt(formData, "etaMinDays") ?? 0,
        p_eta_max_days: parseOptionalInt(formData, "etaMaxDays") ?? 0,
        p_idempotency_key: newKey(),
      },
      ["/admin/commerce", "/admin/commerce/settings"],
      "Pincode saved."
    )
  );
}

export async function updateCommerceShippingSettingsAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() =>
    runRpc(
      "update_commerce_shipping_settings",
      {
        p_default_shipping_charge_paise: parseRequiredPaise(formData, "defaultShippingChargePaise"),
        p_free_shipping_threshold_paise: parseOptionalPaise(formData, "freeShippingThresholdPaise"),
        p_cod_enabled_global: parseCheckboxBoolean(formData, "codEnabledGlobal"),
        p_assembly_install_note: optionalText(formData, "assemblyInstallNote"),
        p_idempotency_key: newKey(),
      },
      ["/admin/commerce", "/admin/commerce/settings"],
      "Shipping settings saved."
    )
  );
}

export async function archiveCommerceProductMediaAction(formData: FormData): Promise<CommerceActionResult> {
  return guarded(() => {
    const productId = optionalUuid(formData, "productId");
    return runRpc(
      "archive_commerce_product_media",
      {
        p_media_id: requiredText(formData, "mediaId"),
        p_idempotency_key: newKey(),
      },
      productPaths(productId),
      "Media archived."
    );
  });
}
