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
 * The accessibility contract is unchanged: one spoken status message OUTSIDE
 * the busy region, everything decorative hidden, and no explicit live-region
 * attribute — `role="status"` already announces once, and declaring a live
 * region as well would announce it twice.
 *
 * IT COVERS THE RESULTS, AND ONLY THE RESULTS
 *
 * The heading and the tab rail render immediately, outside the Suspense
 * boundary, so a skeleton eyebrow/title/filter row underneath them drew a
 * SECOND set of the same furniture for as long as the fetch took — which after
 * the navigation was reduced to one rail is exactly the duplicate row this
 * change set out to remove, reappearing on every load. The skeleton now stands
 * in for the grid alone.
 *
 * TWO GRIDS, TWO SHAPES
 *
 * Projects are 4:5 cards with two lines of text under them; a room view is a
 * dense grid of square thumbnails with no text at all. One skeleton for both
 * would guarantee a layout shift on at least one of them, so the variant picks
 * the geometry the real results will use.
 */
export function PortfolioSkeleton({
  variant = "projects",
}: {
  readonly variant?: "projects" | "room";
}) {
  const isRoom = variant === "room";

  return (
    <>
      <p role="status" className="od-sr-only">
        {isRoom
          ? "Loading ONEDECORE Portfolio photographs."
          : "Loading ONEDECORE Portfolio projects."}
      </p>
      <div
        className="od-loading"
        aria-busy="true"
        aria-label="Loading Portfolio"
        data-od-loading={variant}
      >
        <p className="od-loading__label" aria-hidden="true">
          Loading Portfolio
        </p>

        {isRoom ? (
          <div className="od-loading__tiles" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} className="od-skeleton od-skeleton--tile" />
            ))}
          </div>
        ) : (
          <div className="od-loading__grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="od-skeleton-card">
                <span className="od-skeleton od-skeleton--media" />
                <span className="od-skeleton od-skeleton--line" />
                <span className="od-skeleton od-skeleton--line od-skeleton--short" />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
