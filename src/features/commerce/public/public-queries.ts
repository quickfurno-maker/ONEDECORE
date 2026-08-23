import "server-only";
import { PublicCommerceReadError } from "./public-errors.ts";
import {
  parsePublicCategories,
  parsePublicPincode,
  parsePublicProductDetail,
  parsePublicProductPage,
  parsePublicSitemap,
} from "./public-parsers.ts";
import { createPublicCommerceAnonClient } from "./public-client.ts";
import type {
  PublicCommerceCategory,
  PublicCommercePincodeResult,
  PublicCommerceProductDetail,
  PublicCommerceProductPage,
  PublicCommerceSearchInput,
  PublicCommerceSitemap,
} from "./public-types.ts";

async function rpcOrThrow(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const client = createPublicCommerceAnonClient();
  const { data, error } = args
    ? await client.rpc(name, args)
    : await client.rpc(name);
  if (error) {
    throw new PublicCommerceReadError(name);
  }
  return data;
}

export async function queryPublicCategories(): Promise<PublicCommerceCategory[]> {
  const data = await rpcOrThrow("list_public_commerce_categories");
  return parsePublicCategories(data);
}

export async function queryPublicProducts(
  input: PublicCommerceSearchInput
): Promise<PublicCommerceProductPage> {
  const data = await rpcOrThrow("search_public_commerce_products", {
    p_category_slug: input.categorySlug,
    p_query: input.query,
    p_sort: input.sort,
    p_min_price_paise: input.minPricePaise,
    p_max_price_paise: input.maxPricePaise,
    p_availability_mode: input.availabilityMode,
    p_featured_only: input.featuredOnly,
    p_limit: input.limit,
    p_offset: input.offset,
  });
  return parsePublicProductPage(data);
}

export async function queryPublicProduct(
  slug: string
): Promise<PublicCommerceProductDetail | null> {
  const data = await rpcOrThrow("get_public_commerce_product", { p_slug: slug });
  return parsePublicProductDetail(data);
}

export async function queryPublicPincode(pincode: string): Promise<PublicCommercePincodeResult> {
  const data = await rpcOrThrow("check_public_commerce_pincode", { p_pincode: pincode });
  return parsePublicPincode(data);
}

export async function queryPublicCommerceSitemap(): Promise<PublicCommerceSitemap> {
  const data = await rpcOrThrow("list_public_commerce_sitemap");
  return parsePublicSitemap(data);
}
