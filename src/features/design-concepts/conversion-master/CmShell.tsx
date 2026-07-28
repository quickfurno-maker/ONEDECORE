import Link from "next/link";
import type { ReactNode } from "react";
import { CM_REVIEW } from "./content";
import { CmFooter } from "./CmFooter";
import { CmNav } from "./CmNav";
import { StickyBar } from "./StickyBar";
import { RevealRuntime } from "../shared/RevealRuntime";

const MAIN_ID = "cm-main";

interface CmShellProps {
  readonly children: ReactNode;
}

/**
 * Conversion Master chrome: skip link, review banner, nav, main, sticky, footer,
 * reveal runtime.
 */
export function CmShell({ children }: CmShellProps) {
  return (
    <div data-design-concept="" data-concept="conversion-master" data-cm="">
      <a className="dc-skip" href={`#${MAIN_ID}`}>
        Skip to content
      </a>

      <div className="dc-review">
        <div className="dc-container dc-review__inner">
          <span className="dc-review__tag">{CM_REVIEW.tag}</span>
          <span>{CM_REVIEW.notice}</span>
          <Link href={CM_REVIEW.backHref} className="dc-review__link">
            {CM_REVIEW.backLabel}
          </Link>
        </div>
      </div>

      <CmNav />

      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <StickyBar />
      <CmFooter />
      <RevealRuntime />
    </div>
  );
}
