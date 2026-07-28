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
import type {
  CmPlannerStep,
  CmPropertyId,
  CmRoomId,
  CmServiceId,
  CmTimelineId,
} from "./content";

export type PlannerMode = "desktop-inline" | "mobile-sheet";

export interface LeadContactFields {
  name: string;
  mobile: string;
  locality: string;
  whatsappConsent: boolean;
  privacyConsent: boolean;
}

export interface LeadState extends LeadContactFields {
  service: CmServiceId | null;
  property: CmPropertyId | null;
  timeline: CmTimelineId | null;
  rooms: readonly CmRoomId[];
  step: CmPlannerStep;
  isOpen: boolean;
  submitted: boolean;
  mode: PlannerMode;
}

interface LeadContextValue extends LeadState {
  openPlanner: (step?: CmPlannerStep) => void;
  closePlanner: () => void;
  setService: (service: CmServiceId) => void;
  setProperty: (property: CmPropertyId) => void;
  setTimeline: (timeline: CmTimelineId) => void;
  setRooms: (rooms: readonly CmRoomId[]) => void;
  setContact: (fields: Partial<LeadContactFields>) => void;
  setStep: (step: CmPlannerStep) => void;
  goNext: () => void;
  goBack: () => void;
  markSubmitted: () => void;
  resetSubmitted: () => void;
}

const LeadContext = createContext<LeadContextValue | null>(null);

const DESKTOP_MQ = "(min-width: 1024px)";

function detectMode(): PlannerMode {
  if (typeof window === "undefined") return "desktop-inline";
  return window.matchMedia(DESKTOP_MQ).matches
    ? "desktop-inline"
    : "mobile-sheet";
}

export function LeadProvider({ children }: { children: ReactNode }) {
  const [service, setServiceState] = useState<CmServiceId | null>(null);
  const [property, setProperty] = useState<CmPropertyId | null>(null);
  const [timeline, setTimeline] = useState<CmTimelineId | null>(null);
  const [rooms, setRooms] = useState<readonly CmRoomId[]>([]);
  const [step, setStep] = useState<CmPlannerStep>(1);
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<PlannerMode>("desktop-inline");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => setMode(mq.matches ? "desktop-inline" : "mobile-sheet");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const openPlanner = useCallback((nextStep?: CmPlannerStep) => {
    setSubmitted(false);
    if (nextStep) setStep(nextStep);
    const current = detectMode();
    setMode(current);
    if (current === "mobile-sheet") {
      setIsOpen(true);
    } else {
      setIsOpen(true);
      const target = document.getElementById("cm-lead-planner");
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const closePlanner = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setService = useCallback((next: CmServiceId) => {
    setServiceState(next);
  }, []);

  const setContact = useCallback((fields: Partial<LeadContactFields>) => {
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

  const goNext = useCallback(() => {
    setStep((current) => (current < 4 ? ((current + 1) as CmPlannerStep) : current));
  }, []);

  const goBack = useCallback(() => {
    setStep((current) => (current > 1 ? ((current - 1) as CmPlannerStep) : current));
  }, []);

  const markSubmitted = useCallback(() => {
    setSubmitted(true);
  }, []);

  const resetSubmitted = useCallback(() => {
    setSubmitted(false);
  }, []);

  const value = useMemo<LeadContextValue>(
    () => ({
      service,
      property,
      timeline,
      rooms,
      step,
      isOpen,
      submitted,
      mode,
      name,
      mobile,
      locality,
      whatsappConsent,
      privacyConsent,
      openPlanner,
      closePlanner,
      setService,
      setProperty,
      setTimeline,
      setRooms,
      setContact,
      setStep,
      goNext,
      goBack,
      markSubmitted,
      resetSubmitted,
    }),
    [
      service,
      property,
      timeline,
      rooms,
      step,
      isOpen,
      submitted,
      mode,
      name,
      mobile,
      locality,
      whatsappConsent,
      privacyConsent,
      openPlanner,
      closePlanner,
      setService,
      setContact,
      goNext,
      goBack,
      markSubmitted,
      resetSubmitted,
    ]
  );

  return <LeadContext.Provider value={value}>{children}</LeadContext.Provider>;
}

export function useLead(): LeadContextValue {
  const ctx = useContext(LeadContext);
  if (!ctx) {
    throw new Error("useLead must be used within LeadProvider");
  }
  return ctx;
}
