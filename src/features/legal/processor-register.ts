/**
 * Phase 3A1 — data processor register.
 * Current verified processors only; planned integrations marked not active.
 * No signed DPA or India-only processing claims.
 */

export type ProcessorStatus = "current" | "planned" | "under-review" | "retired";

export interface ProcessorRegisterEntry {
  readonly provider: string;
  readonly status: ProcessorStatus;
  readonly purpose: string;
  readonly dataCategories: readonly string[];
  readonly locationsKnown: string | null;
  readonly transferAssessment: string;
  readonly contractDpa: string;
  readonly securityReview: string;
  readonly deletionCapability: string;
  readonly incidentContact: string | null;
  readonly approval: null;
  readonly notes: readonly string[];
}

export const PROCESSOR_REGISTER: readonly ProcessorRegisterEntry[] = [
  {
    provider: "Supabase",
    status: "current",
    purpose:
      "Database, authentication and Portfolio media storage for existing admin and public Portfolio features",
    dataCategories: [
      "Admin user accounts and auth sessions",
      "Portfolio project metadata and published media",
      "Application and security logs (as configured)",
    ],
    locationsKnown: "Verify current Supabase project region with owner — not asserted here",
    transferAssessment: "OWNER_DECISION_REQUIRED — cross-border transfer assessment pending",
    contractDpa: "Not claimed signed — verify Supabase DPA and sub-processor terms",
    securityReview: "PARTIAL — server-only keys; encryption in transit assumed; storage encryption verification pending",
    deletionCapability: "Verify operational deletion for Portfolio media and auth records",
    incidentContact: null,
    approval: null,
    notes: [
      "Only verified current processor for actual existing DB/auth/Portfolio use.",
      "Do not claim India-only processing.",
    ],
  },
  {
    provider: "Hosting provider",
    status: "under-review",
    purpose: "Website hosting and TLS termination",
    dataCategories: [
      "HTTP request metadata when backend is active",
      "Static asset delivery",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED — hosting region pending verification",
    contractDpa: "Not claimed signed",
    securityReview: "PLANNED — verify with deployment configuration",
    deletionCapability: "Log retention per hosting provider policy — pending owner decision",
    incidentContact: null,
    approval: null,
    notes: ["Include only when hosting provider is verified for production deployment."],
  },
  {
    provider: "Meta WhatsApp Business Platform",
    status: "planned",
    purpose: "WhatsApp service communication channel",
    dataCategories: [
      "Phone numbers",
      "WhatsApp message content",
      "Delivery and read receipts",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED — Meta cross-border terms pending review",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending Meta platform and contract terms",
    incidentContact: null,
    approval: null,
    notes: ["WhatsApp is not live on the current website."],
  },
  {
    provider: "Groq",
    status: "planned",
    purpose: "AI-assisted consultation drafting and summarisation",
    dataCategories: [
      "Enquiry and message content sent for AI processing",
      "Session summaries",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED — AI processor location and transfer pending review",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending Groq contract and operational deletion workflow",
    incidentContact: null,
    approval: null,
    notes: ["Groq processing is not live."],
  },
  {
    provider: "n8n",
    status: "planned",
    purpose: "Workflow automation for operational follow-ups",
    dataCategories: [
      "Contact identifiers",
      "Workflow trigger payloads",
      "Integration metadata",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED — self-hosted vs cloud deployment pending",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending deployment model and workflow design",
    incidentContact: null,
    approval: null,
    notes: ["Automation workflows are not live."],
  },
  {
    provider: "Monitoring (provider TBD)",
    status: "planned",
    purpose: "Application uptime, error and performance monitoring",
    dataCategories: [
      "Error payloads",
      "Performance metrics",
      "Potentially request metadata",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending provider selection",
    incidentContact: null,
    approval: null,
    notes: [],
  },
  {
    provider: "Email / SMS (provider TBD)",
    status: "planned",
    purpose: "Transactional and service communication delivery",
    dataCategories: [
      "Email addresses",
      "Phone numbers",
      "Message content",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending provider selection",
    incidentContact: null,
    approval: null,
    notes: [],
  },
  {
    provider: "Analytics (provider TBD)",
    status: "planned",
    purpose: "Website usage analytics if separately approved",
    dataCategories: [
      "Device and usage metrics",
      "Page views",
      "Campaign attribution if enabled",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_DECISION_REQUIRED",
    contractDpa: "Not signed — not active",
    securityReview: "NOT IMPLEMENTED",
    deletionCapability: "Pending provider selection",
    incidentContact: null,
    approval: null,
    notes: [
      "No analytics, Meta Pixel or non-essential tracking approved on current website.",
    ],
  },
] as const;

export function getCurrentProcessors(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): readonly ProcessorRegisterEntry[] {
  return entries.filter((entry) => entry.status === "current");
}

export function getPlannedProcessors(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): readonly ProcessorRegisterEntry[] {
  return entries.filter((entry) => entry.status === "planned");
}

export function noSignedDpaClaimed(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): boolean {
  return entries.every(
    (entry) =>
      entry.contractDpa.startsWith("Not claimed") ||
      entry.contractDpa.startsWith("Not signed")
  );
}
