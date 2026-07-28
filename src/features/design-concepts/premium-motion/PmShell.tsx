import Link from "next/link";
import type { ReactNode } from "react";
import { PM_CONCEPT_ID, PM_REVIEW } from "./content";
import { PmFooter } from "./PmFooter";
import { PmNav } from "./PmNav";
import { PmPlannerSheet } from "./PmPlanner";
import { PmSticky } from "./PmSticky";
import { RevealRuntime } from "../shared/RevealRuntime";

const MAIN_ID = "pm-main";

/**
 * Concept chrome. The internal review strip sits outside <main> so the premium
 * composition itself carries no internal classification copy.
 */
export function PmShell({ children }: { readonly children: ReactNode }) {
  return (
    <div data-design-concept="" data-concept={PM_CONCEPT_ID} data-pm="">
      <a className="dc-skip" href={`#${MAIN_ID}`}>
        Skip to content
      </a>

      <div className="dc-review">
        <div className="dc-container dc-review__inner">
          <span className="dc-review__tag">{PM_REVIEW.tag}</span>
          <span>{PM_REVIEW.notice}</span>
          <Link href={PM_REVIEW.backHref} className="dc-review__link">
            {PM_REVIEW.backLabel}
          </Link>
        </div>
      </div>

      <PmNav />

      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <PmSticky />
      <PmFooter />
      <PmPlannerSheet />
      <RevealRuntime />
    </div>
  );
}
