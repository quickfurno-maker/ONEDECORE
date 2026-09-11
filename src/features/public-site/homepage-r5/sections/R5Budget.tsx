"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePlan } from "@/features/public-site/home-r4/PlanContext";
import { serviceForProjectScope } from "@/features/lead-intake/project-scope";
import { R5_BUDGET, R5_BUDGET_COPY } from "../content";

/**
 * Budget Explorer — browsing, not a second form.
 *
 * ONE CTA, AND IT OPENS THE CANONICAL PLANNER
 *
 * The whole risk in a section like this is that it grows its own fields. It has
 * none: choosing a home type changes which four bands are displayed and nothing
 * else. The single button calls `openPlanner` through `usePlan`, which is the
 * same `LeadConsultationHost` the hero, the sticky bar and the closing section
 * use. One journey, one validation, one consent record, one submission.
 *
 * THE PREFILL IS THE EXISTING MECHANISM, NOT A NEW ONE
 *
 * `setService` then `setProjectScope` is the order `UnifiedLeadBrief` itself
 * uses, and it matters: `setService` clears a scope that no longer belongs to
 * the chosen service, so calling it second would discard the scope we just set.
 * Both take values straight from `LEAD_PROJECT_SCOPE_CODES`, so nothing here
 * can put the form into a state it would refuse.
 *
 * The bands are read from `BUDGET_RANGES_BY_PROJECT_SCOPE` — see `content.ts`.
 * A range shown here is always a range the intake accepts.
 */
export function R5Budget() {
  const [activeId, setActiveId] = useState(R5_BUDGET[0]!.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const { openPlanner, getNextIncompleteStep, setService, setProjectScope } = usePlan();

  const activeIndex = R5_BUDGET.findIndex((entry) => entry.id === activeId);
  const active = R5_BUDGET[activeIndex] ?? R5_BUDGET[0]!;

  const select = (index: number) => {
    const next = R5_BUDGET[((index % R5_BUDGET.length) + R5_BUDGET.length) % R5_BUDGET.length]!;
    setActiveId(next.id);
    tabRefs.current[R5_BUDGET.indexOf(next)]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select(index - 1);
        break;
      case "Home":
        event.preventDefault();
        select(0);
        break;
      case "End":
        event.preventDefault();
        select(R5_BUDGET.length - 1);
        break;
      default:
        break;
    }
  };

  const open = useCallback(() => {
    /*
     * Service BEFORE scope. `setService` resets a scope that does not belong to
     * the new service, so the reverse order silently drops the selection the
     * visitor just made.
     */
    const service = serviceForProjectScope(active.id);
    if (service) setService(service as never);
    setProjectScope(active.id);
    openPlanner(getNextIncompleteStep());
  }, [active.id, getNextIncompleteStep, openPlanner, setProjectScope, setService]);

  return (
    <section className="r5-section" aria-labelledby="r5-budget-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_BUDGET_COPY.eyebrow}</p>
          <h2 id="r5-budget-title" className="r5-heading">
            {R5_BUDGET_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_BUDGET_COPY.supporting}</p>
        </header>

        <ul className="r5-tabs" role="tablist" aria-label="Choose a home type">
          {R5_BUDGET.map((entry, index) => {
            const selected = entry.id === activeId;
            return (
              <li key={entry.id} role="presentation">
                <button
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${entry.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${entry.id}`}
                  tabIndex={selected ? 0 : -1}
                  className="r5-tab"
                  onClick={() => setActiveId(entry.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          key={active.id}
          className="r5-fade"
        >
          {/*
            The band is the whole card. An earlier version repeated the home
            type under every range, which put the word "Kitchen" on screen four
            times directly below the Kitchen tab that was already selected —
            noise that read like a rendering bug. The tablist states the home
            type; the cards state the ranges.
          */}
          <ul className="r5-bands" aria-label={`${active.label} planning ranges`}>
            {active.bands.map((band) => (
              <li key={band} className="r5-band">
                <p className="r5-band__value">{band}</p>
              </li>
            ))}
          </ul>
        </div>

        {/*
          The qualifier stays. A range presented as a price is the shortest path
          to an argument at handover, and the existing FAQ draws the same line.
        */}
        <p className="r5-disclaimer">{R5_BUDGET_COPY.disclaimer}</p>

        <button
          type="button"
          className="dc-btn dc-btn--primary"
          data-conversion-action="budget-explorer-start-plan"
          onClick={open}
        >
          {R5_BUDGET_COPY.cta}
        </button>
      </div>
    </section>
  );
}
