import { PM_METRICS, PM_METRICS_COPY } from "./content";
import { VerifiedMetricCounter } from "./VerifiedMetricCounter";

/** Four-cell statistics strip immediately after the hero. */
export function HomeTruthMetrics() {
  return (
    <section
      className="pm-section pm-metrics"
      aria-label={PM_METRICS_COPY.ariaLabel}
    >
      <div className="dc-container">
        <div className="pm-metrics__strip">
          {PM_METRICS.map((metric) => (
            <VerifiedMetricCounter
              key={metric.id}
              value={metric.value}
              suffix={metric.suffix}
              label={metric.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
