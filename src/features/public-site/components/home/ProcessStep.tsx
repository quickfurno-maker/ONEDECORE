import type { ProcessStep } from "../../content/process";
import { cn } from "../../utils/cn";
import { Reveal } from "../primitives/Reveal";

export interface ProcessStepProps {
  step: ProcessStep;
  revealDelayMs?: number;
  /** When true, omit the trailing connector after this step (last item). */
  isLast?: boolean;
}

/**
 * Single process stage — Server Component.
 * Ordinals are editorial labels, not interactive status indicators.
 */
export function ProcessStepItem({
  step,
  revealDelayMs = 0,
  isLast = false,
}: ProcessStepProps) {
  return (
    <Reveal delayMs={revealDelayMs} className="ps-process-step-reveal">
      <article
        id={`process-step-${step.id}`}
        className={cn("ps-process-step", isLast && "ps-process-step--last")}
      >
        <p className="ps-type-overline ps-process-step__ordinal" aria-hidden="true">
          {step.ordinal}
        </p>
        <h3 className="ps-type-heading-3 ps-process-step__title">{step.title}</h3>
        <p className="ps-type-body ps-process-step__description">{step.description}</p>
      </article>
    </Reveal>
  );
}
