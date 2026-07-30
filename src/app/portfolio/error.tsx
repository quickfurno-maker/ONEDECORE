"use client";

import { useEffect } from "react";
import Link from "next/link";

interface PortfolioErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/** Dark Portfolio error boundary — no raw error exposure. */
export default function PortfolioError({ error, reset }: PortfolioErrorProps) {
  useEffect(() => {
    console.error(
      "[PublicPortfolio] Redacted operation: PORTFOLIO_ROUTE_ERROR",
      error.digest ? { digest: error.digest } : undefined
    );
  }, [error]);

  return (
    <main className="od-state" role="alert">
      <div className="od-state__inner">
        <h1>We could not load the Portfolio.</h1>
        <p>
          Please try again. You can also return to the Portfolio directory or
          ONEDECORE homepage.
        </p>
        <div className="od-state__actions">
          <button type="button" className="od-btn-primary" onClick={() => reset()}>
            Try Again
          </button>
          <Link href="/portfolio" className="od-btn-ghost">
            Portfolio
          </Link>
          <Link href="/" className="od-btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
