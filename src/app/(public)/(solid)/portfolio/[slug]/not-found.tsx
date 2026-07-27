import Link from "next/link";

export default function PortfolioNotFound() {
  return (
    <div id="portfolio-not-found-main" className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Project Not Found
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          The requested portfolio project does not exist, has been archived, or is unavailable.
        </p>
        <div className="pt-4">
          <Link
            id="not-found-back-button"
            href="/portfolio"
            className="inline-flex items-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            Back to Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
