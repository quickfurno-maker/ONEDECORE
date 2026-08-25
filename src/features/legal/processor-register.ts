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
      "Managed database, authentication, Portfolio media storage, and public website lead-intake / CRM persistence",
    dataCategories: [
      "Admin user accounts and auth sessions",
      "Portfolio project metadata and published media",
      "Website lead intake requests and lead records",
      "Contact records linked to leads",
      "Consent evidence and lead events",
      "Application and security logs (as configured)",
    ],
    locationsKnown:
      "ap-south-1 / Mumbai — managed project OneDecore ref lpurlfmpvriyvpkujvyl (owner-confirmed + managed closeout records)",
    transferAssessment:
      "Primary project region is India (Mumbai). Provider terms may permit support/sub-processor processing outside the primary region — owner must review current Supabase DPA/sub-processor schedule before activation.",
    contractDpa:
      "Provider publishes a Data Processing Addendum at https://supabase.com/legal/dpa (and customer-resources DPA pages). Bespoke countersigned DPA is NOT claimed. Owner must confirm current Terms/DPA acceptance on the OneDecore Supabase account before leadProcessorsRegistered=true.",
    securityReview: "PARTIAL — server-only keys; encryption in transit assumed; storage encryption verification pending",
    deletionCapability: "Verify operational deletion for leads, contacts, consent evidence, Portfolio media and auth records",
    incidentContact: null,
    approval: null,
    notes: [
      "Verified current processor for existing DB/auth/Portfolio and the lead-intake RPC path.",
      "Region ap-south-1 / Mumbai and project ref lpurlfmpvriyvpkujvyl are documented from owner confirmation and repository managed closeouts.",
      "Public provider DPA URL recorded for diligence; do not invent a bespoke signed agreement.",
      "OWNER_PROVIDER_EVIDENCE_REQUIRED: confirm account-level Terms/DPA acceptance date/version and review current sub-processor list.",
    ],
  },
  {
    provider: "Hostinger VPS",
    status: "under-review",
    purpose: "Website hosting and TLS termination for the public Next.js application",
    dataCategories: [
      "HTTP request metadata (including lead-intake API requests when enabled)",
      "Static asset delivery",
      "Application process logs on the VPS (as configured)",
    ],
    locationsKnown: null,
    transferAssessment: "OWNER_PROVIDER_EVIDENCE_REQUIRED — VPS region/location from Hostinger account/server panel",
    contractDpa:
      "OWNER_PROVIDER_EVIDENCE_REQUIRED — Hostinger privacy/data-processing terms or DPA applicable to this account; bespoke signed agreement not claimed",
    securityReview: "PLANNED — verify with deployment configuration",
    deletionCapability: "Log retention per hosting provider policy — pending owner decision",
    incidentContact: null,
    approval: null,
    notes: [
      "Provider brand recorded from existing repository deployment documentation (Hostinger VPS).",
      "OWNER_PROVIDER_EVIDENCE_REQUIRED: contracting/legal entity on the ONEDECORE Hostinger account/invoice; VPS region; applicable privacy/DPA terms.",
      "Do not invent Hostinger legal entity, region, or DPA signing status.",
      "Still under-review for leadProcessorsRegistered completeness.",
    ],
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
  return entries.every((entry) => {
    const text = entry.contractDpa.toLowerCase();
    if (text.includes("bespoke countersigned dpa is not claimed")) return true;
    if (text.includes("bespoke signed agreement not claimed")) return true;
    if (text.startsWith("not claimed")) return true;
    if (text.startsWith("not signed")) return true;
    if (text.includes("owner_provider_evidence_required")) return true;
    return false;
  });
}

/** Current website-lead processors that must be diligence-complete before the flag. */
export function getWebsiteLeadProcessors(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): readonly ProcessorRegisterEntry[] {
  return entries.filter(
    (entry) =>
      entry.status === "current" ||
      (entry.status === "under-review" &&
        (entry.provider === "Hostinger VPS" ||
          entry.provider.toLowerCase().includes("host")))
  );
}

export function getMissingWebsiteLeadProcessorEvidence(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): readonly string[] {
  const missing: string[] = [];
  for (const entry of getWebsiteLeadProcessors(entries)) {
    if (entry.provider === "Supabase") {
      if (/OWNER_PROVIDER_EVIDENCE_REQUIRED/i.test(entry.notes.join(" "))) {
        missing.push(
          "Supabase: owner confirmation of account Terms/DPA acceptance date/version and current sub-processor list review"
        );
      }
    }
    if (entry.provider === "Hostinger VPS") {
      if (entry.locationsKnown == null) {
        missing.push("Hostinger: VPS region/location from account or server panel");
      }
      if (/OWNER_PROVIDER_EVIDENCE_REQUIRED/i.test(entry.contractDpa)) {
        missing.push(
          "Hostinger: contracting/legal entity and applicable privacy/DPA terms for this account"
        );
      }
    }
  }
  return missing;
}

export function areWebsiteLeadProcessorsReady(
  entries: readonly ProcessorRegisterEntry[] = PROCESSOR_REGISTER
): boolean {
  return getMissingWebsiteLeadProcessorEvidence(entries).length === 0;
}
