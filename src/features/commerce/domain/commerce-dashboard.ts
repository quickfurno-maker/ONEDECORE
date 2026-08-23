import { isPublicationReady } from "./publication.ts";

export type CommerceAttentionKind = "catalog" | "inventory" | "pincodes" | "settings";

export interface CommerceDashboardCapabilities {
  readonly canManageCatalog: boolean;
  readonly canManageInventory: boolean;
  readonly canManageSettings: boolean;
}

export interface CommerceAttentionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly actionLabel: string;
  readonly actionKind: CommerceAttentionKind;
  readonly tone: "urgent" | "attention" | "info";
}

export interface CommerceKpiItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly context: string;
  readonly href: string;
  readonly accent: "purple" | "warning" | "blue" | "teal" | "positive" | "gold";
  readonly sparkline: readonly number[] | null;
}

export interface DashboardProductBase {
  readonly id: string;
  readonly product_reference: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly featured: boolean;
  readonly category_id: string;
  readonly updated_at: string;
}

export interface DashboardProduct extends DashboardProductBase {
  readonly tax_rate_id: string | null;
}

export interface DashboardCategory {
  readonly id: string;
  readonly name: string;
  readonly parent_category_id: string | null;
  readonly status: string;
  readonly seo_title: string | null;
  readonly seo_description: string | null;
  readonly sort_order: number;
}

export interface DashboardVariant {
  readonly id: string;
  readonly product_id: string;
  readonly sku: string;
  readonly status: string;
  readonly availability_mode: string;
  readonly selling_price_paise: number;
}

export interface DashboardInventory {
  readonly variant_id: string;
  readonly stock_on_hand: number;
  readonly reserved_qty: number;
  readonly available_qty: number;
}

export interface DashboardMedia {
  readonly product_id: string;
  readonly status: string;
  readonly is_primary: boolean;
  readonly public_path: string;
}

export interface DashboardTaxRate {
  readonly id: string;
  readonly is_active: boolean;
}

export interface DashboardPincode {
  readonly pincode: string;
  readonly serviceable: boolean;
  readonly zone_code: string | null;
  readonly updated_at: string;
}

export interface CommerceDashboardInput {
  readonly products: readonly DashboardProduct[];
  readonly categories: readonly DashboardCategory[];
  readonly variants: readonly DashboardVariant[];
  readonly media: readonly DashboardMedia[];
  readonly taxRates: readonly DashboardTaxRate[];
  readonly taxRequiredForPublish: boolean;
  readonly gstInclusiveDisplay: boolean;
  readonly shippingPresent: boolean;
  readonly pincodes: readonly DashboardPincode[];
  readonly inventory: readonly DashboardInventory[] | null;
  readonly inventoryStatus: "ok" | "unavailable" | "omitted";
}

export interface CatalogueHealth {
  readonly published: number;
  readonly draft: number;
  readonly archived: number;
  readonly needsAttention: number;
}

export interface InventoryByCategory {
  readonly name: string;
  readonly available: number;
}

export interface InventorySnapshot {
  readonly readyStockSkus: number;
  readonly madeToOrderSkus: number;
  readonly availableUnits: number;
  readonly reservedUnits: number;
  readonly zeroStock: number;
  readonly byRootCategory: readonly InventoryByCategory[];
}

export interface ReadinessCheck {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface StorefrontReadiness {
  readonly readyPublished: number;
  readonly needsAttentionProducts: number;
  readonly checks: readonly ReadinessCheck[];
}

export interface FeaturedPreview {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly startingPricePaise: number | null;
  readonly stockMode: string;
  readonly status: string;
  readonly hasPublicPrimary: boolean;
}

export interface CategoryDistributionRow {
  readonly id: string;
  readonly name: string;
  readonly published: number;
  readonly draft: number;
  readonly featured: number;
}

export interface DeliveryCoverage {
  readonly serviceable: number;
  readonly unserviceable: number;
  readonly groups: readonly { readonly label: string; readonly count: number }[];
  readonly lastUpdated: string | null;
}

export interface RecentProduct {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly updatedAt: string;
}

export interface CommerceDashboardSnapshot {
  readonly kpis: readonly CommerceKpiItem[];
  readonly health: CatalogueHealth;
  readonly attention: readonly CommerceAttentionItem[];
  readonly inventory: InventorySnapshot | null;
  readonly inventoryStatus: "ok" | "unavailable" | "omitted";
  readonly readiness: StorefrontReadiness;
  readonly featured: readonly FeaturedPreview[];
  readonly distribution: readonly CategoryDistributionRow[];
  readonly coverage: DeliveryCoverage;
  readonly recent: readonly RecentProduct[];
}

function availableFor(inventory: DashboardInventory | undefined): number {
  if (!inventory) return 0;
  return inventory.stock_on_hand - inventory.reserved_qty;
}

function rootIdFor(categoryId: string, byId: Map<string, DashboardCategory>): string {
  const row = byId.get(categoryId);
  if (!row) return categoryId;
  if (!row.parent_category_id) return row.id;
  return row.parent_category_id;
}

function hasActiveMedia(productId: string, media: readonly DashboardMedia[]): boolean {
  return media.some((item) => item.product_id === productId && item.status === "active");
}

function hasActivePrimaryPublic(productId: string, media: readonly DashboardMedia[]): boolean {
  return media.some(
    (item) =>
      item.product_id === productId &&
      item.status === "active" &&
      item.is_primary &&
      item.public_path !== ""
  );
}

function hasActivePricedVariant(productId: string, variants: readonly DashboardVariant[]): boolean {
  return variants.some(
    (variant) =>
      variant.product_id === productId &&
      variant.status === "active" &&
      Number.isInteger(variant.selling_price_paise) &&
      variant.selling_price_paise >= 0
  );
}

export function buildCommerceDashboardSnapshot(input: CommerceDashboardInput): CommerceDashboardSnapshot {
  const categoryById = new Map(input.categories.map((row) => [row.id, row]));
  const inventoryByVariant = new Map((input.inventory ?? []).map((row) => [row.variant_id, row]));
  const variantsByProduct = new Map<string, DashboardVariant[]>();
  for (const variant of input.variants) {
    const list = variantsByProduct.get(variant.product_id) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.product_id, list);
  }

  const published = input.products.filter((row) => row.status === "published");
  const draft = input.products.filter((row) => row.status === "draft");
  const archived = input.products.filter((row) => row.status === "archived");
  const featuredPublished = published.filter((row) => row.featured);
  const activeCategories = input.categories.filter((row) => row.status === "active");
  const activeRoots = activeCategories.filter((row) => row.parent_category_id === null);
  const readyStock = input.variants.filter(
    (row) => row.status === "active" && row.availability_mode === "ready_stock"
  );
  const madeToOrder = input.variants.filter(
    (row) => row.status === "active" && row.availability_mode === "made_to_order"
  );

  const attention: CommerceAttentionItem[] = [];
  const attentionProductIds = new Set<string>();

  const pushProduct = (
    product: DashboardProduct,
    detail: string,
    actionLabel: string,
    hash: string,
    tone: CommerceAttentionItem["tone"] = "attention"
  ) => {
    attentionProductIds.add(product.id);
    attention.push({
      id: `${product.id}:${hash}`,
      title: product.name,
      detail,
      href: `/admin/commerce/products/${product.id}${hash ? `#${hash}` : ""}`,
      actionLabel,
      actionKind: "catalog",
      tone,
    });
  };

  for (const product of input.products) {
    const category = categoryById.get(product.category_id) ?? null;
    const activeTax =
      product.tax_rate_id != null &&
      input.taxRates.some((rate) => rate.id === product.tax_rate_id && rate.is_active);
    const publicationReady = isPublicationReady({
      name: product.name,
      categoryStatus: category?.status ?? null,
      hasActivePricedVariant: hasActivePricedVariant(product.id, input.variants),
      taxRequiredForPublish: input.taxRequiredForPublish,
      hasActiveTaxRate: activeTax,
      hasActivePrimaryMedia: hasActivePrimaryPublic(product.id, input.media),
    });

    if (!hasActiveMedia(product.id, input.media)) {
      pushProduct(product, "No active product media", "Fix Media", "media");
    }
    if (!hasActivePricedVariant(product.id, input.variants)) {
      pushProduct(product, "No active priced variant", "Variants", "variants");
    }
    if (product.status === "published" && !hasActivePrimaryPublic(product.id, input.media)) {
      pushProduct(product, "No public product image", "Fix Media", "media", "urgent");
    }
    if (product.featured && product.status !== "published") {
      pushProduct(product, "Featured product is not published", "Publication", "overview");
    }
    if (product.status === "published" && input.taxRequiredForPublish && !activeTax) {
      pushProduct(product, "Published product is missing an active tax rate", "Overview", "overview", "urgent");
    }
    if (category && category.status !== "active") {
      pushProduct(product, `Category ${category.name} is inactive`, "Categories", "");
    }
    if (!publicationReady && product.status === "published") {
      pushProduct(product, "Publication readiness failed", "Review", "overview", "urgent");
    }
  }

  if (input.inventoryStatus === "ok") {
    for (const variant of readyStock) {
      const inv = inventoryByVariant.get(variant.id);
      const available = availableFor(inv);
      if (available <= 0) {
        const product = input.products.find((row) => row.id === variant.product_id);
        attention.push({
          id: `zero:${variant.id}`,
          title: variant.sku,
          detail: "Ready-stock variant has zero available units",
          href: product
            ? `/admin/commerce/products/${product.id}#inventory`
            : "/admin/commerce/products",
          actionLabel: "Inventory",
          actionKind: "inventory",
          tone: "urgent",
        });
        if (product) attentionProductIds.add(product.id);
      }
    }
  }

  if (input.pincodes.filter((row) => row.serviceable).length === 0) {
    attention.push({
      id: "pincodes",
      title: "Delivery coverage",
      detail: "No serviceable pincodes configured",
      href: "/admin/commerce/settings",
      actionLabel: "Manage Pincodes",
      actionKind: "pincodes",
      tone: "urgent",
    });
  }
  if (!input.shippingPresent) {
    attention.push({
      id: "shipping",
      title: "Shipping settings",
      detail: "Default shipping configuration is missing",
      href: "/admin/commerce/settings",
      actionLabel: "Settings",
      actionKind: "settings",
      tone: "attention",
    });
  }

  const cappedAttention = attention.slice(0, 12);
  const health: CatalogueHealth = {
    published: published.length,
    draft: draft.length,
    archived: archived.length,
    needsAttention: attentionProductIds.size,
  };

  let inventory: InventorySnapshot | null = null;
  if (input.inventoryStatus === "ok") {
    let availableUnits = 0;
    let reservedUnits = 0;
    let zeroStock = 0;
    const byRoot = new Map<string, number>();
    for (const variant of readyStock) {
      const inv = inventoryByVariant.get(variant.id);
      const available = availableFor(inv);
      const reserved = inv?.reserved_qty ?? 0;
      availableUnits += available;
      reservedUnits += reserved;
      if (available <= 0) zeroStock += 1;
      const product = input.products.find((row) => row.id === variant.product_id);
      if (product) {
        const root = rootIdFor(product.category_id, categoryById);
        const name = categoryById.get(root)?.name ?? "Uncategorised";
        byRoot.set(name, (byRoot.get(name) ?? 0) + available);
      }
    }
    inventory = {
      readyStockSkus: readyStock.length,
      madeToOrderSkus: madeToOrder.length,
      availableUnits,
      reservedUnits,
      zeroStock,
      byRootCategory: [...byRoot.entries()]
        .map(([name, available]) => ({ name, available }))
        .sort((a, b) => b.available - a.available)
        .slice(0, 8),
    };
  }

  const readyPublished = published.filter((product) => {
    const category = categoryById.get(product.category_id) ?? null;
    const activeTax =
      product.tax_rate_id != null &&
      input.taxRates.some((rate) => rate.id === product.tax_rate_id && rate.is_active);
    return isPublicationReady({
      name: product.name,
      categoryStatus: category?.status ?? null,
      hasActivePricedVariant: hasActivePricedVariant(product.id, input.variants),
      taxRequiredForPublish: input.taxRequiredForPublish,
      hasActiveTaxRate: activeTax,
      hasActivePrimaryMedia: hasActivePrimaryPublic(product.id, input.media),
    });
  }).length;

  const publishedWithActiveVariants = published.filter((product) =>
    hasActivePricedVariant(product.id, input.variants)
  ).length;
  const publishedWithPublicMedia = published.filter((product) =>
    hasActivePrimaryPublic(product.id, input.media)
  ).length;
  const serviceable = input.pincodes.filter((row) => row.serviceable).length;

  const readiness: StorefrontReadiness = {
    readyPublished,
    needsAttentionProducts: attentionProductIds.size,
    checks: [
      {
        label: "Published products with active variants",
        ok: published.length === 0 ? false : publishedWithActiveVariants === published.length,
        detail: `${publishedWithActiveVariants} of ${published.length} published`,
      },
      {
        label: "GST-inclusive price configured",
        ok: input.gstInclusiveDisplay,
        detail: input.gstInclusiveDisplay ? "Locked GST-inclusive display" : "Not locked",
      },
      {
        label: "Public media finalized",
        ok: published.length === 0 ? false : publishedWithPublicMedia === published.length,
        detail: `${publishedWithPublicMedia} of ${published.length} published`,
      },
      {
        label: "Pincode serviceability configured",
        ok: serviceable > 0,
        detail: `${serviceable} serviceable pincodes`,
      },
      {
        label: "Shipping settings present",
        ok: input.shippingPresent,
        detail: input.shippingPresent ? "Default shipping configured" : "Missing",
      },
      {
        label: "Active root categories",
        ok: activeRoots.length > 0,
        detail: `${activeRoots.length} active roots`,
      },
    ],
  };

  const featured: FeaturedPreview[] = featuredPublished.slice(0, 6).map((product) => {
    const variants = (variantsByProduct.get(product.id) ?? []).filter((row) => row.status === "active");
    const minPrice = variants.reduce<number | null>((acc, row) => {
      if (acc === null || row.selling_price_paise < acc) return row.selling_price_paise;
      return acc;
    }, null);
    const stockMode = variants.some((row) => row.availability_mode === "ready_stock")
      ? "Ready Stock"
      : variants.some((row) => row.availability_mode === "made_to_order")
        ? "Made to Order"
        : "—";
    return {
      id: product.id,
      name: product.name,
      categoryName: categoryById.get(product.category_id)?.name ?? "Uncategorised",
      startingPricePaise: minPrice,
      stockMode,
      status: product.status,
      hasPublicPrimary: hasActivePrimaryPublic(product.id, input.media),
    };
  });

  const distribution: CategoryDistributionRow[] = activeRoots
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((root) => {
      const ids = new Set(
        input.categories
          .filter((row) => row.id === root.id || row.parent_category_id === root.id)
          .map((row) => row.id)
      );
      const inTree = input.products.filter((row) => ids.has(row.category_id));
      return {
        id: root.id,
        name: root.name,
        published: inTree.filter((row) => row.status === "published").length,
        draft: inTree.filter((row) => row.status === "draft").length,
        featured: inTree.filter((row) => row.featured).length,
      };
    });

  const groupsMap = new Map<string, number>();
  for (const row of input.pincodes.filter((item) => item.serviceable)) {
    const label = row.zone_code?.trim() || "Ungrouped";
    groupsMap.set(label, (groupsMap.get(label) ?? 0) + 1);
  }
  const lastUpdated =
    input.pincodes.reduce<string | null>((acc, row) => {
      if (!acc || row.updated_at > acc) return row.updated_at;
      return acc;
    }, null);

  const coverage: DeliveryCoverage = {
    serviceable,
    unserviceable: input.pincodes.filter((row) => !row.serviceable).length,
    groups: [...groupsMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    lastUpdated,
  };

  const recent: RecentProduct[] = input.products
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      updatedAt: row.updated_at,
    }));

  const kpis: CommerceKpiItem[] = [
    {
      id: "published-products",
      label: "Published Products",
      value: String(published.length),
      context: "Visible catalogue products",
      href: "/admin/commerce/products?status=published",
      accent: "positive",
      sparkline: null,
    },
    {
      id: "draft-products",
      label: "Draft Products",
      value: String(draft.length),
      context: "Need publication review",
      href: "/admin/commerce/products?status=draft",
      accent: "warning",
      sparkline: null,
    },
    {
      id: "active-categories",
      label: "Active Categories",
      value: String(activeCategories.length),
      context: "Active catalogue nodes",
      href: "/admin/commerce/categories",
      accent: "teal",
      sparkline: null,
    },
    {
      id: "featured-products",
      label: "Featured Products",
      value: String(featuredPublished.length),
      context: "Published and featured",
      href: "/admin/commerce/products?featured=true&status=published",
      accent: "gold",
      sparkline: null,
    },
    {
      id: "ready-stock",
      label: "Ready-Stock Variants",
      value: String(readyStock.length),
      context: "Available for stock sale",
      href: "/admin/commerce/products?mode=ready_stock",
      accent: "blue",
      sparkline: null,
    },
    inventory
      ? {
          id: "zero-stock",
          label: "Zero Stock",
          value: String(inventory.zeroStock),
          context: "Ready-stock SKUs with no available units",
          href: "/admin/commerce/products?mode=ready_stock",
          accent: "warning",
          sparkline: null,
        }
      : {
          id: "made-to-order",
          label: "Made-to-Order Variants",
          value: String(madeToOrder.length),
          context: "Made-to-order SKUs",
          href: "/admin/commerce/products?mode=made_to_order",
          accent: "purple",
          sparkline: null,
        },
  ];

  return {
    kpis,
    health,
    attention: cappedAttention,
    inventory,
    inventoryStatus: input.inventoryStatus,
    readiness,
    featured,
    distribution,
    coverage,
    recent,
  };
}

export interface ProductWorkspaceRow {
  readonly id: string;
  readonly product_reference: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryName: string;
  readonly variantCount: number;
  readonly startingPricePaise: number | null;
  readonly modeLabel: string;
  readonly availableLabel: string;
  readonly featured: boolean;
  readonly status: string;
  readonly updatedAt: string;
  readonly hasPublicPrimary: boolean;
  readonly availabilityMode: "ready_stock" | "made_to_order" | "mixed" | "none";
}

export function buildProductWorkspaceRows(input: {
  readonly products: readonly DashboardProductBase[];
  readonly categories: readonly DashboardCategory[];
  readonly variants: readonly DashboardVariant[];
  readonly media: readonly DashboardMedia[];
  readonly inventory: readonly DashboardInventory[] | null;
}): readonly ProductWorkspaceRow[] {
  const categoryById = new Map(input.categories.map((row) => [row.id, row]));
  const inventoryByVariant = new Map((input.inventory ?? []).map((row) => [row.variant_id, row]));
  return input.products.map((product) => {
    const variants = input.variants.filter((row) => row.product_id === product.id && row.status === "active");
    const minPrice = variants.reduce<number | null>((acc, row) => {
      if (acc === null || row.selling_price_paise < acc) return row.selling_price_paise;
      return acc;
    }, null);
    const hasReady = variants.some((row) => row.availability_mode === "ready_stock");
    const hasMto = variants.some((row) => row.availability_mode === "made_to_order");
    const availabilityMode: ProductWorkspaceRow["availabilityMode"] = hasReady && hasMto
      ? "mixed"
      : hasReady
        ? "ready_stock"
        : hasMto
          ? "made_to_order"
          : "none";
    const modeLabel =
      availabilityMode === "ready_stock"
        ? "Ready Stock"
        : availabilityMode === "made_to_order"
          ? "Made to Order"
          : availabilityMode === "mixed"
            ? "Mixed"
            : "—";
    let availableLabel = "—";
    if (input.inventory && hasReady) {
      const units = variants
        .filter((row) => row.availability_mode === "ready_stock")
        .reduce((sum, row) => sum + availableFor(inventoryByVariant.get(row.id)), 0);
      availableLabel = String(units);
    } else if (hasMto && !hasReady) {
      availableLabel = "MTO";
    }
    return {
      id: product.id,
      product_reference: product.product_reference,
      name: product.name,
      slug: product.slug,
      categoryName: categoryById.get(product.category_id)?.name ?? "Uncategorised",
      variantCount: variants.length,
      startingPricePaise: minPrice,
      modeLabel,
      availableLabel,
      featured: product.featured,
      status: product.status,
      updatedAt: product.updated_at,
      hasPublicPrimary: hasActivePrimaryPublic(product.id, input.media),
      availabilityMode,
    };
  });
}

export function applyCommerceActionLabels(
  items: readonly CommerceAttentionItem[],
  capabilities: CommerceDashboardCapabilities
): readonly CommerceAttentionItem[] {
  return items.map((item) => {
    if (item.actionKind === "catalog") {
      return {
        ...item,
        actionLabel: capabilities.canManageCatalog ? item.actionLabel : "View Product",
      };
    }
    if (item.actionKind === "inventory") {
      return {
        ...item,
        actionLabel: capabilities.canManageInventory ? "Adjust Inventory" : "View Inventory",
      };
    }
    if (item.actionKind === "pincodes") {
      return {
        ...item,
        actionLabel: capabilities.canManageSettings ? "Manage Pincodes" : "View Pincodes",
      };
    }
    return {
      ...item,
      actionLabel: capabilities.canManageSettings ? "Manage Settings" : "View Settings",
    };
  });
}
