import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPublicRenderer } from "@/features/landing-lab/components/LandingPublicRenderer";
import { loadLiveLandingPageView } from "@/features/landing-lab/server/load-live-landing-page";
import { ignoreUnsignedRunQuery } from "@/features/marketing/execution/server/verify-execution-context";

export const dynamic = "force-dynamic";

interface LandingPublicPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LandingPublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadLiveLandingPageView(slug);

  /*
   * Campaign pages stay out of the index.
   *
   * A landing page is bought traffic for one campaign; it duplicates the real
   * site's content, often exists in two variants at once, and is retired when
   * the campaign ends. Indexing it would compete with the pages meant to rank
   * and would leave dead results behind. The title is the page's own, because
   * it names the browser tab and any link a visitor shares by hand.
   */
  return {
    title: view?.title ? `${view.title} — ONEDECORE` : "ONEDECORE",
    robots: { index: false, follow: false, nocache: true },
    other: { slug },
  };
}

export default async function LandingPublicPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{ odecx?: string; run_reference?: string; run_target_reference?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  ignoreUnsignedRunQuery({
    run_reference: query.run_reference,
    run_target_reference: query.run_target_reference,
  });
  const view = await loadLiveLandingPageView(slug);
  if (!view) notFound();

  let campaignExecutionContext = null;
  if (query.odecx) {
    try {
      const decoded = Buffer.from(query.odecx, "base64url").toString("utf8");
      campaignExecutionContext = JSON.parse(decoded) as never;
    } catch {
      campaignExecutionContext = null;
    }
  }

  /*
   * No wrapper styling here on purpose.
   *
   * This route previously constrained the page to `max-w-3xl` with its own
   * padding and background, which made a full-bleed hero impossible and left
   * every campaign page looking like a narrow document. The landing page owns
   * its own layout — `.lp-page` sets the background, the gutters and the
   * fluid rhythm — so the route's job is to resolve and mount it, nothing more.
   */
  return (
    <main data-public-dark-theme="">
      <LandingPublicRenderer
        blocks={view.blocks}
        signedContext={view.signedContext}
        campaignExecutionContext={campaignExecutionContext}
      />
    </main>
  );
}
