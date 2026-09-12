import type { LandingBlock } from "../contracts/blocks.ts";
import {
  FaqSection,
  FooterSection,
  HeroSection,
  LeadFormSection,
  OfferCtaSection,
  PortfolioPreviewSection,
  ProcessSection,
  ServiceHighlightsSection,
  TestimonialsSection,
  TrustProofSection,
} from "./LandingBlocks.tsx";
import { LandingCta } from "./LandingCta.tsx";
import type { LandingProjectCard } from "./resolve-landing-projects.ts";
import "./landing-page.css";

/**
 * The whole page, from blocks to markup.
 *
 * This is the single description of a campaign landing page. The live route
 * and the admin preview both render it; the only difference between them is
 * what is provided around it — a real `LeadConsultationHost` and resolved
 * portfolio data on the live page, neither in the preview.
 *
 * WHY THE HERO IS SPECIAL-CASED.
 *
 * `<h1>` must appear exactly once, and the first image the visitor sees should
 * not be lazy-loaded. Both are properties of the FIRST hero on the page rather
 * than of hero blocks in general: an author may add a second hero further down,
 * and that one is an `<h2>` section with a lazily-loaded image. Passing
 * `priority` only to the first one is what keeps the document outline honest.
 */

export interface LandingPageBodyProps {
  readonly blocks: readonly LandingBlock[];
  /** Resolved portfolio cards, keyed by the blockId that asked for them. */
  readonly projectsByBlockId?: Readonly<Record<string, readonly LandingProjectCard[]>>;
  /**
   * The sticky phone CTA. Absent in the preview, where a control fixed to the
   * viewport would float over the admin UI rather than the page being previewed.
   */
  readonly stickyCtaLabel?: string | null;
  /**
   * Highlights one section in the admin preview. Never set on the live page,
   * where nothing is "selected" and the attribute simply does not appear.
   */
  readonly selectedBlockId?: string | null;
}

function blockSection(
  block: LandingBlock,
  isFirstHero: boolean,
  projects: readonly LandingProjectCard[]
) {
  switch (block.type) {
    case "hero":
      return <HeroSection block={block} priority={isFirstHero} />;
    case "trust_proof":
      return <TrustProofSection block={block} />;
    case "service_highlights":
      return <ServiceHighlightsSection block={block} />;
    case "process":
      return <ProcessSection block={block} />;
    case "portfolio_preview":
      return <PortfolioPreviewSection block={block} projects={projects} />;
    case "testimonials":
      return <TestimonialsSection block={block} />;
    case "faq":
      return <FaqSection block={block} />;
    case "offer_cta":
      return <OfferCtaSection block={block} />;
    case "lead_form_placeholder":
      return <LeadFormSection block={block} />;
    case "footer":
      return <FooterSection block={block} />;
    default: {
      // Exhaustiveness: a new block type must be given a section here.
      const never: never = block;
      void never;
      return null;
    }
  }
}

export function LandingPageBody({
  blocks,
  projectsByBlockId,
  stickyCtaLabel,
  selectedBlockId,
}: LandingPageBodyProps) {
  const firstHeroId = blocks.find((block) => block.type === "hero")?.blockId ?? null;

  return (
    <div className="lp-page" data-lp-page="">
      {blocks.map((block) =>
        (
          <div
            key={block.blockId}
            data-lp-block-id={block.blockId}
            data-lp-selected={
              selectedBlockId === block.blockId ? "true" : undefined
            }
          >
            {blockSection(
              block,
              block.blockId === firstHeroId,
              projectsByBlockId?.[block.blockId] ?? []
            )}
          </div>
        )
      )}

      {stickyCtaLabel ? (
        <div className="lp-sticky" data-lp-sticky="">
          <LandingCta label={stickyCtaLabel} url={null} source="sticky" />
        </div>
      ) : null}
    </div>
  );
}
