"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Every call to action on a campaign landing page.
 *
 * WHAT A CTA ACTUALLY DOES, AND WHY IT DEPENDS ON THE URL.
 *
 * The contract lets a CTA url be a safe http(s) address, a root-relative path,
 * an `#anchor`, or nothing at all. Those are four different behaviours, and the
 * renderer this replaces had one: it printed the label inside a `<p>`. A
 * campaign page whose buttons are paragraphs converts nobody, so each case is
 * handled:
 *
 *   #anchor          scroll to that section of this page
 *   /path            navigate within the site, client-side
 *   https://…        navigate out, in a new tab, with rel="noreferrer"
 *   null / empty     open the ONEDECORE consultation form
 *
 * The last is the important default. An author who adds a hero and leaves the
 * URL blank gets the behaviour they almost certainly wanted — the enquiry form
 * — instead of a dead control. That is a decision, so it is written down.
 *
 * WHY THE FORM IS OPENED RATHER THAN EMBEDDED.
 *
 * ONEDECORE has exactly one public lead form, mounted once by
 * `LeadConsultationHost`. This asks that host to open it. Nothing here renders
 * a `<form>`, an input, or a second lead contract — a rule the public
 * lead-form test enforces by asserting the only `<form>` on any public surface
 * lives in `UnifiedLeadBrief`.
 *
 * WHY THE OPENER IS INJECTED INSTEAD OF LOOKED UP.
 *
 * The obvious implementation calls `usePlan()` here. That throws in the admin
 * preview, which has no `PlanProvider` and must never have one: a preview able
 * to open the real form is a preview able to create a real lead from an unsaved
 * draft. So the opener arrives through this context — supplied on the live page,
 * `null` in the preview — and the same component renders an inert control when
 * there is nothing to open. No conditional hooks, no environment sniffing.
 */

export type LandingRenderMode = "live" | "preview";

interface LandingActionValue {
  readonly mode: LandingRenderMode;
  readonly openForm: (() => void) | null;
}

const LandingActionCtx = createContext<LandingActionValue>({
  mode: "live",
  openForm: null,
});

export function LandingActionProvider({
  mode,
  openForm,
  children,
}: {
  readonly mode: LandingRenderMode;
  readonly openForm: (() => void) | null;
  readonly children: ReactNode;
}) {
  const value = useMemo(() => ({ mode, openForm }), [mode, openForm]);
  return (
    <LandingActionCtx.Provider value={value}>{children}</LandingActionCtx.Provider>
  );
}

export function useLandingAction(): LandingActionValue {
  return useContext(LandingActionCtx);
}

export interface LandingCtaProps {
  readonly label: string;
  readonly url?: string | null;
  readonly variant?: "primary" | "secondary";
  readonly className?: string;
  /** Names the block a click came from, for conversion debugging. */
  readonly source: string;
}

export function LandingCta({
  label,
  url,
  variant = "primary",
  className,
  source,
}: LandingCtaProps) {
  const { mode, openForm } = useLandingAction();
  const classes = ["lp-btn", `lp-btn--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  const action = `landing-cta-${source}`;
  const target = typeof url === "string" ? url.trim() : "";

  if (target.startsWith("#")) {
    return (
      <a className={classes} href={target} data-conversion-action={action}>
        {label}
      </a>
    );
  }

  if (target.startsWith("/")) {
    return (
      <Link className={classes} href={target} data-conversion-action={action}>
        {label}
      </Link>
    );
  }

  if (target.startsWith("http://") || target.startsWith("https://")) {
    return (
      <a
        className={classes}
        href={target}
        target="_blank"
        rel="noreferrer noopener"
        data-conversion-action={action}
      >
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={openForm ?? undefined}
      // The preview has no form to open and must not pretend otherwise.
      aria-disabled={mode === "preview" || !openForm ? true : undefined}
      data-conversion-action={action}
      data-landing-cta-opens-form=""
    >
      {label}
    </button>
  );
}
