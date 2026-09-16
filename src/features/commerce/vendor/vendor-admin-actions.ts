"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/service-role";
import { commerceErrorFromUnknown, type CommerceActionResult } from "../server/commerce-errors";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function secret(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function requireConfirmedPassword(password: string, confirmation: string): void {
  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== confirmation ||
    password !== password.trim()
  ) {
    throw new Error("COMMERCE_VALIDATION");
  }
}

function key(): string {
  return crypto.randomUUID();
}

function refreshVendorAdmin(): void {
  revalidatePath("/admin/commerce/vendors");
  revalidatePath("/admin/commerce/vendor-review");
}

async function requireCatalogAuthority() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", { requested_permission: "commerce.catalog.manage" });
  if (error || data !== true) throw new Error("COMMERCE_UNAUTHORIZED");
  return supabase;
}

export async function createCommerceVendorAccountAction(
  formData: FormData
): Promise<CommerceActionResult<{ vendorCode?: string }>> {
  let createdUserId: string | null = null;
  try {
    const supabase = await requireCatalogAuthority();
    const displayName = text(formData, "displayName");
    const email = text(formData, "email").toLowerCase();
    const password = secret(formData, "password");
    const passwordConfirmation = secret(formData, "passwordConfirmation");
    requireConfirmedPassword(password, passwordConfirmation);
    if (displayName.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("COMMERCE_VALIDATION");
    }

    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: "commerce_vendor", display_name: displayName },
    });
    if (createError || !created.user?.id) throw createError ?? new Error("COMMERCE_VALIDATION");
    createdUserId = created.user.id;

    const { data, error } = await supabase.rpc("create_commerce_vendor", {
      p_user_id: createdUserId,
      p_display_name: displayName,
      p_idempotency_key: key(),
    });
    if (error) throw error;
    const payload = (data ?? {}) as Record<string, unknown>;
    const vendorCode = typeof payload.vendor_code === "string" ? payload.vendor_code : undefined;
    refreshVendorAdmin();
    return { success: true, message: "Vendor account created.", data: { vendorCode } };
  } catch (error) {
    if (createdUserId) {
      try {
        await createAdminClient().auth.admin.deleteUser(createdUserId);
      } catch {
        // Best-effort rollback only; never mask the original failure.
      }
    }
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function setCommerceVendorStatusAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const supabase = await requireCatalogAuthority();
    const vendorId = text(formData, "vendorId");
    const status = text(formData, "status");
    if (!vendorId || !["active", "suspended", "disabled"].includes(status)) throw new Error("COMMERCE_VALIDATION");
    const { error } = await supabase.rpc("set_commerce_vendor_status" as never, {
      p_vendor_id: vendorId,
      p_status: status,
      p_idempotency_key: key(),
    } as never);
    if (error) throw error;
    refreshVendorAdmin();
    return { success: true, message: `Vendor ${status}.` };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function resetCommerceVendorPasswordAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const supabase = await requireCatalogAuthority();
    const vendorId = text(formData, "vendorId");
    const password = secret(formData, "password");
    const passwordConfirmation = secret(formData, "passwordConfirmation");
    requireConfirmedPassword(password, passwordConfirmation);
    if (!vendorId) throw new Error("COMMERCE_VALIDATION");

    const { data: vendor, error } = await supabase
      .from("commerce_vendors")
      .select("user_id")
      .eq("id", vendorId)
      .maybeSingle();
    if (error || !vendor) throw error ?? new Error("COMMERCE_NOT_FOUND");
    const row = vendor as unknown as { user_id: string };
    const { error: resetError } = await createAdminClient().auth.admin.updateUserById(row.user_id, { password });
    if (resetError) throw resetError;
    refreshVendorAdmin();
    return { success: true, message: "Vendor password reset." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function reviewVendorCommerceProductAction(formData: FormData): Promise<CommerceActionResult> {
  try {
    const supabase = await requireCatalogAuthority();
    const productId = text(formData, "productId");
    const decision = text(formData, "decision");
    const note = text(formData, "note");
    const lockVersion = Number.parseInt(text(formData, "lockVersion"), 10);
    if (!productId || !Number.isInteger(lockVersion) || !["approve", "request_changes", "reject"].includes(decision)) {
      throw new Error("COMMERCE_VALIDATION");
    }
    const { error } = await supabase.rpc("review_vendor_commerce_product", {
      p_product_id: productId,
      p_decision: decision,
      p_note: note,
      p_expected_lock_version: lockVersion,
      p_idempotency_key: key(),
    });
    if (error) throw error;
    refreshVendorAdmin();
    revalidatePath(`/admin/commerce/products/${productId}`);
    return { success: true, message: decision === "approve" ? "Vendor product approved." : decision === "request_changes" ? "Changes requested." : "Vendor product rejected." };
  } catch (error) {
    const err = commerceErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
