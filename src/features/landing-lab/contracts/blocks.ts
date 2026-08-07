/**
 * Phase 9B migration-independent — structured landing page block schemas.
 */

export const LANDING_BLOCK_TYPES = [
  "hero",
  "trust_proof",
  "service_highlights",
  "process",
  "portfolio_preview",
  "testimonials",
  "faq",
  "offer_cta",
  "lead_form_placeholder",
  "footer",
] as const;

export type LandingBlockType = (typeof LANDING_BLOCK_TYPES)[number];

const MAX_SHORT_TEXT = 120;
const MAX_MEDIUM_TEXT = 280;
const MAX_LONG_TEXT = 600;
const MAX_ITEMS = 12;
const MAX_FAQ_ITEMS = 20;
const BLOCK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,48}$/i;
const SAFE_URL_PATTERN =
  /^(https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%]*|\/[a-zA-Z0-9][-a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%]*|#[a-zA-Z][-a-zA-Z0-9._~-]*)$/;
const UNSAFE_TEXT_PATTERN = /<|>|javascript:|on\w+\s*=/i;

export interface BlockBase {
  readonly blockId: string;
  readonly type: LandingBlockType;
}

export interface HeroBlock extends BlockBase {
  readonly type: "hero";
  readonly headline: string;
  readonly subheadline: string | null;
  readonly primaryCtaLabel: string;
  readonly primaryCtaUrl: string | null;
  readonly imageUrl: string | null;
}

export interface TrustProofBlock extends BlockBase {
  readonly type: "trust_proof";
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }>;
}

export interface ServiceHighlightsBlock extends BlockBase {
  readonly type: "service_highlights";
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly title: string;
    readonly description: string;
    readonly iconLabel: string | null;
  }>;
}

export interface ProcessBlock extends BlockBase {
  readonly type: "process";
  readonly title: string;
  readonly steps: ReadonlyArray<{
    readonly title: string;
    readonly description: string;
  }>;
}

export interface PortfolioPreviewBlock extends BlockBase {
  readonly type: "portfolio_preview";
  readonly title: string;
  readonly projectSlugs: readonly string[];
  readonly ctaLabel: string | null;
  readonly ctaUrl: string | null;
}

export interface TestimonialsBlock extends BlockBase {
  readonly type: "testimonials";
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly quote: string;
    readonly author: string;
    readonly role: string | null;
  }>;
}

export interface FaqBlock extends BlockBase {
  readonly type: "faq";
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly question: string;
    readonly answer: string;
  }>;
}

export interface OfferCtaBlock extends BlockBase {
  readonly type: "offer_cta";
  readonly headline: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly ctaUrl: string | null;
}

export interface LeadFormPlaceholderBlock extends BlockBase {
  readonly type: "lead_form_placeholder";
  readonly headline: string;
  readonly helperText: string | null;
  readonly submitLabel: string;
}

export interface FooterBlock extends BlockBase {
  readonly type: "footer";
  readonly legalLine: string;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
}

export type LandingBlock =
  | HeroBlock
  | TrustProofBlock
  | ServiceHighlightsBlock
  | ProcessBlock
  | PortfolioPreviewBlock
  | TestimonialsBlock
  | FaqBlock
  | OfferCtaBlock
  | LeadFormPlaceholderBlock
  | FooterBlock;

function validateBlockId(blockId: string): string | null {
  if (!BLOCK_ID_PATTERN.test(blockId)) {
    return "Block id must be 3-49 alphanumeric characters, hyphens, or underscores.";
  }
  return null;
}

function validateSafeText(
  value: unknown,
  maxLength: number,
  field: string
): string | null {
  if (typeof value !== "string") return `${field} must be a string.`;
  const trimmed = value.trim();
  if (!trimmed) return `${field} is required.`;
  if (trimmed.length > maxLength) return `${field} exceeds ${maxLength} characters.`;
  if (UNSAFE_TEXT_PATTERN.test(trimmed)) {
    return `${field} contains unsafe HTML or script patterns.`;
  }
  return null;
}

function validateOptionalSafeText(
  value: unknown,
  maxLength: number,
  field: string
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return `${field} must be a string or null.`;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return `${field} exceeds ${maxLength} characters.`;
  if (UNSAFE_TEXT_PATTERN.test(trimmed)) {
    return `${field} contains unsafe HTML or script patterns.`;
  }
  return null;
}

function validateSafeUrl(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return `${field} must be a string or null.`;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 512) return `${field} exceeds 512 characters.`;
  if (!SAFE_URL_PATTERN.test(trimmed)) return `${field} must be a safe http(s) or root-relative URL.`;
  return null;
}

function validateSlug(value: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(value)) {
    return "Portfolio slug must be lowercase alphanumeric with hyphens.";
  }
  return null;
}

export function validateLandingBlock(block: unknown): string | null {
  if (!block || typeof block !== "object") return "Block must be an object.";
  const candidate = block as Record<string, unknown>;
  const blockIdError = validateBlockId(String(candidate.blockId ?? ""));
  if (blockIdError) return blockIdError;

  const type = candidate.type;
  if (typeof type !== "string" || !LANDING_BLOCK_TYPES.includes(type as LandingBlockType)) {
    return "Block type is invalid.";
  }

  switch (type) {
    case "hero": {
      const headline = validateSafeText(candidate.headline, MAX_MEDIUM_TEXT, "headline");
      if (headline) return headline;
      const subheadline = validateOptionalSafeText(
        candidate.subheadline,
        MAX_MEDIUM_TEXT,
        "subheadline"
      );
      if (subheadline) return subheadline;
      const primaryCtaLabel = validateSafeText(
        candidate.primaryCtaLabel,
        MAX_SHORT_TEXT,
        "primaryCtaLabel"
      );
      if (primaryCtaLabel) return primaryCtaLabel;
      const primaryCtaUrl = validateSafeUrl(candidate.primaryCtaUrl, "primaryCtaUrl");
      if (primaryCtaUrl) return primaryCtaUrl;
      const imageUrl = validateSafeUrl(candidate.imageUrl, "imageUrl");
      if (imageUrl) return imageUrl;
      return null;
    }
    case "trust_proof": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        return "trust_proof requires at least one item.";
      }
      if (candidate.items.length > MAX_ITEMS) return "trust_proof exceeds item limit.";
      for (const item of candidate.items) {
        if (!item || typeof item !== "object") return "trust_proof item must be an object.";
        const label = validateSafeText((item as { label?: unknown }).label, MAX_SHORT_TEXT, "label");
        if (label) return label;
        const value = validateSafeText((item as { value?: unknown }).value, MAX_SHORT_TEXT, "value");
        if (value) return value;
      }
      return null;
    }
    case "service_highlights": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        return "service_highlights requires at least one item.";
      }
      if (candidate.items.length > MAX_ITEMS) return "service_highlights exceeds item limit.";
      for (const item of candidate.items) {
        if (!item || typeof item !== "object") return "service_highlights item must be an object.";
        const row = item as Record<string, unknown>;
        const itemTitle = validateSafeText(row.title, MAX_SHORT_TEXT, "title");
        if (itemTitle) return itemTitle;
        const description = validateSafeText(row.description, MAX_MEDIUM_TEXT, "description");
        if (description) return description;
        const iconLabel = validateOptionalSafeText(row.iconLabel, MAX_SHORT_TEXT, "iconLabel");
        if (iconLabel) return iconLabel;
      }
      return null;
    }
    case "process": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
        return "process requires at least one step.";
      }
      if (candidate.steps.length > MAX_ITEMS) return "process exceeds step limit.";
      for (const step of candidate.steps) {
        if (!step || typeof step !== "object") return "process step must be an object.";
        const row = step as Record<string, unknown>;
        const stepTitle = validateSafeText(row.title, MAX_SHORT_TEXT, "title");
        if (stepTitle) return stepTitle;
        const description = validateSafeText(row.description, MAX_MEDIUM_TEXT, "description");
        if (description) return description;
      }
      return null;
    }
    case "portfolio_preview": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.projectSlugs) || candidate.projectSlugs.length === 0) {
        return "portfolio_preview requires at least one project slug.";
      }
      if (candidate.projectSlugs.length > MAX_ITEMS) {
        return "portfolio_preview exceeds slug limit.";
      }
      for (const slug of candidate.projectSlugs) {
        const slugError = validateSlug(String(slug));
        if (slugError) return slugError;
      }
      const ctaLabel = validateOptionalSafeText(candidate.ctaLabel, MAX_SHORT_TEXT, "ctaLabel");
      if (ctaLabel) return ctaLabel;
      const ctaUrl = validateSafeUrl(candidate.ctaUrl, "ctaUrl");
      if (ctaUrl) return ctaUrl;
      return null;
    }
    case "testimonials": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        return "testimonials requires at least one item.";
      }
      if (candidate.items.length > MAX_ITEMS) return "testimonials exceeds item limit.";
      for (const item of candidate.items) {
        if (!item || typeof item !== "object") return "testimonials item must be an object.";
        const row = item as Record<string, unknown>;
        const quote = validateSafeText(row.quote, MAX_LONG_TEXT, "quote");
        if (quote) return quote;
        const author = validateSafeText(row.author, MAX_SHORT_TEXT, "author");
        if (author) return author;
        const role = validateOptionalSafeText(row.role, MAX_SHORT_TEXT, "role");
        if (role) return role;
      }
      return null;
    }
    case "faq": {
      const title = validateSafeText(candidate.title, MAX_SHORT_TEXT, "title");
      if (title) return title;
      if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        return "faq requires at least one item.";
      }
      if (candidate.items.length > MAX_FAQ_ITEMS) return "faq exceeds item limit.";
      for (const item of candidate.items) {
        if (!item || typeof item !== "object") return "faq item must be an object.";
        const row = item as Record<string, unknown>;
        const question = validateSafeText(row.question, MAX_MEDIUM_TEXT, "question");
        if (question) return question;
        const answer = validateSafeText(row.answer, MAX_LONG_TEXT, "answer");
        if (answer) return answer;
      }
      return null;
    }
    case "offer_cta": {
      const headline = validateSafeText(candidate.headline, MAX_MEDIUM_TEXT, "headline");
      if (headline) return headline;
      const body = validateSafeText(candidate.body, MAX_LONG_TEXT, "body");
      if (body) return body;
      const ctaLabel = validateSafeText(candidate.ctaLabel, MAX_SHORT_TEXT, "ctaLabel");
      if (ctaLabel) return ctaLabel;
      const ctaUrl = validateSafeUrl(candidate.ctaUrl, "ctaUrl");
      if (ctaUrl) return ctaUrl;
      return null;
    }
    case "lead_form_placeholder": {
      const headline = validateSafeText(candidate.headline, MAX_MEDIUM_TEXT, "headline");
      if (headline) return headline;
      const helperText = validateOptionalSafeText(
        candidate.helperText,
        MAX_MEDIUM_TEXT,
        "helperText"
      );
      if (helperText) return helperText;
      const submitLabel = validateSafeText(candidate.submitLabel, MAX_SHORT_TEXT, "submitLabel");
      if (submitLabel) return submitLabel;
      return null;
    }
    case "footer": {
      const legalLine = validateSafeText(candidate.legalLine, MAX_MEDIUM_TEXT, "legalLine");
      if (legalLine) return legalLine;
      const contactEmail = validateOptionalSafeText(
        candidate.contactEmail,
        MAX_SHORT_TEXT,
        "contactEmail"
      );
      if (contactEmail) return contactEmail;
      const contactPhone = validateOptionalSafeText(
        candidate.contactPhone,
        MAX_SHORT_TEXT,
        "contactPhone"
      );
      if (contactPhone) return contactPhone;
      return null;
    }
    default:
      return "Block type is invalid.";
  }
}

export function validateLandingPageBlocks(blocks: readonly unknown[]): string | null {
  if (!Array.isArray(blocks)) return "Blocks must be an array.";
  if (blocks.length === 0) return "At least one block is required.";
  if (blocks.length > 32) return "Page exceeds maximum block count.";

  const seenIds = new Set<string>();
  let hasLeadForm = false;
  let hasFooter = false;

  for (const block of blocks) {
    const error = validateLandingBlock(block);
    if (error) return error;
    const blockId = String((block as { blockId: string }).blockId);
    if (seenIds.has(blockId)) return `Duplicate block id: ${blockId}.`;
    seenIds.add(blockId);
    const type = (block as { type: LandingBlockType }).type;
    if (type === "lead_form_placeholder") hasLeadForm = true;
    if (type === "footer") hasFooter = true;
  }

  if (!hasLeadForm) return "Page must include a lead_form_placeholder block.";
  if (!hasFooter) return "Page must include a footer block.";
  return null;
}
