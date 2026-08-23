export const PUBLIC_COMMERCE_SORTS = [
  "featured",
  "newest",
  "price_low_high",
  "price_high_low",
] as const;

export type PublicCommerceSort = (typeof PUBLIC_COMMERCE_SORTS)[number];

export const PUBLIC_AVAILABILITY_MODES = ["ready_stock", "made_to_order"] as const;
export type PublicAvailabilityMode = (typeof PUBLIC_AVAILABILITY_MODES)[number];

export const PUBLIC_SEARCH_QUERY_MAX = 80;
export const PUBLIC_PAGE_SIZE = 12;
export const PUBLIC_PAGE_SIZE_MAX = 48;

export interface PublicCommerceCategory {
  readonly name: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly sortOrder: number;
  readonly parentSlug: string | null;
  readonly isRoot: boolean;
}

export interface PublicCommerceProductCard {
  readonly productReference: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryName: string;
  readonly categorySlug: string;
  readonly shortDescription: string | null;
  readonly featured: boolean;
  readonly startingPricePaise: number;
  readonly compareAtPricePaise: number | null;
  readonly primaryImagePath: string | null;
  readonly primaryImageAlt: string;
  readonly variantCount: number;
  readonly availabilityMode: "ready_stock" | "made_to_order" | "mixed" | null;
  readonly isAvailable: boolean;
}

export interface PublicCommerceProductPage {
  readonly items: readonly PublicCommerceProductCard[];
  readonly total: number;
}

export interface PublicCommerceVariant {
  readonly sku: string;
  readonly displayName: string | null;
  readonly optionValues: Readonly<Record<string, string>>;
  readonly sellingPricePaise: number;
  readonly compareAtPricePaise: number | null;
  readonly availabilityMode: PublicAvailabilityMode;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
}

export interface PublicCommerceMedia {
  readonly publicPath: string;
  readonly altText: string;
  readonly isPrimary: boolean;
  readonly sortOrder: number;
}

export interface PublicCommerceSpecification {
  readonly key: string;
  readonly value: string;
  readonly sortOrder: number;
}

export interface PublicCommerceProductDetail {
  readonly productReference: string;
  readonly name: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly fullDescription: string;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly hsnSacCode: string | null;
  readonly featured: boolean;
  readonly gstInclusiveDisplay: true;
  readonly category: {
    readonly name: string;
    readonly slug: string;
    readonly parentSlug: string | null;
  };
  readonly variants: readonly PublicCommerceVariant[];
  readonly media: readonly PublicCommerceMedia[];
  readonly specifications: readonly PublicCommerceSpecification[];
  readonly related: readonly PublicCommerceProductCard[];
}

export interface PublicCommercePincodeResult {
  readonly pincode: string;
  readonly serviceable: boolean;
  readonly etaMinDays: number | null;
  readonly etaMaxDays: number | null;
  readonly assemblyInstallNote: string | null;
}

export interface PublicCommerceSitemap {
  readonly categories: readonly { readonly slug: string; readonly updatedAt: string }[];
  readonly products: readonly { readonly slug: string; readonly updatedAt: string }[];
}

export interface PublicCommerceSearchInput {
  readonly categorySlug: string | null;
  readonly query: string | null;
  readonly sort: PublicCommerceSort;
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
  readonly availabilityMode: PublicAvailabilityMode | null;
  readonly featuredOnly: boolean;
  readonly limit: number;
  readonly offset: number;
}
