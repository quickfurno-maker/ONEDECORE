/**
 * Phase 3A1 — privacy policy draft content source.
 */

import { LEGAL_DPDP_READINESS_STATEMENT } from "./legal-publication.ts";
import { BUSINESS_IDENTITY, getMissingLegalPublicationFields } from "./business-identity.ts";

/** Canonical privacy notice version for consent evidence (draft-review). */
export const PRIVACY_NOTICE_VERSION = "privacy-notice-v0.1-draft" as const;

/** Proposed production version identifier — not effective until owner approval + activation. */
export const PRIVACY_NOTICE_PROPOSED_PRODUCTION_VERSION =
  "privacy-notice-v1.0" as const;

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}

export const PRIVACY_POLICY_CONTENT: readonly LegalContentSection[] = [
  {
    id: "draft-status",
    title: "Draft status",
    body: [
      "This Privacy Notice is proposed for owner approval. It is not yet effective.",
      "ONEDECORE does not claim DPDP compliance at this draft stage.",
      "ONEDECORE does not claim DPDP compliance merely by publishing this notice.",
      "Final compliance depends on applicable commencement, approved operational processes, processor contracts, implemented safeguards and any later qualified legal review the owner obtains.",
      "Counsel status: NO COUNSEL REVIEW YET. This notice has not been reviewed by counsel.",
      LEGAL_DPDP_READINESS_STATEMENT,
    ],
  },
  {
    id: "who-we-are",
    title: "Who ONEDECORE is",
    body: [
      `Trading name: ${BUSINESS_IDENTITY.tradingName}.`,
      `Entity type: ${BUSINESS_IDENTITY.entityType ?? "pending owner input"}.`,
      `Proprietor / legal identity: ${BUSINESS_IDENTITY.legalEntityName ?? "pending owner input"}.`,
      `Service region: ${BUSINESS_IDENTITY.serviceRegion}.`,
      `Registered office: ${BUSINESS_IDENTITY.registeredOfficeAddress ?? "pending owner input"}.`,
      BUSINESS_IDENTITY.contactRoleMapping.operatingOfficeSameAsRegistered
        ? "Operating office: same as registered office."
        : `Operating office: ${BUSINESS_IDENTITY.operatingOfficeAddress ?? "pending owner input"}.`,
      `Business email: ${BUSINESS_IDENTITY.businessEmail ?? "pending owner input"}.`,
      `Privacy contact email: ${BUSINESS_IDENTITY.privacyEmail ?? "pending owner input"}.`,
      BUSINESS_IDENTITY.contactRoleMapping.privacyAndGrievanceCombined
        ? "Grievance contact email: same as privacy contact email (owner-approved combined-role mapping)."
        : `Grievance contact email: ${BUSINESS_IDENTITY.grievanceEmail ?? "pending owner input"}.`,
      BUSINESS_IDENTITY.contactRoleMapping.privacyAndDataRightsCombined
        ? "Data-rights request email: same as privacy contact email (owner-approved combined-role mapping)."
        : `Data-rights request email: ${BUSINESS_IDENTITY.dataRightsRequestEmail ?? "pending owner input"}.`,
      `Authorised representative: ${BUSINESS_IDENTITY.authorisedRepresentative ?? "pending owner input"}.`,
      `Grievance contact: ${BUSINESS_IDENTITY.grievanceContact ?? "pending owner input"}.`,
    ],
  },
  {
    id: "scope",
    title: "Scope",
    body: [
      "This notice describes how ONEDECORE handles personal data for the public website, consultation enquiry form (when enabled), CRM follow-up, and related service operations.",
      "Separate consent copies apply to marketing, WhatsApp and portfolio media reuse.",
    ],
  },
  {
    id: "personal-data",
    title: "Personal data we may process from website enquiries",
    body: [
      "Name.",
      "Mobile / phone number.",
      "Email address (if provided).",
      "Locality (if provided).",
      "Service, property and timeline selections.",
      "Optional message.",
      "Consent choices and evidence.",
      "First-party attribution such as landing path / UTM fields already supported by the product.",
      "Technical request metadata needed for security, rate limiting and abuse prevention.",
      "WhatsApp number only if you opt in to that channel when offered.",
      "No payment-card data is collected by the website lead form.",
      "No sensitive personal data is intentionally requested.",
    ],
  },
  {
    id: "purposes",
    title: "Purposes",
    body: [
      "Respond to interior design and renovation consultation enquiries.",
      "Coordinate follow-up and keep CRM records for sales operations.",
      "Provide indicative planning guidance through the in-browser estimator.",
      "Store consent evidence and honour withdrawals / suppression.",
      "Protect the service against abuse (rate limiting and security logs).",
      "Send optional marketing only with separate consent (not collected by the current website form).",
      "Operate WhatsApp service communication only with separate channel consent (outbound WhatsApp remains a separate activation).",
      "Publish portfolio content with separate media consent.",
    ],
  },
  {
    id: "collection-sources",
    title: "How we collect data",
    body: [
      "Current: in-browser planner and estimator inputs remain on your device unless you copy or submit them yourself.",
      "When production lead intake is authorized and enabled: the consultation enquiry form may submit the personal data described above to ONEDECORE systems.",
      "Until that authorization, public lead collection remains disabled.",
      "Portfolio media via admin CMS with publication controls.",
      "We do not buy personal data lists.",
    ],
  },
  {
    id: "service-communications",
    title: "Service communications",
    body: [
      "Operational contact about your enquiry, estimate, consultation, site visit, proposal or project requires service communication consent on the form.",
      "Service communication is separate from optional marketing.",
      "Email channel consent appears only when an email address is supplied.",
    ],
  },
  {
    id: "marketing",
    title: "Marketing communications",
    body: [
      "Marketing is optional, not required for service, and will not be pre-ticked.",
      "Accepting this Privacy Notice or Terms of Use is not marketing consent.",
      "The current website consultation form does not collect marketing consent.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    body: [
      "WhatsApp is not live as an activated production outbound channel on the current website.",
      "If the form offers optional WhatsApp consent, that consent is stored separately and does not by itself activate WhatsApp sending.",
      "Future WhatsApp use will require separate, explicit channel consent and a separate activation decision.",
    ],
  },
  {
    id: "ai-assistance",
    title: "AI-assisted consultation",
    body: [
      "Groq AI processing is not live on the current website.",
      "When enabled, some messages may be drafted or initially handled by an AI consultation assistant.",
      "A human team member can review, override or take over at any time.",
      "AI assistance disclosure is transparency, not blanket automated-processing consent.",
    ],
  },
  {
    id: "portfolio-media",
    title: "Portfolio and client media",
    body: [
      "Published Portfolio items follow existing CMS publication rules.",
      "Separate consent is required before reusing client images, names, locality, testimonials or project descriptions for advertising or social media.",
    ],
  },
  {
    id: "processors",
    title: "Processors",
    body: [
      "Current processor: Supabase — managed database, authentication, Portfolio storage, and website lead-intake / CRM persistence. Project region: ap-south-1 / Mumbai (owner-confirmed). A bespoke signed DPA is not claimed here.",
      "Hosting: Hostinger VPS (as documented in repository deployment records) for website hosting, TLS termination and application logs. Exact legal entity, hosting region and DPA/terms remain under review.",
      "Planned not active for website lead capture: Meta WhatsApp Business Platform, Groq, n8n, monitoring, email/SMS and analytics.",
      "No signed data-processing agreements are claimed at this stage beyond what the owner separately verifies with each provider.",
    ],
  },
  {
    id: "transfers",
    title: "Transfers and locations",
    body: [
      "Supabase primary region for this project is ap-south-1 / Mumbai.",
      "India-only processing for all sub-processors is not claimed.",
      "Hosting region and other transfer details remain pending completion of the processor register review.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "Lead records: 24 months after the last meaningful lead activity or closure, then delete/anonymize unless another lawful/business requirement requires retention.",
      "Consent evidence: 36 months after the related lead/customer relationship is closed, retaining only evidence reasonably needed to demonstrate the recorded consent/withdrawal history.",
      "Operational/security/audit evidence linked to leads: 36 months after the related lead is closed, limited to accountability needs.",
      "Suppression: retain the minimum suppression record while the opt-out remains in force; do not retain unrelated profile/marketing content merely for suppression.",
      "These retention periods are owner-approved for MVP operations and are not described as counsel-approved.",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "ONEDECORE applies privacy-by-design and data-minimisation principles in architecture.",
      "Reasonable safeguards are planned; absolute security is not claimed.",
      "Encryption in transit is expected for production hosting; storage encryption verification is pending.",
      "Server-only secrets and least-privilege access are design requirements.",
    ],
  },
  {
    id: "breach",
    title: "Breach response",
    body: [
      "A breach readiness playbook is documented for detect → contain → preserve → assess → notify → remediate → review.",
      "Operational breach compliance is not claimed complete.",
      "Affected-person and Board notifications will follow applicable law once procedures are approved.",
    ],
  },
  {
    id: "children",
    title: "Children",
    body: [
      "Services are intended for adult homeowners or authorised adults acting on their behalf.",
      "No deliberate marketing to children.",
      "No age inference by AI; no proof-of-age documents collected by default.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "You may request access, correction, completion, updating or erasure of your personal data when processing begins.",
      "You may withdraw consent and opt out of marketing or WhatsApp where applicable.",
      "You may raise a grievance regarding personal-data handling.",
      "Nomination rights apply where required under applicable law.",
      `Contact ${BUSINESS_IDENTITY.privacyEmail ?? "the privacy contact"} to submit a request. Verification measures will be proportionate.`,
      "See the Data Rights page for a local request template. Nothing is sent automatically from the website.",
    ],
  },
  {
    id: "withdrawal",
    title: "Withdrawal of consent",
    body: [
      "Withdrawing consent must be as easy as giving it.",
      "Withdrawal does not affect processing already performed lawfully before withdrawal.",
      "Suppression records may be retained to honour your opt-out.",
    ],
  },
  {
    id: "grievance",
    title: "Grievance",
    body: [
      `Grievance contact: ${BUSINESS_IDENTITY.grievanceContact ?? "pending owner input"}.`,
      BUSINESS_IDENTITY.contactRoleMapping.privacyAndGrievanceCombined
        ? `Grievance email: ${BUSINESS_IDENTITY.privacyEmail ?? "pending owner input"} (combined with privacy contact).`
        : `Grievance email: ${BUSINESS_IDENTITY.grievanceEmail ?? "pending owner input"}.`,
      "We will acknowledge and address grievances in accordance with applicable law.",
    ],
  },
  {
    id: "complaint-escalation",
    title: "Complaint escalation",
    body: [
      "If you are not satisfied with our response, you may escalate under applicable Indian data-protection law once enforcement mechanisms are available to you.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    body: [
      "This notice will be updated when material changes occur.",
      "Material changes will be communicated before or when they take effect.",
      "Copy version identifiers will be recorded for consent purposes.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      `Privacy contact email: ${BUSINESS_IDENTITY.privacyEmail ?? "pending owner input"}.`,
      `Business contact email: ${BUSINESS_IDENTITY.businessEmail ?? "pending owner input"}.`,
      `Registered office: ${BUSINESS_IDENTITY.registeredOfficeAddress ?? "pending owner input"}.`,
    ],
  },
  {
    id: "publication-blockers",
    title: "Publication blockers",
    body: [
      getMissingLegalPublicationFields().length > 0
        ? `Missing mandatory identity and contact fields: ${getMissingLegalPublicationFields().join(", ")}.`
        : "Core business-identity publication fields for Privacy/Terms contacts are recorded.",
      "Owner approval of this Privacy Notice / Terms / consent copy versions remains pending (approval flags remain false).",
      "Processor register remains incomplete for leadProcessorsRegistered (Supabase DPA review and Hostinger legal entity/region/terms still open).",
      "Counsel status: NO COUNSEL REVIEW YET — counsel approval is optional metadata and is not claimed.",
    ],
  },
] as const;
