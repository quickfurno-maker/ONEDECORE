/**
 * Phase 3A1.1 — authoritative Indian DPDP legal source registry.
 * Records sources and staged commencement; does not claim compliance.
 */

export const LEGAL_DPDP_READINESS_STATEMENT =
  "Designed for DPDP readiness; owner, operational and Indian legal-counsel review remain pending." as const;

export const LEGAL_SOURCE_AUTHORITIES = [
  "India Code",
  "Ministry of Electronics and Information Technology (MeitY)",
  "Gazette of India",
] as const;

export type LegalSourceAuthority = (typeof LEGAL_SOURCE_AUTHORITIES)[number];

export type LegalSourceType =
  | "primary-legislation"
  | "subordinate-rules"
  | "implementation-timeline"
  | "corrigendum"
  | "related-notification";

export type LegalSourceStatus = "registered" | "linked-note" | "pending-official-url";

export interface LegalSourceReference {
  readonly id: string;
  readonly title: string;
  readonly authority: LegalSourceAuthority;
  readonly publicationDate: string;
  readonly sourceUrl: string;
  readonly sourceType: LegalSourceType;
  readonly jurisdiction: "India";
  readonly implementationRelevance: string;
  readonly reviewedAt: string;
  readonly notes: readonly string[];
  readonly status: LegalSourceStatus;
}

export interface DpdpCommencementStage {
  readonly id: string;
  readonly label: string;
  readonly timing: string;
  readonly description: string;
}

/** MeitY Act & Policies document landing used for Rules and listed Enforcement Timeline. */
export const MEITY_DPDP_RULES_LANDING_URL =
  "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa" as const;

export const DPDP_ACT_2023: LegalSourceReference = {
  id: "dpdp-act-2023",
  title: "Digital Personal Data Protection Act, 2023",
  authority: "India Code",
  publicationDate: "2023-08-11",
  sourceUrl: "https://www.indiacode.nic.in/handle/123456789/22037",
  sourceType: "primary-legislation",
  jurisdiction: "India",
  implementationRelevance:
    "Primary legislation governing digital personal data processing; ONEDECORE designs for future-effective obligations without claiming compliance.",
  reviewedAt: "2026-07-29",
  status: "registered",
  notes: [
    "Official India Code handle for the Act.",
    "Publication date records Presidential assent date commonly associated with Act 22 of 2023; confirm exact Gazette particulars on India Code.",
  ],
} as const;

export const DPDP_RULES_2025: LegalSourceReference = {
  id: "dpdp-rules-2025",
  title: "Digital Personal Data Protection Rules, 2025",
  authority: "Ministry of Electronics and Information Technology (MeitY)",
  publicationDate: "2025-11-14",
  sourceUrl: MEITY_DPDP_RULES_LANDING_URL,
  sourceType: "subordinate-rules",
  jurisdiction: "India",
  implementationRelevance:
    "Subordinate rules under the DPDP Act, including staged commencement for notice, consent, safeguards and related operational duties.",
  reviewedAt: "2026-07-29",
  status: "registered",
  notes: [
    "Official MeitY document listing for the Digital Personal Data Protection Rules, 2025.",
    "Publication date aligns with the November 2025 MeitY notification cluster (including G.S.R. 846(E) references); confirm exact Gazette imprint against the Official Gazette.",
    "Linked: December 2025 corrigendum G.S.R. 892(E) — see registry entry dpdp-rules-2025-corrigendum.",
  ],
} as const;

export const DPDP_ENFORCEMENT_TIMELINE: LegalSourceReference = {
  id: "dpdp-enforcement-timeline-2025",
  title: "Enforcement Timeline for the DPDP Act",
  authority: "Ministry of Electronics and Information Technology (MeitY)",
  publicationDate: "2025-11-14",
  sourceUrl: MEITY_DPDP_RULES_LANDING_URL,
  sourceType: "implementation-timeline",
  jurisdiction: "India",
  implementationRelevance:
    "Official MeitY-listed enforcement timeline describing staged commencement of Act and Rules provisions; used to plan readiness ahead of applicable dates.",
  reviewedAt: "2026-07-29",
  status: "registered",
  notes: [
    "Distinct MeitY-listed document: Enforcement Timeline for the DPDP Act.",
    "Shares the MeitY Digital Personal Data Protection Rules, 2025 document landing URL because MeitY lists the Timeline alongside the Rules on that page; this entry is not a duplicate of the Rules text.",
    "Staged commencement recorded in DPDP_COMMENCEMENT_STAGES.",
  ],
} as const;

/**
 * Corrigendum to the DPDP Rules, 2025.
 * Registered as a distinct source. Exact egazette PDF URL remains pending
 * confirmation; MeitY Rules landing is retained as the parent listing context.
 */
export const DPDP_RULES_2025_CORRIGENDUM: LegalSourceReference = {
  id: "dpdp-rules-2025-corrigendum",
  title: "Corrigendum to the Digital Personal Data Protection Rules, 2025 (G.S.R. 892(E))",
  authority: "Gazette of India",
  publicationDate: "2025-12-11",
  sourceUrl: MEITY_DPDP_RULES_LANDING_URL,
  sourceType: "corrigendum",
  jurisdiction: "India",
  implementationRelevance:
    "Clerical corrigendum to the notified Rules; does not replace staged commencement planning.",
  reviewedAt: "2026-07-29",
  status: "pending-official-url",
  notes: [
    "Notification number G.S.R. 892(E); December 2025 corrigendum to G.S.R. 846(E).",
    "Exact Official Gazette PDF URL not hardcoded until an official India Code / egazette URL is verified without relying on secondary aggregators.",
    "Parent listing context: MeitY Digital Personal Data Protection Rules, 2025 document page.",
  ],
} as const;

export const DPDP_COMMENCEMENT_STAGES: readonly DpdpCommencementStage[] = [
  {
    id: "nov-2025-institutional",
    label: "November 2025 — institutional and procedural provisions",
    timing: "November 2025 (notification cluster including 14 November 2025)",
    description:
      "Specified institutional and procedural provisions under the DPDP framework commenced in November 2025 per the Enforcement Timeline.",
  },
  {
    id: "rule-4-consent-manager",
    label: "Rule 4 and consent-manager provisions",
    timing: "One year after notification",
    description:
      "Rule 4 and linked consent-manager provisions commence one year after notification of the DPDP Rules, 2025.",
  },
  {
    id: "operational-rules",
    label: "Rules 3, 5–16, 22–23 and linked operational provisions",
    timing: "Eighteen months after notification",
    description:
      "Rules 3, 5–16, 22–23 and linked operational provisions commence eighteen months after notification of the DPDP Rules, 2025.",
  },
] as const;

export const MEITY_ENFORCEMENT_TIMELINE_NOTES: readonly string[] = [
  "Enforcement Timeline for the DPDP Act is registered as LEGAL_SOURCE_REGISTRY entry dpdp-enforcement-timeline-2025.",
  "ONEDECORE is being designed for DPDP readiness ahead of applicable commencement dates.",
  "Final operational compliance requires owner decisions, processor contracts, and qualified Indian legal-counsel review.",
  LEGAL_DPDP_READINESS_STATEMENT,
] as const;

export const LEGAL_SOURCE_REGISTRY: readonly LegalSourceReference[] = [
  DPDP_ACT_2023,
  DPDP_RULES_2025,
  DPDP_ENFORCEMENT_TIMELINE,
  DPDP_RULES_2025_CORRIGENDUM,
] as const;

export const LEGAL_SOURCE_REGISTRY_COUNT = LEGAL_SOURCE_REGISTRY.length;

export const DPDP_CORE_PRINCIPLES: readonly string[] = [
  "Independent, clear and plain notice",
  "Itemised personal data",
  "Specified purposes",
  "Specific goods, services or use enabled",
  "Purpose limitation",
  "Data minimisation",
  "Easy consent withdrawal",
  "Access, correction, erasure and grievance paths",
  "Processor contracts",
  "Reasonable safeguards",
  "Breach readiness",
  "Deletion when purpose ends, subject to lawful retention",
  "Public privacy and grievance contact",
  "No dark-pattern consent",
] as const;

export function isAllowlistedAuthority(authority: string): boolean {
  return (LEGAL_SOURCE_AUTHORITIES as readonly string[]).includes(authority);
}

export function allSourcesHaveHttpsUrls(
  sources: readonly LegalSourceReference[] = LEGAL_SOURCE_REGISTRY
): boolean {
  return sources.every((source) => /^https:\/\//i.test(source.sourceUrl));
}
