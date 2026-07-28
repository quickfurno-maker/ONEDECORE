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
import {
  getNextIncompleteStep as computeNextStep,
  type LeadSnapshot,
} from "./lead-state";

export type PlannerMode = "desktop-inline" | "mobile-sheet" | "desktop-modal";

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
  message: string;
  step: CmPlannerStep;
  isOpen: boolean;
  submitted: boolean;
  mode: PlannerMode;
  /** Compact entry card vs expanded multi-step on desktop. */
  plannerExpanded: boolean;
}

interface LeadContextValue extends LeadState {
  openPlanner: (step?: CmPlannerStep) => void;
  closePlanner: () => void;
  setService: (service: CmServiceId) => void;
  setProperty: (property: CmPropertyId) => void;
  setTimeline: (timeline: CmTimelineId) => void;
  setRooms: (rooms: readonly CmRoomId[]) => void;
  setContact: (fields: Partial<LeadContactFields>) => void;
  setMessage: (message: string) => void;
  setStep: (step: CmPlannerStep) => void;
  expandPlanner: () => void;
  goNext: () => void;
  goBack: () => void;
  markSubmitted: () => void;
  editSubmission: () => void;
  resetAll: () => void;
  getNextIncompleteStep: () => CmPlannerStep;
}

const LeadContext = createContext<LeadContextValue | null>(null);

const DESKTOP_MQ = "(min-width: 1024px)";
const WIDE_MQ = "(min-width: 1280px)";

function detectMode(): PlannerMode {
  if (typeof window === "undefined") return "desktop-inline";
  if (!window.matchMedia(DESKTOP_MQ).matches) return "mobile-sheet";
  if (!window.matchMedia(WIDE_MQ).matches) return "desktop-modal";
  return "desktop-inline";
}

function snapshotFrom(
  service: CmServiceId | null,
  property: CmPropertyId | null,
  timeline: CmTimelineId | null,
  rooms: readonly CmRoomId[],
  name: string,
  mobile: string,
  locality: string,
  message: string,
  whatsappConsent: boolean,
  privacyConsent: boolean
): LeadSnapshot {
  return {
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
  };
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
  const [plannerExpanded, setPlannerExpanded] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [message, setMessageState] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_MQ);
    const wide = window.matchMedia(WIDE_MQ);
    const sync = () => setMode(detectMode());
    sync();
    desktop.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      desktop.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  const getNextIncompleteStep = useCallback((): CmPlannerStep => {
    return computeNextStep(
      snapshotFrom(
        service,
        property,
        timeline,
        rooms,
        name,
        mobile,
        locality,
        message,
        whatsappConsent,
        privacyConsent
      )
    );
  }, [
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
  ]);

  const openPlanner = useCallback(
    (nextStep?: CmPlannerStep) => {
      setSubmitted(false);
      const current = detectMode();
      setMode(current);
      const target = nextStep ?? computeNextStep(
        snapshotFrom(
          service,
          property,
          timeline,
          rooms,
          name,
          mobile,
          locality,
          message,
          whatsappConsent,
          privacyConsent
        )
      );
      setStep(target);
      setPlannerExpanded(target > 1 || Boolean(service));
      setIsOpen(true);

      if (current === "desktop-inline") {
        requestAnimationFrame(() => {
          document
            .getElementById("cm-lead-planner")
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } else if (current === "desktop-modal") {
        requestAnimationFrame(() => {
          document
            .getElementById("cm-lead-planner-modal")
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    },
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

  const closePlanner = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setService = useCallback((next: CmServiceId) => {
    setServiceState(next);
    setPlannerExpanded(true);
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

  const setMessage = useCallback((value: string) => {
    setMessageState(value);
  }, []);

  const expandPlanner = useCallback(() => {
    setPlannerExpanded(true);
  }, []);

  const goNext = useCallback(() => {
    setStep((current) =>
      current < 4 ? ((current + 1) as CmPlannerStep) : current
    );
  }, []);

  const goBack = useCallback(() => {
    setStep((current) =>
      current > 1 ? ((current - 1) as CmPlannerStep) : current
    );
  }, []);

  const markSubmitted = useCallback(() => {
    setSubmitted(true);
    setIsOpen(false);
  }, []);

  const editSubmission = useCallback(() => {
    setSubmitted(false);
    setStep(4);
    setPlannerExpanded(true);
  }, []);

  const resetAll = useCallback(() => {
    setServiceState(null);
    setProperty(null);
    setTimeline(null);
    setRooms([]);
    setStep(1);
    setIsOpen(false);
    setSubmitted(false);
    setPlannerExpanded(false);
    setName("");
    setMobile("");
    setLocality("");
    setMessageState("");
    setWhatsappConsent(false);
    setPrivacyConsent(false);
  }, []);

  const value = useMemo<LeadContextValue>(
    () => ({
      service,
      property,
      timeline,
      rooms,
      message,
      step,
      isOpen,
      submitted,
      mode,
      plannerExpanded,
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
      setMessage,
      setStep,
      expandPlanner,
      goNext,
      goBack,
      markSubmitted,
      editSubmission,
      resetAll,
      getNextIncompleteStep,
    }),
    [
      service,
      property,
      timeline,
      rooms,
      message,
      step,
      isOpen,
      submitted,
      mode,
      plannerExpanded,
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
      setMessage,
      expandPlanner,
      goNext,
      goBack,
      markSubmitted,
      editSubmission,
      resetAll,
      getNextIncompleteStep,
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
