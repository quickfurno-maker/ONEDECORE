import Image from "next/image";
import Link from "next/link";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import {
  ARTWORK_PROVENANCE_NOTE,
  BRAND_PROPOSITION_COPY,
  FEATURED_PORTFOLIO_COPY,
  HOMEPAGE_COPY,
  HOMEPAGE_HERO_ASSET,
  MATERIAL_PRIMARY,
  MATERIAL_STORY_SECTION_COPY,
  MATERIAL_SUPPORTING,
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
  SECTION_IDS,
  SERVICES_SECTION_COPY,
  SERVICE_CARDS,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
} from "../../content/shared-content";
import { Reveal } from "../../shared/Reveal";

interface CinematicConceptProps {
  readonly featured: readonly PublicPortfolioCard[];
}

function projectMeta(card: PublicPortfolioCard): string | null {
  const place = card.locationLabel ?? card.services[0]?.serviceLabel ?? null;
  const year = card.completionYear ? String(card.completionYear) : null;
  return [place, year].filter(Boolean).join(" · ") || null;
}

export function CinematicConcept({ featured }: CinematicConceptProps) {
  const [lead, ...rest] = featured;
  const supporting = rest.slice(0, 4);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="cin-hero" aria-labelledby="cin-hero-title">
        <div className="cin-hero__media">
          <Image
            src={HOMEPAGE_HERO_ASSET.path}
            alt={HOMEPAGE_HERO_ASSET.alt}
            fill
            priority
            sizes="100vw"
            quality={82}
            style={{ objectPosition: HOMEPAGE_HERO_ASSET.focalPoint }}
          />
        </div>
        <div className="cin-hero__scrim" aria-hidden="true" />
        <div className="cin-hero__grid" aria-hidden="true" />

        <div className="dc-container cin-hero__inner">
          <Reveal className="cin-hero__panel">
            <p className="dc-eyebrow">ONEDECORE</p>
            <h1 id="cin-hero-title" className="cin-hero__title">
              {HOMEPAGE_COPY.h1}
            </h1>
            <p className="cin-hero__lede">{HOMEPAGE_COPY.supportingLine}</p>
            <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--primary">
              {HOMEPAGE_COPY.ctaLabel}
            </Link>
          </Reveal>

          <Reveal className="cin-hero__rail" order={2}>
            <ul className="cin-hero__services">
              {SERVICE_CARDS.map((service) => (
                <li key={service.id}>
                  <span className="dc-ordinal">{service.ordinal}</span>
                  <span>{service.title}</span>
                </li>
              ))}
            </ul>
            <p className="dc-provenance">{ARTWORK_PROVENANCE_NOTE}</p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- proposition */}
      <section
        id={SECTION_IDS.proposition}
        className="dc-section cin-prop"
        aria-labelledby="cin-prop-title"
      >
        <div className="dc-container cin-prop__inner">
          <Reveal className="cin-prop__mark">
            <span className="cin-prop__rule" aria-hidden="true" />
          </Reveal>
          <Reveal order={1}>
            <h2 id="cin-prop-title" className="dc-h2">
              {BRAND_PROPOSITION_COPY.heading}
            </h2>
            <p className="cin-prop__body">{BRAND_PROPOSITION_COPY.body}</p>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- services */}
      <section
        id={SECTION_IDS.services}
        className="dc-section cin-services"
        aria-labelledby="cin-services-title"
      >
        <div className="dc-container">
          <Reveal className="cin-head">
            <p className="dc-eyebrow">{SERVICES_SECTION_COPY.overline}</p>
            <h2 id="cin-services-title" className="dc-h2">
              {SERVICES_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{SERVICES_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="cin-services__grid">
            {SERVICE_CARDS.map((service, index) => (
              <Reveal as="li" key={service.id} order={index} className="cin-card">
                <div className="cin-card__media">
                  <Image
                    src={service.asset.path}
                    alt={service.asset.alt}
                    width={service.asset.width}
                    height={service.asset.height}
                    loading="lazy"
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    style={{ objectPosition: service.asset.focalPoint }}
                  />
                  <span className="cin-card__veil" aria-hidden="true" />
                  <span className="cin-card__ordinal">{service.ordinal}</span>
                </div>
                <div className="cin-card__body">
                  <h3 className="dc-h3">{service.title}</h3>
                  <p className="dc-body">{service.description}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- portfolio */}
      <section
        id={SECTION_IDS.work}
        className="dc-section cin-work"
        aria-labelledby="cin-work-title"
      >
        <div className="dc-container">
          <Reveal className="cin-head cin-head--split">
            <div>
              <p className="dc-eyebrow">{FEATURED_PORTFOLIO_COPY.overline}</p>
              <h2 id="cin-work-title" className="dc-h2">
                {FEATURED_PORTFOLIO_COPY.heading}
              </h2>
            </div>
            <p className="dc-lede">{FEATURED_PORTFOLIO_COPY.description}</p>
          </Reveal>

          {lead ? (
            <>
              <Reveal className="cin-work__lead">
                <Link href={`/portfolio/${lead.slug}`} className="cin-work__leadLink">
                  <span className="cin-work__leadMedia">
                    <Image
                      src={lead.cover.url}
                      alt={lead.cover.altText}
                      width={lead.cover.width}
                      height={lead.cover.height}
                      loading="lazy"
                      sizes="(max-width: 1023px) 100vw, 1200px"
                    />
                    <span className="cin-work__leadScrim" aria-hidden="true" />
                  </span>
                  <span className="cin-work__leadCopy">
                    <span className="dc-eyebrow">Featured project</span>
                    <span className="cin-work__leadTitle">{lead.title}</span>
                    {projectMeta(lead) ? (
                      <span className="cin-work__meta">{projectMeta(lead)}</span>
                    ) : null}
                  </span>
                </Link>
              </Reveal>

              {supporting.length > 0 ? (
                <ul className="cin-work__grid">
                  {supporting.map((card, index) => (
                    <Reveal as="li" key={card.slug} order={index}>
                      <Link href={`/portfolio/${card.slug}`} className="cin-work__card">
                        <span className="cin-work__cardMedia">
                          <Image
                            src={card.cover.url}
                            alt={card.cover.altText}
                            width={card.cover.width}
                            height={card.cover.height}
                            loading="lazy"
                            sizes="(max-width: 767px) 100vw, 50vw"
                          />
                          <span className="cin-work__cardScrim" aria-hidden="true" />
                        </span>
                        <span className="cin-work__cardCopy">
                          <span className="cin-work__cardTitle">{card.title}</span>
                          {projectMeta(card) ? (
                            <span className="cin-work__meta">{projectMeta(card)}</span>
                          ) : null}
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <Reveal className="cin-work__empty">
              <h3 className="dc-h3">{FEATURED_PORTFOLIO_COPY.emptyHeading}</h3>
              <p className="dc-body">{FEATURED_PORTFOLIO_COPY.emptyBody}</p>
            </Reveal>
          )}

          <Reveal className="cin-work__cta" order={1}>
            <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--ghost">
              {FEATURED_PORTFOLIO_COPY.exploreLabel}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- process */}
      <section
        id={SECTION_IDS.process}
        className="dc-section cin-process"
        aria-labelledby="cin-process-title"
      >
        <div className="dc-container">
          <Reveal className="cin-head">
            <p className="dc-eyebrow">{PROCESS_SECTION_COPY.overline}</p>
            <h2 id="cin-process-title" className="dc-h2">
              {PROCESS_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{PROCESS_SECTION_COPY.introduction}</p>
          </Reveal>

          <ol className="cin-process__list">
            {PROCESS_STEPS.map((step, index) => (
              <Reveal as="li" key={step.id} order={index} className="cin-step">
                <span className="cin-step__ordinal" aria-hidden="true">
                  {step.ordinal}
                </span>
                <h3 className="dc-h3">{step.title}</h3>
                <p className="dc-body">{step.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- materials */}
      <section
        id={SECTION_IDS.materials}
        className="dc-section cin-materials"
        aria-labelledby="cin-materials-title"
      >
        <div className="dc-container">
          <Reveal className="cin-head">
            <p className="dc-eyebrow">{MATERIAL_STORY_SECTION_COPY.overline}</p>
            <h2 id="cin-materials-title" className="dc-h2">
              {MATERIAL_STORY_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{MATERIAL_STORY_SECTION_COPY.introduction}</p>
          </Reveal>

          <div className="cin-materials__stage">
            <Reveal as="figure" className="cin-materials__primary">
              <Image
                src={MATERIAL_PRIMARY.asset.path}
                alt={MATERIAL_PRIMARY.asset.alt}
                width={MATERIAL_PRIMARY.asset.width}
                height={MATERIAL_PRIMARY.asset.height}
                loading="lazy"
                sizes="(max-width: 767px) 100vw, 62vw"
                style={{ objectPosition: MATERIAL_PRIMARY.asset.focalPoint }}
              />
              <figcaption>
                <span className="dc-ordinal">{MATERIAL_PRIMARY.ordinal}</span>
                <span>{MATERIAL_PRIMARY.caption}</span>
              </figcaption>
            </Reveal>

            <div className="cin-materials__column">
              {MATERIAL_SUPPORTING.map((item, index) => (
                <Reveal
                  as="figure"
                  key={item.id}
                  order={index + 1}
                  className="cin-materials__supporting"
                >
                  <Image
                    src={item.asset.path}
                    alt={item.asset.alt}
                    width={item.asset.width}
                    height={item.asset.height}
                    loading="lazy"
                    sizes="(max-width: 767px) 100vw, 34vw"
                    style={{ objectPosition: item.asset.focalPoint }}
                  />
                  <figcaption>
                    <span className="dc-ordinal">{item.ordinal}</span>
                    <span>{item.caption}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>

          <p className="dc-provenance cin-materials__note">{ARTWORK_PROVENANCE_NOTE}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section
        id={SECTION_IDS.trust}
        className="dc-section cin-trust"
        aria-labelledby="cin-trust-title"
      >
        <div className="dc-container">
          <Reveal className="cin-head">
            <p className="dc-eyebrow">{TRUST_SECTION_COPY.overline}</p>
            <h2 id="cin-trust-title" className="dc-h2">
              {TRUST_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{TRUST_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="cin-trust__grid">
            {TRUST_PILLARS.map((pillar, index) => (
              <Reveal as="li" key={pillar.id} order={index} className="cin-trust__card">
                <span className="dc-ordinal">{pillar.ordinal}</span>
                <h3 className="dc-h3">{pillar.title}</h3>
                <p className="dc-body">{pillar.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
