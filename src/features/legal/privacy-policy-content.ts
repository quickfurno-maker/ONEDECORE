/**
 * Privacy Notice content — customer-facing public sections + draft-only review appendix.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";
import {
  LEGAL_EFFECTIVE_DATE_PLACEHOLDER,
  LEGAL_PUBLICATION_MODE,
  isRealLegalEffectiveDate,
  type LegalPublicationMode,
} from "./legal-publication.ts";

/**
 * Published version.
 *
 * v1.1 adds the advertising-measurement disclosure. The change is additive —
 * no existing statement was withdrawn or weakened — but it describes a new
 * recipient and a new cookie, which is a material change and therefore a new
 * version rather than a quiet edit to v1.0.
 *
 * The v1.0 approval record below is kept as history; v1.1 carries its own,
 * and `PRIVACY_NOTICE_ADVERTISING_AMENDMENT.ownerApproval` is null until the
 * owner signs it off. Nothing about that blocks a visitor: the advertising
 * section renders regardless, and no Meta cookie can be set without an
 * explicit grant from the person reading it.
 */
export const PRIVACY_NOTICE_VERSION = "privacy-notice-v1.1" as const;

/** The version this amendment supersedes. Retained for audit. */
export const PRIVACY_NOTICE_PREVIOUS_VERSION = "privacy-notice-v1.0" as const;

/** @deprecated Alias kept for call sites that referenced the proposed id. */
export const PRIVACY_NOTICE_PROPOSED_PRODUCTION_VERSION = PRIVACY_NOTICE_VERSION;

/** Owner-authorized production activation date (YYYY-MM-DD). */
export const PRIVACY_NOTICE_EFFECTIVE_DATE: string | null = "2026-08-25";

export const PRIVACY_NOTICE_OWNER_APPROVAL = {
  approvedBy: "ONEDECORE owner",
  approvedAt: "2026-08-25",
  reference:
    "PR #92 owner APPROVE of published-mode package at 2609bbca1ba661989fd0e8f468b0724a47adcd5d",
  counselApproval: null,
} as const;

/**
 * The v1.1 advertising amendment, and its approval state.
 *
 * `ownerApproval` is null on purpose and must not be filled in by the change
 * that writes the copy — an approval an author grants themselves records
 * nothing. The owner sets it when they have read the section.
 *
 * This is a DISCLOSURE gate, not a tracking gate. The two are separate so that
 * neither can be mistaken for the other: tracking is blocked by the consent
 * cookie whatever this says, and this being unapproved never means a visitor
 * is tracked without being told.
 */
export const PRIVACY_NOTICE_ADVERTISING_AMENDMENT = {
  version: PRIVACY_NOTICE_VERSION,
  supersedes: PRIVACY_NOTICE_PREVIOUS_VERSION,
  summary:
    "Adds the advertising-measurement section and names Meta as a recipient when the visitor allows advertising cookies.",
  ownerApproval: null as null | {
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly reference: string;
  },
  counselApproval: null,
} as const;

export type LegalContentAudience = "public" | "draft-only";

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  /** Defaults to public. Draft-only sections never render in owner-approved or published mode. */
  readonly audience?: LegalContentAudience;
}

export function getPrivacyNoticeDisplayVersion(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): string {
  return mode === "draft-review"
    ? "privacy-notice-v0.1-draft"
    : PRIVACY_NOTICE_VERSION;
}

export function getPrivacyNoticeEffectiveDateLabel(
  effectiveDate: string | null = PRIVACY_NOTICE_EFFECTIVE_DATE,
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): string {
  if (mode === "published") {
    if (!isRealLegalEffectiveDate(effectiveDate)) {
      throw new Error(
        "[ONEDECORE Legal] Published Privacy Notice requires a real YYYY-MM-DD effective date."
      );
    }
    return effectiveDate;
  }
  if (mode === "owner-approved") {
    return "Not yet effective — will be set on authorized production activation";
  }
  return LEGAL_EFFECTIVE_DATE_PLACEHOLDER;
}

export function resolveLegalContentSections(
  sections: readonly LegalContentSection[],
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): readonly LegalContentSection[] {
  if (mode === "published" || mode === "owner-approved") {
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
      "Meta Platforms is used for advertising measurement only, and only if you allow advertising cookies. What it receives, and what it never receives, is set out under 'Cookies and advertising measurement' below.",
    ],
  },
  {
    /*
     * The advertising-measurement disclosure.
     *
     * Placed immediately after Service providers because that is where a
     * reader looking for "who else sees my data" will already be, and because
     * the Meta entry in that section points here.
     *
     * Every sentence describes what the code actually does. The field list is
     * the exact `user_data` allow-list from `meta-capi-signals.ts`, and the
     * "we do not send" list is the exact set the tests assert absent. Nothing
     * here promises a retention period or a legal-entity fact that is not
     * already recorded in the business identity.
     */
    id: "advertising-measurement",
    title: "Cookies and advertising measurement",
    body: [
      "Necessary cookies keep the website working — for example your session, security, and remembering a preference you have set. These are not used for advertising.",
      "Optional advertising measurement uses the Meta Pixel and Meta's Conversions API to tell us which advertising led to a real enquiry. It runs only if you choose 'Allow advertising cookies'. If you choose 'Necessary only', or make no choice at all, no Meta script is loaded, no Meta cookie is set and no event is sent.",
      "When you allow it, Meta may receive: the event name, event time and an event identifier; the page address the event happened on; that it happened on a website; your browser's user-agent string; your IP address where our hosting rules allow us to read it; and the Meta advertising cookies _fbp and _fbc when they are present.",
      "We do not send Meta your name, phone number, email address, postal address, date of birth, gender, budget, service selection, project details, enquiry message, quotation data or any CRM record. Meta's automatic advanced matching is switched off.",
      "The event identifier is a random one-time value used only so that the browser report and our server report of the same enquiry are counted once rather than twice. It is not derived from your contact details.",
      "You can change your choice at any time using the 'Cookie preferences' control on any public page. Choosing 'Necessary only' stops further events immediately and removes the _fbp and _fbc cookies from this browser. Events already sent to Meta before you changed your choice cannot be recalled by us.",
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
