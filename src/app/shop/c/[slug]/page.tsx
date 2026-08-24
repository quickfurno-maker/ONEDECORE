import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ShopFilters } from "@/features/commerce/public/components/ShopFilters";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceCategories, getPublicCommerceProducts } from "@/features/commerce/public/public-cache";
import { listingPageHref, parseShopListingParams } from "@/features/commerce/public/public-search-params";
import {
  PUBLIC_PAGE_SIZE,
  type PublicCommerceCategory,
  type PublicCommerceProductPage,
  type PublicCommerceSearchInput,
} from "@/features/commerce/public/public-types";
import { shopListingHasQueryDuplicates, shopOpenGraph } from "@/features/commerce/public/shop-seo";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  if (!isShopPublicEnabled()) {
    return {
      title: "Furniture shop — ONEDECORE",
      robots: { index: false, follow: false },
    };
  }
  const { slug } = await params;
  const filtered = shopListingHasQueryDuplicates(await searchParams);
  try {
    const categories = await getPublicCommerceCategories();
    const category = categories.find((row) => row.slug === slug);
    if (!category) {
      return { title: `Shop — ${SITE_CONFIG.name}`, robots: { index: false, follow: true } };
    }
    const title = category.seoTitle ?? `${category.name} — ${SITE_CONFIG.name}`;
    const description =
      category.seoDescription ?? category.shortDescription ?? `Browse ${category.name} at ONEDECORE.`;
    const url = absoluteUrl(`shop/c/${category.slug}`);
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
      openGraph: shopOpenGraph({ title, description, url }),
    };
  } catch {
    return { title: `Shop — ${SITE_CONFIG.name}`, robots: { index: false, follow: true } };
  }
}

async function loadCategory(
  slug: string,
  query: PublicCommerceSearchInput
): Promise<
  | {
      ok: true;
      category: PublicCommerceCategory;
      page: PublicCommerceProductPage;
      parentName: string | null;
    }
  | { ok: false }
> {
  try {
    const [categories, page] = await Promise.all([
      getPublicCommerceCategories(),
      getPublicCommerceProducts(query),
    ]);
    const category = categories.find((row) => row.slug === slug);
    if (!category) {
      notFound();
    }
    const parentName = category.parentSlug
      ? (categories.find((row) => row.slug === category.parentSlug)?.name ?? category.parentSlug)
      : null;
    return { ok: true, category, page, parentName };
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return { ok: false };
    }
    throw error;
  }
}

export default async function ShopCategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = parseShopListingParams(await searchParams, slug);
  const loaded = await loadCategory(slug, query);
  if (!loaded.ok) {
    return (
      <main className="od-shop">
        <div className="od-shop__error" role="alert">
          This category could not be loaded right now.
        </div>
      </main>
    );
  }

  const currentPage = Math.floor(query.offset / PUBLIC_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(loaded.page.total / PUBLIC_PAGE_SIZE));
  const path = `/shop/c/${slug}`;

  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">
          <Link href="/shop">Shop</Link>
          {loaded.category.parentSlug && loaded.parentName ? (
            <>
              {" / "}
              <Link href={`/shop/c/${loaded.category.parentSlug}`}>{loaded.parentName}</Link>
            </>
          ) : null}
        </p>
        <h1>{loaded.category.name}</h1>
        {loaded.category.shortDescription ? (
          <p className="od-shop__lede">{loaded.category.shortDescription}</p>
        ) : null}
      </header>
      <ShopFilters action={path} input={query} />
      {loaded.page.items.length === 0 ? (
        <p className="od-shop__empty">No published products in this category yet.</p>
      ) : (
        <div className="od-shop__grid">
          {loaded.page.items.map((card) => (
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
