"use client";

import Link from "next/link";
import { CM_STICKY } from "./content";
import { useLead } from "./LeadContext";

/** Mobile-only sticky conversion bar. */
export function StickyBar() {
  const { openPlanner } = useLead();

  return (
    <div className="cm-sticky" role="region" aria-label="Quick conversion actions">
      <button
        type="button"
        className="dc-btn dc-btn--primary cm-sticky__btn"
        onClick={() => openPlanner()}
      >
        {CM_STICKY.plan}
      </button>
      <Link href={CM_STICKY.projectsHref} className="dc-btn dc-btn--ghost cm-sticky__btn">
        {CM_STICKY.projects}
      </Link>
    </div>
  );
}
