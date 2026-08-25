/**
 * Privacy Notice content — customer-facing public sections + draft-only review appendix.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";
import {
  LEGAL_PUBLICATION_MODE,
  type LegalPublicationMode,
} from "./legal-publication.ts";

/** Current in-repo draft version identifier (not effective). */
export const PRIVACY_NOTICE_VERSION = "privacy-notice-v0.1-draft" as const;

/** Proposed production version after owner APPROVE + activation. */
export const PRIVACY_NOTICE_PROPOSED_PRODUCTION_VERSION =
  "privacy-notice-v1.0" as const;

/**
 * Set only when production publication is authorized.
 * Do not hard-code a calendar date before activation.
 */
export const PRIVACY_NOTICE_EFFECTIVE_DATE: string | null = null;

export type LegalContentAudience = "public" | "draft-only";

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  /** Defaults to public. Draft-only sections never render in published mode. */
  readonly audience?: LegalContentAudience;
}

export function getPrivacyNoticeDisplayVersion(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): string {
  return mode === "published"
    ? PRIVACY_NOTICE_PROPOSED_PRODUCTION_VERSION
    : PRIVACY_NOTICE_VERSION;
}

export function getPrivacyNoticeEffectiveDateLabel(
  effectiveDate: string | null = PRIVACY_NOTICE_EFFECTIVE_DATE
): string {
  return (
    effectiveDate ??
    "To be set to the calendar date of authorized production activation"
  );
}

export function resolveLegalContentSections(
  sections: readonly LegalContentSection[],
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): readonly LegalContentSection[] {
  if (mode === "published") {
    return sections.filter((section) => section.audience !== "draft-only");
  }
  return sections;
}

export function flattenLegalContentSections(
  sections: readonly LegalContentSection[]
): string {
  return sections
    .flatMap((section) => [section.title, ...section.body])
    .join("\n");
}

const privacyEmail =
  BUSINESS_IDENTITY.privacyEmail ?? "onedecore@gmail.com";
const businessEmail =
  BUSINESS_IDENTITY.businessEmail ?? "onedecore@gmail.com";
const registeredOffice =
  BUSINESS_IDENTITY.registeredOfficeAddress ??
  "SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207";

/**
 * Canonical Privacy Notice sections.
 * Public sections are the exact customer-facing published copy.
 * Draft-only sections appear only while LEGAL_PUBLICATION_MODE is draft-review.
 */
export const PRIVACY_POLICY_CONTENT: readonly LegalContentSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: [
      `Trading name: ${BUSINESS_IDENTITY.tradingName}.`,
      `Entity type: proprietorship.`,
      `Proprietor / legal identity: ${BUSINESS_IDENTITY.legalEntityName ?? "ONEDECORE"}.`,
      `Service region: ${BUSINESS_IDENTITY.serviceRegion}.`,
      `Registered office: ${registeredOffice}.`,
      "Operating office: same as registered office.",
      `Business email: ${businessEmail}.`,
      `Privacy contact email: ${privacyEmail}.`,
      `Grievance and data-rights requests: ${privacyEmail}.`,
      `Authorised representative: ${BUSINESS_IDENTITY.authorisedRepresentative ?? "ONEDECORE"}.`,
      `Grievance contact: ${BUSINESS_IDENTITY.grievanceContact ?? "ONEDECORE, Proprietor / Grievance Contact"}.`,
    ],
  },
  {
    id: "scope",
    title: "Scope",
    body: [
      "This Privacy Notice describes how ONEDECORE handles personal data for the public website, consultation enquiry form, CRM follow-up, and related service operations.",
    ],
  },
  {
    id: "personal-data",
    title: "Personal data we process",
    body: [
      "When you submit a consultation enquiry, we may process: name; mobile number; email address (if provided); locality (if provided); service, property and timeline selections; optional message; consent choices; first-party attribution such as landing path or UTM fields supported by the product; and technical request metadata needed for security, rate limiting and abuse prevention.",
      "WhatsApp contact details are processed for WhatsApp only if you opt in to that channel when offered.",
      "We do not collect payment-card data through the website consultation form.",
      "We do not intentionally request sensitive personal data.",
    ],
  },
  {
    id: "purposes",
    title: "Purposes",
    body: [
      "We use personal data to respond to interior design and renovation consultation enquiries; administer related CRM records; store consent evidence; coordinate service follow-up; protect the service against misuse; and provide indicative planning guidance through the in-browser estimator.",
      "Marketing communications are optional and are not collected by the current website consultation form.",
      "WhatsApp service messages require separate optional consent and are not authorised by enquiry or phone/email service-communication consent alone.",
    ],
  },
  {
    id: "collection-sources",
    title: "How we collect data",
    body: [
      "In-browser planner and estimator inputs remain on your device unless you copy or submit them yourself.",
      "When you submit the consultation enquiry form, the personal data described in this notice is sent to ONEDECORE systems for the purposes above.",
      "Portfolio media is managed through ONEDECORE's admin systems under separate publication controls.",
      "We do not buy personal data lists.",
    ],
  },
  {
    id: "service-communications",
    title: "Service communications",
    body: [
      "Operational contact about your enquiry, estimate, consultation, site visit, proposal or project requires service-communication consent on the form.",
      "Email service communication is requested only when you provide an email address.",
      "Service communication is separate from optional marketing.",
    ],
  },
  {
    id: "marketing",
    title: "Marketing communications",
    body: [
      "Marketing is optional and is not required to receive service.",
      "Accepting this Privacy Notice or the Terms of Use is not marketing consent.",
      "Marketing checkboxes are not pre-ticked.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    body: [
      "WhatsApp is a separate communication channel.",
      "If the form offers optional WhatsApp consent and you opt in, ONEDECORE may use WhatsApp for service-related messages about your enquiry or project.",
      "WhatsApp consent does not authorise marketing messages.",
    ],
  },
  {
    id: "portfolio-media",
    title: "Portfolio and client media",
    body: [
      "Published portfolio items follow ONEDECORE's publication controls.",
      "Separate consent is required before reusing client images, names, locality, testimonials or project descriptions for advertising or social media.",
    ],
  },
  {
    id: "processors",
    title: "Service providers",
    body: [
      "ONEDECORE uses service providers to operate the website and CRM, including Supabase for managed database/authentication services and Hostinger-hosted infrastructure for the website. These providers may process limited personal or technical data necessary to provide their services. Details may be updated as our service-provider arrangements change.",
      "Supabase project region: Mumbai, India (ap-south-1).",
    ],
  },
  {
    id: "transfers",
    title: "Locations",
    body: [
      "Primary database services for this project are hosted in Mumbai, India (ap-south-1).",
      "Some service providers may process technical or support data from other locations as needed to operate their services.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "Lead records: retained for 24 months after the last meaningful lead activity or closure, then deleted or anonymised unless another lawful or business requirement requires retention.",
      "Consent evidence: retained for 36 months after the related lead or customer relationship is closed, limited to evidence reasonably needed to demonstrate the recorded consent or withdrawal history.",
      "Operational and security audit evidence linked to leads: retained for 36 months after the related lead is closed, limited to accountability needs.",
      "Suppression records: the minimum suppression record is retained while an opt-out remains in force so we do not accidentally re-contact you; unrelated profile or marketing content is not retained merely for suppression.",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "ONEDECORE uses reasonable technical and organisational safeguards appropriate to the service, including HTTPS/TLS for data in transit, access controls, and server-side handling of privileged credentials. No system can be guaranteed absolutely secure.",
    ],
  },
  {
    id: "breach",
    title: "Security and personal-data incidents",
    body: [
      "If a personal-data or security incident occurs, ONEDECORE will investigate, contain and remediate it and will make notifications required by applicable law.",
    ],
  },
  {
    id: "children",
    title: "Children",
    body: [
      "Services are intended for adult homeowners or authorised adults acting on their behalf.",
      "ONEDECORE does not deliberately market to children.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "You may request access, correction, updating or erasure of personal data where applicable, withdraw consent where processing depends on consent, and raise a grievance about personal-data handling.",
      `Contact ${privacyEmail} to submit a request. We may take proportionate steps to verify your identity.`,
      "See the Data Rights page for a request template. Requests are not sent automatically from the website.",
    ],
  },
  {
    id: "withdrawal",
    title: "Withdrawal of consent",
    body: [
      "Where processing depends on consent, you may withdraw that consent.",
      "Withdrawal does not affect processing already carried out before withdrawal.",
      "A minimum suppression record may be retained to honour an opt-out.",
    ],
  },
  {
    id: "grievance",
    title: "Grievance",
    body: [
      `Grievance contact: ${BUSINESS_IDENTITY.grievanceContact ?? "ONEDECORE, Proprietor / Grievance Contact"}.`,
      `Grievance email: ${privacyEmail}.`,
      "We will acknowledge and address grievances in accordance with applicable law.",
    ],
  },
  {
    id: "complaint-escalation",
    title: "Further remedies",
    body: [
      "If you remain dissatisfied, you may pursue remedies available under applicable law.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this notice",
    body: [
      "We may update this Privacy Notice from time to time. Material changes will be published with an updated version and effective date. Where required, we will provide additional notice or obtain consent.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      `Privacy contact email: ${privacyEmail}.`,
      `Business contact email: ${businessEmail}.`,
      `Registered office: ${registeredOffice}.`,
    ],
  },
  {
    id: "draft-review-status",
    title: "Draft review status (internal)",
    audience: "draft-only",
    body: [
      "This Privacy Notice is proposed for owner approval. It is not yet effective while publication mode remains draft-review.",
      "Counsel status: NO COUNSEL REVIEW YET. This notice has not been reviewed by counsel.",
      "ONEDECORE does not claim DPDP compliance at this draft stage.",
      "Internal processor-register and activation gates remain separate from this customer-facing copy.",
    ],
  },
] as const;

export function getPrivacyPolicySections(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): readonly LegalContentSection[] {
  return resolveLegalContentSections(PRIVACY_POLICY_CONTENT, mode);
}

/** Exact published-mode customer-facing text (titles + body). */
export function getPublishedPrivacyNoticeText(): string {
  return flattenLegalContentSections(getPrivacyPolicySections("published"));
}
