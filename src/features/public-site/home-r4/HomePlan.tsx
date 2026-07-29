"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PM_CLOSE, PM_PLANNER, PM_SECTION_IDS } from "./content";
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
 * No production lead backend exists yet; do not collect contact for fake submit.
 * // Phase 7: replace Copy My Interior Brief with approved lead-intake contract.
 */
export function HomePlan() {
  const plan = usePlan();
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  const rows = useMemo(() => {
    const rooms =
      plan.rooms.length > 0
        ? plan.rooms
            .map((id) => labelOf(PM_PLANNER.rooms, id))
            .filter(Boolean)
            .join(", ")
        : null;

    return [
      { label: "Service", value: labelOf(PM_PLANNER.services, plan.service) },
      { label: "Property", value: labelOf(PM_PLANNER.properties, plan.property) },
      { label: "Timeline", value: labelOf(PM_PLANNER.timelines, plan.timeline) },
      { label: "Rooms", value: rooms },
      { label: "Locality", value: plan.locality.trim() || null },
    ].filter((row) => row.value);
  }, [plan.rooms, plan.service, plan.property, plan.timeline, plan.locality]);

  const onCopy = async () => {
    const text = [
      "ONEDECORE — My Interior Brief",
      `Service: ${labelOf(PM_PLANNER.services, plan.service) ?? "Not selected"}`,
      `Property: ${labelOf(PM_PLANNER.properties, plan.property) ?? "Not selected"}`,
      `Timeline: ${labelOf(PM_PLANNER.timelines, plan.timeline) ?? "Not selected"}`,
      `Rooms: ${
        plan.rooms.length > 0
          ? plan.rooms.map((id) => labelOf(PM_PLANNER.rooms, id)).join(", ")
          : "Not selected"
      }`,
      `Locality: ${plan.locality.trim() || "Not selected"}`,
      plan.message.trim() ? `Notes: ${plan.message.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
    } catch {
      setCopyState("err");
    }
  };

  return (
    <section
      id={PM_SECTION_IDS.plan}
      className="pm-section pm-close"
      aria-labelledby="pm-close-title"
    >
      <span className="pm-close__glow" aria-hidden="true" />
      <div className="dc-container pm-close__inner">
        <div className="pm-close__intro">
          <p className="pm-eyebrow">{PM_CLOSE.eyebrow}</p>
          <h2 id="pm-close-title" className="pm-h2">
            {PM_CLOSE.heading}
          </h2>
          <p className="pm-lede">{PM_CLOSE.lede}</p>

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
          <div className="pm-planner__success" role="region" aria-label="Interior brief actions">
            <h3 className="pm-planner__successTitle">{PM_CLOSE.briefTitle}</h3>
            <p className="pm-planner__successBody">{PM_CLOSE.briefBody}</p>
            <div className="pm-close__actions">
              <button
                type="button"
                className="dc-btn dc-btn--primary pm-btn--sheen"
                onClick={() => void onCopy()}
                data-conversion-action="brief-copy"
              >
                {PM_CLOSE.submitLabel}
              </button>
              <Link
                href={PM_CLOSE.secondaryHref}
                className="dc-btn dc-btn--ghost"
              >
                {PM_CLOSE.secondaryLabel}
              </Link>
            </div>
            <p className="pm-close__reassure">{PM_CLOSE.reassurance}</p>
            <p className="pm-lede" role="status" aria-live="polite">
              {copyState === "ok"
                ? "Interior brief copied to your clipboard."
                : copyState === "err"
                  ? "Could not copy automatically. Select your plan summary and copy manually."
                  : null}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
