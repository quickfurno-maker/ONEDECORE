/**
 * Phase 3A1 — data retention matrix.
 * No final retention periods invented; owner and legal approval required.
 */

export const RETENTION_OWNER_DECISION_REQUIRED =
  "OWNER_DECISION_REQUIRED" as const;

export type RetentionDecisionStatus = typeof RETENTION_OWNER_DECISION_REQUIRED;

export type RetentionCategoryId =
  | "lead"
  | "contact"
  | "consent"
  | "withdrawal"
  | "suppression"
  | "whatsapp"
  | "media"
  | "ai-run"
  | "ai-summary"
  | "campaign"
  | "consultation"
  | "proposal"
  | "customer-project"
  | "warranty"
  | "grievance"
  | "rights-request"
  | "security-log"
  | "breach-record"
  | "backup";

export interface RetentionMatrixEntry {
  readonly category: RetentionCategoryId;
  readonly label: string;
  readonly purpose: string;
  readonly proposedRetention: RetentionDecisionStatus;
  readonly approvedRetention: RetentionDecisionStatus;
  readonly trigger: string;
  readonly deletionOrAnonymisation: string;
  readonly legalHold: RetentionDecisionStatus;
  readonly processorDeletion: string;
  readonly ownerApproval: null;
  readonly legalApproval: null;
  readonly notes: readonly string[];
}

export const RETENTION_MATRIX: readonly RetentionMatrixEntry[] = [
  {
    category: "lead",
    label: "Lead records",
    purpose: "Enquiry intake and sales follow-up",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Lead creation; conversion or closure",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["No lead store exists on current homepage."],
  },
  {
    category: "contact",
    label: "Contact records",
    purpose: "Ongoing client and prospect communication",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Contact creation; relationship end",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "consent",
    label: "Consent records",
    purpose: "Demonstrate lawful consent and copy version shown",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Consent capture; withdrawal",
    deletionOrAnonymisation: "Evidence retention after withdrawal — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["Must retain evidence sufficient to demonstrate consent when required by law."],
  },
  {
    category: "withdrawal",
    label: "Withdrawal records",
    purpose: "Honour opt-out and consent withdrawal requests",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Withdrawal request received",
    deletionOrAnonymisation: "Suppression list retention — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "suppression",
    label: "Suppression lists",
    purpose: "Prevent re-contact after opt-out",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Marketing or channel opt-out",
    deletionOrAnonymisation: "Minimum necessary suppression — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "whatsapp",
    label: "WhatsApp message records",
    purpose: "Service communication via WhatsApp",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Message exchange; channel opt-out",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Meta WhatsApp — pending DPA and deletion terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["WhatsApp is not live on current website."],
  },
  {
    category: "media",
    label: "Client and project media",
    purpose: "Portfolio, project documentation and delivery records",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Project completion; consent withdrawal",
    deletionOrAnonymisation: "Unpublish and delete per consent — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Supabase storage deletion capability — verify operationally",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "ai-run",
    label: "AI run logs",
    purpose: "Audit AI-assisted consultation interactions",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "AI session start/end",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Groq — pending DPA and deletion terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["Groq is not live."],
  },
  {
    category: "ai-summary",
    label: "AI summaries",
    purpose: "Operational summaries from AI-assisted sessions",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Summary generation",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Groq — pending DPA and deletion terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "campaign",
    label: "Campaign data",
    purpose: "Marketing campaign attribution and performance",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Campaign start/end; opt-out",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Analytics — pending when approved",
    ownerApproval: null,
    legalApproval: null,
    notes: ["No campaign engine on current website."],
  },
  {
    category: "consultation",
    label: "Consultation records",
    purpose: "Schedule and document design consultations",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Consultation booking; completion",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["No consultation booking on current website."],
  },
  {
    category: "proposal",
    label: "Proposal and quotation records",
    purpose: "Commercial proposals and signed quotations",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Proposal issue; acceptance or expiry",
    deletionOrAnonymisation: "Statutory and contractual minimums — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "customer-project",
    label: "Customer and project records",
    purpose: "Active and completed interior project delivery",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Project start; completion; warranty period",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "warranty",
    label: "Warranty claim records",
    purpose: "Process and evidence warranty claims",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Claim filing; resolution",
    deletionOrAnonymisation: "Pending owner-approved schedule aligned with warranty terms",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["Detailed warranty terms not yet effective."],
  },
  {
    category: "grievance",
    label: "Grievance records",
    purpose: "Handle privacy and service grievances under applicable law",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Grievance received; resolution",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["Grievance contact pending owner input."],
  },
  {
    category: "rights-request",
    label: "Data rights requests",
    purpose: "Access, correction, erasure and related rights requests",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Request received; fulfilled or refused with reason",
    deletionOrAnonymisation: "Evidence of response — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["No automated rights-request submission on current website."],
  },
  {
    category: "security-log",
    label: "Security logs",
    purpose: "Detect, investigate and respond to security events",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Security event; routine rotation",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Supabase and hosting — verify deletion capability",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
  {
    category: "breach-record",
    label: "Breach records",
    purpose: "Document personal-data breach assessment and response",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Incident detected; closed",
    deletionOrAnonymisation: "Pending owner-approved schedule",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Pending processor contract terms",
    ownerApproval: null,
    legalApproval: null,
    notes: ["Breach playbook documented separately; operational compliance not claimed complete."],
  },
  {
    category: "backup",
    label: "Backups",
    purpose: "Disaster recovery and business continuity",
    proposedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    approvedRetention: RETENTION_OWNER_DECISION_REQUIRED,
    trigger: "Backup cycle; restore test",
    deletionOrAnonymisation: "Rolling backup expiry — pending owner decision",
    legalHold: RETENTION_OWNER_DECISION_REQUIRED,
    processorDeletion: "Hosting / Supabase backup policies — verify",
    ownerApproval: null,
    legalApproval: null,
    notes: [],
  },
] as const;

export function allRetentionPeriodsUnresolved(
  entries: readonly RetentionMatrixEntry[] = RETENTION_MATRIX
): boolean {
  return entries.every(
    (entry) =>
      entry.proposedRetention === RETENTION_OWNER_DECISION_REQUIRED &&
      entry.approvedRetention === RETENTION_OWNER_DECISION_REQUIRED
  );
}
