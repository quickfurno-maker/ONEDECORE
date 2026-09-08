import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_HOW_EYEBROW,
  DISCOVERY_HOW_HEADLINE,
  DISCOVERY_HOW_STEPS,
} from "./discovery-copy";

/**
 * How it works — a four-step timeline.
 *
 * The connecting line is a single pseudo-element on the list, drawn behind the
 * step markers, so it becomes a vertical rail on mobile and a horizontal one on
 * desktop without any second markup path. It carries no information the text
 * does not: a visitor who cannot see the line still reads four numbered steps
 * in order.
 */
export function DiscoveryProcess() {
  return (
    <section
      className="od-disc-band od-disc-band--surface od-disc-how"
      data-od-disc-section="process"
      aria-labelledby="od-disc-process-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head">
          <p className="od-disc-kicker">{DISCOVERY_HOW_EYEBROW}</p>
          <h2 id="od-disc-process-title" className="od-disc-display">
            {DISCOVERY_HOW_HEADLINE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
        </Reveal>

        <ol className="od-disc-how__steps">
          {DISCOVERY_HOW_STEPS.map((step, index) => (
            <Reveal
              key={step.id}
              order={index}
              as="li"
              className="od-disc-how__step"
            >
              <span className="od-disc-how__marker" aria-hidden="true">
                {step.number}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
