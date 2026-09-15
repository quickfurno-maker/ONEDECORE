import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface VendorProductRow {
  readonly id: string;
  readonly product_reference: string;
  readonly name: string;
  readonly full_description: string;
  readonly vendor_submission_status: string;
  readonly vendor_stock_status: string;
  readonly submitted_at: string | null;
  readonly review_note: string | null;
  readonly lock_version: number;
  readonly updated_at: string;
}

export interface VendorVariantRow {
  readonly id: string;
  readonly product_id: string;
  readonly sku: string;
  readonly selling_price_paise: number;
  readonly availability_mode: string;
}

export interface VendorMediaRow {
  readonly id: string;
  readonly product_id: string;
  readonly public_path: string;
  readonly is_primary: boolean;
  readonly status: string;
}
export interface VendorProductSummary extends VendorProductRow {
  readonly sku: string;
  readonly sellingPricePaise: number;
  readonly imageCount: number;
}

const productSelect =
  "id, product_reference, name, full_description, vendor_submission_status, vendor_stock_status, submitted_at, review_note, lock_version, updated_at";

export async function listMyVendorProducts(): Promise<readonly VendorProductSummary[]> {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("commerce_products")
    .select(productSelect)
    .not("vendor_id", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (products ?? []) as unknown as VendorProductRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [{ data: variants, error: variantError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("commerce_product_variants").select("id, product_id, sku, selling_price_paise, availability_mode").in("product_id", ids),
    supabase.from("commerce_product_media").select("id, product_id, public_path, is_primary, status").in("product_id", ids).eq("status", "active"),
  ]);
  if (variantError) throw variantError;
  if (mediaError) throw mediaError;
  const variantRows = (variants ?? []) as unknown as VendorVariantRow[];
  const mediaRows = (media ?? []) as unknown as VendorMediaRow[];
  return rows.map((row) => {
    const variant = variantRows.find((item) => item.product_id === row.id);
    return {
      ...row,
      sku: variant?.sku ?? "—",
      sellingPricePaise: variant?.selling_price_paise ?? 0,
      imageCount: mediaRows.filter((item) => item.product_id === row.id).length,
    };
  });
}

export async function getMyVendorProduct(productId: string): Promise<{
  readonly product: VendorProductRow;
  readonly variant: VendorVariantRow;
  readonly media: readonly VendorMediaRow[];
} | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase.from("commerce_products").select(productSelect).eq("id", productId).maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const [{ data: variants, error: variantError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("commerce_product_variants").select("id, product_id, sku, selling_price_paise, availability_mode").eq("product_id", productId).order("sort_order").limit(1),
    supabase.from("commerce_product_media").select("id, product_id, public_path, is_primary, status").eq("product_id", productId).eq("status", "active").order("sort_order"),
  ]);
  if (variantError) throw variantError;
  if (mediaError) throw mediaError;
  const variant = (variants?.[0] ?? null) as unknown as VendorVariantRow | null;
  if (!variant) return null;
  return {
    product: product as unknown as VendorProductRow,
    variant,
    media: (media ?? []) as unknown as VendorMediaRow[],
  };
}

export function vendorStatusLabel(status: string): string {
  if (status === "pending_review") return "Under Review";
  if (status === "changes_requested") return "Changes Requested";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Draft";
}
