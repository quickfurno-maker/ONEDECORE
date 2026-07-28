import Image from "next/image";
import Link from "next/link";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import {
  CM_CTA,
  CM_SECTION_IDS,
  FEATURED_PORTFOLIO_COPY,
} from "./content";
import { Reveal } from "../shared/Reveal";

interface ProjectsSectionProps {
  readonly featured: readonly PublicPortfolioCard[];
}

function projectMeta(card: PublicPortfolioCard): string | null {
  const place = card.locationLabel ?? card.services[0]?.serviceLabel ?? null;
  const year = card.completionYear ? String(card.completionYear) : null;
  const property = card.propertyType;
  return [place, property, year].filter(Boolean).join(" · ") || null;
}

function hasCover(card: PublicPortfolioCard): boolean {
  return Boolean(card.cover?.url);
}

/** Next.js image optimizer refuses private IPs; keep local review covers visible. */
function isLocalStorageUrl(url: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(url);
}

export function ProjectsSection({ featured }: ProjectsSectionProps) {
  const withCovers = featured.filter(hasCover);
  const [lead, ...rest] = withCovers;
  const supporting = rest.slice(0, 4);

  return (
    <section
      id={CM_SECTION_IDS.projects}
      className="cm-section cm-projects"
      aria-labelledby="cm-projects-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head cm-section__head--split">
          <div>
            <p className="dc-eyebrow">{FEATURED_PORTFOLIO_COPY.overline}</p>
            <h2 id="cm-projects-title" className="cm-h2">
              {FEATURED_PORTFOLIO_COPY.heading}
            </h2>
          </div>
          <p className="dc-lede">{FEATURED_PORTFOLIO_COPY.description}</p>
        </Reveal>

        {!lead ? (
          <Reveal className="cm-projects__empty">
            <h3 className="cm-h3">{FEATURED_PORTFOLIO_COPY.emptyHeading}</h3>
            <p className="dc-body">{FEATURED_PORTFOLIO_COPY.emptyBody}</p>
            <p className="dc-body">
              Project covers could not be loaded for this preview. Explore the
              portfolio when published work is available.
            </p>
            <Link href="/portfolio" className="dc-btn dc-btn--primary">
              {CM_CTA.projects}
            </Link>
          </Reveal>
        ) : (
          <>
            <Reveal className="cm-projects__lead">
              <article className="cm-project cm-project--lead">
                <Link
                  href={`/portfolio/${lead.slug}`}
                  className="cm-project__media"
                >
                  <Image
                    src={lead.cover.url}
                    alt={lead.cover.altText}
                    width={lead.cover.width}
                    height={lead.cover.height}
                    loading="lazy"
                    unoptimized={isLocalStorageUrl(lead.cover.url)}
                    sizes="(max-width: 1023px) 100vw, 1200px"
                  />
                </Link>
                <div className="cm-project__copy">
                  <p className="dc-eyebrow">Selected project</p>
                  <h3 className="cm-project__title">{lead.title}</h3>
                  {projectMeta(lead) ? (
                    <p className="cm-project__meta">{projectMeta(lead)}</p>
                  ) : null}
                  <Link
                    href={`/portfolio/${lead.slug}`}
                    className="dc-textlink"
                  >
                    View Project
                  </Link>
                </div>
              </article>
            </Reveal>

            {supporting.length > 0 ? (
              <ul className="cm-projects__grid">
                {supporting.map((card, index) => (
                  <Reveal as="li" key={card.slug} order={index}>
                    <article className="cm-project">
                      <Link
                        href={`/portfolio/${card.slug}`}
                        className="cm-project__media"
                      >
                        <Image
                          src={card.cover.url}
                          alt={card.cover.altText}
                          width={card.cover.width}
                          height={card.cover.height}
                          loading="lazy"
                          unoptimized={isLocalStorageUrl(card.cover.url)}
                          sizes="(max-width: 767px) 100vw, 50vw"
                        />
                      </Link>
                      <div className="cm-project__copy">
                        <h3 className="cm-project__title">{card.title}</h3>
                        {projectMeta(card) ? (
                          <p className="cm-project__meta">{projectMeta(card)}</p>
                        ) : null}
                        <Link
                          href={`/portfolio/${card.slug}`}
                          className="dc-textlink"
                        >
                          View Project
                        </Link>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </ul>
            ) : null}

            <Reveal className="cm-projects__explore">
              <Link href="/portfolio" className="dc-btn dc-btn--ghost">
                {CM_CTA.projects}
              </Link>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}
