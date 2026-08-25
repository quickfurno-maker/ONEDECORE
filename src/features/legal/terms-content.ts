/**
 * Phase 3A1 — terms of use draft content source.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";

/** Proposed production version identifier — not effective until owner approval + activation. */
export const TERMS_OF_USE_PROPOSED_PRODUCTION_VERSION = "terms-of-use-v1.0" as const;

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}

export const TERMS_OF_USE_CONTENT: readonly LegalContentSection[] = [
  {
    id: "draft-status",
    title: "Draft status",
    body: [
      "These Terms of Use are proposed for owner approval. They are not yet effective.",
      "Counsel status: NO COUNSEL REVIEW YET. This document does not claim legal compliance or counsel approval.",
      "Website operator identity details below reflect owner-supplied facts.",
    ],
  },
  {
    id: "informational-website",
    title: "Informational website",
    body: [
      `You are visiting the public website of ${BUSINESS_IDENTITY.tradingName}, an interior design and renovation service operating in ${BUSINESS_IDENTITY.serviceRegion}.`,
      BUSINESS_IDENTITY.entityType === "proprietorship"
        ? `ONEDECORE is operated as a proprietorship. Trading name: ${BUSINESS_IDENTITY.tradingName}. Proprietor / legal identity (owner-supplied): ${BUSINESS_IDENTITY.legalEntityName ?? "pending"}.`
        : "Operator legal form details remain pending owner input.",
      `Registered office: ${BUSINESS_IDENTITY.registeredOfficeAddress ?? "pending owner input"}.`,
      BUSINESS_IDENTITY.contactRoleMapping.operatingOfficeSameAsRegistered
        ? "Operating office: same as registered office."
        : `Operating office: ${BUSINESS_IDENTITY.operatingOfficeAddress ?? "pending owner input"}.`,
      `Business contact: ${BUSINESS_IDENTITY.businessEmail ?? "pending owner input"}.`,
      "The website provides information about services, an indicative estimator, an in-browser planning tool, published portfolio content, and (when enabled) a consultation enquiry form.",
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
    id: "portfolio-truth",
    title: "Portfolio and media",
    body: [
      "Portfolio pages display published project content from the ONEDECORE CMS.",
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
      "When you submit an enquiry or upload content, you must provide accurate information and only submit content you have the right to share.",
      "Separate consent applies to marketing, WhatsApp and portfolio media reuse.",
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
      "The website may link to third-party services.",
      "ONEDECORE is not responsible for third-party websites, messaging platforms or payment providers.",
      "WhatsApp, Groq, analytics and campaign tools are planned or separately gated and are not claimed as active website lead processors in this draft.",
    ],
  },
  {
    id: "availability",
    title: "Availability",
    body: [
      "The website is provided on an as-available basis.",
      "Features may change, be added or be removed; production lead intake remains disabled until separately authorized.",
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
        "Governing law and jurisdiction clause: not yet owner-approved.",
      "Status: OWNER APPROVED · NOT COUNSEL REVIEWED. This clause has not been reviewed by counsel.",
    ],
  },
  {
    id: "limitation-liability",
    title: "Limitation of liability",
    body: [
      "To the fullest extent permitted by applicable law, ONEDECORE is not liable for indirect, incidental or consequential losses arising from use of the website or reliance on indicative estimates.",
      "Nothing in these Terms excludes liability that cannot be excluded under applicable Indian law.",
      "Counsel status: NO COUNSEL REVIEW YET — this wording is owner-facing draft language only.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: [
      "You agree to indemnify ONEDECORE against claims arising from your misuse of the website or from content you submit without rights or authority, to the extent permitted by applicable law.",
      "Counsel status: NO COUNSEL REVIEW YET.",
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
    id: "business-claims",
    title: "Business claims",
    body: [
      "Commercial claims on the homepage derive from owner-approved claim configuration.",
      "No aggregateRating, Review or Warranty schema.org structured data is published as a compliance claim.",
    ],
  },
  {
    id: "changes",
    title: "Changes",
    body: [
      "These Terms will be updated when material changes occur.",
      "Continued use after effective publication may constitute acceptance of updated terms as stated in the effective version.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      `Business contact email: ${BUSINESS_IDENTITY.businessEmail ?? "pending owner input"}.`,
      `Registered office: ${BUSINESS_IDENTITY.registeredOfficeAddress ?? "pending owner input"}.`,
    ],
  },
] as const;
