import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PortfolioGrid } from "@/features/portfolio/public/components/PortfolioGrid";
import { getPaginatedProjects } from "@/features/portfolio/public/public-portfolio-cache";
import { parseListingParams } from "@/features/portfolio/public/public-request-validation";
import { PORTFOLIO_SERVICE_LABELS } from "@/features/portfolio/public/constants";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const LISTING_DESCRIPTION =
  "Browse ONEDECORE's portfolio of home interiors, modular kitchens, and custom wardrobes.";

interface PortfolioPageProps {
  searchParams: Promise<{ page?: string; service?: string }>;
}

export async function generateMetadata({
  searchParams,
}: PortfolioPageProps): Promise<Metadata> {
  const parsed = parseListingParams(await searchParams);

  if (!parsed) {
    notFound();
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

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const parsed = parseListingParams(await searchParams);

  if (!parsed) {
    notFound();
  }

  const paginatedData = await getPaginatedProjects(
    parsed.page,
    parsed.service ?? undefined
  );

  return (
    <main
      id="portfolio-page-main"
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      <header className="mb-10 space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
          Interior Design Portfolio
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl">
          {parsed.service
            ? `Showing projects for ${PORTFOLIO_SERVICE_LABELS[parsed.service]}`
            : "Explore our curated showcase of completed residential interior projects."}
        </p>
      </header>

      <PortfolioGrid data={paginatedData} />
    </main>
  );
}
