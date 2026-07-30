import Link from "next/link";

export default function PortfolioNotFound() {
  return (
    <main id="portfolio-not-found-main" className="od-state">
      <div className="od-state__inner">
        <h1>Project Not Found</h1>
        <p>
          The requested portfolio project does not exist, has been archived, or
          is unavailable.
        </p>
        <div className="od-state__actions">
          <Link
            id="not-found-back-button"
            href="/portfolio"
            className="od-btn-primary"
          >
            Back to Portfolio
          </Link>
          <Link href="/" className="od-btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
