/**
 * Phase 3A1 — authoritative Indian DPDP legal source registry.
 * Records sources and staged commencement; does not claim compliance.
 */

export const LEGAL_DPDP_READINESS_STATEMENT =
  "Designed for DPDP readiness; owner, operational and Indian legal-counsel review remain pending." as const;

export interface LegalSourceReference {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly notes?: readonly string[];
}

export interface DpdpCommencementStage {
  readonly id: string;
  readonly label: string;
  readonly timing: string;
  readonly description: string;
}

export const DPDP_ACT_2023: LegalSourceReference = {
  id: "dpdp-act-2023",
  title: "Digital Personal Data Protection Act, 2023",
  publisher: "India Code",
  url: "https://www.indiacode.nic.in/handle/123456789/22037",
  notes: [
    "Primary legislation governing digital personal data processing in India.",
    "ONEDECORE architecture is designed for future-effective obligations; compliance is not claimed.",
  ],
} as const;

export const DPDP_RULES_2025: LegalSourceReference = {
  id: "dpdp-rules-2025",
  title: "Digital Personal Data Protection Rules, 2025",
  publisher: "Ministry of Electronics and Information Technology (MeitY)",
  url: "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa",
  notes: [
    "Subordinate rules under the DPDP Act, 2023.",
    "Staged commencement applies — see DPDP_COMMENCEMENT_STAGES.",
  ],
} as const;

export const DPDP_COMMENCEMENT_STAGES: readonly DpdpCommencementStage[] = [
  {
    id: "nov-2025-institutional",
    label: "November 2025 — institutional and procedural provisions",
    timing: "November 2025",
    description:
      "Specified institutional and procedural provisions under the DPDP framework commenced in November 2025.",
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
  "MeitY published the DPDP Act enforcement timeline in November 2025.",
  "ONEDECORE is being designed for DPDP readiness ahead of applicable commencement dates.",
  "Final operational compliance requires owner decisions, processor contracts, and qualified Indian legal-counsel review.",
  LEGAL_DPDP_READINESS_STATEMENT,
] as const;

export const LEGAL_SOURCE_REGISTRY: readonly LegalSourceReference[] = [
  DPDP_ACT_2023,
  DPDP_RULES_2025,
] as const;

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
