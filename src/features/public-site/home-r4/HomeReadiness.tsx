"use client";

import { PM_READINESS_COPY, PM_SECTION_IDS } from "./content";
import { computeReadinessState } from "./plan-state";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

export function HomeReadiness() {
  const plan = usePlan();
  const state = computeReadinessState(plan);
  const copy = PM_READINESS_COPY.states[state];

  const checks = {
    service: Boolean(plan.service),
    property: Boolean(plan.property),
    timeline: Boolean(plan.timeline),
    rooms: plan.rooms.length > 0,
    locality: Boolean(plan.locality.trim()),
  } as const;

  const onCta = () => {
    if (state === "brief-ready") {
      const target = document.getElementById(PM_SECTION_IDS.plan);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    plan.openPlanner(plan.getNextIncompleteStep());
  };

  return (
    <section
      id={PM_SECTION_IDS.readiness}
      className="pm-section pm-readiness"
      aria-labelledby="pm-readiness-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_READINESS_COPY.eyebrow}</p>
          <h2 id="pm-readiness-title" className="pm-h2">
            {PM_READINESS_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_READINESS_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-readiness__panel" order={1}>
          <p className="pm-readiness__state" data-state={state}>
            <span className="pm-readiness__stateMark" aria-hidden="true" />
            <span>{copy.label}</span>
          </p>
          <p className="pm-body">{copy.body}</p>

          <ul className="pm-readiness__checklist">
            {PM_READINESS_COPY.checklist.map((item) => {
              const done = checks[item.id as keyof typeof checks];
              return (
                <li
                  key={item.id}
                  className="pm-readiness__check"
                  data-done={done ? "" : undefined}
                >
                  <span className="pm-readiness__tick" aria-hidden="true">
                    {done ? "●" : "○"}
                  </span>
                  <span>
                    {item.label}
                    <span className="pm-metric__sr">
                      {done ? " — complete" : " — not yet"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--sheen"
            data-conversion-action="readiness-continue"
            onClick={onCta}
          >
            {copy.cta}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
