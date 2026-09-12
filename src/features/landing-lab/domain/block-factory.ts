import {
  LANDING_BLOCK_TYPES,
  type LandingBlock,
  type LandingBlockType,
} from "../contracts/blocks.ts";

/**
 * New blocks, duplicates, and moves — the three structural edits.
 *
 * WHY DEFAULTS CONTAIN NO NUMBERS.
 *
 * Every figure ONEDECORE could put on a page — a rating, a project count, a
 * warranty length, a satisfaction percentage — is governed by
 * `features/legal/claim-evidence.ts`, and not one of them is currently backed
 * by public evidence. A default like "4.9 rating from 500+ clients" would put
 * an unevidenced claim on a campaign page the moment an author added a block
 * and forgot to edit it, which is exactly how fabricated proof reaches
 * production.
 *
 * So the defaults describe the SHAPE of a section and leave the substance to
 * the author: "Add a short, factual point" rather than a fictional statistic.
 * Prose about what the business offers is fine — the live site already says
 * "free design consultation" — but a number is never a default.
 *
 * WHY IDS ARE DERIVED FROM THE TYPE AND A COUNTER.
 *
 * A block id ends up in the saved JSON and in validation messages. Deriving it
 * from the author's headline would put customer-facing copy into a structural
 * identifier, and renaming the headline later would either break the id or
 * leave it lying about its own content.
 */

const ID_SUFFIX_LIMIT = 200;

/** A short, stable stem per type. Kept inside the 3-49 char id pattern. */
const ID_STEM: Record<LandingBlockType, string> = {
  hero: "hero",
  trust_proof: "trust",
  service_highlights: "services",
  process: "process",
  portfolio_preview: "portfolio",
  testimonials: "testimonials",
  faq: "faq",
  offer_cta: "offer",
  lead_form_placeholder: "enquiry",
  footer: "footer",
};

/** Human labels for the palette and outline. */
export const LANDING_BLOCK_LABELS: Record<LandingBlockType, string> = {
  hero: "Hero",
  trust_proof: "Trust points",
  service_highlights: "Services",
  process: "How it works",
  portfolio_preview: "Project gallery",
  testimonials: "Testimonials",
  faq: "Questions",
  offer_cta: "Call to action",
  lead_form_placeholder: "Enquiry form",
  footer: "Footer",
};

/** One line explaining what each section is for, shown in the palette. */
export const LANDING_BLOCK_DESCRIPTIONS: Record<LandingBlockType, string> = {
  hero: "The first screen: headline, supporting line and the main button.",
  trust_proof: "Short factual points, side by side.",
  service_highlights: "What you do, as a small set of cards.",
  process: "The steps a customer goes through, in order.",
  portfolio_preview: "Real projects from your portfolio, as photographs.",
  testimonials: "Quotes from real clients. Only publish ones you have.",
  faq: "Questions people actually ask before enquiring.",
  offer_cta: "A focused prompt to get in touch.",
  lead_form_placeholder: "Opens the ONEDECORE enquiry form. Required.",
  footer: "Legal line and contact details. Required.",
};

export function nextBlockId(
  type: LandingBlockType,
  existingIds: readonly string[]
): string {
  const stem = ID_STEM[type];
  const taken = new Set(existingIds.map((id) => id.toLowerCase()));
  if (!taken.has(stem)) return stem;
  for (let n = 2; n <= ID_SUFFIX_LIMIT; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Practically unreachable: the page cap is far below the suffix limit.
  return `${stem}-${Date.now().toString(36)}`;
}

/**
 * A valid, empty-but-publishable block of the given type.
 *
 * Every returned block passes `validateLandingBlock` as-is, so adding a section
 * never puts the page into a state that cannot be saved. Nullable fields are
 * explicit `null` because the contract types them `| null`, not `?`.
 */
export function createLandingBlock(
  type: LandingBlockType,
  existingIds: readonly string[]
): LandingBlock {
  const blockId = nextBlockId(type, existingIds);

  switch (type) {
    case "hero":
      return {
        blockId,
        type: "hero",
        headline: "Interiors planned around the way you live",
        subheadline: null,
        primaryCtaLabel: "Book a free design consultation",
        primaryCtaUrl: null,
        imageUrl: null,
      };
    case "trust_proof":
      return {
        blockId,
        type: "trust_proof",
        title: "Why ONEDECORE",
        items: [{ label: "Add a label", value: "Add a short, factual point" }],
      };
    case "service_highlights":
      return {
        blockId,
        type: "service_highlights",
        title: "What we design",
        items: [
          {
            title: "Add a service",
            description: "Describe what this covers, in one or two lines.",
            iconLabel: null,
          },
        ],
      };
    case "process":
      return {
        blockId,
        type: "process",
        title: "How it works",
        steps: [
          {
            title: "Add a step",
            description: "Describe what happens at this stage.",
          },
        ],
      };
    case "portfolio_preview":
      return {
        blockId,
        type: "portfolio_preview",
        title: "Recent projects",
        // Deliberately empty of real slugs: the author picks published
        // projects from the portfolio, so the page can never show a project
        // that was chosen for it by a default.
        projectSlugs: ["replace-with-a-published-project"],
        ctaLabel: "See more projects",
        ctaUrl: "/portfolio",
      };
    case "testimonials":
      return {
        blockId,
        type: "testimonials",
        title: "What clients say",
        items: [
          {
            quote: "Replace this with a real quote you have permission to use.",
            author: "Client name",
            role: null,
          },
        ],
      };
    case "faq":
      return {
        blockId,
        type: "faq",
        title: "Questions",
        items: [
          {
            question: "Add a question people actually ask",
            answer: "Answer it plainly, in a sentence or two.",
          },
        ],
      };
    case "offer_cta":
      return {
        blockId,
        type: "offer_cta",
        headline: "Plan your interiors with ONEDECORE",
        body: "Tell us about your space and we will take it from there.",
        ctaLabel: "Book a free design consultation",
        ctaUrl: null,
      };
    case "lead_form_placeholder":
      return {
        blockId,
        type: "lead_form_placeholder",
        headline: "Book a free design consultation",
        helperText: "Share a few details and our design team will call you back.",
        submitLabel: "Start my design brief",
      };
    case "footer":
      return {
        blockId,
        type: "footer",
        legalLine: "ONEDECORE — interior design and execution, Pune.",
        contactEmail: null,
        contactPhone: null,
      };
    default: {
      // Exhaustiveness: adding a block type without a factory is a build error.
      const never: never = type;
      throw new Error(`No default block for type: ${String(never)}`);
    }
  }
}

/** A copy of a block, under a fresh unique id. */
export function duplicateLandingBlock(
  block: LandingBlock,
  existingIds: readonly string[]
): LandingBlock {
  return { ...block, blockId: nextBlockId(block.type, existingIds) } as LandingBlock;
}

/**
 * Move one block up or down.
 *
 * Returns the ORIGINAL array when the move is impossible, so callers can treat
 * an unchanged reference as "nothing happened" and skip marking the page dirty.
 */
export function moveLandingBlock(
  blocks: readonly LandingBlock[],
  index: number,
  direction: -1 | 1
): readonly LandingBlock[] {
  const target = index + direction;
  if (index < 0 || index >= blocks.length) return blocks;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** Move a block to an arbitrary position, for drag-and-drop. */
export function reorderLandingBlocks(
  blocks: readonly LandingBlock[],
  fromIndex: number,
  toIndex: number
): readonly LandingBlock[] {
  if (fromIndex === toIndex) return blocks;
  if (fromIndex < 0 || fromIndex >= blocks.length) return blocks;
  if (toIndex < 0 || toIndex >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

export const ORDERED_BLOCK_TYPES: readonly LandingBlockType[] = LANDING_BLOCK_TYPES;
