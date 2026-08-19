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
  return {
    title: "ONEDECORE",
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

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-neutral-950 px-4 py-12 text-neutral-100">
      <LandingPublicRenderer
        blocks={view.blocks}
        signedContext={view.signedContext}
        campaignExecutionContext={campaignExecutionContext}
      />
    </main>
  );
}
