"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { PlanProvider } from "../../public-site/home-r4/PlanContext";
import { HomePlannerSheet } from "../../public-site/home-r4/HomePlanner";
import {
  useLeadIntakeReadiness,
  type LeadIntakeReadinessState,
} from "./use-lead-intake-readiness";
import type { LeadIntakeTrustedContexts } from "./unified-lead-request.ts";

/**
 * The one place a public lead form exists.
 *
 * ONE HOST, ONE SHEET, ONE FORM
 *
 * Every public consultation entry point — hero, service tile, sticky dock,
 * consultation band, closing panel, a published Landing Lab page — opens THIS.
 * There is no second implementation to drift from, no page-specific variant, no
 * simplified homepage version. A page mounts the host once; every CTA on it
 * calls the shared open API.
 *
 * WHAT THE HOST ADDS OVER A BARE PROVIDER
 *
 * Two things the sheet cannot know on its own.
 *
 * First, AVAILABILITY. The sheet asks the running server whether a lead can be
 * submitted before it renders a single editable field. A public build-time flag
 * used to answer that, and it was wrong: a real enquiry was completed against a
 * form the backend could not accept, because the HTML had been built while it
 * still could. Readiness is checked when the sheet opens, not at page load, so
 * the answer is about the server as it is now.
 *
 * Second, TRUSTED CONTEXT. A Landing Lab page carries a signed publication
 * context, and sometimes a signed campaign execution context. Those have to
 * reach the request body without Landing Lab owning its own form to carry them.
 * The host holds them; the brief step reads them; the adapter attaches them.
 * They are opaque here on purpose — this component neither mints nor validates
 * them, it only carries what the server signed.
 */

export interface LeadConsultationContextValue {
  readonly readiness: LeadIntakeReadinessState;
  readonly checkReadiness: () => Promise<void>;
  readonly trustedContexts: LeadIntakeTrustedContexts;
}

const LeadConsultationCtx = createContext<LeadConsultationContextValue | null>(
  null
);

export function useLeadConsultation(): LeadConsultationContextValue {
  const ctx = useContext(LeadConsultationCtx);
  if (!ctx) {
    throw new Error(
      "useLeadConsultation must be used inside LeadConsultationHost"
    );
  }
  return ctx;
}

export interface LeadConsultationHostProps {
  readonly children: ReactNode;
  /**
   * Signed contexts from a published Landing Lab page, when the visitor arrived
   * through one. Opaque: minted and verified server-side, only carried here.
   */
  readonly trustedContexts?: LeadIntakeTrustedContexts;
}

export function LeadConsultationHost({
  children,
  trustedContexts,
}: LeadConsultationHostProps) {
  const { state, check } = useLeadIntakeReadiness();

  const value = useMemo<LeadConsultationContextValue>(
    () => ({
      readiness: state,
      checkReadiness: check,
      trustedContexts: trustedContexts ?? {},
    }),
    [state, check, trustedContexts]
  );

  return (
    <LeadConsultationCtx.Provider value={value}>
      <PlanProvider>
        {children}
        {/*
          Mounted ONCE, here. A page that mounted a second sheet would have two
          independent plan states and two forms racing to submit the same
          visitor — which is the class of defect this whole consolidation exists
          to remove.
        */}
        <HomePlannerSheet />
      </PlanProvider>
    </LeadConsultationCtx.Provider>
  );
}
