import Link from "next/link";
import { PortfolioCard } from "./PortfolioCard";
import { getFeaturedProjects } from "../public-portfolio-cache";

export async function FeaturedPortfolioSection() {
  const featuredCards = await getFeaturedProjects();

  return (
    <section id="featured-portfolio-section" className="w-full py-16 bg-neutral-50 dark:bg-neutral-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Featured Portfolio
            </h2>
            <p className="mt-2 text-base text-neutral-600 dark:text-neutral-400 max-w-2xl">
              Explore our recent complete home interior transformations and bespoke design solutions.
            </p>
          </div>
          <Link
            id="featured-view-all-link"
            href="/portfolio"
            className="inline-flex items-center text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            View All Projects &rarr;
          </Link>
        </div>

        {featuredCards.length > 0 ? (
          <div
            id="featured-cards-grid"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {featuredCards.map((card, idx) => (
              <PortfolioCard key={card.slug} card={card} eagerImage={idx < 3} />
            ))}
          </div>
        ) : (
          <div
            id="featured-empty-state"
            className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Curated portfolio projects coming soon.
            </h3>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              We are finalizing documentation for our latest interior transformations.
            </p>
            <div className="mt-6">
              <Link
                id="featured-empty-cta-button"
                href="/portfolio"
                className="inline-flex items-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Browse Portfolio Directory
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
