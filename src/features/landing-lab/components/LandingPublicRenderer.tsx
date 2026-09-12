import { LeadConsultationHost } from "@/features/lead-intake/public/LeadConsultationHost";
import type { LandingBlock } from "../contracts/blocks.ts";
import type { SignedPublicationContext } from "../contracts/publication-context.ts";
import { LandingPageBody } from "../public/LandingPageBody.tsx";
import { LandingLiveActions } from "../public/LandingLiveActions.tsx";
import { resolveLandingPageProjects } from "../public/resolve-landing-projects.ts";

/**
 * The live campaign landing page.
 *
 * WHAT THIS COMPONENT IS RESPONSIBLE FOR, AND WHAT IT IS NOT.
 *
 * It owns the three things that only exist on the live page: the canonical
 * lead host carrying the signed attribution contexts, real portfolio data
 * resolved from the public read model, and the sticky phone CTA. The markup
 * itself belongs to `LandingPageBody`, which the admin preview renders too —
 * so what an author approves in the builder is the same component tree that
 * gets published, not a second description of it.
 *
 * WHY IT STAYS A SERVER COMPONENT.
 *
 * Resolving portfolio slugs is a cached server read, and doing it here means
 * the public HTML arrives complete: no client fetch, no layout shift as
 * project cards appear, nothing for an ad-blocker or a slow connection to
 * interrupt. The only client code on the page is the CTA behaviour and the
 * consultation sheet.
 *
 * ATTRIBUTION IS CARRIED, NEVER CONSTRUCTED.
 *
 * `signedContext` is minted and verified server-side. This component only
 * hands it to `LeadConsultationHost`, which holds it until a lead is actually
 * submitted. Nothing here reads it, derives from it, or exposes it to page
 * code.
 */

interface LandingPublicRendererProps {
  readonly blocks: readonly LandingBlock[];
  readonly signedContext: SignedPublicationContext;
  readonly campaignExecutionContext?: unknown;
}

export async function LandingPublicRenderer({
  blocks,
  signedContext,
  campaignExecutionContext,
}: LandingPublicRendererProps) {
  const projectsByBlockId = await resolveLandingPageProjects(blocks);

  /*
   * The sticky CTA reuses the enquiry block's own label, so the phone bar and
   * the section it scrolls to never disagree. No enquiry block, no sticky bar.
   */
  const enquiryBlock = blocks.find(
    (block) => block.type === "lead_form_placeholder"
  );
  const stickyCtaLabel =
    enquiryBlock?.type === "lead_form_placeholder" ? enquiryBlock.submitLabel : null;

  return (
    <LeadConsultationHost
      trustedContexts={{
        landingPublicationContext: signedContext,
        campaignExecutionContext,
      }}
    >
      <LandingLiveActions>
        <LandingPageBody
          blocks={blocks}
          projectsByBlockId={projectsByBlockId}
          stickyCtaLabel={stickyCtaLabel}
        />
      </LandingLiveActions>
    </LeadConsultationHost>
  );
}
