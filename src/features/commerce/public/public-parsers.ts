import { COMMERCE_OPTION_KEYS } from "../domain/option-values.ts";
import { PublicCommerceParseError } from "./public-errors.ts";
import {
  PUBLIC_AVAILABILITY_MODES,
  PUBLIC_COMMERCE_SORTS,
  PUBLIC_PAGE_SIZE,
  PUBLIC_PAGE_SIZE_MAX,
  PUBLIC_SEARCH_QUERY_MAX,
  type PublicAvailabilityMode,
  type PublicCommerceCategory,
  type PublicCommercePincodeResult,
  type PublicCommerceProductCard,
  type PublicCommerceProductDetail,
  type PublicCommerceProductPage,
  type PublicCommerceSearchInput,
  type PublicCommerceSitemap,
  type PublicCommerceSort,
} from "./public-types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PublicCommerceParseError(context);
  }
  return value;
}

function optionalString(value: unknown, context: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new PublicCommerceParseError(context);
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requireInt(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new PublicCommerceParseError(context);
  }
  return value;
}

function optionalInt(value: unknown, context: string): number | null {
  if (value == null) return null;
  return requireInt(value, context);
}

function requireBool(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new PublicCommerceParseError(context);
  }
  return value;
}

const FORBIDDEN_KEYS = [
  "stock_on_hand",
  "reserved_qty",
  "available_qty",
  "created_by",
  "updated_by",
  "lock_version",
] as const;

function assertNoInternalKeys(value: unknown, context: string): void {
  const raw = JSON.stringify(value);
  for (const key of FORBIDDEN_KEYS) {
    if (raw.includes(`"${key}"`)) {
      throw new PublicCommerceParseError(`${context}:internal-field`);
    }
  }
}

export function parsePublicCategory(value: unknown): PublicCommerceCategory {
  if (!isRecord(value)) {
    throw new PublicCommerceParseError("category");
  }
  return {
    name: requireString(value.name, "category.name"),
    slug: requireString(value.slug, "category.slug"),
    shortDescription: optionalString(value.short_description, "category.short_description"),
    seoTitle: optionalString(value.seo_title, "category.seo_title"),
    seoDescription: optionalString(value.seo_description, "category.seo_description"),
    sortOrder: requireInt(value.sort_order, "category.sort_order"),
    parentSlug: optionalString(value.parent_slug, "category.parent_slug"),
    isRoot: requireBool(value.is_root, "category.is_root"),
  };
}

export function parsePublicCategories(value: unknown): PublicCommerceCategory[] {
  if (!Array.isArray(value)) {
    throw new PublicCommerceParseError("categories");
  }
  return value.map((row, index) => parsePublicCategory(row ?? { _i: index }));
}

function parseAvailabilitySummary(
  value: unknown,
  context: string
): PublicCommerceProductCard["availabilityMode"] {
  if (value == null) return null;
  if (value === "ready_stock" || value === "made_to_order" || value === "mixed") {
    return value;
  }
  throw new PublicCommerceParseError(context);
}

export function parsePublicProductCard(
  value: unknown,
  context = "card"
): PublicCommerceProductCard {
  if (!isRecord(value)) {
    throw new PublicCommerceParseError(context);
  }
  assertNoInternalKeys(value, context);
  const compare = optionalInt(value.compare_at_price_paise, `${context}.compare`);
  const starting = requireInt(value.starting_price_paise, `${context}.price`);
  return {
    productReference: requireString(value.product_reference, `${context}.ref`),
    name: requireString(value.name, `${context}.name`),
    slug: requireString(value.slug, `${context}.slug`),
    categoryName: requireString(value.category_name, `${context}.category_name`),
    categorySlug: requireString(value.category_slug, `${context}.category_slug`),
    shortDescription: optionalString(value.short_description, `${context}.short`),
    featured: requireBool(value.featured, `${context}.featured`),
    startingPricePaise: starting,
    compareAtPricePaise: compare != null && compare > starting ? compare : null,
    primaryImagePath: optionalString(value.primary_image_path, `${context}.image`),
    primaryImageAlt: optionalString(value.primary_image_alt, `${context}.alt`) ?? "",
    variantCount: requireInt(value.variant_count, `${context}.variants`),
    availabilityMode: parseAvailabilitySummary(value.availability_mode, `${context}.mode`),
    isAvailable: requireBool(value.is_available, `${context}.available`),
  };
}

export function parsePublicProductPage(value: unknown): PublicCommerceProductPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new PublicCommerceParseError("product-page");
  }
  assertNoInternalKeys(value, "product-page");
  return {
    items: value.items.map((item, index) => parsePublicProductCard(item, `item.${index}`)),
    total: requireInt(value.total, "product-page.total"),
  };
}

function parseOptionValues(value: unknown, context: string): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    throw new PublicCommerceParseError(context);
  }
  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!(COMMERCE_OPTION_KEYS as readonly string[]).includes(key)) {
      throw new PublicCommerceParseError(`${context}.key`);
    }
    if (typeof raw !== "string" || raw.trim() === "") {
      throw new PublicCommerceParseError(`${context}.value`);
    }
    next[key] = raw;
  }
  return next;
}

export function parsePublicProductDetail(value: unknown): PublicCommerceProductDetail | null {
  if (value == null) return null;
  if (!isRecord(value)) {
    throw new PublicCommerceParseError("detail");
  }
  assertNoInternalKeys(value, "detail");
  if (!isRecord(value.category) || !Array.isArray(value.variants) || !Array.isArray(value.media)) {
    throw new PublicCommerceParseError("detail.collections");
  }
  if (!Array.isArray(value.specifications) || !Array.isArray(value.related)) {
    throw new PublicCommerceParseError("detail.related");
  }
  if (value.gst_inclusive_display !== true) {
    throw new PublicCommerceParseError("detail.gst");
  }

  const variants = value.variants.map((row, index) => {
    if (!isRecord(row)) {
      throw new PublicCommerceParseError(`variant.${index}`);
    }
    const mode = row.availability_mode;
    if (mode !== "ready_stock" && mode !== "made_to_order") {
      throw new PublicCommerceParseError(`variant.${index}.mode`);
    }
    const availabilityMode: PublicAvailabilityMode = mode;
    const selling = requireInt(row.selling_price_paise, `variant.${index}.price`);
    const compare = optionalInt(row.compare_at_price_paise, `variant.${index}.compare`);
    return {
      sku: requireString(row.sku, `variant.${index}.sku`),
      displayName: optionalString(row.display_name, `variant.${index}.name`),
      optionValues: parseOptionValues(row.option_values, `variant.${index}.options`),
      sellingPricePaise: selling,
      compareAtPricePaise: compare != null && compare > selling ? compare : null,
      availabilityMode,
      isAvailable: requireBool(row.is_available, `variant.${index}.available`),
      sortOrder: requireInt(row.sort_order, `variant.${index}.sort`),
    };
  });

  return {
    productReference: requireString(value.product_reference, "detail.ref"),
    name: requireString(value.name, "detail.name"),
    slug: requireString(value.slug, "detail.slug"),
    shortDescription: optionalString(value.short_description, "detail.short"),
    fullDescription: typeof value.full_description === "string" ? value.full_description : "",
    seoTitle: optionalString(value.seo_title, "detail.seo_title"),
    seoDescription: optionalString(value.seo_description, "detail.seo_description"),
    hsnSacCode: optionalString(value.hsn_sac_code, "detail.hsn"),
    featured: requireBool(value.featured, "detail.featured"),
    gstInclusiveDisplay: true,
    category: {
      name: requireString(value.category.name, "detail.category.name"),
      slug: requireString(value.category.slug, "detail.category.slug"),
      parentSlug: optionalString(value.category.parent_slug, "detail.category.parent"),
    },
    variants,
    media: value.media.map((row, index) => {
      if (!isRecord(row)) {
        throw new PublicCommerceParseError(`media.${index}`);
      }
      return {
        publicPath: requireString(row.public_path, `media.${index}.path`),
        altText: optionalString(row.alt_text, `media.${index}.alt`) ?? "",
        isPrimary: requireBool(row.is_primary, `media.${index}.primary`),
        sortOrder: requireInt(row.sort_order, `media.${index}.sort`),
      };
    }),
    specifications: value.specifications.map((row, index) => {
      if (!isRecord(row)) {
        throw new PublicCommerceParseError(`spec.${index}`);
      }
      return {
        key: requireString(row.key, `spec.${index}.key`),
        value: requireString(row.value, `spec.${index}.value`),
        sortOrder: requireInt(row.sort_order, `spec.${index}.sort`),
      };
    }),
    related: value.related.map((row, index) => parsePublicProductCard(row, `related.${index}`)),
  };
}

export function parsePublicPincode(value: unknown): PublicCommercePincodeResult {
  if (!isRecord(value)) {
    throw new PublicCommerceParseError("pincode");
  }
  if ("zone_code" in value) {
    throw new PublicCommerceParseError("pincode.zone");
  }
  const serviceable = requireBool(value.serviceable, "pincode.serviceable");
  return {
    pincode: requireString(value.pincode, "pincode.value"),
    serviceable,
    etaMinDays: serviceable ? requireInt(value.eta_min_days, "pincode.eta_min") : null,
    etaMaxDays: serviceable ? requireInt(value.eta_max_days, "pincode.eta_max") : null,
    assemblyInstallNote: optionalString(value.assembly_install_note, "pincode.note"),
  };
}

export function parsePublicSitemap(value: unknown): PublicCommerceSitemap {
  if (!isRecord(value) || !Array.isArray(value.categories) || !Array.isArray(value.products)) {
    throw new PublicCommerceParseError("sitemap");
  }
  const mapEntries = (rows: unknown[], kind: string) =>
    rows.map((row, index) => {
      if (!isRecord(row)) {
        throw new PublicCommerceParseError(`${kind}.${index}`);
      }
      return {
        slug: requireString(row.slug, `${kind}.${index}.slug`),
        updatedAt: String(row.updated_at ?? ""),
      };
    });
  return {
    categories: mapEntries(value.categories, "sitemap.cat"),
    products: mapEntries(value.products, "sitemap.prod"),
  };
}

export function isPublicCommerceSort(value: string): value is PublicCommerceSort {
  return (PUBLIC_COMMERCE_SORTS as readonly string[]).includes(value);
}

export function isPublicAvailabilityMode(value: string): value is PublicAvailabilityMode {
  return (PUBLIC_AVAILABILITY_MODES as readonly string[]).includes(value);
}

export function boundPublicSearchQuery(raw: string | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, PUBLIC_SEARCH_QUERY_MAX);
}

export function boundPublicPage(limit: number | null, offset: number | null): {
  limit: number;
  offset: number;
} {
  const nextLimit = Math.min(Math.max(limit ?? PUBLIC_PAGE_SIZE, 1), PUBLIC_PAGE_SIZE_MAX);
  const nextOffset = Math.min(Math.max(offset ?? 0, 0), 10000);
  return { limit: nextLimit, offset: nextOffset };
}

export function normalizePublicSearchInput(
  input: Partial<PublicCommerceSearchInput>
): PublicCommerceSearchInput {
  const sort = input.sort ?? "featured";
  if (!isPublicCommerceSort(sort)) {
    throw new PublicCommerceParseError("search.sort");
  }
  const page = boundPublicPage(input.limit ?? null, input.offset ?? null);
  return {
    categorySlug: input.categorySlug ?? null,
    query: boundPublicSearchQuery(input.query ?? null),
    sort,
    minPricePaise: input.minPricePaise ?? null,
    maxPricePaise: input.maxPricePaise ?? null,
    availabilityMode: input.availabilityMode ?? null,
    featuredOnly: input.featuredOnly === true,
    limit: page.limit,
    offset: page.offset,
  };
}
