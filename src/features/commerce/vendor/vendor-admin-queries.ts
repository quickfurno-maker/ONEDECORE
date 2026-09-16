import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/service-role";

export interface CommerceVendorAdminRow {
  readonly id: string;
  readonly vendorCode: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: string;
  readonly email: string | null;
  readonly createdAt: string;
}

export interface VendorReviewQueueRow {
  readonly id: string;
  readonly productReference: string;
  readonly name: string;
  readonly vendorId: string;
  readonly vendorCode: string;
  readonly vendorName: string;
  readonly submittedAt: string | null;
  readonly categoryId: string | null;
  readonly lockVersion: number;
}

export async function listCommerceVendorsAdmin(): Promise<readonly CommerceVendorAdminRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commerce_vendors")
    .select("id,vendor_code,user_id,display_name,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    vendor_code: string;
    user_id: string;
    display_name: string;
    status: string;
    created_at: string;
  }>;
  const admin = createAdminClient();
  const emails = new Map<string, string | null>();
  await Promise.all(rows.map(async (row) => {
    const result = await admin.auth.admin.getUserById(row.user_id);
    emails.set(row.user_id, result.data.user?.email ?? null);
  }));

  return rows.map((row) => ({
    id: row.id,
    vendorCode: row.vendor_code,
    userId: row.user_id,
    displayName: row.display_name,
    status: row.status,
    email: emails.get(row.user_id) ?? null,
    createdAt: row.created_at,
  }));
}

export async function listVendorReviewQueue(): Promise<readonly VendorReviewQueueRow[]> {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("commerce_products")
    .select("id,product_reference,name,vendor_id,submitted_at,category_id,lock_version")
    .eq("vendor_submission_status", "pending_review")
    .not("vendor_id", "is", null)
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  const productRows = (products ?? []) as unknown as Array<{
    id: string; product_reference: string; name: string; vendor_id: string;
    submitted_at: string | null; category_id: string | null; lock_version: number;
  }>;

  if (productRows.length === 0) return [];
  const vendorIds = [...new Set(productRows.map((row) => row.vendor_id))];
  const { data: vendors, error: vendorError } = await supabase
    .from("commerce_vendors")
    .select("id,vendor_code,display_name")
    .in("id", vendorIds);
  if (vendorError) throw vendorError;
  const vendorMap = new Map(
    ((vendors ?? []) as unknown as Array<{ id: string; vendor_code: string; display_name: string }>).map((row) => [row.id, row])
  );
  return productRows.map((row) => {
    const vendor = vendorMap.get(row.vendor_id);
    return {
      id: row.id,
      productReference: row.product_reference,
      name: row.name,
      vendorId: row.vendor_id,
      vendorCode: vendor?.vendor_code ?? "—",
      vendorName: vendor?.display_name ?? "Vendor",
      submittedAt: row.submitted_at,
      categoryId: row.category_id,
      lockVersion: row.lock_version,
    };
  });
}

export async function getVendorProductAdminMeta(productId: string): Promise<{
  readonly vendorId: string;
  readonly vendorCode: string;
  readonly vendorName: string;
  readonly submissionStatus: string;
  readonly reviewNote: string | null;
  readonly categoryId: string | null;
  readonly lockVersion: number;
} | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("commerce_products")
    .select("vendor_id,vendor_submission_status,review_note,category_id,lock_version")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  const row = product as unknown as {
    vendor_id: string | null; vendor_submission_status: string | null;
    review_note: string | null; category_id: string | null; lock_version: number;
  } | null;
  if (!row?.vendor_id || !row.vendor_submission_status) return null;
  const { data: vendor, error: vendorError } = await supabase
    .from("commerce_vendors")
    .select("vendor_code,display_name")
    .eq("id", row.vendor_id)
    .maybeSingle();
  if (vendorError) throw vendorError;
  const vendorRow = vendor as unknown as { vendor_code: string; display_name: string } | null;
  return {
    vendorId: row.vendor_id,
    vendorCode: vendorRow?.vendor_code ?? "—",
    vendorName: vendorRow?.display_name ?? "Vendor",
    submissionStatus: row.vendor_submission_status,
    reviewNote: row.review_note,
    categoryId: row.category_id,
    lockVersion: row.lock_version,
  };
}
