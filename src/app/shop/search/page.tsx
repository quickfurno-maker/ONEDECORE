import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ShopFilters } from "@/features/commerce/public/components/ShopFilters";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceProducts } from "@/features/commerce/public/public-cache";
import { listingPageHref, parseShopListingParams } from "@/features/commerce/public/public-search-params";
import { PUBLIC_PAGE_SIZE, type PublicCommerceProductPage } from "@/features/commerce/public/public-types";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: `Search furniture — ${SITE_CONFIG.name}`,
  description: "Search published ONEDECORE furniture.",
  alternates: { canonical: absoluteUrl("shop/search") },
  robots: { index: false, follow: true },
};

export default async function ShopSearchPage({ searchParams }: PageProps) {
  // Fail closed before any catalogue read. The layout renders the inactive
  // boundary in place of these children while the gate is off.
  if (!isShopPublicEnabled()) {
    return null;
  }

  const query = parseShopListingParams(await searchParams);
  const path = "/shop/search";

  let page: PublicCommerceProductPage;
  try {
    page = await getPublicCommerceProducts(query);
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return (
        <main className="od-shop odc-listing">
          <header className="od-shop__hero odc-listing__head">
            <h1>Search furniture</h1>
          </header>
          <div className="odc-listing__body">
            <div className="od-shop__error" role="alert">
              Search is temporarily unavailable.
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  const currentPage = Math.floor(query.offset / PUBLIC_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(page.total / PUBLIC_PAGE_SIZE));

  return (
    <main className="od-shop odc-listing">
      <nav className="odc-crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/shop">Shop</Link>
          </li>
          <li aria-current="page">Search</li>
        </ol>
      </nav>

      <header className="od-shop__hero odc-listing__head">
        <h1>Search furniture</h1>
        {query.query ? <p className="od-shop__lede">Results for “{query.query}”.</p> : null}
      </header>

      <div className="odc-listing__body">
        <ShopFilters action={path} input={query} includeQuery resultCount={page.total} />
        {page.items.length === 0 ? (
          <p className="od-shop__empty">No published products match this search.</p>
        ) : (
          <div className="od-shop__grid">
            {page.items.map((card) => (
              <ShopProductCard key={card.slug} card={card} />
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <nav className="od-shop__pager" aria-label="Pagination">
            {currentPage > 1 ? (
              <Link href={listingPageHref(path, query, currentPage - 1)}>Previous</Link>
            ) : null}
            <span className="odc-pager__status">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={listingPageHref(path, query, currentPage + 1)}>Next</Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
