"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PM_CLOSE, PM_PLANNER, PM_SECTION_IDS } from "./content";
import { formatInteriorBrief } from "./plan-state";
import { usePlan } from "./PlanContext";

function labelOf(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string | null
): string | null {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label ?? null;
}

/**
 * Final plan section — summary + clipboard brief export + the CTA that opens
 * the one lead form.
 *
 * THIS SECTION NO LONGER CONTAINS A FORM.
 *
 * It used to mount a second, flat lead form beside the guided sheet: two forms,
 * two contracts, two sets of validation rules, and two ways for an enquiry to
 * be lost. The sheet asks the same questions in a better order and is the only
 * thing that submits, so what is left here is the summary of what the visitor
 * has already answered and the control that opens the sheet at the first
 * question still outstanding.
 *
 * THE CONVERSION CTA IS ALWAYS OFFERED
 *
 * It used to be conditional on a build-time public flag, which is what let the
 * page promise a live form while the server could accept nothing. Whether a
 * lead can actually be submitted is now decided by the running server, at the
 * moment the sheet opens — so this section simply offers the consultation and
 * lets the sheet answer honestly. Copying a brief remains the secondary path
 * for somebody who would rather not send anything.
 */
export function HomePlan() {
  const plan = usePlan();
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  const budgetLabel = labelOf(
    PM_PLANNER.budgetComfortOptions,
    plan.budgetComfort
  );

  const rows = useMemo(() => {
    const rooms =
      plan.rooms.length > 0
        ? plan.rooms
            .map((id) => labelOf(PM_PLANNER.rooms, id))
            .filter(Boolean)
            .join(", ")
        : null;

    const estimate = plan.estimateSummary;

    return [
      { label: "Service", value: labelOf(PM_PLANNER.services, plan.service) },
      { label: "Property", value: labelOf(PM_PLANNER.properties, plan.property) },
      { label: "Timeline", value: labelOf(PM_PLANNER.timelines, plan.timeline) },
      { label: "Rooms", value: rooms },
      { label: "Budget", value: budgetLabel },
      {
        label: "Indicative estimate",
        value: estimate
          ? `${estimate.rangeLabel} · ${estimate.serviceLabel} · ${estimate.sizeLabel} · ${estimate.finishLabel}`
          : null,
      },
      { label: "Locality", value: plan.locality.trim() || null },
    ].filter((row) => row.value);
  }, [
    plan.rooms,
    plan.service,
    plan.property,
    plan.timeline,
    plan.locality,
    plan.estimateSummary,
    budgetLabel,
  ]);

  const onCopy = async () => {
    const text = formatInteriorBrief(plan, budgetLabel);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
    } catch {
      setCopyState("err");
    }
  };

  const briefActions = (
    <div className="pm-close__secondary">
      <p className="pm-close__secondary-label">Other options</p>
      <div className="pm-close__actions">
        <button
          type="button"
          className="dc-btn dc-btn--ghost"
          onClick={() => void onCopy()}
          data-conversion-action="brief-copy"
        >
          {PM_CLOSE.copyBriefSecondaryLabel}
        </button>
        <Link
          href={PM_CLOSE.secondaryHref}
          className="dc-btn dc-btn--ghost"
          data-conversion-action="portfolio-view"
        >
          {PM_CLOSE.secondaryLabel}
        </Link>
      </div>
      <p className="pm-lede" role="status" aria-live="polite">
        {copyState === "ok"
          ? PM_CLOSE.copySuccess
          : copyState === "err"
            ? PM_CLOSE.copyFailure
            : null}
      </p>
    </div>
  );

  return (
    <section
      id="consultation"
      className="pm-section pm-close"
      aria-labelledby="pm-close-title"
    >
      <span id={PM_SECTION_IDS.plan} />
      {/*
        `#contact` lands here, on the section that already IS the contact.

        The menu's Contact destination has to resolve to something now that the
        Interiors page is the homepage, and this closing band is where a visitor
        actually reaches ONEDECORE — it opens the one planner, through the one
        `LeadConsultationHost`. A second contact form to satisfy a menu item
        would be a second lead path to keep in step with the first.

        `#consultation` above is the same target under its older name, kept
        because `/portfolio/[slug]` and the Shop nav already link to it.
      */}
      <span id="contact" className="od-disc-anchor-alias" aria-hidden="true" />
      <span className="pm-close__glow" aria-hidden="true" />
      <div className="dc-container pm-close__inner">
        <div className="pm-close__intro">
          <p className="pm-eyebrow">{PM_CLOSE.eyebrow}</p>
          <h2 id="pm-close-title" className="pm-h2">
            {PM_CLOSE.heading}
          </h2>
          <p className="pm-lede">
            {PM_CLOSE.ledeActive}
          </p>
          <p className="pm-close__reassurance">
            {PM_CLOSE.reassuranceActive}
          </p>

          <div className="pm-summary pm-summary--intro">
            <div className="pm-summary__head">
              <h3 className="pm-summary__title">{PM_CLOSE.summaryHeading}</h3>
              <button
                type="button"
                className="pm-textlink pm-summary__edit"
                onClick={() => plan.openPlanner(plan.getNextIncompleteStep())}
              >
                {PM_CLOSE.editLabel}
              </button>
            </div>
            {rows.length > 0 ? (
              <dl className="pm-summary__list">
                {rows.map((row, index) => (
                  <div
                    key={row.label}
                    style={{ "--pm-line": index } as React.CSSProperties}
                  >
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="pm-summary__empty">{PM_PLANNER.summaryEmpty}</p>
            )}
          </div>
        </div>

        <div className="pm-card pm-close__panel">
          <span className="pm-card__glow" aria-hidden="true" />
          <div
            className="pm-planner__success"
            role="region"
            aria-label="Consultation request"
          >
            <h3 className="pm-planner__successTitle">
              {PM_CLOSE.briefTitleActive}
            </h3>
            <p className="pm-planner__successBody">{PM_CLOSE.briefBodyActive}</p>
            <div className="pm-close__form-actions">
              <button
                type="button"
                className="dc-btn dc-btn--primary pm-btn--sheen"
                onClick={() => plan.openPlanner(plan.getNextIncompleteStep())}
                data-conversion-action="consultation-plan"
              >
                {PM_CLOSE.submitLabel}
              </button>
            </div>
            <p className="pm-close__reassurance">{PM_CLOSE.reassuranceActive}</p>
            {briefActions}
          </div>
        </div>
      </div>
    </section>
  );
}
