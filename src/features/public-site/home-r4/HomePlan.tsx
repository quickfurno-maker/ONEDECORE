"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HomeLeadCapture } from "../../lead-intake/public/HomeLeadCapture.tsx";
import type { LeadFormMode } from "../../lead-intake/public/lead-form-mode.ts";
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
 * Final plan section — summary + clipboard brief export.
 * Lead form mode is resolved on the server and passed in to avoid SSR/client drift.
 * When leadFormMode is active/preview, the enquiry form is the primary conversion path.
 */
export function HomePlan({
  leadFormMode,
}: {
  readonly leadFormMode: LeadFormMode;
}) {
  const plan = usePlan();
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const formPrimary = leadFormMode === "active" || leadFormMode === "preview";

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
    <div className={formPrimary ? "pm-close__secondary" : undefined}>
      {!formPrimary ? (
        <>
          <h3 className="pm-planner__successTitle">{PM_CLOSE.briefTitle}</h3>
          <p className="pm-planner__successBody">{PM_CLOSE.briefBody}</p>
        </>
      ) : (
        <p className="pm-close__secondary-label">Other options</p>
      )}
      <div className="pm-close__actions">
        <button
          type="button"
          className={
            formPrimary
              ? "dc-btn dc-btn--ghost"
              : "dc-btn dc-btn--primary pm-btn--sheen"
          }
          onClick={() => void onCopy()}
          data-conversion-action="brief-copy"
        >
          {formPrimary ? PM_CLOSE.copyBriefSecondaryLabel : PM_CLOSE.submitLabel}
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
      data-lead-form-mode={leadFormMode}
    >
      <span id={PM_SECTION_IDS.plan} />
      <span className="pm-close__glow" aria-hidden="true" />
      <div className="dc-container pm-close__inner">
        <div className="pm-close__intro">
          <p className="pm-eyebrow">{PM_CLOSE.eyebrow}</p>
          <h2 id="pm-close-title" className="pm-h2">
            {PM_CLOSE.heading}
          </h2>
          <p className="pm-lede">
            {formPrimary ? PM_CLOSE.ledeActive : PM_CLOSE.lede}
          </p>
          <p className="pm-close__reassurance">
            {formPrimary ? PM_CLOSE.reassuranceActive : PM_CLOSE.reassurance}
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
            aria-label={
              formPrimary ? "Consultation request" : "Interior brief actions"
            }
          >
            {formPrimary ? (
              <>
                <h3 className="pm-planner__successTitle">
                  {PM_CLOSE.briefTitleActive}
                </h3>
                <p className="pm-planner__successBody">{PM_CLOSE.briefBodyActive}</p>
                <HomeLeadCapture mode={leadFormMode} />
                {briefActions}
              </>
            ) : leadFormMode === "copy-only" ? (
              briefActions
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
