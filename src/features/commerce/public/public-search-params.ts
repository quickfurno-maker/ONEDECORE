import {
  boundPublicPage,
  boundPublicSearchQuery,
  isPublicAvailabilityMode,
  isPublicCommerceSort,
} from "./public-parsers.ts";
import { PUBLIC_PAGE_SIZE, type PublicCommerceSearchInput } from "./public-types.ts";

export function parseShopListingParams(
  searchParams: Record<string, string | string[] | undefined>,
  categorySlug?: string
): PublicCommerceSearchInput {
  const raw = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const sortRaw = raw("sort") ?? "featured";
  const sort = isPublicCommerceSort(sortRaw) ? sortRaw : "featured";
  const availabilityRaw = raw("availability");
  const availabilityMode =
    availabilityRaw && isPublicAvailabilityMode(availabilityRaw) ? availabilityRaw : null;
  const pageRaw = Number.parseInt(raw("page") ?? "1", 10);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const { limit, offset } = boundPublicPage(PUBLIC_PAGE_SIZE, (page - 1) * PUBLIC_PAGE_SIZE);

  const minRupees = Number.parseInt(raw("min") ?? "", 10);
  const maxRupees = Number.parseInt(raw("max") ?? "", 10);

  return {
    categorySlug: categorySlug ?? null,
    query: boundPublicSearchQuery(raw("q") ?? null),
    sort,
    minPricePaise: Number.isInteger(minRupees) && minRupees >= 0 ? minRupees * 100 : null,
    maxPricePaise: Number.isInteger(maxRupees) && maxRupees >= 0 ? maxRupees * 100 : null,
    availabilityMode,
    featuredOnly: false,
    limit,
    offset,
  };
}

export function listingPageHref(
  path: string,
  input: PublicCommerceSearchInput,
  page: number
): string {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.sort !== "featured") params.set("sort", input.sort);
  if (input.availabilityMode) params.set("availability", input.availabilityMode);
  if (input.minPricePaise != null) params.set("min", String(input.minPricePaise / 100));
  if (input.maxPricePaise != null) params.set("max", String(input.maxPricePaise / 100));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
