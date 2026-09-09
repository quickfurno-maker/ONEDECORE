"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BudgetComfortId } from "./budget-config";
import type {
  PmPropertyId,
  PmRoomId,
  PmServiceId,
  PmStep,
  PmTimelineId,
} from "./content";
import type { EstimatorPlanSelection } from "./estimator-plan-map";
import { toEstimateSummary } from "./estimator-plan-map";
import {
  isBudgetRangeForScope,
  serviceForProjectScope,
  type LeadProjectScopeCode,
} from "../../lead-intake/project-scope.ts";
import { v4RequiresScope } from "../../lead-intake/contracts.ts";
import {
  acceptSubmission,
  CLOSED_LEAD_SHEET,
  closeSheet,
  finishSubmission as finishSubmissionTransition,
  openSheet,
  resetSheet,
  type LeadSheetState,
  type LeadSheetTransition,
} from "./lead-sheet-lifecycle.ts";
import {
  completedStepCount,
  getNextIncompleteStep as computeNextStep,
  planProgressPercent,
  ensureRoom as ensureRoomIn,
  toggleRoom as toggleRoomIn,
  type PlanEstimateSummary,
  type PlanSnapshot,
} from "./plan-state";

export interface PlanContactFields {
  readonly name: string;
  readonly mobile: string;
  readonly locality: string;
  readonly whatsappConsent: boolean;
  readonly privacyConsent: boolean;
}

export interface AddAreaToPlanInput {
  readonly service?: PmServiceId;
  readonly rooms: readonly PmRoomId[];
}

interface PlanApi extends PlanSnapshot {
  readonly step: PmStep;
  readonly isOpen: boolean;
  readonly mode: "sheet";
  readonly submitted: boolean;
  readonly completedSteps: number;
  readonly progress: number;
  readonly openPlanner: (step?: PmStep) => void;
  readonly closePlanner: () => void;
  readonly setService: (service: PmServiceId) => void;
  readonly setProjectScope: (scope: LeadProjectScopeCode) => void;
  readonly setBudgetRange: (budget: string) => void;
  readonly setProperty: (property: PmPropertyId) => void;
  readonly setTimeline: (timeline: PmTimelineId) => void;
  readonly toggleRoom: (room: PmRoomId) => void;
  readonly addRoom: (room: PmRoomId) => void;
  readonly addAreaToPlanAndOpen: (input: AddAreaToPlanInput) => void;
  readonly applyEstimateToPlanAndOpen: (
    selection: EstimatorPlanSelection
  ) => void;
  readonly setBudgetComfort: (budget: BudgetComfortId | null) => void;
  readonly setContact: (fields: Partial<PlanContactFields>) => void;
  readonly setMessage: (message: string) => void;
  readonly setStep: (step: PmStep) => void;
  readonly goNext: () => void;
  readonly goBack: () => void;
  /** The reference the server returned for an accepted enquiry, if any. */
  readonly submissionReference: string | null;
  /** True when the acceptance was a replay of an enquiry already held. */
  readonly submissionDuplicate: boolean;
  /**
   * Record that the backend ACCEPTED a lead. Deliberately does not close the
   * sheet — see the note on the implementation.
   */
  readonly markSubmitted: (result: LeadSubmissionResult) => void;
  /** The visitor is done reading the success screen: close it and start clean. */
  readonly finishSubmission: () => void;
  readonly editSubmission: () => void;
  readonly resetAll: () => void;
  readonly getNextIncompleteStep: () => PmStep;
}

/**
 * What the server said about an accepted enquiry.
 *
 * Held in context rather than inside the form component because the
 * confirmation OUTLIVES the form: the fields unmount when the enquiry is
 * accepted, and a reference that lived in their local state would go with
 * them. This is the thing the visitor may need to read back to us on the
 * phone, so it belongs to the journey, not to the widget.
 */
export interface LeadSubmissionResult {
  readonly reference: string | null;
  readonly duplicate: boolean;
}

const PlanCtx = createContext<PlanApi | null>(null);

/**
 * Single source of truth for the interior plan. Every CTA on the page routes
 * through `openPlanner`, so there is one journey, one submission path, and one
 * success state.
 *
 * THIS STATE LEAVES THE BROWSER. It used to be a prototype that did not, and
 * the comment saying so outlived the truth. What is held here — service, scope,
 * budget, timeline, locality, contact, message — is what `unifiedLeadToRequest`
 * turns into a `public-consult-v4` body and posts. Treat every field as
 * customer data on its way to a lead, not as throwaway UI state.
 */
export function PlanProvider({ children }: { readonly children: ReactNode }) {
  const [service, setServiceState] = useState<PmServiceId | null>(null);
  const [projectScope, setProjectScopeState] =
    useState<LeadProjectScopeCode | null>(null);
  const [budgetRange, setBudgetRangeState] = useState<string | null>(null);
  const [property, setPropertyState] = useState<PmPropertyId | null>(null);
  const [timeline, setTimelineState] = useState<PmTimelineId | null>(null);
  const [rooms, setRooms] = useState<readonly PmRoomId[]>([]);
  const [budgetComfort, setBudgetComfortState] =
    useState<BudgetComfortId | null>(null);
  const [estimateSummary, setEstimateSummaryState] =
    useState<PlanEstimateSummary | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [message, setMessageState] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [step, setStepState] = useState<PmStep>(1);
  /*
   * Sheet visibility and submission outcome are ONE value driven by the
   * transitions in `lead-sheet-lifecycle.ts`, not four independent booleans.
   * They were independent when a lead could be accepted and the sheet closed
   * in the same breath, which is the bug that lost a visitor's confirmation.
   */
  const [sheet, setSheet] = useState<LeadSheetState>(CLOSED_LEAD_SHEET);
  const { open: isOpen, submitted } = sheet;
  const submissionReference = sheet.reference;
  const submissionDuplicate = sheet.duplicate;

  const snapshot = useMemo<PlanSnapshot>(
    () => ({
      service,
      projectScope,
      budgetRange,
      property,
      timeline,
      rooms,
      budgetComfort,
      estimateSummary,
      name,
      mobile,
      locality,
      message,
      whatsappConsent,
      privacyConsent,
    }),
    [
      service,
      projectScope,
      budgetRange,
      property,
      timeline,
      rooms,
      budgetComfort,
      estimateSummary,
      name,
      mobile,
      locality,
      message,
      whatsappConsent,
      privacyConsent,
    ]
  );

  const getNextIncompleteStep = useCallback(
    (): PmStep => computeNextStep(snapshot),
    [snapshot]
  );

  /**
   * Clear the answers, WITHOUT touching `isOpen` or `submitted`.
   *
   * Split out so that "close the sheet" and "forget the enquiry" can be
   * composed independently. Conflating them is what broke the success screen.
   */
  const resetEnquiry = useCallback(() => {
    setServiceState(null);
    setProjectScopeState(null);
    setBudgetRangeState(null);
    setPropertyState(null);
    setTimelineState(null);
    setRooms([]);
    setBudgetComfortState(null);
    setEstimateSummaryState(null);
    setName("");
    setMobile("");
    setLocality("");
    setMessageState("");
    setWhatsappConsent(false);
    setPrivacyConsent(false);
    setStepState(1);
  }, []);

  /**
   * Closing a FINISHED enquiry also forgets it.
   *
   * Every close path funnels through here — the header X, the scrim, Escape,
   * and the success screen's Done — so this is the one place that has to get
   * it right. If the visitor is closing a submitted enquiry, the next CTA must
   * open a blank form: their name, mobile, message, consent and the previous
   * submission reference are finished business and must not reappear.
   */
  /*
   * The sheet value is read through a ref so the close handlers KEEP A STABLE
   * IDENTITY.
   *
   * `useSheetOverlay` depends on `closePlanner` and re-runs whenever it
   * changes: it re-records the element to restore focus to and pulls focus
   * back to the first control in the panel. Accepting a lead changes the sheet
   * state, so a dependency-carrying `closePlanner` would yank focus off the
   * confirmation the instant it appeared. These handlers only ever run from a
   * click or a keypress, long after the effect below has flushed, so the ref
   * is never stale when it is actually read.
   */
  const sheetRef = useRef<LeadSheetState>(CLOSED_LEAD_SHEET);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  /** Apply a lifecycle transition, obeying its instruction about the answers. */
  const applyTransition = useCallback(
    (transition: LeadSheetTransition) => {
      if (transition.resetAnswers) resetEnquiry();
      setSheet(transition.state);
    },
    [resetEnquiry]
  );

  const closePlanner = useCallback(() => {
    applyTransition(closeSheet(sheetRef.current));
  }, [applyTransition]);

  const openPlanner = useCallback(
    (target?: PmStep) => {
      const transition = openSheet(sheetRef.current);
      if (transition.resetAnswers) {
        // A finished enquiry is being reopened: start over, at the beginning.
        resetEnquiry();
        setStepState(target ?? 1);
      } else {
        setStepState(target ?? computeNextStep(snapshot));
      }
      setSheet(transition.state);
    },
    [snapshot, resetEnquiry]
  );


  /**
   * Changing the service INVALIDATES a home answer it no longer fits.
   *
   * Switching to `custom-wardrobes` must clear both, because v4 requires their
   * absence for that service; switching between the two scoped services must
   * clear a scope that belonged to the other one, because a kitchen scope on a
   * complete-home enquiry is refused. Leaving stale values behind would let the
   * sheet look answered while the request it produces is rejected.
   */
  const setService = useCallback((next: PmServiceId) => {
    setServiceState(next);
    setProjectScopeState((scope) => {
      if (scope === null) return null;
      if (!v4RequiresScope(next)) return null;
      return serviceForProjectScope(scope) === next ? scope : null;
    });
    setBudgetRangeState((budget) => {
      if (budget === null) return null;
      if (!v4RequiresScope(next)) return null;
      return budget;
    });
  }, []);

  /** A new scope means a new ladder, so the band chosen from the old one goes. */
  const setProjectScope = useCallback((next: LeadProjectScopeCode) => {
    setProjectScopeState(next);
    setBudgetRangeState((budget) =>
      isBudgetRangeForScope(next, budget) ? budget : null
    );
  }, []);

  const setBudgetRange = useCallback((next: string) => {
    setBudgetRangeState(next);
  }, []);

  const setProperty = useCallback((next: PmPropertyId) => {
    setPropertyState(next);
  }, []);

  const setTimeline = useCallback((next: PmTimelineId) => {
    setTimelineState(next);
  }, []);

  const setBudgetComfort = useCallback((next: BudgetComfortId | null) => {
    setBudgetComfortState(next);
  }, []);

  const toggleRoom = useCallback((room: PmRoomId) => {
    setRooms((current) => toggleRoomIn(current, room));
  }, []);

  const addRoom = useCallback((room: PmRoomId) => {
    setRooms((current) => ensureRoomIn(current, room));
  }, []);

  const addAreaToPlanAndOpen = useCallback(
    (input: AddAreaToPlanInput) => {
      let nextRooms = snapshot.rooms;
      for (const room of input.rooms) {
        nextRooms = ensureRoomIn(nextRooms, room);
      }
      const nextService = input.service ?? snapshot.service;
      const prospective: PlanSnapshot = {
        ...snapshot,
        service: nextService,
        rooms: nextRooms,
      };
      const target = computeNextStep(prospective);
      const transition = openSheet(sheetRef.current);
      // Order matters: the reset runs first, these setters overwrite it.
      if (transition.resetAnswers) resetEnquiry();
      if (input.service) setServiceState(input.service);
      setRooms(nextRooms);
      setStepState(target);
      setSheet(transition.state);
    },
    [snapshot, resetEnquiry]
  );

  /**
   * Atomically apply estimator selection, compute the next step from a
   * prospective snapshot, then open the planner — never stale relative to
   * the just-applied estimate.
   */
  const applyEstimateToPlanAndOpen = useCallback(
    (selection: EstimatorPlanSelection) => {
      let nextRooms = snapshot.rooms;
      for (const room of selection.rooms) {
        nextRooms = ensureRoomIn(nextRooms, room);
      }
      const nextSummary = toEstimateSummary(selection);
      const prospective: PlanSnapshot = {
        ...snapshot,
        service: selection.service,
        projectScope: null,
        budgetRange: null,
        property: selection.property,
        rooms: nextRooms,
        budgetComfort: selection.budgetComfort,
        estimateSummary: nextSummary,
      };
      const target = computeNextStep(prospective);
      setServiceState(selection.service);
      setPropertyState(selection.property);
      /*
       * The estimator answers a different question — property size and finish,
       * not the v4 scope ladder — so it must not leave a scope from a service
       * it just replaced. It clears rather than guesses.
       */
      setProjectScopeState((scope) =>
        scope !== null &&
        v4RequiresScope(selection.service) &&
        serviceForProjectScope(scope) === selection.service
          ? scope
          : null
      );
      const transition = openSheet(sheetRef.current);
      // Order matters: the reset runs first, these setters overwrite it.
      if (transition.resetAnswers) resetEnquiry();
      setBudgetRangeState(null);
      setRooms(nextRooms);
      setBudgetComfortState(selection.budgetComfort);
      setEstimateSummaryState(nextSummary);
      setStepState(target);
      setSheet(transition.state);
    },
    [snapshot, resetEnquiry]
  );

  const setContact = useCallback((fields: Partial<PlanContactFields>) => {
    if (fields.name !== undefined) setName(fields.name);
    if (fields.mobile !== undefined) setMobile(fields.mobile);
    if (fields.locality !== undefined) setLocality(fields.locality);
    if (fields.whatsappConsent !== undefined) {
      setWhatsappConsent(fields.whatsappConsent);
    }
    if (fields.privacyConsent !== undefined) {
      setPrivacyConsent(fields.privacyConsent);
    }
  }, []);

  const setMessage = useCallback((next: string) => {
    setMessageState(next);
  }, []);

  const setStep = useCallback((next: PmStep) => {
    setStepState(next);
  }, []);

  const goNext = useCallback(() => {
    setStepState((current) => (current < 4 ? ((current + 1) as PmStep) : current));
  }, []);

  const goBack = useCallback(() => {
    setStepState((current) => (current > 1 ? ((current - 1) as PmStep) : current));
  }, []);

  /**
   * THE LEAD WAS ACCEPTED. THE SHEET STAYS OPEN.
   *
   * This used to also call `setIsOpen(false)`, and `HomePlannerSheet` returns
   * null while closed — so the instant the server answered 201 the sheet
   * unmounted, taking the success message and the submission reference with
   * it. From the visitor's side the form simply vanished: no confirmation, no
   * reference, no way to tell a successful enquiry from a lost one.
   *
   * Accepting a lead and closing the sheet are now separate events. The
   * visitor closes it themselves, via `finishSubmission` or any other close
   * path, once they have actually read the confirmation.
   */
  const markSubmitted = useCallback(
    (result: LeadSubmissionResult) => {
      applyTransition(acceptSubmission(sheetRef.current, result));
    },
    [applyTransition]
  );

  /** Done on the success screen: close it and clear the finished enquiry. */
  const finishSubmission = useCallback(() => {
    applyTransition(finishSubmissionTransition());
  }, [applyTransition]);

  const editSubmission = useCallback(() => {
    setSheet((current) => ({ ...current, submitted: false }));
    setStepState(4);
  }, []);

  const resetAll = useCallback(() => {
    applyTransition(resetSheet());
  }, [applyTransition]);

  const value = useMemo<PlanApi>(
    () => ({
      ...snapshot,
      step,
      isOpen,
      mode: "sheet",
      submitted,
      submissionReference,
      submissionDuplicate,
      completedSteps: completedStepCount(snapshot),
      progress: planProgressPercent(snapshot),
      openPlanner,
      closePlanner,
      setService,
      setProjectScope,
      setBudgetRange,
      setProperty,
      setTimeline,
      toggleRoom,
      addRoom,
      addAreaToPlanAndOpen,
      applyEstimateToPlanAndOpen,
      setBudgetComfort,
      setContact,
      setMessage,
      setStep,
      goNext,
      goBack,
      markSubmitted,
      finishSubmission,
      editSubmission,
      resetAll,
      getNextIncompleteStep,
    }),
    [
      snapshot,
      step,
      isOpen,
      submitted,
      submissionReference,
      submissionDuplicate,
      openPlanner,
      closePlanner,
      setService,
      setProjectScope,
      setBudgetRange,
      setProperty,
      setTimeline,
      toggleRoom,
      addRoom,
      addAreaToPlanAndOpen,
      applyEstimateToPlanAndOpen,
      setBudgetComfort,
      setContact,
      setMessage,
      setStep,
      goNext,
      goBack,
      markSubmitted,
      finishSubmission,
      editSubmission,
      resetAll,
      getNextIncompleteStep,
    ]
  );

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}

export function usePlan(): PlanApi {
  const ctx = useContext(PlanCtx);
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider");
  return ctx;
}
