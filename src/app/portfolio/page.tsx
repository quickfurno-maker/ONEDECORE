import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PortfolioGrid } from "@/features/portfolio/public/components/PortfolioGrid";
import { PortfolioRoomGallery } from "@/features/portfolio/public/components/PortfolioRoomGallery";
import { PortfolioSkeleton } from "@/features/portfolio/public/components/PortfolioSkeleton";
import { PortfolioViewTabs } from "@/features/portfolio/public/components/PortfolioViewTabs";
import {
  getPaginatedProjects,
  getRoomGallery,
} from "@/features/portfolio/public/public-portfolio-cache";
import { parseListingParams } from "@/features/portfolio/public/public-request-validation";
import { PORTFOLIO_SERVICE_LABELS } from "@/features/portfolio/public/constants";
import {
  PORTFOLIO_ROOM_LABELS,
  portfolioViewHref,
  roomForView,
  type PortfolioViewCode,
} from "@/features/portfolio/public/portfolio-rooms";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const LISTING_DESCRIPTION =
  "Browse ONEDECORE's portfolio of home interiors, modular kitchens, and custom wardrobes.";

interface PortfolioPageProps {
  searchParams: Promise<{
    page?: string;
    service?: string;
    category?: string;
    view?: string;
  }>;
}

/**
 * Canonical URL for a view. The default view carries no query parameter.
 *
 * Built from the same `portfolioViewHref` the tabs use, so the canonical tag
 * and the link a visitor followed can never name two different addresses for
 * one listing.
 */
function canonicalForView(view: PortfolioViewCode): string {
  const path = portfolioViewHref(view);
  const query = path.slice(path.indexOf("?") + 1);
  return path.includes("?")
    ? `${absoluteUrl("portfolio")}?${query}`
    : absoluteUrl("portfolio");
}

function titleForView(view: PortfolioViewCode): string {
  const room = roomForView(view);
  return room
    ? `${PORTFOLIO_ROOM_LABELS[room]} Interiors — ${SITE_CONFIG.name}`
    : `Portfolio — ${SITE_CONFIG.name}`;
}

/**
 * SEO NOTE: `notFound()` BELONGS IN THE PAGE, NOT IN THE METADATA.
 *
 * These routes used to call `notFound()` from `generateMetadata` as well. The
 * not-found BODY rendered, so the bug was invisible in a browser — but the
 * response still carried HTTP 200, and a crawler reads the status, not the
 * words. Every bogus `?view=` and `?page=` value was therefore an indexable
 * 200 page saying "not found".
 *
 * `generateMetadata` is not the render path: Next documents `notFound()` for
 * Server Components, Server Functions and Route Handlers, and it works by
 * throwing where the renderer can catch it and set the status. So metadata
 * returns a `noindex` document for input it cannot describe, and the page
 * component below is the ONE place that calls `notFound()` — which is what
 * produces both the 404 status and the not-found UI.
 */
export async function generateMetadata({
  searchParams,
}: PortfolioPageProps): Promise<Metadata> {
  const parsed = parseListingParams(await searchParams);

  if (!parsed) {
    return {
      title: `Portfolio — ${SITE_CONFIG.name}`,
      robots: { index: false, follow: false },
    };
  }

  const title = titleForView(parsed.view);
  const canonical = canonicalForView(parsed.view);

  return {
    title,
    description: LISTING_DESCRIPTION,
    /*
     * The canonical points at the `?view=` form even when the visitor arrived
     * via a legacy `?category=` link, so the two addresses do not compete for
     * the same listing.
     */
    alternates: { canonical },
    openGraph: {
      title,
      description: LISTING_DESCRIPTION,
      url: canonical,
      siteName: SITE_CONFIG.name,
      locale: SITE_CONFIG.locale,
      type: "website",
    },
  };
}

/**
 * The parts that wait on the database, and the only parts inside Suspense.
 *
 * Keeping the fetch here rather than in the page body is what lets the page
 * decide 404-or-not BEFORE anything streams, while the skeleton still covers
 * the fetch itself.
 */
async function PortfolioProjectResults({
  page,
  service,
  category,
}: {
  readonly page: number;
  readonly service?: string;
  readonly category?: string;
}) {
  const paginatedData = await getPaginatedProjects(page, service, category);
  return <PortfolioGrid data={paginatedData} />;
}

async function PortfolioRoomResults({
  view,
}: {
  readonly view: Exclude<PortfolioViewCode, "projects">;
}) {
  const gallery = await getRoomGallery(view);
  return <PortfolioRoomGallery room={gallery.room} photos={gallery.photos} />;
}

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  /*
   * VALIDATE BEFORE ANYTHING STREAMS.
   *
   * `notFound()` can only set an HTTP 404 while the response headers are still
   * unsent. A Suspense fallback rendering is what sends them, so this check --
   * and the `notFound()` it may call -- must come before the boundary below.
   */
  const raw = await searchParams;
  const parsed = parseListingParams(raw);

  if (!parsed) {
    notFound();
  }

  /*
   * LEGACY LINKS GET ONE PERMANENT ANSWER, NOT A SECOND ADDRESS.
   *
   * `?category=` was the old public navigation. Rather than serving the same
   * listing at two URLs, an old link is redirected to the canonical `?view=`
   * form — which keeps the link working, keeps one address per listing, and
   * means nothing has to guess later which of the two was authoritative.
   *
   * 308, not 307: the scheme moved permanently, so a crawler should transfer
   * whatever the old URL had earned and stop asking for it. A temporary
   * redirect would keep both addresses alive in the index indefinitely.
   */
  if (raw.category !== undefined) {
    permanentRedirect(portfolioViewHref(parsed.view));
  }

  const room = roomForView(parsed.view);

  return (
    <main id="portfolio-page-main" className="od-portfolio-main">
      <header className="od-portfolio-header">
        <p className="od-portfolio-eyebrow">ONEDECORE Portfolio</p>
        <h1 className="od-portfolio-title">
          {room
            ? `${PORTFOLIO_ROOM_LABELS[room]} interiors we’ve delivered across Pune.`
            : "Interiors we’ve delivered across Pune."}
        </h1>
        {/*
          NO LEDE ON A ROOM VIEW.
          The sentence that used to sit here — "Every image opens the project it
          came from" — stopped being true the moment the room library shipped:
          a bulk-uploaded room photograph has no project to open. Rather than
          replace one paragraph of explanation with another, the room views
          carry none at all. A grid of photographs under a heading that names
          the room does not need to be explained; the projects listing does,
          because "Projects" alone does not say what a card will be.
        */}
        {room ? null : (
          <p className="od-portfolio-lede">
            {parsed.service
              ? `Showing projects for ${PORTFOLIO_SERVICE_LABELS[parsed.service]}`
              : "Complete home interiors, modular kitchens and custom wardrobes — photographed as delivered."}
          </p>
        )}
      </header>

      <PortfolioViewTabs activeView={parsed.view} />

      <Suspense fallback={<PortfolioSkeleton variant={room ? "room" : "projects"} />}>
        {room ? (
          <PortfolioRoomResults view={room} />
        ) : (
          <PortfolioProjectResults
            page={parsed.page}
            service={parsed.service ?? undefined}
            category={parsed.category ?? undefined}
          />
        )}
      </Suspense>
    </main>
  );
}
