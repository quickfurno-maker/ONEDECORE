import Link from "next/link";

export default function PortfolioListingNotFound() {
  return (
    <main id="portfolio-listing-not-found" className="od-state">
      <div className="od-state__inner">
        <h1>404 — Invalid Portfolio Filter or Page</h1>
        <p>
          The requested portfolio page or service category filter does not
          exist.
        </p>
        <div className="od-state__actions">
          <Link
            id="not-found-reset-link"
            href="/portfolio"
            className="od-btn-primary"
          >
            View Portfolio Directory
          </Link>
          <Link href="/" className="od-btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
