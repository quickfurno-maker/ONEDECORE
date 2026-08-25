"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { PM_PLANNER } from "./content";
import type { EstimatorPlanSelection } from "./estimator-plan-map";
import { toEstimateSummary } from "./estimator-plan-map";
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
  readonly markSubmitted: () => void;
  readonly editSubmission: () => void;
  readonly resetAll: () => void;
  readonly getNextIncompleteStep: () => PmStep;
}

const PlanCtx = createContext<PlanApi | null>(null);

/**
 * Single source of truth for the interior plan. Every CTA on the page routes
 * through `openPlanner`, so there is one journey, one submission path, and one
 * success state. Prototype only — nothing leaves the browser.
 */
export function PlanProvider({ children }: { readonly children: ReactNode }) {
  const [service, setServiceState] = useState<PmServiceId | null>(null);
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
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (service !== null || typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("service");
    if (!raw) return;
    if (PM_PLANNER.services.some((row) => row.id === raw)) {
      setServiceState(raw as PmServiceId);
    }
  }, [service]);

  const snapshot = useMemo<PlanSnapshot>(
    () => ({
      service,
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

  const openPlanner = useCallback(
    (target?: PmStep) => {
      setStepState(target ?? computeNextStep(snapshot));
      setIsOpen(true);
    },
    [snapshot]
  );

  const closePlanner = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setService = useCallback((next: PmServiceId) => {
    setServiceState(next);
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
      if (input.service) setServiceState(input.service);
      setRooms(nextRooms);
      setStepState(target);
      setIsOpen(true);
    },
    [snapshot]
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
        property: selection.property,
        rooms: nextRooms,
        budgetComfort: selection.budgetComfort,
        estimateSummary: nextSummary,
      };
      const target = computeNextStep(prospective);
      setServiceState(selection.service);
      setPropertyState(selection.property);
      setRooms(nextRooms);
      setBudgetComfortState(selection.budgetComfort);
      setEstimateSummaryState(nextSummary);
      setStepState(target);
      setIsOpen(true);
    },
    [snapshot]
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

  const markSubmitted = useCallback(() => {
    setSubmitted(true);
    setIsOpen(false);
  }, []);

  const editSubmission = useCallback(() => {
    setSubmitted(false);
    setStepState(4);
  }, []);

  const resetAll = useCallback(() => {
    setServiceState(null);
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
    setIsOpen(false);
    setSubmitted(false);
  }, []);

  const value = useMemo<PlanApi>(
    () => ({
      ...snapshot,
      step,
      isOpen,
      mode: "sheet",
      submitted,
      completedSteps: completedStepCount(snapshot),
      progress: planProgressPercent(snapshot),
      openPlanner,
      closePlanner,
      setService,
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
      editSubmission,
      resetAll,
      getNextIncompleteStep,
    }),
    [
      snapshot,
      step,
      isOpen,
      submitted,
      openPlanner,
      closePlanner,
      setService,
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
