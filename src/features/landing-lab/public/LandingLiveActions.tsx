"use client";

import { usePlan } from "@/features/public-site/home-r4/PlanContext";
import { type ReactNode } from "react";
import { LandingActionProvider } from "./LandingCta.tsx";

/**
 * Connects the page's calls to action to the one canonical enquiry form.
 *
 * WHY THIS TINY COMPONENT EXISTS.
 *
 * `usePlan()` only works inside the `PlanProvider` that `LeadConsultationHost`
 * mounts, and calling it anywhere else throws. The admin preview has no such
 * host and must never have one — a preview that can open the real form is a
 * preview that can create a real lead from an unsaved draft.
 *
 * So the lookup happens here, on the live page only, and the opener is passed
 * down as a value. `LandingCta` never calls the hook itself; it receives either
 * a function or `null`, and renders an inert control when there is nothing to
 * open. That is what lets one set of block components serve both surfaces
 * without either sniffing its environment.
 */
export function LandingLiveActions({ children }: { readonly children: ReactNode }) {
  const { openPlanner } = usePlan();
  return (
    <LandingActionProvider mode="live" openForm={openPlanner}>
      {children}
    </LandingActionProvider>
  );
}
