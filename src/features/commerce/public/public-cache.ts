import "server-only";
import { unstable_cache } from "next/cache";
import { normalizePublicSearchInput } from "./public-parsers.ts";
import {
  queryPublicCategories,
  queryPublicCommerceSitemap,
  queryPublicProduct,
  queryPublicProducts,
} from "./public-queries.ts";
import type { PublicCommerceSearchInput } from "./public-types.ts";

const REVALIDATE_SECONDS = 60;

export const getPublicCommerceCategories = unstable_cache(
  async () => queryPublicCategories(),
  ["public-commerce-categories"],
  { revalidate: REVALIDATE_SECONDS, tags: ["public-commerce"] }
);

export function getPublicCommerceProducts(input: PublicCommerceSearchInput) {
  const normalised = normalizePublicSearchInput(input);
  return unstable_cache(
    async () => queryPublicProducts(normalised),
    [
      "public-commerce-products",
      normalised.categorySlug ?? "",
      normalised.query ?? "",
      normalised.sort,
      String(normalised.minPricePaise ?? ""),
      String(normalised.maxPricePaise ?? ""),
      normalised.availabilityMode ?? "",
      String(normalised.featuredOnly),
      String(normalised.limit),
      String(normalised.offset),
    ],
    { revalidate: REVALIDATE_SECONDS, tags: ["public-commerce"] }
  )();
}

export function getPublicCommerceProduct(slug: string) {
  return unstable_cache(
    async () => queryPublicProduct(slug),
    ["public-commerce-product", slug],
    { revalidate: REVALIDATE_SECONDS, tags: ["public-commerce"] }
  )();
}

export const getPublicCommerceSitemap = unstable_cache(
  async () => queryPublicCommerceSitemap(),
  ["public-commerce-sitemap"],
  { revalidate: REVALIDATE_SECONDS, tags: ["public-commerce"] }
);
