import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isPublicationReady } from "../domain/publication";
import {
  assembleCommerceSettings,
  assertCommerceMaybeRow,
  assertCommerceReadList,
  readCommerceInventoryList,
  readCommerceProductRow,
} from "../domain/commerce-read";

type CommerceTable =
  | "commerce_categories"
  | "commerce_products"
  | "commerce_product_variants"
  | "commerce_inventory"
  | "commerce_product_media"
  | "commerce_product_specifications"
  | "commerce_related_products"
  | "commerce_tax_rates"
  | "commerce_tax_settings"
  | "commerce_shipping_settings"
  | "commerce_pincodes";

function fromCommerce(supabase: Awaited<ReturnType<typeof createClient>>, table: CommerceTable) {
  return supabase.from(table as never);
}

export interface CommerceCategoryRow {
  readonly id: string;
  readonly category_reference: string;
  readonly name: string;
  readonly slug: string;
  readonly parent_category_id: string | null;
  readonly short_description: string | null;
  readonly seo_title: string | null;
  readonly seo_description: string | null;
  readonly sort_order: number;
  readonly status: string;
  readonly shipping_charge_paise_override: number | null;
  readonly cod_allowed_override: boolean | null;
  readonly free_shipping_eligible_override: boolean | null;
}

export interface CommerceProductListItem {
  readonly id: string;
  readonly product_reference: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly featured: boolean;
  readonly category_id: string;
  readonly lock_version: number;
  readonly updated_at: string;
}

export interface CommerceVariantRow {
  readonly id: string;
  readonly product_id: string;
  readonly sku: string;
  readonly option_values: Record<string, string>;
  readonly display_name: string | null;
  readonly selling_price_paise: number;
  readonly compare_at_price_paise: number | null;
  readonly status: string;
  readonly availability_mode: string;
  readonly sort_order: number;
}

export interface CommerceInventoryRow {
  readonly variant_id: string;
  readonly stock_on_hand: number;
  readonly reserved_qty: number;
  readonly available_qty: number;
}

export interface CommerceMediaRow {
  readonly id: string;
  readonly product_id: string;
  readonly variant_id: string | null;
  readonly public_path: string;
  readonly original_path: string;
  readonly alt_text: string;
  readonly is_primary: boolean;
  readonly sort_order: number;
  readonly status: string;
}

export interface CommerceSpecRow {
  readonly id: string;
  readonly specification_key: string;
  readonly specification_value: string;
  readonly sort_order: number;
}

export interface CommerceTaxRateRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly rate_basis_points: number;
  readonly description: string | null;
  readonly is_active: boolean;
}

export interface CommerceTaxSettingsRow {
  readonly gst_inclusive_display: boolean;
  readonly tax_required_for_publish: boolean;
}

export interface CommerceShippingSettingsRow {
  readonly default_shipping_charge_paise: number;
  readonly free_shipping_threshold_paise: number | null;
  readonly cod_enabled_global: boolean;
  readonly assembly_install_note: string | null;
}

export interface CommercePincodeRow {
  readonly pincode: string;
  readonly serviceable: boolean;
  readonly zone_code: string | null;
  readonly eta_min_days: number;
  readonly eta_max_days: number;
  readonly updated_at: string;
}

export interface CommerceProductDetail {
  readonly product: {
    readonly id: string;
    readonly product_reference: string;
    readonly category_id: string;
    readonly name: string;
    readonly slug: string;
    readonly short_description: string | null;
    readonly full_description: string;
    readonly status: string;
    readonly tax_rate_id: string | null;
    readonly hsn_sac_code: string | null;
    readonly shipping_charge_paise_override: number | null;
    readonly cod_allowed_override: boolean | null;
    readonly free_shipping_eligible_override: boolean | null;
    readonly seo_title: string | null;
    readonly seo_description: string | null;
    readonly featured: boolean;
    readonly lock_version: number;
    readonly updated_at: string;
    readonly published_at: string | null;
  };
  readonly category: CommerceCategoryRow | null;
  readonly variants: readonly CommerceVariantRow[];
  readonly inventory: readonly CommerceInventoryRow[];
  readonly media: readonly CommerceMediaRow[];
  readonly specifications: readonly CommerceSpecRow[];
  readonly relatedProductIds: readonly string[];
  readonly relatedProducts: readonly CommerceProductListItem[];
  readonly taxRates: readonly CommerceTaxRateRow[];
  readonly taxSettings: CommerceTaxSettingsRow | null;
  readonly publicationReady: boolean;
}

export interface CommerceOverview {
  readonly categoryCount: number;
  readonly productCount: number;
  readonly draftCount: number;
  readonly publishedCount: number;
  readonly archivedCount: number;
  readonly variantCount: number;
  readonly taxRateCount: number;
  readonly pincodeCount: number;
  readonly taxRequiredForPublish: boolean;
  readonly gstInclusiveDisplay: boolean;
  readonly defaultShippingChargePaise: number;
  readonly inventoryReady: boolean;
  readonly settingsReady: boolean;
}

export async function listCommerceCategories(): Promise<readonly CommerceCategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await fromCommerce(supabase, "commerce_categories")
    .select(
      "id, category_reference, name, slug, parent_category_id, short_description, seo_title, seo_description, sort_order, status, shipping_charge_paise_override, cod_allowed_override, free_shipping_eligible_override"
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return assertCommerceReadList({ data, error }, "commerce_categories") as CommerceCategoryRow[];
}

export async function listRootCommerceCategories(): Promise<readonly CommerceCategoryRow[]> {
  const rows = await listCommerceCategories();
  return rows.filter((row) => row.parent_category_id === null);
}

export async function listCommerceProducts(filters?: {
  readonly q?: string;
  readonly status?: string;
}): Promise<readonly CommerceProductListItem[]> {
  const supabase = await createClient();
  let query = fromCommerce(supabase, "commerce_products").select(
    "id, product_reference, name, slug, status, featured, category_id, lock_version, updated_at"
  );
  const status = filters?.status?.trim();
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const q = filters?.q?.trim();
  if (q) {
    const safe = q.replace(/[%*,]/g, " ").slice(0, 120);
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%,product_reference.ilike.%${safe}%`);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  return assertCommerceReadList({ data, error }, "commerce_products") as CommerceProductListItem[];
}

export async function getCommerceProductDetail(productId: string): Promise<CommerceProductDetail | null> {
  return getCommerceProductDetailForWorkspace(productId);
}

export async function getCommerceProductDetailForWorkspace(
  productId: string
): Promise<CommerceProductDetail | null> {
  const supabase = await createClient();
  const productRes = await fromCommerce(supabase, "commerce_products")
    .select(
      "id, product_reference, category_id, name, slug, short_description, full_description, status, tax_rate_id, hsn_sac_code, shipping_charge_paise_override, cod_allowed_override, free_shipping_eligible_override, seo_title, seo_description, featured, lock_version, updated_at, published_at"
    )
    .eq("id", productId)
    .maybeSingle();
  const found = readCommerceProductRow(productRes, "commerce_products");
  if (found.status === "not_found") return null;
  const row = found.row as unknown as CommerceProductDetail["product"];

  const [categoryRes, variantsRes, mediaRes, specsRes, relatedRes, taxRatesRes, taxSettingsRes] = await Promise.all([
    fromCommerce(supabase, "commerce_categories")
      .select(
        "id, category_reference, name, slug, parent_category_id, short_description, seo_title, seo_description, sort_order, status, shipping_charge_paise_override, cod_allowed_override, free_shipping_eligible_override"
      )
      .eq("id", row.category_id)
      .maybeSingle(),
    fromCommerce(supabase, "commerce_product_variants")
      .select(
        "id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise, status, availability_mode, sort_order"
      )
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    fromCommerce(supabase, "commerce_product_media")
      .select("id, product_id, variant_id, public_path, original_path, alt_text, is_primary, sort_order, status")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    fromCommerce(supabase, "commerce_product_specifications")
      .select("id, specification_key, specification_value, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    fromCommerce(supabase, "commerce_related_products")
      .select("related_product_id, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    fromCommerce(supabase, "commerce_tax_rates").select("id, code, name, rate_basis_points, description, is_active"),
    fromCommerce(supabase, "commerce_tax_settings")
      .select("gst_inclusive_display, tax_required_for_publish")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const categoryRow = assertCommerceMaybeRow(categoryRes, "commerce_categories") as CommerceCategoryRow | null;
  const variantRows = assertCommerceReadList(variantsRes, "commerce_product_variants") as CommerceVariantRow[];
  const mediaRows = assertCommerceReadList(mediaRes, "commerce_product_media") as CommerceMediaRow[];
  const specRows = assertCommerceReadList(specsRes, "commerce_product_specifications") as CommerceSpecRow[];
  const relatedLinks = assertCommerceReadList(relatedRes, "commerce_related_products") as {
    related_product_id: string;
  }[];
  const taxRatesRows = assertCommerceReadList(taxRatesRes, "commerce_tax_rates") as CommerceTaxRateRow[];
  const taxSettingsRow = assertCommerceMaybeRow(taxSettingsRes, "commerce_tax_settings") as CommerceTaxSettingsRow | null;

  const variantIds = variantRows.map((item) => item.id);
  let inventoryRows: CommerceInventoryRow[] = [];
  if (variantIds.length) {
    const inventoryRes = await fromCommerce(supabase, "commerce_inventory")
      .select("variant_id, stock_on_hand, reserved_qty, available_qty")
      .in("variant_id", variantIds);
    inventoryRows = assertCommerceReadList(inventoryRes, "commerce_inventory") as CommerceInventoryRow[];
  }

  const relatedIds = relatedLinks.map((item) => item.related_product_id);
  let relatedProducts: CommerceProductListItem[] = [];
  if (relatedIds.length) {
    const relatedProductsRes = await fromCommerce(supabase, "commerce_products")
      .select("id, product_reference, name, slug, status, featured, category_id, lock_version, updated_at")
      .in("id", relatedIds);
    relatedProducts = assertCommerceReadList(relatedProductsRes, "commerce_products") as CommerceProductListItem[];
  }

  const hasActiveTaxRate =
    row.tax_rate_id != null && taxRatesRows.some((rate) => rate.id === row.tax_rate_id && rate.is_active);
  const hasActivePricedVariant = variantRows.some(
    (variant) => variant.status === "active" && Number.isInteger(variant.selling_price_paise) && variant.selling_price_paise >= 0
  );
  const hasActivePrimaryMedia = mediaRows.some(
    (item) => item.status === "active" && item.is_primary && item.public_path !== ""
  );

  return {
    product: row,
    category: categoryRow,
    variants: variantRows,
    inventory: inventoryRows,
    media: mediaRows,
    specifications: specRows,
    relatedProductIds: relatedIds,
    relatedProducts,
    taxRates: taxRatesRows,
    taxSettings: taxSettingsRow,
    publicationReady: isPublicationReady({
      name: row.name,
      categoryStatus: categoryRow?.status ?? null,
      hasActivePricedVariant,
      taxRequiredForPublish: taxSettingsRow?.tax_required_for_publish ?? true,
      hasActiveTaxRate,
      hasActivePrimaryMedia,
    }),
  };
}

export async function getCommerceSettings(): Promise<{
  readonly taxRates: readonly CommerceTaxRateRow[];
  readonly taxSettings: CommerceTaxSettingsRow | null;
  readonly shipping: CommerceShippingSettingsRow | null;
  readonly pincodes: readonly CommercePincodeRow[];
}> {
  const supabase = await createClient();
  const [taxRatesRes, taxSettingsRes, shippingRes, pincodesRes] = await Promise.all([
    fromCommerce(supabase, "commerce_tax_rates")
      .select("id, code, name, rate_basis_points, description, is_active")
      .order("code", { ascending: true }),
    fromCommerce(supabase, "commerce_tax_settings")
      .select("gst_inclusive_display, tax_required_for_publish")
      .eq("id", 1)
      .maybeSingle(),
    fromCommerce(supabase, "commerce_shipping_settings")
      .select("default_shipping_charge_paise, free_shipping_threshold_paise, cod_enabled_global, assembly_install_note")
      .eq("id", 1)
      .maybeSingle(),
    fromCommerce(supabase, "commerce_pincodes")
      .select("pincode, serviceable, zone_code, eta_min_days, eta_max_days, updated_at")
      .order("pincode", { ascending: true }),
  ]);
  const settings = assembleCommerceSettings({
    taxRates: taxRatesRes,
    taxSettings: taxSettingsRes,
    shipping: shippingRes,
    pincodes: pincodesRes,
  });
  return {
    taxRates: settings.taxRates as CommerceTaxRateRow[],
    taxSettings: settings.taxSettings as CommerceTaxSettingsRow | null,
    shipping: settings.shipping as CommerceShippingSettingsRow | null,
    pincodes: settings.pincodes as CommercePincodeRow[],
  };
}

export async function getCommerceOverview(): Promise<CommerceOverview> {
  const supabase = await createClient();
  const [
    { count: categoryCount },
    { data: products },
    { count: variantCount },
    { count: taxRateCount },
    { count: pincodeCount },
    { data: taxSettings },
    { data: shipping },
    { count: inventoryCount },
  ] = await Promise.all([
    fromCommerce(supabase, "commerce_categories").select("id", { count: "exact", head: true }),
    fromCommerce(supabase, "commerce_products").select("status"),
    fromCommerce(supabase, "commerce_product_variants").select("id", { count: "exact", head: true }),
    fromCommerce(supabase, "commerce_tax_rates").select("id", { count: "exact", head: true }),
    fromCommerce(supabase, "commerce_pincodes").select("pincode", { count: "exact", head: true }),
    fromCommerce(supabase, "commerce_tax_settings")
      .select("gst_inclusive_display, tax_required_for_publish")
      .eq("id", 1)
      .maybeSingle(),
    fromCommerce(supabase, "commerce_shipping_settings")
      .select("default_shipping_charge_paise")
      .eq("id", 1)
      .maybeSingle(),
    fromCommerce(supabase, "commerce_inventory").select("variant_id", { count: "exact", head: true }),
  ]);

  const productRows = (products ?? []) as { status: string }[];
  const tax = taxSettings as CommerceTaxSettingsRow | null;
  const ship = shipping as { default_shipping_charge_paise: number } | null;
  const settingsReady = Boolean(tax) && Boolean(ship);
  const inventoryReady = (inventoryCount ?? 0) >= 0;

  return {
    categoryCount: categoryCount ?? 0,
    productCount: productRows.length,
    draftCount: productRows.filter((row) => row.status === "draft").length,
    publishedCount: productRows.filter((row) => row.status === "published").length,
    archivedCount: productRows.filter((row) => row.status === "archived").length,
    variantCount: variantCount ?? 0,
    taxRateCount: taxRateCount ?? 0,
    pincodeCount: pincodeCount ?? 0,
    taxRequiredForPublish: tax?.tax_required_for_publish ?? true,
    gstInclusiveDisplay: tax?.gst_inclusive_display ?? true,
    defaultShippingChargePaise: ship?.default_shipping_charge_paise ?? 0,
    inventoryReady,
    settingsReady,
  };
}

export async function loadCommerceCatalogueGraph(options: {
  readonly includeInventory: boolean;
}): Promise<{
  readonly products: readonly {
    readonly id: string;
    readonly product_reference: string;
    readonly name: string;
    readonly slug: string;
    readonly status: string;
    readonly featured: boolean;
    readonly category_id: string;
    readonly tax_rate_id: string | null;
    readonly updated_at: string;
  }[];
  readonly categories: readonly CommerceCategoryRow[];
  readonly variants: readonly CommerceVariantRow[];
  readonly media: readonly Pick<
    CommerceMediaRow,
    "product_id" | "status" | "is_primary" | "public_path"
  >[];
  readonly inventory: readonly CommerceInventoryRow[] | null;
  readonly inventoryStatus: "ok" | "unavailable" | "omitted";
  readonly taxRates: readonly CommerceTaxRateRow[];
  readonly taxSettings: CommerceTaxSettingsRow | null;
  readonly shipping: CommerceShippingSettingsRow | null;
  readonly pincodes: readonly CommercePincodeRow[];
}> {
  const supabase = await createClient();
  const [productsRes, categoriesRes, variantsRes, mediaRes, taxRatesRes, taxSettingsRes, shippingRes, pincodesRes] =
    await Promise.all([
      fromCommerce(supabase, "commerce_products").select(
        "id, product_reference, name, slug, status, featured, category_id, tax_rate_id, updated_at"
      ),
      fromCommerce(supabase, "commerce_categories").select(
        "id, category_reference, name, slug, parent_category_id, short_description, seo_title, seo_description, sort_order, status, shipping_charge_paise_override, cod_allowed_override, free_shipping_eligible_override"
      ),
      fromCommerce(supabase, "commerce_product_variants").select(
        "id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise, status, availability_mode, sort_order"
      ),
      fromCommerce(supabase, "commerce_product_media").select("product_id, status, is_primary, public_path"),
      fromCommerce(supabase, "commerce_tax_rates").select("id, code, name, rate_basis_points, description, is_active"),
      fromCommerce(supabase, "commerce_tax_settings")
        .select("gst_inclusive_display, tax_required_for_publish")
        .eq("id", 1)
        .maybeSingle(),
      fromCommerce(supabase, "commerce_shipping_settings")
        .select("default_shipping_charge_paise, free_shipping_threshold_paise, cod_enabled_global, assembly_install_note")
        .eq("id", 1)
        .maybeSingle(),
      fromCommerce(supabase, "commerce_pincodes")
        .select("pincode, serviceable, zone_code, eta_min_days, eta_max_days, updated_at")
        .order("pincode", { ascending: true }),
    ]);

  const products = assertCommerceReadList(productsRes, "commerce_products") as {
    readonly id: string;
    readonly product_reference: string;
    readonly name: string;
    readonly slug: string;
    readonly status: string;
    readonly featured: boolean;
    readonly category_id: string;
    readonly tax_rate_id: string | null;
    readonly updated_at: string;
  }[];
  const categories = assertCommerceReadList(categoriesRes, "commerce_categories") as CommerceCategoryRow[];
  const variants = assertCommerceReadList(variantsRes, "commerce_product_variants") as CommerceVariantRow[];
  const media = assertCommerceReadList(mediaRes, "commerce_product_media") as Pick<
    CommerceMediaRow,
    "product_id" | "status" | "is_primary" | "public_path"
  >[];
  const taxRates = assertCommerceReadList(taxRatesRes, "commerce_tax_rates") as CommerceTaxRateRow[];
  const taxSettings = assertCommerceMaybeRow(taxSettingsRes, "commerce_tax_settings") as CommerceTaxSettingsRow | null;
  const shipping = assertCommerceMaybeRow(shippingRes, "commerce_shipping_settings") as CommerceShippingSettingsRow | null;
  const pincodes = assertCommerceReadList(pincodesRes, "commerce_pincodes") as CommercePincodeRow[];

  let inventory: CommerceInventoryRow[] | null = null;
  let inventoryStatus: "ok" | "unavailable" | "omitted" = "omitted";
  if (options.includeInventory) {
    const inventoryRes = await fromCommerce(supabase, "commerce_inventory").select(
      "variant_id, stock_on_hand, reserved_qty, available_qty"
    );
    const inventoryRead = readCommerceInventoryList(inventoryRes);
    if (inventoryRead.status === "unavailable") {
      inventoryStatus = "unavailable";
      inventory = null;
    } else {
      inventoryStatus = "ok";
      inventory = inventoryRead.rows as CommerceInventoryRow[];
    }
  }

  return {
    products,
    categories,
    variants,
    media,
    inventory,
    inventoryStatus,
    taxRates,
    taxSettings,
    shipping,
    pincodes,
  };
}

export async function listCommerceProductWorkspace(filters?: {
  readonly q?: string;
  readonly status?: string;
  readonly includeInventory?: boolean;
}): Promise<{
  readonly products: readonly CommerceProductListItem[];
  readonly categories: readonly CommerceCategoryRow[];
  readonly variants: readonly CommerceVariantRow[];
  readonly media: readonly Pick<CommerceMediaRow, "product_id" | "status" | "is_primary" | "public_path">[];
  readonly inventory: readonly CommerceInventoryRow[] | null;
  readonly inventoryStatus: "ok" | "unavailable" | "omitted";
}> {
  const supabase = await createClient();
  let productQuery = fromCommerce(supabase, "commerce_products").select(
    "id, product_reference, name, slug, status, featured, category_id, lock_version, updated_at"
  );
  const status = filters?.status?.trim();
  if (status && status !== "all") {
    productQuery = productQuery.eq("status", status);
  }
  const q = filters?.q?.trim();
  if (q) {
    const safe = q.replace(/[%*,]/g, " ").slice(0, 120);
    productQuery = productQuery.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%,product_reference.ilike.%${safe}%`);
  }

  const [productsRes, categoriesRes] = await Promise.all([
    productQuery.order("updated_at", { ascending: false }),
    fromCommerce(supabase, "commerce_categories").select(
      "id, category_reference, name, slug, parent_category_id, short_description, seo_title, seo_description, sort_order, status, shipping_charge_paise_override, cod_allowed_override, free_shipping_eligible_override"
    ),
  ]);
  const products = assertCommerceReadList(productsRes, "commerce_products") as CommerceProductListItem[];
  const categories = assertCommerceReadList(categoriesRes, "commerce_categories") as CommerceCategoryRow[];
  const ids = products.map((row) => row.id);
  if (ids.length === 0) {
    return {
      products,
      categories,
      variants: [],
      media: [],
      inventory: filters?.includeInventory === false ? null : [],
      inventoryStatus: filters?.includeInventory === false ? "omitted" : "ok",
    };
  }

  const [variantsRes, mediaRes] = await Promise.all([
    fromCommerce(supabase, "commerce_product_variants")
      .select(
        "id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise, status, availability_mode, sort_order"
      )
      .in("product_id", ids),
    fromCommerce(supabase, "commerce_product_media")
      .select("product_id, status, is_primary, public_path")
      .in("product_id", ids),
  ]);
  const variants = assertCommerceReadList(variantsRes, "commerce_product_variants") as CommerceVariantRow[];
  const media = assertCommerceReadList(mediaRes, "commerce_product_media") as Pick<
    CommerceMediaRow,
    "product_id" | "status" | "is_primary" | "public_path"
  >[];
  const variantIds = variants.map((row) => row.id);

  let inventory: CommerceInventoryRow[] | null = null;
  let inventoryStatus: "ok" | "unavailable" | "omitted" = "omitted";
  if (filters?.includeInventory === false) {
    return { products, categories, variants, media, inventory: null, inventoryStatus: "omitted" };
  }
  if (variantIds.length === 0) {
    return { products, categories, variants, media, inventory: [], inventoryStatus: "ok" };
  }
  const inventoryRes = await fromCommerce(supabase, "commerce_inventory")
    .select("variant_id, stock_on_hand, reserved_qty, available_qty")
    .in("variant_id", variantIds);
  const inventoryRead = readCommerceInventoryList(inventoryRes);
  if (inventoryRead.status === "unavailable") {
    inventoryStatus = "unavailable";
    inventory = null;
  } else {
    inventoryStatus = "ok";
    inventory = inventoryRead.rows as CommerceInventoryRow[];
  }
  return { products, categories, variants, media, inventory, inventoryStatus };
}
