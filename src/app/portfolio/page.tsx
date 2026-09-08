import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PortfolioGrid } from "@/features/portfolio/public/components/PortfolioGrid";
import { PortfolioSkeleton } from "@/features/portfolio/public/components/PortfolioSkeleton";
import { getPaginatedProjects } from "@/features/portfolio/public/public-portfolio-cache";
import { parseListingParams } from "@/features/portfolio/public/public-request-validation";
import { PORTFOLIO_SERVICE_LABELS } from "@/features/portfolio/public/constants";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const LISTING_DESCRIPTION =
  "Browse ONEDECORE's portfolio of home interiors, modular kitchens, and custom wardrobes.";

interface PortfolioPageProps {
  searchParams: Promise<{ page?: string; service?: string; category?: string }>;
}

/**
 * SEO NOTE: `notFound()` BELONGS IN THE PAGE, NOT IN THE METADATA.
 *
 * These routes used to call `notFound()` from `generateMetadata` as well. The
 * not-found BODY rendered, so the bug was invisible in a browser — but the
 * response still carried HTTP 200, and a crawler reads the status, not the
 * words. Every bogus `?category=` and `?page=` value was therefore an
 * indexable 200 page saying "not found".
 *
 * `generateMetadata` is not the render path: Next documents `notFound()` for
 * Server Components, Server Functions and Route Handlers, and it works by
 * throwing where the renderer can catch it and set the status. So metadata
 * now returns a `noindex` document for input it cannot describe, and the page
 * component below is the ONE place that calls `notFound()` — which is what
 * produces both the 404 status and the not-found UI.
 */
export async function generateMetadata({
  searchParams,
}: PortfolioPageProps): Promise<Metadata> {
  const parsed = parseListingParams(await searchParams);

  if (!parsed) {
    /*
     * Unrepresentable input. Metadata cannot refuse the request — only the
     * page can — so it describes nothing and asks not to be indexed. The page
     * component then returns the real 404.
     */
    return {
      title: `Portfolio — ${SITE_CONFIG.name}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `Portfolio — ${SITE_CONFIG.name}`;

  return {
    title,
    description: LISTING_DESCRIPTION,
    alternates: {
      canonical: absoluteUrl("portfolio"),
    },
    openGraph: {
      title,
      description: LISTING_DESCRIPTION,
      url: absoluteUrl("portfolio"),
      siteName: SITE_CONFIG.name,
      locale: SITE_CONFIG.locale,
      type: "website",
    },
  };
}

/**
 * The part that waits on the database, and the only part inside Suspense.
 *
 * Keeping the fetch here rather than in the page body is what lets the page
 * decide 404-or-not BEFORE anything streams, while the skeleton still covers
 * the fetch itself.
 */
async function PortfolioResults({
  page,
  service,
  category,
}: {
  readonly page: number;
  readonly service?: string;
  readonly category?: string;
}) {
  const paginatedData = await getPaginatedProjects(page, service, category);
  return <PortfolioGrid data={paginatedData} />;
}

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  /*
   * VALIDATE BEFORE ANYTHING STREAMS.
   *
   * `notFound()` can only set an HTTP 404 while the response headers are still
   * unsent. A Suspense fallback rendering is what sends them, so this check --
   * and the `notFound()` it may call -- must come before the boundary below.
   * When this segment had a `loading.tsx`, the fallback rendered first and
   * every invalid request answered "200 OK" with a not-found body.
   */
  const parsed = parseListingParams(await searchParams);

  if (!parsed) {
    notFound();
  }

  return (
    <main id="portfolio-page-main" className="od-portfolio-main">
      <header className="od-portfolio-header">
        <p className="od-portfolio-eyebrow">ONEDECORE Portfolio</p>
        <h1 className="od-portfolio-title">
          Interiors we&rsquo;ve delivered across Pune.
        </h1>
        <p className="od-portfolio-lede">
          {parsed.service
            ? `Showing projects for ${PORTFOLIO_SERVICE_LABELS[parsed.service]}`
            : "Complete home interiors, modular kitchens and custom wardrobes — photographed as delivered."}
        </p>
      </header>

      <Suspense fallback={<PortfolioSkeleton />}>
        <PortfolioResults
          page={parsed.page}
          service={parsed.service ?? undefined}
          category={parsed.category ?? undefined}
        />
      </Suspense>
    </main>
  );
}
