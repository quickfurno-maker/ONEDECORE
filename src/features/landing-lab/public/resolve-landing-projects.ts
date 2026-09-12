import "server-only";

import { getProjectBySlug } from "../../portfolio/public/public-portfolio-cache.ts";
import { focalObjectPosition } from "../../portfolio/public/portfolio-rooms.ts";
import type { LandingBlock } from "../contracts/blocks.ts";

/**
 * Turns the project slugs an author picked into real, renderable cards.
 *
 * WHY THE RENDERER CANNOT DO THIS ITSELF.
 *
 * The old portfolio block printed `block.projectSlugs.join(", ")` — internal
 * identifiers, as customer-facing copy, on a page bought with ad spend. The
 * data to do better already existed: `getProjectBySlug` is the same cached
 * public read model the portfolio pages use, so a landing page shows exactly
 * what `/portfolio` shows and goes stale at the same moment.
 *
 * WHY IT READS THE PUBLIC MODEL AND NOTHING ELSE.
 *
 * `getProjectBySlug` returns published projects only. A landing page therefore
 * cannot surface a draft, an unpublished project, or any admin-side field,
 * even if an author types the slug of one they saw in the CMS. That is the
 * whole reason this goes through the public cache rather than a direct query.
 *
 * WHY A MISSING SLUG IS SILENT.
 *
 * Projects get unpublished, and a live campaign must not break when one does.
 * An unresolved slug is dropped. If every slug in a block is gone the block
 * renders nothing at all, which is a page with one fewer section rather than a
 * heading above an empty grid or, worse, a 500 during a campaign.
 */

export interface LandingProjectCard {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  /** `object-position` honouring the project's configured focal point. */
  readonly objectPosition: string;
  /** Short line under the title: location, property type, or both. */
  readonly meta: string | null;
}

function buildMeta(project: {
  locationLabel: string | null;
  propertyType: string | null;
}): string | null {
  const parts = [project.propertyType, project.locationLabel].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Resolve one block's slugs, in the order the author arranged them. */
export async function resolveLandingProjectCards(
  slugs: readonly string[]
): Promise<readonly LandingProjectCard[]> {
  const unique = [...new Set(slugs)];
  const resolved = await Promise.all(
    unique.map(async (slug) => {
      try {
        const project = await getProjectBySlug(slug);
        if (!project) return null;
        const cover = project.cover;
        if (!cover?.url) return null;

        return {
          slug: project.slug,
          title: project.title,
          href: `/portfolio/${project.slug}`,
          imageUrl: cover.url,
          imageAlt: cover.altText || project.title,
          objectPosition: focalObjectPosition(cover.focalX, cover.focalY),
          meta: buildMeta(project),
        } satisfies LandingProjectCard;
      } catch {
        // A cache miss or a transient read must not take the campaign down.
        return null;
      }
    })
  );

  return resolved.filter((card): card is LandingProjectCard => card !== null);
}

/**
 * Every portfolio block on a page, resolved in one pass.
 *
 * Keyed by blockId so the renderer stays synchronous: the page awaits this
 * once on the server and hands the components plain data, which is what lets
 * the same components render in the admin preview with no data layer at all.
 */
export async function resolveLandingPageProjects(
  blocks: readonly LandingBlock[]
): Promise<Readonly<Record<string, readonly LandingProjectCard[]>>> {
  const portfolioBlocks = blocks.filter(
    (block): block is Extract<LandingBlock, { type: "portfolio_preview" }> =>
      block.type === "portfolio_preview"
  );
  if (portfolioBlocks.length === 0) return {};

  const entries = await Promise.all(
    portfolioBlocks.map(
      async (block) =>
        [block.blockId, await resolveLandingProjectCards(block.projectSlugs)] as const
    )
  );

  return Object.fromEntries(entries);
}
