"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  HomePlannerMode,
  PmPropertyId,
  PmRoomId,
  PmServiceId,
  PmStep,
  PmTimelineId,
} from "./content";
import {
  completedStepCount,
  getNextIncompleteStep as computeNextStep,
  planProgressPercent,
  ensureRoom as ensureRoomIn,
  toggleRoom as toggleRoomIn,
  type PlanSnapshot,
} from "./plan-state";

export interface PlanContactFields {
  readonly name: string;
  readonly mobile: string;
  readonly locality: string;
  readonly whatsappConsent: boolean;
  readonly privacyConsent: boolean;
}

interface PlanApi extends PlanSnapshot {
  readonly step: PmStep;
  readonly isOpen: boolean;
  readonly mode: HomePlannerMode;
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

/** Matches the CSS breakpoint at which the inline planner card is available. */
const INLINE_MIN_WIDTH = 1080;

function currentMode(): HomePlannerMode {
  if (typeof window === "undefined") return "sheet";
  return window.innerWidth >= INLINE_MIN_WIDTH ? "inline" : "sheet";
}

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
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [message, setMessageState] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [step, setStepState] = useState<PmStep>(1);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<HomePlannerMode>("sheet");
  const [submitted, setSubmitted] = useState(false);

  const snapshot = useMemo<PlanSnapshot>(
    () => ({
      service,
      property,
      timeline,
      rooms,
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
      setMode(currentMode());
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

  const toggleRoom = useCallback((room: PmRoomId) => {
    setRooms((current) => toggleRoomIn(current, room));
  }, []);

  const addRoom = useCallback((room: PmRoomId) => {
    setRooms((current) => ensureRoomIn(current, room));
  }, []);

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
      mode,
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
      mode,
      submitted,
      openPlanner,
      closePlanner,
      setService,
      setProperty,
      setTimeline,
      toggleRoom,
      addRoom,
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
