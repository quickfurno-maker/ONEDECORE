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
      "Provider publishes a Data Processing Addendum at https://supabase.com/legal/dpa (Schedule 3 sub-processors). Bespoke countersigned DPA is NOT claimed. Owner review confirmed 2026-08-25: current applicable Supabase Terms/DPA accepted for continued use; current sub-processor schedule reviewed at operational level. Historical account-acceptance timestamp not independently available.",
    securityReview: "PARTIAL — server-only keys; encryption in transit assumed; storage encryption verification pending",
    deletionCapability: "Verify operational deletion for leads, contacts, consent evidence, Portfolio media and auth records",
    incidentContact: null,
    approval: null,
    notes: [
      "Verified current processor for existing DB/auth/Portfolio and the lead-intake RPC path.",
      "Project OneDecore ref lpurlfmpvriyvpkujvyl, region ap-south-1 / Mumbai, status ACTIVE_HEALTHY, created 2026-07-24T17:14:53Z.",
      "Verified billing: Supabase Pte. Ltd. invoice VSWLVE-00005 dated 2026-08-22 for quickfurno-maker's Org including project ref lpurlfmpvriyvpkujvyl.",
      "Owner attestation 2026-08-25: approves Supabase as current website-lead processor; reviewed current DPA and Schedule 3 sub-processors; no bespoke signed DPA claimed.",
      "Historical Terms/DPA acceptance timestamp not independently available; current owner review confirmed 2026-08-25.",
    ],
  },
  {
    provider: "Hostinger VPS",
    status: "current",
    purpose: "Website hosting and TLS termination for the public Next.js application",
    dataCategories: [
      "HTTP request metadata (including lead-intake API requests when enabled)",
      "Static asset delivery",
      "Application process logs on the VPS (as configured)",
    ],
    locationsKnown:
      "Mumbai, India — VPS srv1927220.hstgr.cloud (IPv4 91.108.105.192 within Hostinger geofeed 91.108.104.0/21 → IN/Mumbai)",
    transferAssessment:
      "Primary VPS location Mumbai, India per provisioned IP and Hostinger published geofeed. Provider terms may permit support/sub-processor processing outside the primary region — owner reviewed current Hostinger privacy/DPA terms 2026-08-25.",
    contractDpa:
      "India contracting entity HOSTINGER PTE LTD per Hostinger official List of countries (India Group No. 1). Provider publishes a Data Processing Addendum at https://www.hostinger.com/legal/data-processing-addendum covering relevant Hostinger affiliates per published text. Bespoke countersigned DPA is NOT claimed. Owner review confirmed 2026-08-25: current applicable Hostinger Terms, Hosting Agreement, and privacy/DPA terms accepted for continued use. Historical account-acceptance timestamp not independently available.",
    securityReview: "PLANNED — verify with deployment configuration",
    deletionCapability: "Log retention per hosting provider policy — pending owner decision",
    incidentContact: null,
    approval: null,
    notes: [
      "Verified account/order H_49416957 (KVM 2, payment email 2026-08-24, account quickfurno@gmail.com) provides production ONEDECORE VPS.",
      "Verified provisioning: srv1927220.hstgr.cloud, IPv4 91.108.105.192, IPv6 2a02:4780:12:3403::1, Ubuntu 24.04 LTS.",
      "Contracting entity HOSTINGER PTE LTD per official India Group No. 1 rule; marketing emails may show Hostinger International Ltd. branding — not used as contracting entity.",
      "Owner attestation 2026-08-25: approves Hostinger as current website-lead processor; no bespoke signed DPA claimed.",
      "Historical Terms/DPA acceptance timestamp not independently available; current owner review confirmed 2026-08-25.",
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
