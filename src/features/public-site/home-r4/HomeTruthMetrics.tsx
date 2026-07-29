import { PM_PROOF_COPY, PM_PROOF_METRICS } from "./content";
import { VerifiedMetricCounter } from "./VerifiedMetricCounter";

/** Owner-approved proof strip with animated counters. */
export function HomeTruthMetrics() {
  return (
    <section
      className="pm-section pm-metrics"
      aria-label={PM_PROOF_COPY.ariaLabel}
    >
      <div className="dc-container">
        <div className="pm-metrics__strip">
          {PM_PROOF_METRICS.map((metric) => (
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
