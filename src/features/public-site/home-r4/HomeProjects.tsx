"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { PM_PROJECTS_COPY, PM_SECTION_IDS } from "./content";
import { usePlan } from "./PlanContext";
import { selectHomepageProjectProof } from "./project-proof";

interface HomeProjectsProps {
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

/** Single coherent pending-proof composition — heading/body/actions once. */
function ProjectsPending() {
  const { openPlanner, getNextIncompleteStep } = usePlan();

  return (
    <Reveal className="pm-projects__pending" order={1}>
      <div className="pm-projects__pending-copy">
        <p className="pm-eyebrow">{PM_PROJECTS_COPY.eyebrow}</p>
        <h2 id="pm-projects-title" className="pm-h2">
          {PM_PROJECTS_COPY.heading}
        </h2>
        <p className="pm-lede">{PM_PROJECTS_COPY.lede}</p>
        <div className="pm-projects__pending-actions">
          <Link
            href={PM_PROJECTS_COPY.allHref}
            className="dc-btn dc-btn--primary pm-btn--sheen"
            data-conversion-action="portfolio-view"
          >
            {PM_PROJECTS_COPY.allLabel}
          </Link>
          <button
            type="button"
            className="dc-btn dc-btn--ghost"
            data-conversion-action="readiness-continue"
            onClick={() => openPlanner(getNextIncompleteStep())}
          >
            {PM_PROJECTS_COPY.planLabel}
          </button>
        </div>
      </div>
      <div className="pm-projects__pending-visual" aria-hidden="true">
        <svg
          className="pm-projects__linework"
          viewBox="0 0 640 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="24"
            y="28"
            width="592"
            height="224"
            rx="4"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path d="M24 188H616" stroke="currentColor" strokeWidth="1" />
          <path d="M216 28V252" stroke="currentColor" strokeWidth="1" />
          <path d="M424 28V252" stroke="currentColor" strokeWidth="1" />
          <path d="M24 108H216" stroke="currentColor" strokeWidth="1" />
          <path d="M424 148H616" stroke="currentColor" strokeWidth="1" />
          <circle cx="320" cy="118" r="34" stroke="currentColor" strokeWidth="1" />
          <path d="M286 118H354" stroke="currentColor" strokeWidth="1" />
          <path d="M320 84V152" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </Reveal>
  );
}

export function HomeProjects({ featured }: HomeProjectsProps) {
  const proof = selectHomepageProjectProof(featured);
  const [lead, ...rest] = proof;
  const supporting = rest.slice(0, 4);

  return (
    <section
      id={PM_SECTION_IDS.projects}
      className="pm-section pm-projects"
      aria-labelledby="pm-projects-title"
    >
      <div className="dc-container">
        {!lead ? (
          <ProjectsPending />
        ) : (
          <>
            <Reveal className="pm-head pm-head--split">
              <div>
                <p className="pm-eyebrow">{PM_PROJECTS_COPY.eyebrow}</p>
                <h2 id="pm-projects-title" className="pm-h2">
                  Selected work
                </h2>
              </div>
              <div className="pm-head__aside">
                <Link href={PM_PROJECTS_COPY.allHref} className="pm-textlink">
                  {PM_PROJECTS_COPY.allLabel}
                </Link>
              </div>
            </Reveal>

            <Reveal className="pm-projects__lead" order={1}>
              <Link
                href={`/portfolio/${lead.slug}`}
                className="pm-project pm-project--lead"
              >
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
                    <Link
                      href={`/portfolio/${card.slug}`}
                      className="pm-project"
                    >
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
