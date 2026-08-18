import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPublicRenderer } from "@/features/landing-lab/components/LandingPublicRenderer";
import { loadLiveLandingPageView } from "@/features/landing-lab/server/load-live-landing-page";

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

export default async function LandingPublicPage({ params }: LandingPublicPageProps) {
  const { slug } = await params;
  const view = await loadLiveLandingPageView(slug);
  if (!view) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-neutral-950 px-4 py-12 text-neutral-100">
      <LandingPublicRenderer blocks={view.blocks} signedContext={view.signedContext} />
    </main>
  );
}
