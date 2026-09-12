import type { LandingBlock } from "../contracts/blocks.ts";

/**
 * Starting points for a campaign page.
 *
 * WHAT A TEMPLATE IS ALLOWED TO CONTAIN.
 *
 * Structure and neutral prose. Never a figure.
 *
 * Every number ONEDECORE could put on a page — a rating, a project count, a
 * warranty length, a satisfaction percentage — is governed by
 * `features/legal/claim-evidence.ts`, and `getUnevidencedClaimIds()` currently
 * returns all ten of them: not one is backed by public evidence. A template
 * that seeded "4.9 from 500+ clients" would publish a fabricated claim the
 * moment an author picked it and moved on, and templates are picked precisely
 * by people in a hurry. So trust points ship as empty prompts the author must
 * fill, and no template contains a digit.
 *
 * Prose describing what the business offers is a different thing and is fine:
 * the live site already says "free design consultation", because that is an
 * offer the business makes rather than a measurement of it.
 *
 * WHY NO TEMPLATE INCLUDES TRUST POINTS.
 *
 * The section exists and is worth using — but only with real, supportable
 * proof. A template cannot supply that, and the two things it could supply
 * instead are both worse than leaving it out: an invented figure, or three
 * rows reading "Add a short, factual point" that ship to a live campaign
 * because the author was in a hurry. Trust Points stays in the palette, one
 * click away, for the moment there is something true to put in it.
 *
 * WHY TESTIMONIALS ARE NEVER TEMPLATED.
 *
 * A templated quote is a fake quote with a real company's name under it. No
 * template includes a testimonials block; an author who has real, permitted
 * quotes adds the block and types them.
 *
 * WHY PORTFOLIO SLUGS ARE NEVER TEMPLATED EITHER.
 *
 * A template cannot know which projects are published, and a wrong slug either
 * renders nothing or shows a project the campaign was not about. The portfolio
 * block is offered by the palette, not seeded by a template.
 */

export interface LandingTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Suggested page title; the author can change it before creating. */
  readonly suggestedTitle: string;
  readonly buildBlocks: () => readonly LandingBlock[];
}

/** The enquiry and footer blocks every page must end with. */
function closingBlocks(headline: string, helperText: string): LandingBlock[] {
  return [
    {
      blockId: "enquiry",
      type: "lead_form_placeholder",
      headline,
      helperText,
      submitLabel: "Book a free design consultation",
    },
    {
      blockId: "footer",
      type: "footer",
      legalLine: "ONEDECORE — interior design and execution, Pune.",
      contactEmail: null,
      contactPhone: null,
    },
  ];
}

function processBlock(): LandingBlock {
  return {
    blockId: "process",
    type: "process",
    title: "How it works",
    steps: [
      {
        title: "Tell us about your space",
        description:
          "Share the layout, how you use it, and what you want to change.",
      },
      {
        title: "See a design and a costing",
        description:
          "We plan the space and put a clear scope and price in front of you.",
      },
      {
        title: "We build and hand over",
        description:
          "Manufacturing, site work and installation are managed by our team.",
      },
    ],
  };
}

function faqBlock(items: ReadonlyArray<{ question: string; answer: string }>): LandingBlock {
  return { blockId: "faq", type: "faq", title: "Questions", items };
}

const COMMON_FAQ = [
  {
    question: "What does a design consultation cover?",
    answer:
      "We discuss your space, how you want to use it, and the scope you have in mind. You get a clear view of what is possible before committing to anything.",
  },
  {
    question: "Do you handle execution as well as design?",
    answer:
      "Yes. Design, manufacturing and site installation are handled by our own team, so there is one point of accountability.",
  },
];

function room(
  id: string,
  name: string,
  headline: string,
  sub: string,
  services: ReadonlyArray<{ title: string; description: string }>,
  suggestedTitle: string
): LandingTemplate {
  return {
    id,
    name,
    description: `Hero, services, process and questions, shaped for ${name.toLowerCase()} campaigns.`,
    suggestedTitle,
    buildBlocks: () => [
      {
        blockId: "hero",
        type: "hero",
        headline,
        subheadline: sub,
        primaryCtaLabel: "Book a free design consultation",
        primaryCtaUrl: null,
        imageUrl: null,
      },
      {
        blockId: "services",
        type: "service_highlights",
        title: "What this covers",
        items: services.map((service) => ({ ...service, iconLabel: null })),
      },
      processBlock(),
      faqBlock(COMMON_FAQ),
      {
        blockId: "offer",
        type: "offer_cta",
        headline: "Start with a conversation about your space",
        body: "Tell us the layout and how you live in it. We will take it from there.",
        ctaLabel: "Book a free design consultation",
        ctaUrl: null,
      },
      ...closingBlocks(
        "Book a free design consultation",
        "Share a few details and our design team will call you back."
      ),
    ],
  };
}

export const LANDING_TEMPLATES: readonly LandingTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description:
      "Just the two sections a page cannot be published without. Build the rest yourself.",
    suggestedTitle: "New landing page",
    buildBlocks: () => [
      {
        blockId: "hero",
        type: "hero",
        headline: "Interiors planned around the way you live",
        subheadline: null,
        primaryCtaLabel: "Book a free design consultation",
        primaryCtaUrl: null,
        imageUrl: null,
      },
      ...closingBlocks(
        "Book a free design consultation",
        "Share a few details and our design team will call you back."
      ),
    ],
  },

  room(
    "complete-home",
    "Complete Home Interiors",
    "Complete home interiors, planned around your space",
    "One team for design, manufacturing and installation — across every room in the house.",
    [
      {
        title: "Space planning",
        description:
          "Layouts worked out room by room, around how your household actually moves.",
      },
      {
        title: "Modular and carpentry",
        description:
          "Wardrobes, storage and built-in furniture made to the dimensions of your home.",
      },
      {
        title: "Finishes and site work",
        description:
          "Surfaces, lighting and finishing handled and coordinated on site.",
      },
    ],
    "Complete Home Interiors — Pune"
  ),

  room(
    "modular-kitchen",
    "Modular Kitchen",
    "Plan your modular kitchen with ONEDECORE",
    "A kitchen laid out around the way you cook, built to the dimensions of your space.",
    [
      {
        title: "Layout and workflow",
        description:
          "The working triangle, storage reach and appliance placement planned before anything is made.",
      },
      {
        title: "Storage that fits",
        description:
          "Units sized to what you actually keep, rather than to a standard catalogue.",
      },
      {
        title: "Finishes and hardware",
        description:
          "Shutter finishes, counters and fittings chosen together so the kitchen reads as one piece.",
      },
    ],
    "Modular Kitchen — Pune"
  ),

  room(
    "1bhk",
    "1 BHK Interiors",
    "Design your 1 BHK to work harder",
    "Compact homes reward planning. Storage, light and circulation worked out together.",
    [
      {
        title: "Storage without crowding",
        description:
          "Vertical and built-in storage that keeps the floor clear.",
      },
      {
        title: "One space, several uses",
        description:
          "Furniture and layout planned so a room can do more than one job.",
      },
      {
        title: "Light and sightlines",
        description:
          "Finishes and lighting chosen to keep a small home feeling open.",
      },
    ],
    "1 BHK Interiors — Pune"
  ),

  room(
    "2bhk",
    "2 BHK Interiors",
    "Design your 2 BHK around the way you live",
    "Living, cooking, sleeping and storage planned as one brief rather than four.",
    [
      {
        title: "Living and dining",
        description:
          "Seating, storage and circulation arranged around how the space is actually used.",
      },
      {
        title: "Bedrooms and wardrobes",
        description:
          "Wardrobe volume and bed placement worked out against the real room dimensions.",
      },
      {
        title: "Kitchen and utility",
        description:
          "A working layout with storage sized to the household.",
      },
    ],
    "2 BHK Interiors — Pune"
  ),

  room(
    "3bhk",
    "3 BHK Interiors",
    "Interiors for a 3 BHK, planned as one home",
    "More rooms means more decisions. We plan them together so the home reads as a whole.",
    [
      {
        title: "A consistent material palette",
        description:
          "Finishes chosen once and carried across rooms, so nothing looks assembled piecemeal.",
      },
      {
        title: "Storage across the home",
        description:
          "Wardrobes, utility and shared storage planned against what the household keeps.",
      },
      {
        title: "Rooms with a purpose",
        description:
          "Guest room, study or child's room planned for how it will really be used.",
      },
    ],
    "3 BHK Interiors — Pune"
  ),

  room(
    "villa",
    "Villa Interiors",
    "Villa interiors, designed across every level",
    "Larger homes need layout, material and lighting decisions to hold together across floors.",
    [
      {
        title: "Whole-home planning",
        description:
          "Circulation, sightlines and zoning worked out across levels before detailing begins.",
      },
      {
        title: "Bespoke joinery",
        description:
          "Built-in furniture and storage made for the specific spaces they sit in.",
      },
      {
        title: "Lighting and finishes",
        description:
          "Layered lighting and a material palette carried through the house.",
      },
    ],
    "Villa Interiors — Pune"
  ),

  room(
    "premium",
    "Premium Interiors",
    "Considered interiors, executed properly",
    "Detailed design, controlled execution, and one team accountable from drawing to handover.",
    [
      {
        title: "Detailed design",
        description:
          "Drawings worked to the level where the site has nothing left to improvise.",
      },
      {
        title: "Material selection",
        description:
          "Surfaces, hardware and finishes selected and specified, not left to substitution.",
      },
      {
        title: "Controlled execution",
        description:
          "Manufacturing and installation run by our own team against the approved drawings.",
      },
    ],
    "Premium Interiors — Pune"
  ),
];

export function getLandingTemplate(id: string): LandingTemplate | null {
  return LANDING_TEMPLATES.find((template) => template.id === id) ?? null;
}

export const DEFAULT_LANDING_TEMPLATE_ID = "complete-home";
