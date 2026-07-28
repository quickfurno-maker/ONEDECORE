import Image from "next/image";
import Link from "next/link";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PM_PROJECTS_COPY, PM_SECTION_IDS } from "./content";
import { Reveal } from "../shared/Reveal";

interface PmProjectsProps {
  readonly featured: readonly PublicPortfolioCard[];
}

function metaOf(card: PublicPortfolioCard): string | null {
  const parts = [
    card.locationLabel,
    card.propertyType,
    card.completionYear ? String(card.completionYear) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Next.js declines to optimise private-IP sources; keep local review covers visible. */
function isLocalStorageUrl(url: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(url);
}

export function PmProjects({ featured }: PmProjectsProps) {
  const withCovers = featured.filter((card) => Boolean(card.cover?.url));
  const [lead, ...rest] = withCovers;
  const supporting = rest.slice(0, 4);

  return (
    <section
      id={PM_SECTION_IDS.projects}
      className="pm-section pm-projects"
      aria-labelledby="pm-projects-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head pm-head--split">
          <div>
            <p className="pm-eyebrow">{PM_PROJECTS_COPY.eyebrow}</p>
            <h2 id="pm-projects-title" className="pm-h2">
              {PM_PROJECTS_COPY.heading}
            </h2>
          </div>
          <div className="pm-head__aside">
            <p className="pm-lede">{PM_PROJECTS_COPY.lede}</p>
            <Link href={PM_PROJECTS_COPY.allHref} className="pm-textlink">
              {PM_PROJECTS_COPY.allLabel}
            </Link>
          </div>
        </Reveal>

        {!lead ? (
          <Reveal className="pm-card pm-projects__empty" order={1}>
            <span className="pm-card__glow" aria-hidden="true" />
            <h3 className="pm-h3">{PM_PROJECTS_COPY.emptyHeading}</h3>
            <p className="pm-body">{PM_PROJECTS_COPY.emptyBody}</p>
            <Link
              href={PM_PROJECTS_COPY.allHref}
              className="dc-btn dc-btn--primary pm-btn--sheen"
            >
              {PM_PROJECTS_COPY.allLabel}
            </Link>
          </Reveal>
        ) : (
          <>
            <Reveal className="pm-projects__lead" order={1}>
              <Link href={`/portfolio/${lead.slug}`} className="pm-project pm-project--lead">
                <figure className="pm-project__media">
                  <Image
                    src={lead.cover.url}
                    alt={lead.cover.altText}
                    width={lead.cover.width}
                    height={lead.cover.height}
                    loading="lazy"
                    unoptimized={isLocalStorageUrl(lead.cover.url)}
                    sizes="(max-width: 1023px) 100vw, 1200px"
                  />
                  <span className="pm-project__veil" aria-hidden="true" />
                </figure>
                <div className="pm-project__body">
                  <h3 className="pm-project__title">{lead.title}</h3>
                  {metaOf(lead) ? (
                    <p className="pm-project__meta">{metaOf(lead)}</p>
                  ) : null}
                  <p className="pm-project__summary">{lead.summary}</p>
                  <span className="pm-textlink" aria-hidden="true">
                    View project
                  </span>
                </div>
              </Link>
            </Reveal>

            {supporting.length > 0 ? (
              <ul className="pm-projects__grid">
                {supporting.map((card, index) => (
                  <Reveal as="li" key={card.slug} order={index + 1}>
                    <Link href={`/portfolio/${card.slug}`} className="pm-project">
                      <figure className="pm-project__media">
                        <Image
                          src={card.cover.url}
                          alt={card.cover.altText}
                          width={card.cover.width}
                          height={card.cover.height}
                          loading="lazy"
                          unoptimized={isLocalStorageUrl(card.cover.url)}
                          sizes="(max-width: 767px) 100vw, 45vw"
                        />
                        <span className="pm-project__veil" aria-hidden="true" />
                      </figure>
                      <div className="pm-project__body">
                        <h3 className="pm-project__title">{card.title}</h3>
                        {metaOf(card) ? (
                          <p className="pm-project__meta">{metaOf(card)}</p>
                        ) : null}
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
