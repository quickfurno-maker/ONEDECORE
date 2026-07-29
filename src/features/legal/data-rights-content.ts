/**
 * Phase 3A1 — data rights page draft content source.
 */

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}

export const DATA_RIGHTS_CONTENT: readonly LegalContentSection[] = [
  {
    id: "draft-status",
    title: "Draft status",
    body: [
      "This Data Rights information page is a draft for owner and Indian legal counsel review. It is not yet effective.",
      "No automated data-rights request submission exists on the current website.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: [
      "Depending on applicable law, you may have the following rights regarding your personal data once ONEDECORE begins processing it:",
      "Right of access — obtain confirmation and a copy of personal data being processed.",
      "Right of correction — request correction of inaccurate or incomplete data.",
      "Right of completion — request completion of incomplete personal data.",
      "Right of updating — request updating of outdated personal data.",
      "Right of erasure — request deletion when retention is no longer necessary or lawful grounds no longer apply.",
      "Right to withdraw consent — withdraw consent where processing is consent-based.",
      "Right to opt out of marketing — stop optional marketing communications.",
      "Right to opt out of WhatsApp — withdraw WhatsApp channel consent separately from other channels.",
      "Right to grievance — raise a privacy grievance with ONEDECORE.",
      "Right of nomination — nominate another individual to exercise rights on your behalf where applicable under law.",
    ],
  },
  {
    id: "current-limitations",
    title: "Current website limitations",
    body: [
      "The current homepage does not collect or store contact submissions.",
      "WhatsApp, Groq AI, CRM and campaign systems are not live.",
      "If you have not yet shared personal data with ONEDECORE through an operational channel, some rights may not yet apply.",
    ],
  },
  {
    id: "how-to-request",
    title: "How to make a request",
    body: [
      "Use the local request template below to prepare your request.",
      "Copy or download the template and send it using the contact route once published by the owner.",
      "Data rights contact email: pending owner input.",
      "Nothing is sent automatically from this website.",
      "No ticket or case ID is created by the template tool.",
    ],
  },
  {
    id: "identity-verification",
    title: "Identity verification",
    body: [
      "ONEDECORE may need reasonable information to verify your identity before responding to a request.",
      "Verification measures will be proportionate and documented once procedures are approved.",
    ],
  },
  {
    id: "response-timing",
    title: "Response timing",
    body: [
      "Response timelines will follow applicable Indian data-protection law once operational procedures and contacts are published.",
      "LEGAL_COUNSEL_REQUIRED: statutory timeline references and extension wording.",
    ],
  },
  {
    id: "withdrawal-marketing",
    title: "Marketing and WhatsApp opt-out",
    body: [
      "Marketing consent is optional and separate from service consent.",
      "WhatsApp opt-out is separate from email or phone service communication.",
      "Withdrawal must be as easy as granting consent.",
    ],
  },
  {
    id: "grievance",
    title: "Grievance",
    body: [
      "Grievance contact: pending owner input.",
      "If you believe your personal data has been handled improperly, you may raise a grievance using the published contact route once available.",
    ],
  },
  {
    id: "complaint-escalation",
    title: "Escalation",
    body: [
      "If you remain dissatisfied with ONEDECORE's response, you may escalate under applicable law once enforcement mechanisms are available.",
      "LEGAL_COUNSEL_REQUIRED: escalation and regulatory reference wording.",
    ],
  },
  {
    id: "template-notice",
    title: "About the request template",
    body: [
      "The template on this page is for your convenience only.",
      "Using the template does not submit data to ONEDECORE.",
      "You must send your completed request through a published contact channel when available.",
    ],
  },
] as const;

/** Future types only — no API or database implementation. */
export type DataRightsRequestType =
  | "access"
  | "correction"
  | "completion"
  | "update"
  | "erasure"
  | "consent-withdrawal"
  | "marketing-opt-out"
  | "whatsapp-opt-out"
  | "grievance"
  | "nomination";

export interface DataRightsRequestContract {
  readonly requestId: string | null;
  readonly requestType: DataRightsRequestType;
  readonly requesterName: string;
  readonly requesterEmail: string | null;
  readonly requesterPhone: string | null;
  readonly description: string;
  readonly submittedAt: string | null;
  readonly status: "draft-local-only" | "submitted" | "in-review" | "fulfilled" | "refused";
  readonly responseDueAt: string | null;
  readonly evidenceReference: string | null;
}
