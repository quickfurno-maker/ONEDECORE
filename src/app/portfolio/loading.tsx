/** Portfolio route loading boundary — server-rendered dark skeletons. */
export default function PortfolioLoading() {
  return (
    <div
      className="od-portfolio-main od-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="od-sr-only">Loading ONEDECORE Portfolio projects.</p>
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
  );
}
