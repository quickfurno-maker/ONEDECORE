import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ShopFilters } from "@/features/commerce/public/components/ShopFilters";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceProducts } from "@/features/commerce/public/public-cache";
import { listingPageHref, parseShopListingParams } from "@/features/commerce/public/public-search-params";
import { PUBLIC_PAGE_SIZE, type PublicCommerceProductPage } from "@/features/commerce/public/public-types";

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
  const query = parseShopListingParams(await searchParams);
  const path = "/shop/search";

  let page: PublicCommerceProductPage;
  try {
    page = await getPublicCommerceProducts(query);
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return (
        <main className="od-shop">
          <div className="od-shop__error" role="alert">
            Search is temporarily unavailable.
          </div>
        </main>
      );
    }
    throw error;
  }

  const currentPage = Math.floor(query.offset / PUBLIC_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(page.total / PUBLIC_PAGE_SIZE));

  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">
          <Link href="/shop">Shop</Link>
        </p>
        <h1>Search furniture</h1>
        {query.query ? <p className="od-shop__lede">Results for “{query.query}”.</p> : null}
      </header>
      <ShopFilters action={path} input={query} includeQuery />
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
          {currentPage < totalPages ? (
            <Link href={listingPageHref(path, query, currentPage + 1)}>Next</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
