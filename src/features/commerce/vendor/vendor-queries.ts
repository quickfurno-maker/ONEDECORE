import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface VendorProductRow {
  readonly id: string;
  readonly product_reference: string;
  readonly name: string;
  readonly full_description: string;
  readonly status: string;
  readonly vendor_sales_enabled: boolean;
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

export interface VendorInventoryRow {
  readonly variant_id: string;
  readonly stock_on_hand: number;
  readonly reserved_qty: number;
  readonly available_qty: number;
}

export interface VendorProductSummary extends VendorProductRow {
  readonly variantId: string | null;
  readonly sku: string;
  readonly sellingPricePaise: number;
  readonly availabilityMode: string;
  readonly stockOnHand: number;
  readonly reservedQty: number;
  readonly availableQty: number;
  readonly imageCount: number;
  readonly primaryImagePath: string | null;
}

const productSelect = [
  "id",
  "product_reference",
  "name",
  "full_description",
  "status",
  "vendor_sales_enabled",
  "vendor_submission_status",
  "vendor_stock_status",
  "submitted_at",
  "review_note",
  "lock_version",
  "updated_at",
].join(", ");

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
  const [variantsRes, mediaRes, inventoryRes] = await Promise.all([
    supabase
      .from("commerce_product_variants")
      .select("id, product_id, sku, selling_price_paise, availability_mode")
      .in("product_id", ids),
    supabase
      .from("commerce_product_media")
      .select("id, product_id, public_path, is_primary, status")
      .in("product_id", ids)
      .eq("status", "active"),
    supabase
      .from("commerce_inventory")
      .select("variant_id, stock_on_hand, reserved_qty, available_qty"),
  ]);
  if (variantsRes.error) throw variantsRes.error;
  if (mediaRes.error) throw mediaRes.error;
  if (inventoryRes.error) throw inventoryRes.error;

  const variants = (variantsRes.data ?? []) as unknown as VendorVariantRow[];
  const media = (mediaRes.data ?? []) as unknown as VendorMediaRow[];
  const inventory = (inventoryRes.data ?? []) as unknown as VendorInventoryRow[];

  return rows.map((row) => {
    const variant = variants.find((item) => item.product_id === row.id);
    const stock = inventory.find((item) => item.variant_id === variant?.id);
    return {
      ...row,
      variantId: variant?.id ?? null,
      sku: variant?.sku ?? "—",
      sellingPricePaise: variant?.selling_price_paise ?? 0,
      availabilityMode: variant?.availability_mode ?? "ready_stock",
      stockOnHand: stock?.stock_on_hand ?? 0,
      reservedQty: stock?.reserved_qty ?? 0,
      availableQty: stock?.available_qty ?? 0,
      imageCount: media.filter((item) => item.product_id === row.id).length,
      primaryImagePath: media.find((item) => item.product_id === row.id && item.is_primary)?.public_path ?? media.find((item) => item.product_id === row.id)?.public_path ?? null,
    };
  });
}

export async function getMyVendorProduct(productId: string): Promise<{
  readonly product: VendorProductRow;
  readonly variant: VendorVariantRow;
  readonly media: readonly VendorMediaRow[];
  readonly inventory: VendorInventoryRow | null;
} | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("commerce_products")
    .select(productSelect)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;

  const [variantsRes, mediaRes, inventoryRes] = await Promise.all([
    supabase
      .from("commerce_product_variants")
      .select("id, product_id, sku, selling_price_paise, availability_mode")
      .eq("product_id", productId)
      .order("sort_order")
      .limit(1),
    supabase
      .from("commerce_product_media")
      .select("id, product_id, public_path, is_primary, status")
      .eq("product_id", productId)
      .eq("status", "active")
      .order("sort_order"),
    supabase
      .from("commerce_inventory")
      .select("variant_id, stock_on_hand, reserved_qty, available_qty"),
  ]);
  if (variantsRes.error) throw variantsRes.error;
  if (mediaRes.error) throw mediaRes.error;
  if (inventoryRes.error) throw inventoryRes.error;

  const variant = (variantsRes.data?.[0] ?? null) as unknown as VendorVariantRow | null;
  if (!variant) return null;
  const inventory = (inventoryRes.data ?? []) as unknown as VendorInventoryRow[];
  return {
    product: product as unknown as VendorProductRow,
    variant,
    media: (mediaRes.data ?? []) as unknown as VendorMediaRow[],
    inventory: inventory.find((row) => row.variant_id === variant.id) ?? null,
  };
}
