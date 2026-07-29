"use client";

import { useId, useState } from "react";
import {
  ESTIMATOR_FINISHES,
  ESTIMATOR_SERVICES,
  computeEstimate,
  type EstimatorFinishId,
  type EstimatorServiceId,
} from "./budget-config";
import { PM_ESTIMATOR, PM_SECTION_IDS } from "./content";
import {
  NOSCRIPT_FINISH_GUIDANCE,
  NOSCRIPT_PRICE_DISCLAIMER,
  buildNoscriptPriceGuide,
  mapEstimatorToPlanSelection,
} from "./estimator-plan-map";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

function defaultSizeFor(serviceId: EstimatorServiceId): string {
  return ESTIMATOR_SERVICES.find((entry) => entry.id === serviceId)!.sizes[0]!.id;
}

const NOSCRIPT_GUIDE = buildNoscriptPriceGuide();

export function HomeBudgetEstimator() {
  const plan = usePlan();
  const resultId = useId();
  const [serviceId, setServiceId] = useState<EstimatorServiceId>("complete-home");
  const [sizeId, setSizeId] = useState("2bhk");
  const [finishId, setFinishId] = useState<EstimatorFinishId>("premium");

  const service = ESTIMATOR_SERVICES.find((entry) => entry.id === serviceId)!;
  const finish = ESTIMATOR_FINISHES.find((entry) => entry.id === finishId)!;
  const size = service.sizes.find((entry) => entry.id === sizeId) ?? service.sizes[0]!;

  const selectService = (next: EstimatorServiceId) => {
    setServiceId(next);
    const nextService = ESTIMATOR_SERVICES.find((entry) => entry.id === next)!;
    if (!nextService.sizes.some((entry) => entry.id === sizeId)) {
      setSizeId(defaultSizeFor(next));
    }
  };

  const estimate = computeEstimate(serviceId, size.id, finishId);

  const applyCurrentEstimate = () => {
    const selection = mapEstimatorToPlanSelection(serviceId, size.id, finishId);
    if (!selection) return;
    plan.applyEstimateToPlanAndOpen(selection);
  };

  return (
    <section
      id={PM_SECTION_IDS.estimate}
      className="pm-section pm-estimator"
      aria-labelledby="pm-estimator-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_ESTIMATOR.eyebrow}</p>
          <h2 id="pm-estimator-title" className="pm-h2">
            {PM_ESTIMATOR.heading}
          </h2>
          <p className="pm-lede">{PM_ESTIMATOR.lede}</p>
          <p className="pm-estimator__reassurance">{PM_ESTIMATOR.reassurance}</p>
        </Reveal>

        <Reveal className="pm-estimator__shell" order={1}>
          <div className="pm-estimator__controls">
            <fieldset className="pm-fieldset">
              <legend className="pm-legend">{PM_ESTIMATOR.stepService}</legend>
              <div className="pm-options" data-columns="two">
                {ESTIMATOR_SERVICES.map((entry, index) => (
                  <label
                    key={entry.id}
                    className="pm-option"
                    data-selected={serviceId === entry.id ? "" : undefined}
                    style={{ "--pm-option-index": index } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name="estimator-service"
                      value={entry.id}
                      checked={serviceId === entry.id}
                      onChange={() => selectService(entry.id)}
                    />
                    <span className="pm-option__label">{entry.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="pm-fieldset">
              <legend className="pm-legend">{PM_ESTIMATOR.stepSize}</legend>
              <div className="pm-options" data-columns="two">
                {service.sizes.map((entry, index) => (
                  <label
                    key={entry.id}
                    className="pm-option"
                    data-selected={size.id === entry.id ? "" : undefined}
                    style={{ "--pm-option-index": index } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name="estimator-size"
                      value={entry.id}
                      checked={size.id === entry.id}
                      onChange={() => setSizeId(entry.id)}
                    />
                    <span className="pm-option__label">{entry.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="pm-fieldset">
              <legend className="pm-legend">{PM_ESTIMATOR.stepFinish}</legend>
              <div className="pm-options" data-columns="auto">
                {ESTIMATOR_FINISHES.map((entry, index) => (
                  <label
                    key={entry.id}
                    className="pm-option"
                    data-selected={finishId === entry.id ? "" : undefined}
                    style={{ "--pm-option-index": index } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name="estimator-finish"
                      value={entry.id}
                      checked={finishId === entry.id}
                      onChange={() => setFinishId(entry.id)}
                    />
                    <span className="pm-option__label">{entry.label}</span>
                    <span className="pm-option__hint">{entry.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="pm-card pm-estimator__result" aria-live="polite">
            <span className="pm-card__glow" aria-hidden="true" />
            <p className="pm-estimator__resultLabel">{PM_ESTIMATOR.resultHeading}</p>
            <p id={resultId} className="pm-estimator__range">
              {estimate?.label ?? "—"}
            </p>
            <dl className="pm-estimator__summary">
              <div>
                <dt>{PM_ESTIMATOR.resultSummaryLabel}</dt>
                <dd>
                  {service.label} · {size.label} · {finish.label}
                </dd>
              </div>
            </dl>
            <p className="pm-estimator__disclaimer">{PM_ESTIMATOR.disclaimer}</p>
            <div className="pm-estimator__actions">
              <button
                type="button"
                className="dc-btn dc-btn--ghost"
                data-conversion-action="estimator-refine"
                onClick={applyCurrentEstimate}
              >
                {PM_ESTIMATOR.refineCta}
              </button>
              <button
                type="button"
                className="dc-btn dc-btn--primary pm-btn--sheen"
                data-conversion-action="estimator-start-plan"
                onClick={applyCurrentEstimate}
              >
                {PM_ESTIMATOR.consultCta}
              </button>
            </div>
          </div>
        </Reveal>

        <noscript>
          <div className="pm-noscript pm-estimator__noscript">
            <h3>{PM_ESTIMATOR.noscriptHeading}</h3>
            <p>{PM_ESTIMATOR.noscriptBody}</p>
            {NOSCRIPT_GUIDE.map((entry) => (
              <article key={entry.serviceLabel}>
                <h4>{entry.serviceLabel}</h4>
                <ul>
                  {entry.sizes.map((sizeEntry) => (
                    <li key={sizeEntry.label}>
                      {sizeEntry.label}: {sizeEntry.range}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            <h4>Finish levels</h4>
            <ul>
              {NOSCRIPT_FINISH_GUIDANCE.map((entry) => (
                <li key={entry.id}>
                  {entry.label}: {entry.factor}
                </li>
              ))}
            </ul>
            <p>{NOSCRIPT_PRICE_DISCLAIMER}</p>
          </div>
        </noscript>
      </div>
    </section>
  );
}
