/**
 * Phase 3A1 — privacy policy draft content source.
 */

import { LEGAL_DPDP_READINESS_STATEMENT } from "./legal-publication.ts";
import { BUSINESS_IDENTITY, getMissingLegalPublicationFields } from "./business-identity.ts";

/** Canonical privacy notice version for consent evidence (draft-review). */
export const PRIVACY_NOTICE_VERSION = "privacy-notice-v0.1-draft" as const;

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
      "This Privacy Notice is a draft for owner and Indian legal counsel review. It is not yet effective.",
      "ONEDECORE does not claim DPDP compliance at this draft stage.",
      "Final compliance depends on applicable commencement, approved operational processes, processor contracts, implemented safeguards and qualified Indian legal review.",
      LEGAL_DPDP_READINESS_STATEMENT,
    ],
  },
  {
    id: "who-we-are",
    title: "Who ONEDECORE is",
    body: [
      `Trading name: ${BUSINESS_IDENTITY.tradingName}.`,
      `Service region: ${BUSINESS_IDENTITY.serviceRegion}.`,
      "Legal entity name, registered office and operating office: pending owner input.",
      "Authorised representative: pending owner input.",
    ],
  },
  {
    id: "scope",
    title: "Scope",
    body: [
      "This notice describes how ONEDECORE intends to handle personal data when enquiry, CRM, messaging, AI and related features are enabled.",
      "It covers the public website, future enquiry flows and related service operations.",
      "Separate consent copies apply to marketing, WhatsApp and portfolio media reuse.",
    ],
  },
  {
    id: "personal-data",
    title: "Personal data we expect to process",
    body: [
      "Name.",
      "Phone number.",
      "WhatsApp number (if you opt in to that channel).",
      "Email address.",
      "Property locality or address when voluntarily supplied.",
      "Property, service and room requirements.",
      "Design preferences.",
      "Budget and indicative estimate selections.",
      "Timeline preferences.",
      "Messages and notes you send.",
      "Future uploads and reference media.",
      "Consultation and site-visit scheduling data (future).",
      "Proposal, quotation and project delivery data (future).",
      "Consent and marketing opt-out evidence.",
      "Future campaign source or UTM attribution (if approved).",
      "Audit and security logs.",
      "Device and network data only when a future backend captures it.",
      "No payment-card data is planned at this stage.",
      "No sensitive personal data is intentionally requested.",
    ],
  },
  {
    id: "purposes",
    title: "Purposes",
    body: [
      "Respond to interior design and renovation enquiries.",
      "Provide indicative planning guidance through the in-browser estimator.",
      "Coordinate consultations, site visits, proposals and project delivery (future).",
      "Send service communications you request or reasonably expect.",
      "Send optional marketing only with separate consent (future).",
      "Operate WhatsApp service communication with separate channel consent (future).",
      "Publish portfolio content with separate media consent.",
      "Maintain security, audit trails and legal compliance.",
      "Honour data-subject rights and grievance requests.",
    ],
  },
  {
    id: "collection-sources",
    title: "How we collect data",
    body: [
      "Current: the homepage does not submit contact data to ONEDECORE servers.",
      "Current: in-browser planner and estimator inputs remain on your device unless you copy them.",
      "Future: forms, email, phone, WhatsApp, in-person meetings and project workflows.",
      "Portfolio media via admin CMS with publication controls.",
      "We do not buy personal data lists.",
    ],
  },
  {
    id: "service-communications",
    title: "Service communications",
    body: [
      "Operational contact about your enquiry, estimate, consultation, site visit, proposal or project requires service communication consent when collection begins.",
      "Service communication is separate from optional marketing.",
    ],
  },
  {
    id: "marketing",
    title: "Marketing communications",
    body: [
      "Marketing is optional, not required for service, and will not be pre-ticked.",
      "Accepting this Privacy Notice or Terms of Use is not marketing consent.",
      "No campaign engine is live on the current website.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    body: [
      "WhatsApp is not live on the current website.",
      "Future WhatsApp use will require separate, explicit channel consent.",
      "WhatsApp Business Platform integration is planned, not active.",
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
      "Homepage project proof remains pending until authentic completed-project media is owner-approved.",
    ],
  },
  {
    id: "processors",
    title: "Processors",
    body: [
      "Current verified processor: Supabase for existing database, authentication and Portfolio storage.",
      "Planned not active: Meta WhatsApp Business Platform, Groq, n8n, monitoring, email/SMS and analytics.",
      "No signed data-processing agreements are claimed at this stage.",
      "Cross-border transfer assessments are pending owner and legal-counsel review.",
    ],
  },
  {
    id: "transfers",
    title: "Transfers and locations",
    body: [
      "Processor locations and cross-border transfers will be documented before relevant features go live.",
      "India-only processing is not claimed.",
      "LEGAL_COUNSEL_REQUIRED: transfer mechanism and safeguards wording.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "No fixed retention periods are stated in this draft.",
      "All retention categories remain OWNER_DECISION_REQUIRED.",
      "Personal data will be deleted or anonymised when the purpose ends, subject to lawful retention obligations once approved schedules exist.",
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
      "Future adult-confirmation gate may be added where appropriate.",
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
      "Grievance contact: pending owner input.",
      "Grievance officer details: pending owner input.",
      "We will acknowledge and address grievances in accordance with applicable law once contacts are published.",
    ],
  },
  {
    id: "complaint-escalation",
    title: "Complaint escalation",
    body: [
      "If you are not satisfied with our response, you may escalate under applicable Indian data-protection law once enforcement mechanisms are available to you.",
      "LEGAL_COUNSEL_REQUIRED: escalation pathway and Board reference wording.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    body: [
      "This draft will be updated after owner and legal-counsel review.",
      "Material changes will be communicated before or when they take effect.",
      "Copy version identifiers will be recorded for consent purposes.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "Privacy contact email: pending owner input.",
      "Business contact email: pending owner input.",
      "Business phone: pending owner input.",
    ],
  },
  {
    id: "publication-blockers",
    title: "Publication blockers",
    body: [
      `Missing mandatory identity and contact fields: ${getMissingLegalPublicationFields().join(", ")}.`,
      "Owner approval and Indian legal-counsel review remain pending.",
      "Retention periods, processor contracts and grievance contacts are unresolved.",
    ],
  },
] as const;
