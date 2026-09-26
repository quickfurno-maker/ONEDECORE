import type { WhatsappAutomationTrigger, WhatsappAutomationView } from "./automations";
import type { WhatsappSendPolicyRead } from "./send-policy";

export const ONEDECORE_WHATSAPP_AUTOMATION_PRESETS = [
  {
    id: "new-lead-nurture",
    title: "New lead nurture",
    summary: "Prepare a consent-gated marketing follow-up after a new CRM lead is created.",
    triggerType: "lead_created",
    toStage: "",
    delayMinutes: 60,
    stopOnLeadStatuses: ["closed_won", "closed_lost"],
    stopOnReply: true,
  },
  {
    id: "qualified-inspiration",
    title: "Qualified lead inspiration",
    summary: "Send approved design inspiration after a lead reaches Qualified, only when MARKETING consent exists.",
    triggerType: "lead_stage_changed",
    toStage: "qualified",
    delayMinutes: 1440,
    stopOnLeadStatuses: ["closed_won", "closed_lost", "on_hold"],
    stopOnReply: true,
  },
  {
    id: "consultation-follow-up",
    title: "Consultation follow-up",
    summary: "Prepare a follow-up after consultation scheduling; CRM tasks remain in CRM Cadence.",
    triggerType: "lead_stage_changed",
    toStage: "consultation_scheduled",
    delayMinutes: 180,
    stopOnLeadStatuses: ["closed_won", "closed_lost", "on_hold"],
    stopOnReply: true,
  },
  {
    id: "proposal-nurture",
    title: "Proposal nurture",
    summary: "Prepare a measured follow-up after the proposal stage, with reply and closed-stage stops.",
    triggerType: "lead_stage_changed",
    toStage: "proposal_sent",
    delayMinutes: 2880,
    stopOnLeadStatuses: ["closed_won", "closed_lost", "on_hold"],
    stopOnReply: true,
  },
  {
    id: "dormant-reengagement",
    title: "Dormant lead re-engagement",
    summary: "Prepare a consent-gated re-engagement for a dormant lead; use CRM audience rules to choose the eligible cohort.",
    triggerType: "lead_stage_changed",
    toStage: "on_hold",
    delayMinutes: 10080,
    stopOnLeadStatuses: ["closed_won", "closed_lost"],
    stopOnReply: true,
  },
  {
    id: "ctwa-follow-up",
    title: "Click-to-WhatsApp follow-up",
    summary: "Prepare a governed follow-up after a Click-to-WhatsApp referral; optional ad id can narrow the trigger.",
    triggerType: "ctwa_referral",
    toStage: "",
    delayMinutes: 60,
    stopOnLeadStatuses: ["closed_won", "closed_lost", "on_hold"],
    stopOnReply: true,
  },
] as const;


export const ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES = [
  {
    id: "new-enquiry-ack",
    title: "New enquiry acknowledgement",
    templatePresetId: "new-enquiry",
    event: "Website enquiry accepted",
    detail: "Immediate WHATSAPP_SERVICE acknowledgement when the enquiry has explicit WhatsApp service opt-in.",
  },
  {
    id: "designer-assignment",
    title: "Designer assignment",
    templatePresetId: "designer-assigned",
    event: "Designer assigned",
    detail: "Introduce the assigned designer after canonical CRM/project assignment.",
  },
  {
    id: "consultation-confirmation",
    title: "Consultation confirmation",
    templatePresetId: "consultation-confirmed",
    event: "Consultation scheduled",
    detail: "Confirm the customer appointment from the canonical CRM activity.",
  },
  {
    id: "consultation-reminder",
    title: "Consultation reminder",
    templatePresetId: "consultation-reminder",
    event: "Consultation reminder due",
    detail: "Reminder tied to the existing scheduled consultation.",
  },
  {
    id: "site-visit-confirmation",
    title: "Site visit confirmation",
    templatePresetId: "site-visit-confirmed",
    event: "Site visit scheduled",
    detail: "Confirm the existing site-visit appointment.",
  },
  {
    id: "site-visit-reminder",
    title: "Site visit reminder",
    templatePresetId: "site-visit-reminder",
    event: "Site visit reminder due",
    detail: "Reminder tied to the existing scheduled site visit.",
  },
  {
    id: "quotation-ready",
    title: "Quotation ready",
    templatePresetId: "quotation-ready",
    event: "Quotation finalized and available",
    detail: "Notify the customer that their existing quotation is ready.",
  },
  {
    id: "quotation-follow-up",
    title: "Quotation follow-up",
    templatePresetId: "quotation-follow-up",
    event: "Quotation follow-up CRM task due",
    detail: "Service follow-up tied to the customer's existing quotation.",
  },
  {
    id: "project-update",
    title: "Project update",
    templatePresetId: "project-update",
    event: "Project milestone recorded",
    detail: "Prepare a factual update from canonical project progress.",
  },
  {
    id: "payment-reminder",
    title: "Payment reminder",
    templatePresetId: "payment-reminder",
    event: "Project payment milestone due",
    detail: "Reminder about an existing project payment milestone.",
  },
  {
    id: "installation",
    title: "Installation schedule",
    templatePresetId: "installation-scheduled",
    event: "Installation scheduled",
    detail: "Notify the customer of the recorded installation start.",
  },
  {
    id: "handover",
    title: "Project handover",
    templatePresetId: "project-handover",
    event: "Handover scheduled",
    detail: "Coordinate the final walkthrough for the existing project.",
  },
  {
    id: "feedback",
    title: "Feedback request",
    templatePresetId: "feedback-request",
    event: "Project/service completed",
    detail: "Post-service feedback request after a completed customer journey.",
  },
] as const;

export type WhatsappUtilityAutomationRecipe =
  (typeof ONEDECORE_WHATSAPP_UTILITY_AUTOMATION_RECIPES)[number];

export type WhatsappAutomationPreset = (typeof ONEDECORE_WHATSAPP_AUTOMATION_PRESETS)[number];
export type WhatsappAutomationPresetId = WhatsappAutomationPreset["id"];

export function getWhatsappAutomationPreset(value: string | null | undefined): WhatsappAutomationPreset | null {
  return ONEDECORE_WHATSAPP_AUTOMATION_PRESETS.find((preset) => preset.id === value) ?? null;
}

export function buildWhatsappAutomationPresetHref(id: WhatsappAutomationPresetId): string {
  return `/admin/whatsapp/automations?new=1&preset=${encodeURIComponent(id)}`;
}

export interface WhatsappOperationalAlert {
  readonly id: string;
  readonly tone: "info" | "warning" | "critical";
  readonly title: string;
  readonly detail: string;
  readonly href: string | null;
}

export function buildWhatsappOperationalAlerts(input: {
  readonly automations: readonly WhatsappAutomationView[];
  readonly approvedCampaignCount: number;
  readonly sendPolicy: WhatsappSendPolicyRead;
  readonly approvedAcknowledgementTemplateCount: number;
  readonly outboundMode: "disabled" | "local-test" | "enabled";
}): readonly WhatsappOperationalAlert[] {
  const alerts: WhatsappOperationalAlert[] = [];
  const reconcile = input.automations.reduce((sum, automation) => sum + (automation.enrollmentStates.needs_reconcile ?? 0), 0);
  const failed = input.automations.reduce((sum, automation) => sum + (automation.enrollmentStates.failed ?? 0), 0);

  if (reconcile > 0) {
    alerts.push({
      id: "needs-reconcile",
      tone: "critical",
      title: `${reconcile} automation send${reconcile === 1 ? "" : "s"} need reconciliation`,
      detail: "Provider outcome is unknown. These sends are parked and are never retried automatically.",
      href: "/admin/whatsapp/automations",
    });
  }
  if (failed > 0) {
    alerts.push({
      id: "failed-enrollments",
      tone: "warning",
      title: `${failed} automation enrollment${failed === 1 ? "" : "s"} failed`,
      detail: "Review the automation evidence before changing any rule or template.",
      href: "/admin/whatsapp/automations",
    });
  }
  if (input.approvedCampaignCount === 0) {
    alerts.push({
      id: "no-approved-marketing-campaign",
      tone: "warning",
      title: "No approved WhatsApp MARKETING campaign is available",
      detail: "Automation recipes can be prepared, but none can become executable until an approved campaign version exists.",
      href: "/admin/whatsapp/campaigns",
    });
  }

  const executionOn = input.sendPolicy.kind === "configured" && input.sendPolicy.policy.executionEnabled;
  if (!executionOn || input.outboundMode !== "enabled") {
    alerts.push({
      id: "execution-safe-off",
      tone: "info",
      title: "WhatsApp automation execution is safely blocked",
      detail: "This is the expected pre-Meta state. Drafting and internal review remain available while the database gate or outbound kill switch is off.",
      href: "/admin/whatsapp/settings",
    });
  }

  if (input.approvedAcknowledgementTemplateCount === 0) {
    alerts.push({
      id: "lead-ack-waiting-template",
      tone: "info",
      title: "Website lead acknowledgement is prepared but dormant",
      detail: "The local onedecore_new_enquiry_ack Utility template exists, but no matching APPROVED provider template is available yet.",
      href: "/admin/whatsapp/templates",
    });
  }

  return alerts;
}

export interface WebsiteLeadAcknowledgementReadiness {
  readonly status: "dormant" | "ready-for-later-activation";
  readonly gates: readonly {
    readonly label: string;
    readonly ready: boolean;
    readonly detail: string;
  }[];
}

export function buildWebsiteLeadAcknowledgementReadiness(input: {
  readonly approvedTemplateCount: number;
  readonly outboundMode: "disabled" | "local-test" | "enabled";
}): WebsiteLeadAcknowledgementReadiness {
  const gates = [
    {
      label: "ONEDECORE Utility preset",
      ready: true,
      detail: "onedecore_new_enquiry_ack is present in the local Template Library.",
    },
    {
      label: "Website WhatsApp service opt-in",
      ready: true,
      detail: "Public lead intake captures WHATSAPP_SERVICE separately from MARKETING consent.",
    },
    {
      label: "Meta-approved Utility template",
      ready: input.approvedTemplateCount > 0,
      detail:
        input.approvedTemplateCount > 0
          ? "A matching approved provider template is recorded."
          : "Waiting for the matching provider template to be approved.",
    },
    {
      label: "Outbound provider activation",
      ready: input.outboundMode === "enabled",
      detail:
        input.outboundMode === "enabled"
          ? "Outbound provider mode is enabled."
          : "Outbound remains disabled/local-test; no acknowledgement can reach Meta.",
    },
  ] as const;
  return {
    status: gates.every((gate) => gate.ready) ? "ready-for-later-activation" : "dormant",
    gates,
  };
}

export function presetTriggerLabel(preset: WhatsappAutomationPreset): string {
  const trigger = preset.triggerType as WhatsappAutomationTrigger;
  if (trigger === "lead_stage_changed" && preset.toStage) {
    return `Lead reaches ${preset.toStage.replace(/_/g, " ")}`;
  }
  if (trigger === "lead_created") return "Lead created";
  if (trigger === "ctwa_referral") return "Click-to-WhatsApp referral";
  return trigger.replace(/_/g, " ");
}
