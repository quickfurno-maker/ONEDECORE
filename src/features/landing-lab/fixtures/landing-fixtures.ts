/**
 * Phase 9B migration-independent — landing lab synthetic fixtures.
 */

import type { LandingBlock } from "../contracts/blocks.ts";
import type {
  LandingExperiment,
  LandingPage,
  LandingPageVersion,
  LandingPublication,
} from "../contracts/page-model.ts";
import type { PublicationContext } from "../contracts/publication-context.ts";

export const LANDING_LAB_PREBUILD_BANNER =
  "STAFF PREVIEW — not a public publication. Exposures and live lead intake are disabled here.";

export function buildSampleLandingBlocks(): readonly LandingBlock[] {
  return [
    {
      blockId: "hero-main",
      type: "hero",
      headline: "Design-led interiors for Gurgaon homes",
      subheadline: "Structured delivery from concept to handover.",
      primaryCtaLabel: "Book a consultation",
      primaryCtaUrl: "/contact",
      imageUrl: "/images/landing/hero-preview.jpg",
    },
    {
      blockId: "trust-proof",
      type: "trust_proof",
      title: "Why homeowners trust ONEDECORE",
      items: [
        { label: "Projects delivered", value: "120+" },
        { label: "Average rating", value: "4.8/5" },
        { label: "Warranty", value: "10 years" },
      ],
    },
    {
      blockId: "service-highlights",
      type: "service_highlights",
      title: "Core services",
      items: [
        {
          title: "Full-home interiors",
          description: "End-to-end planning, procurement, and execution.",
          iconLabel: "home",
        },
        {
          title: "Modular kitchens",
          description: "Factory-built modules with site-ready installation.",
          iconLabel: "kitchen",
        },
      ],
    },
    {
      blockId: "process",
      type: "process",
      title: "How we work",
      steps: [
        { title: "Discovery", description: "Understand scope, budget, and timeline." },
        { title: "Design", description: "Approve layouts, materials, and finishes." },
        { title: "Delivery", description: "Track milestones through handover." },
      ],
    },
    {
      blockId: "portfolio-preview",
      type: "portfolio_preview",
      title: "Recent projects",
      projectSlugs: ["gurgaon-penthouse", "dlf-phase-3-apartment"],
      ctaLabel: "View portfolio",
      ctaUrl: "/portfolio",
    },
    {
      blockId: "testimonials",
      type: "testimonials",
      title: "Client stories",
      items: [
        {
          quote: "The team kept every milestone visible and predictable.",
          author: "Priya S.",
          role: "Homeowner",
        },
      ],
    },
    {
      blockId: "faq",
      type: "faq",
      title: "Common questions",
      items: [
        {
          question: "How long does a typical project take?",
          answer: "Timelines vary by scope; we share a milestone plan during discovery.",
        },
      ],
    },
    {
      blockId: "offer-cta",
      type: "offer_cta",
      headline: "Ready to plan your space?",
      body: "Share your requirements and our team will respond with next steps.",
      ctaLabel: "Start enquiry",
      ctaUrl: "/contact",
    },
    {
      blockId: "lead-form",
      type: "lead_form_placeholder",
      headline: "Tell us about your project",
      helperText: "Prebuild preview only — submissions are disabled.",
      submitLabel: "Submit enquiry (disabled)",
    },
    {
      blockId: "footer-main",
      type: "footer",
      legalLine: "ONEDECORE Interiors. All rights reserved.",
      contactEmail: "hello@onedecore.example",
      contactPhone: "+91-98765-43210",
    },
  ];
}

export function buildSampleLandingPage(): LandingPage {
  return {
    pageReference: "OD-LP-2026-0001",
    title: "Gurgaon Interiors Landing",
    lifecycle: "active",
    createdAt: "2026-08-07T10:00:00.000Z",
    updatedAt: "2026-08-07T10:00:00.000Z",
  };
}

export function buildSampleLandingPageVersion(): LandingPageVersion {
  return {
    pageReference: "OD-LP-2026-0001",
    versionNumber: 1,
    blocks: buildSampleLandingBlocks(),
    frozenAt: "2026-08-07T10:30:00.000Z",
    label: "Initial frozen version",
  };
}

export function buildSampleLandingPublication(): LandingPublication {
  return {
    publicationReference: "OD-LP-PUB-0001",
    pageReference: "OD-LP-2026-0001",
    pageVersionNumber: 1,
    status: "draft",
    campaignReference: "OD-C-2026-0001",
    publishedAt: null,
  };
}

export function buildSamplePublicationContext(): PublicationContext {
  return {
    publicationReference: "OD-LP-PUB-0001",
    pageReference: "OD-LP-2026-0001",
    pageVersionNumber: 1,
    experimentReference: "OD-LP-EXP-0001",
    variantKey: "control",
    campaignReference: "OD-C-2026-0001",
    campaignVersionNumber: 1,
    issuedAt: "2026-08-07T10:00:00.000Z",
    expiresAt: null,
  };
}

export function buildSampleLandingExperiment(): LandingExperiment {
  return {
    experimentReference: "OD-LP-EXP-0001",
    publicationReference: "OD-LP-PUB-0001",
    status: "draft",
    variants: [
      {
        variantKey: "control",
        pageReference: "OD-LP-2026-0001",
        pageVersionNumber: 1,
        allocationPercent: 50,
        label: "Control",
      },
      {
        variantKey: "variant-b",
        pageReference: "OD-LP-2026-0001",
        pageVersionNumber: 2,
        allocationPercent: 50,
        label: "Variant B",
      },
    ],
    winnerVariantKey: null,
  };
}

export function buildAlternateLandingPageVersion(): LandingPageVersion {
  return {
    pageReference: "OD-LP-2026-0001",
    versionNumber: 2,
    blocks: buildSampleLandingBlocks().map((block) =>
      block.type === "hero"
        ? {
            ...block,
            headline: "Premium modular kitchens for Gurgaon",
          }
        : block
    ),
    frozenAt: "2026-08-07T11:00:00.000Z",
    label: "Variant B headline",
  };
}
