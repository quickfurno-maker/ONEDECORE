/**
 * Portfolio loading skeleton — dark, server-rendered, announced once.
 *
 * WHY THIS IS A COMPONENT AND NOT `app/portfolio/loading.tsx`
 *
 * It used to be the segment's `loading.tsx`. A `loading.tsx` is a Suspense
 * fallback for the WHOLE segment, and Next starts streaming the response the
 * moment that fallback renders — which happens before the page has decided
 * whether the request is even valid. Once streaming starts the headers are
 * sent, so the status can no longer be changed, and `notFound()` could only
 * produce a not-found BODY under an HTTP 200. Every bogus `?category=`,
 * `?page=` and unknown slug was a "200 OK — not found" as far as a crawler was
 * concerned.
 *
 * Moving the skeleton inside the page fixes that without losing it: the page
 * validates first (so an invalid request is a real 404), and only then opens a
 * Suspense boundary around the part that actually waits on data. The skeleton
 * still covers the fetch; it just no longer covers the decision.
 *
 * The markup is unchanged, including its accessibility contract: one spoken
 * status message OUTSIDE the busy region, everything decorative hidden, and no
 * explicit live-region attribute — `role="status"` already announces once, and
 * declaring a live region as well would announce it twice.
 */
export function PortfolioSkeleton() {
  return (
    <>
      <p role="status" className="od-sr-only">
        Loading ONEDECORE Portfolio projects.
      </p>
      <div
        className="od-portfolio-main od-loading"
        aria-busy="true"
        aria-label="Loading Portfolio"
      >
        <p className="od-loading__label" aria-hidden="true">
          Loading Portfolio
        </p>

        <div className="od-loading__header" aria-hidden="true">
          <span className="od-skeleton od-skeleton--eyebrow" />
          <span className="od-skeleton od-skeleton--title" />
          <span className="od-skeleton od-skeleton--lede" />
        </div>

        <div className="od-loading__filters" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="od-skeleton od-skeleton--filter" />
          ))}
        </div>

        <div className="od-loading__grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="od-skeleton-card">
              <span className="od-skeleton od-skeleton--media" />
              <span className="od-skeleton od-skeleton--line" />
              <span className="od-skeleton od-skeleton--line od-skeleton--short" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
