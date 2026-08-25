/**
 * Terms of Use content — customer-facing public sections + draft-only review appendix.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";
import {
  LEGAL_PUBLICATION_MODE,
  type LegalPublicationMode,
} from "./legal-publication.ts";
import {
  flattenLegalContentSections,
  resolveLegalContentSections,
  type LegalContentSection,
} from "./privacy-policy-content.ts";

/** Proposed production version after owner APPROVE + activation. */
export const TERMS_OF_USE_PROPOSED_PRODUCTION_VERSION = "terms-of-use-v1.0" as const;

/** Current in-repo draft version identifier (not effective). */
export const TERMS_OF_USE_VERSION = "terms-of-use-v0.1-draft" as const;

/**
 * Set only when production publication is authorized.
 * Do not hard-code a calendar date before activation.
 */
export const TERMS_OF_USE_EFFECTIVE_DATE: string | null = null;

export type { LegalContentSection };

export function getTermsOfUseDisplayVersion(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): string {
  return mode === "published"
    ? TERMS_OF_USE_PROPOSED_PRODUCTION_VERSION
    : TERMS_OF_USE_VERSION;
}

export function getTermsOfUseEffectiveDateLabel(
  effectiveDate: string | null = TERMS_OF_USE_EFFECTIVE_DATE
): string {
  return (
    effectiveDate ??
    "To be set to the calendar date of authorized production activation"
  );
}

const registeredOffice =
  BUSINESS_IDENTITY.registeredOfficeAddress ??
  "SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207";
const businessEmail =
  BUSINESS_IDENTITY.businessEmail ?? "onedecore@gmail.com";

/**
 * Canonical Terms of Use sections.
 * Public sections are the exact customer-facing published copy.
 */
export const TERMS_OF_USE_CONTENT: readonly LegalContentSection[] = [
  {
    id: "operator",
    title: "Operator",
    body: [
      `You are visiting the public website of ${BUSINESS_IDENTITY.tradingName}, an interior design and renovation service operating in ${BUSINESS_IDENTITY.serviceRegion}.`,
      `ONEDECORE is operated as a proprietorship. Trading name: ${BUSINESS_IDENTITY.tradingName}. Proprietor / legal identity: ${BUSINESS_IDENTITY.legalEntityName ?? "ONEDECORE"}.`,
      `Registered office: ${registeredOffice}.`,
      "Operating office: same as registered office.",
      `Business contact: ${businessEmail}.`,
    ],
  },
  {
    id: "website-use",
    title: "Website use",
    body: [
      "The website provides information about interior services, an indicative estimator, an in-browser planning tool, published portfolio content, and a consultation enquiry form.",
      "Nothing on this website creates a binding project contract unless separately agreed in a signed quotation or agreement.",
    ],
  },
  {
    id: "indicative-prices",
    title: "Indicative prices only",
    body: [
      "All prices, budget ranges and estimator outputs are indicative planning guidance only.",
      "They are not quotations, offers or guaranteed final prices.",
      "Final price depends on measurements, materials, scope, finishes, site conditions, approvals and a signed quotation.",
    ],
  },
  {
    id: "estimator-planner",
    title: "Estimator and planner",
    body: [
      "The estimator and in-browser planner help you explore layout, services and indicative budget ranges.",
      "Planner inputs remain in your browser unless you copy or share them yourself.",
      "Copied brief text is not transmitted to ONEDECORE automatically.",
    ],
  },
  {
    id: "consultation-requests",
    title: "Consultation requests",
    body: [
      "Submitting a consultation enquiry is a request for contact, not a confirmed appointment or booking, unless a separate scheduling system is later introduced and clearly described.",
    ],
  },
  {
    id: "portfolio-media",
    title: "Portfolio and media",
    body: [
      "Portfolio pages display published project content from the ONEDECORE content systems.",
      "Do not assume every image on marketing pages represents a specific delivered client project unless explicitly labelled.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: [
      "Website content, branding, layouts, copy and design assets are owned by or licensed to ONEDECORE unless stated otherwise.",
      "You may not copy, scrape, republish or commercially exploit site content without written permission.",
    ],
  },
  {
    id: "user-submissions",
    title: "User submissions",
    body: [
      "When you submit an enquiry or other content, you must provide accurate information and only submit content you have the right to share.",
      "Separate consent applies to marketing, WhatsApp and portfolio media reuse where those permissions are requested.",
    ],
  },
  {
    id: "prohibited-use",
    title: "Prohibited use",
    body: [
      "You must not misuse the website, attempt unauthorised access, introduce malware, scrape data at scale or interfere with site operation.",
      "You must not use the site for unlawful, deceptive or harmful purposes.",
    ],
  },
  {
    id: "third-party",
    title: "Third-party links and services",
    body: [
      "The website may link to or rely on third-party services to operate hosting, database, messaging or similar functions.",
      "ONEDECORE is not responsible for third-party websites or platforms outside ONEDECORE's control.",
    ],
  },
  {
    id: "availability",
    title: "Availability",
    body: [
      "The website is provided on an as-available basis.",
      "Features may change, be added or be removed.",
    ],
  },
  {
    id: "no-advice",
    title: "No professional advice",
    body: [
      "Website content is general information about interior services.",
      "It does not constitute structural, legal, financial or engineering advice.",
      "Site-specific assessments require inspection and professional evaluation.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law and jurisdiction",
    body: [
      BUSINESS_IDENTITY.jurisdictionClause ??
        "These Terms are governed by the laws of India. Subject to applicable law, courts having jurisdiction in Pune, Maharashtra will have jurisdiction over disputes arising from these Terms.",
    ],
  },
  {
    id: "limitation-liability",
    title: "Limitation of liability",
    body: [
      "To the fullest extent permitted by applicable law, ONEDECORE is not liable for indirect, incidental or consequential losses arising from use of the website or reliance on indicative estimates.",
      "Nothing in these Terms excludes liability that cannot be excluded under applicable Indian law.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: [
      "You agree to indemnify ONEDECORE against claims arising from your misuse of the website or from content you submit without rights or authority, to the extent permitted by applicable law.",
    ],
  },
  {
    id: "dispute-resolution",
    title: "Dispute resolution",
    body: [
      "Subject to the governing-law clause above, disputes arising from these Terms will be addressed under applicable law in the courts identified in that clause unless the parties agree otherwise in writing.",
      "No separate arbitration clause is currently published.",
    ],
  },
  {
    id: "changes",
    title: "Changes",
    body: [
      "We may update these Terms from time to time. Material changes will be published with an updated effective date. Where required, we will provide additional notice or obtain consent.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      `Business contact email: ${businessEmail}.`,
      `Registered office: ${registeredOffice}.`,
    ],
  },
  {
    id: "draft-review-status",
    title: "Draft review status (internal)",
    audience: "draft-only",
    body: [
      "These Terms of Use are proposed for owner approval. They are not yet effective while publication mode remains draft-review.",
      "Counsel status: NO COUNSEL REVIEW YET.",
      "Jurisdiction clause status internally: OWNER APPROVED · NOT COUNSEL REVIEWED.",
    ],
  },
] as const;

export function getTermsOfUseSections(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): readonly LegalContentSection[] {
  return resolveLegalContentSections(TERMS_OF_USE_CONTENT, mode);
}

/** Exact published-mode customer-facing text (titles + body). */
export function getPublishedTermsOfUseText(): string {
  return flattenLegalContentSections(getTermsOfUseSections("published"));
}
