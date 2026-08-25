/**
 * Phase 3A1 — terms of use draft content source.
 */

import { BUSINESS_IDENTITY } from "./business-identity.ts";

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
      "These Terms of Use are a draft for owner review. They are not yet effective.",
      "No Indian legal-counsel review has occurred for this draft. This document does not claim legal compliance or counsel approval.",
      "Website operator identity details below reflect owner-supplied facts where available; remaining gaps are marked pending.",
    ],
  },
  {
    id: "informational-website",
    title: "Informational website",
    body: [
      `You are visiting the public website of ${BUSINESS_IDENTITY.tradingName}, an interior design and renovation service operating in ${BUSINESS_IDENTITY.serviceRegion}.`,
      BUSINESS_IDENTITY.entityType === "proprietorship"
        ? "ONEDECORE is operated as a proprietorship. The trading name is ONEDECORE; the proprietor’s exact full legal name remains pending owner input for the effective notice."
        : "Operator legal form details remain pending owner input.",
      BUSINESS_IDENTITY.registeredOfficeAddress
        ? `Registered office: ${BUSINESS_IDENTITY.registeredOfficeAddress}.`
        : "Registered office details remain pending owner input.",
      BUSINESS_IDENTITY.businessEmail
        ? `Business contact: ${BUSINESS_IDENTITY.businessEmail}.`
        : "Business contact details remain pending owner input.",
      "The website provides information about services, an indicative estimator, an in-browser planning tool and published portfolio content.",
      "Nothing on this website creates a binding contract unless separately agreed in a signed quotation or agreement.",
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
      "No quotation, contract, booking or submitted lead is created from the current planner.",
      "Copied brief text is not transmitted to ONEDECORE automatically.",
    ],
  },
  {
    id: "portfolio-truth",
    title: "Portfolio and media",
    body: [
      "Portfolio pages display published project content from the ONEDECORE CMS.",
      "Homepage featured project proof remains pending until authentic completed-project media receives owner approval.",
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
    id: "future-submissions",
    title: "Future user submissions",
    body: [
      "When enquiry forms and uploads are enabled, you must provide accurate information and only submit content you have the right to share.",
      "Separate consent will apply to marketing, WhatsApp and portfolio media reuse.",
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
      "The website may link to third-party services in future.",
      "ONEDECORE is not responsible for third-party websites, messaging platforms or payment providers.",
      "WhatsApp, Groq, analytics and campaign tools are planned, not active on the current website.",
    ],
  },
  {
    id: "availability",
    title: "Availability",
    body: [
      "The website is provided on an as-available basis during development and pre-launch review.",
      "Features may change, be added or be removed without notice during draft-review mode.",
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
      BUSINESS_IDENTITY.jurisdictionClause
        ? BUSINESS_IDENTITY.jurisdictionClause
        : "Governing law and jurisdiction clause: not yet owner-approved.",
      "Proposed owner draft (not yet approved; not lawyer-approved): \"These Terms are governed by the laws of India. Subject to applicable law, courts having jurisdiction in Pune, Maharashtra will have jurisdiction over disputes arising from these Terms.\"",
      "This draft is pending owner decision (APPROVE THIS DRAFT | REVISE | LEAVE NOT YET APPROVED). It is not described as counsel-approved.",
    ],
  },
  {
    id: "limitation-liability",
    title: "Limitation of liability",
    body: [
      "LEGAL_COUNSEL_REQUIRED: limitation of liability wording must be reviewed before publication.",
      "Do not treat draft limitation language as final or enforceable.",
    ],
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: [
      "LEGAL_COUNSEL_REQUIRED: indemnity wording must be reviewed before publication.",
    ],
  },
  {
    id: "dispute-resolution",
    title: "Dispute resolution",
    body: [
      "Arbitration or dispute resolution clause: pending owner input.",
      "LEGAL_COUNSEL_REQUIRED: dispute resolution and arbitration wording.",
    ],
  },
  {
    id: "business-claims",
    title: "Business claims",
    body: [
      "Commercial claims on the homepage derive from owner-approved claim configuration.",
      "Public evidence for aggregate review and project counts may remain pending.",
      "No aggregateRating, Review or Warranty schema.org structured data is published.",
      "Free Design Consultation does not mean the current website books or submits a consultation.",
    ],
  },
  {
    id: "changes",
    title: "Changes",
    body: [
      "These Terms will be updated after owner and legal-counsel review.",
      "Continued use after effective publication may constitute acceptance of updated terms as stated in the effective version.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "Business contact email: pending owner input.",
      "Business phone: pending owner input.",
      "Registered office: pending owner input.",
    ],
  },
] as const;
