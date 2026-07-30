/**
 * Phase 3A1 — communication and consent page draft content source.
 */

import { CONSENT_SEPARATION_RULES, CONSENT_VERSIONS } from "./consent-registry.ts";

export interface LegalContentSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}

export const COMMUNICATION_CONSENT_CONTENT: readonly LegalContentSection[] = [
  {
    id: "draft-status",
    title: "Draft status",
    body: [
      "This Communication and Consent page is a draft for owner and Indian legal counsel review. It is not yet effective.",
      "Consent capture UI is not live on the current website.",
    ],
  },
  {
    id: "purpose-specific-consent",
    title: "Purpose-specific consent",
    body: [
      "ONEDECORE uses separate consent purposes rather than bundled permissions.",
      "Each purpose has its own copy version, channels and required/optional status.",
      "Accepting the Privacy Notice or Terms of Use is not marketing consent.",
    ],
  },
  {
    id: "consent-purposes",
    title: "Consent purposes",
    body: CONSENT_VERSIONS.map(
      (version) =>
        `${version.title} (${version.purposeCode}): ${version.conciseCopy} — required: ${version.required}, default checked: ${version.defaultChecked}, status: ${version.status}.`
    ),
  },
  {
    id: "service-enquiry",
    title: "Service enquiry",
    body: [
      "When you submit an enquiry, ONEDECORE processes the information you provide to understand and respond to your interior design request.",
      "This covers contact details, property information, requirements, budget, timeline and messages.",
    ],
  },
  {
    id: "service-communication",
    title: "Service communication",
    body: [
      "Operational contact about consultation, estimates, site visits, proposals or active projects.",
      "Separate from optional marketing and from WhatsApp channel consent.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    body: [
      "WhatsApp requires explicit, channel-specific consent before service messages are sent.",
      "WhatsApp is not live on the current website.",
      "Marketing messages over WhatsApp require separate optional marketing consent.",
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    body: [
      "Marketing communications are optional and not required to receive service.",
      "Marketing checkboxes are not pre-ticked.",
      "No vague permissions for unnamed partners to contact you.",
    ],
  },
  {
    id: "ai-disclosure",
    title: "AI assistance disclosure",
    body: [
      "Some messages may be drafted or handled by ONEDECORE's AI consultation assistant. A team member can take over at any time.",
      "This is a transparency disclosure, not blanket consent to automated decision-making.",
      "Groq processing is not live on the current website.",
    ],
  },
  {
    id: "portfolio-media",
    title: "Portfolio and media reuse",
    body: [
      "Separate consent is required before using client project images, descriptions, locality, name or testimonial content for portfolio, advertising or social reuse.",
      "Portfolio CMS publication follows existing admin and publication controls.",
    ],
  },
  {
    id: "withdrawal",
    title: "Withdrawal",
    body: [
      "You may withdraw consent through the same or an equally easy channel used to grant it.",
      "Withdrawal of marketing or WhatsApp consent will be honoured for future messages.",
      "Suppression records may be retained to prevent re-contact.",
    ],
  },
  {
    id: "separation-rules",
    title: "Consent separation rules",
    body: [...CONSENT_SEPARATION_RULES],
  },
  {
    id: "versioning",
    title: "Copy versioning",
    body: [
      "Each consent purpose maintains an immutable copy version with effective and retirement dates once approved.",
      "Current versions are in draft-review status with null effective dates.",
      "Future consent records will store copyVersion and noticeVersion identifiers.",
    ],
  },
  {
    id: "dark-patterns",
    title: "No dark patterns",
    body: [
      "ONEDECORE does not use pre-ticked marketing boxes, bundled channel consent or confusing double negatives.",
      "Required consents are limited to what is necessary for the requested service.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "Privacy contact email: pending owner input.",
      "Questions about consent: pending owner input.",
    ],
  },
] as const;
