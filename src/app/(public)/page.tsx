import Link from "next/link";
import { FeaturedPortfolioSection } from "@/features/portfolio/public/components/FeaturedPortfolioSection";
import { SITE_CONFIG } from "@/config/site";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div id="homepage-container" className="flex flex-col">
      {/* Hero Section — scaffold unchanged in C2; C3 replaces */}
      <section id="homepage-hero-section" className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-6xl">
            {SITE_CONFIG.name}
          </h1>
          <p className="text-2xl text-amber-600 dark:text-amber-400 font-semibold">
            {SITE_CONFIG.tagline}
          </p>
          <p className="text-lg text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto">
            Transforming spaces into timeless, functional interior masterpieces across India.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <Link
              id="hero-portfolio-cta-button"
              href="/portfolio"
              className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm"
            >
              Explore Portfolio
            </Link>
          </div>
        </div>
      </section>

      <FeaturedPortfolioSection />
    </div>
  );
}
