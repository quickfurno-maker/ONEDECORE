import { PM_METRICS, PM_METRICS_COPY } from "./content";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { VerifiedMetricCounter } from "./VerifiedMetricCounter";

/** Verified operating-model strip — no project counts while proof mode is pending. */
export function HomeTruthMetrics() {
  return (
    <section
      className="pm-section pm-metrics"
      aria-label={PM_METRICS_COPY.ariaLabel}
    >
      <div className="dc-container">
        <Reveal className="pm-metrics__eyebrow">
          <p className="pm-eyebrow">{PM_METRICS_COPY.eyebrow}</p>
        </Reveal>
        <Reveal className="pm-metrics__strip" order={1}>
          {PM_METRICS.map((metric) => (
            <VerifiedMetricCounter
              key={metric.id}
              value={metric.value}
              label={metric.label}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
