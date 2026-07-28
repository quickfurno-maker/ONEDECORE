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

interface DesignTechConceptProps {
  readonly featured: readonly PublicPortfolioCard[];
}

function projectMeta(card: PublicPortfolioCard): string | null {
  const place = card.locationLabel ?? card.services[0]?.serviceLabel ?? null;
  const year = card.completionYear ? String(card.completionYear) : null;
  return [place, year].filter(Boolean).join(" · ") || null;
}

export function DesignTechConcept({ featured }: DesignTechConceptProps) {
  const [lead, ...rest] = featured;
  const supporting = rest.slice(0, 3);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="dt-hero" aria-labelledby="dt-hero-title">
        <div className="dt-hero__media">
          <Image
            src={HOMEPAGE_HERO_ASSET.path}
            alt={HOMEPAGE_HERO_ASSET.alt}
            fill
            priority
            quality={82}
            sizes="100vw"
            style={{ objectPosition: HOMEPAGE_HERO_ASSET.focalPoint }}
          />
          <span className="dt-hero__scrim" aria-hidden="true" />
        </div>

        <div className="dc-container dt-hero__inner">
          <Reveal className="dt-hero__panel">
            <p className="dc-eyebrow">ONEDECORE</p>
            <h1 id="dt-hero-title" className="dt-hero__title">
              {HOMEPAGE_COPY.h1}
            </h1>
            <p className="dt-hero__lede">{HOMEPAGE_COPY.supportingLine}</p>

            <div className="dt-hero__actions">
              <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--primary">
                {HOMEPAGE_COPY.ctaLabel}
              </Link>
            </div>

            <ul className="dt-hero__chips">
              {SERVICE_CARDS.map((service) => (
                <li key={service.id}>{service.title}</li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="dt-hero__foot" order={2}>
            <a className="dt-hero__next" href={`#${SECTION_IDS.proposition}`}>
              <span className="dt-hero__nextRail" aria-hidden="true">
                <span />
              </span>
              Continue
            </a>
            <p className="dc-provenance">{ARTWORK_PROVENANCE_NOTE}</p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- proposition */}
      <section
        id={SECTION_IDS.proposition}
        className="dc-section dt-prop"
        aria-labelledby="dt-prop-title"
      >
        <div className="dc-container">
          <Reveal className="dt-prop__block">
            <h2 id="dt-prop-title" className="dc-h2">
              {BRAND_PROPOSITION_COPY.heading}
            </h2>
            <p className="dt-prop__body">{BRAND_PROPOSITION_COPY.body}</p>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- services */}
      <section
        id={SECTION_IDS.services}
        className="dc-section dt-services"
        aria-labelledby="dt-services-title"
      >
        <div className="dc-container">
          <Reveal className="dt-head">
            <p className="dc-eyebrow">{SERVICES_SECTION_COPY.overline}</p>
            <h2 id="dt-services-title" className="dc-h2">
              {SERVICES_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{SERVICES_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="dt-services__grid">
            {SERVICE_CARDS.map((service, index) => (
              <Reveal as="li" key={service.id} order={index} className="dt-module">
                <div className="dt-module__media">
                  <Image
                    src={service.asset.path}
                    alt={service.asset.alt}
                    width={service.asset.width}
                    height={service.asset.height}
                    loading="lazy"
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    style={{ objectPosition: service.asset.focalPoint }}
                  />
                  <span className="dt-module__sheen" aria-hidden="true" />
                </div>
                <div className="dt-module__body">
                  <span className="dc-ordinal">{service.ordinal}</span>
                  <h3 className="dc-h3">{service.title}</h3>
                  <p className="dc-body">{service.description}</p>
                </div>
                <span className="dt-module__edge" aria-hidden="true" />
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- portfolio */}
      <section
        id={SECTION_IDS.work}
        className="dc-section dt-work"
        aria-labelledby="dt-work-title"
      >
        <div className="dc-container">
          <Reveal className="dt-head dt-head--split">
            <div>
              <p className="dc-eyebrow">{FEATURED_PORTFOLIO_COPY.overline}</p>
              <h2 id="dt-work-title" className="dc-h2">
                {FEATURED_PORTFOLIO_COPY.heading}
              </h2>
            </div>
            <p className="dc-lede">{FEATURED_PORTFOLIO_COPY.description}</p>
          </Reveal>

          {lead ? (
            <div className="dt-work__layout">
              <Reveal className="dt-work__lead">
                <Link href={`/portfolio/${lead.slug}`} className="dt-work__leadLink">
                  <span className="dt-work__leadMedia">
                    <Image
                      src={lead.cover.url}
                      alt={lead.cover.altText}
                      width={lead.cover.width}
                      height={lead.cover.height}
                      loading="lazy"
                      sizes="(max-width: 1023px) 100vw, 58vw"
                    />
                    <span className="dt-work__leadScrim" aria-hidden="true" />
                  </span>
                  <span className="dt-work__leadCopy">
                    <span className="dt-work__badge">Featured project</span>
                    <span className="dt-work__leadTitle">{lead.title}</span>
                    <span className="dt-work__reveal">
                      {projectMeta(lead) ? (
                        <span className="dt-work__meta">{projectMeta(lead)}</span>
                      ) : null}
                      <span className="dt-work__cue" aria-hidden="true">
                        View project
                      </span>
                    </span>
                  </span>
                </Link>
              </Reveal>

              {supporting.length > 0 ? (
                <ul className="dt-work__list">
                  {supporting.map((card, index) => (
                    <Reveal as="li" key={card.slug} order={index + 1}>
                      <Link href={`/portfolio/${card.slug}`} className="dt-work__row">
                        <span className="dt-work__rowMedia">
                          <Image
                            src={card.cover.url}
                            alt={card.cover.altText}
                            width={card.cover.width}
                            height={card.cover.height}
                            loading="lazy"
                            sizes="(max-width: 1023px) 40vw, 200px"
                          />
                        </span>
                        <span className="dt-work__rowCopy">
                          <span className="dt-work__rowTitle">{card.title}</span>
                          {projectMeta(card) ? (
                            <span className="dt-work__meta">{projectMeta(card)}</span>
                          ) : null}
                        </span>
                        <span className="dt-work__rowArrow" aria-hidden="true" />
                      </Link>
                    </Reveal>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Reveal className="dt-work__empty">
              <h3 className="dc-h3">{FEATURED_PORTFOLIO_COPY.emptyHeading}</h3>
              <p className="dc-body">{FEATURED_PORTFOLIO_COPY.emptyBody}</p>
            </Reveal>
          )}

          <Reveal className="dt-work__cta" order={1}>
            <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--ghost">
              {FEATURED_PORTFOLIO_COPY.exploreLabel}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- process */}
      <section
        id={SECTION_IDS.process}
        className="dc-section dt-process"
        aria-labelledby="dt-process-title"
      >
        <div className="dc-container">
          <Reveal className="dt-head">
            <p className="dc-eyebrow">{PROCESS_SECTION_COPY.overline}</p>
            <h2 id="dt-process-title" className="dc-h2">
              {PROCESS_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{PROCESS_SECTION_COPY.introduction}</p>
          </Reveal>

          <ol className="dt-process__track">
            {PROCESS_STEPS.map((step, index) => (
              <Reveal as="li" key={step.id} order={index} className="dt-node">
                <span className="dt-node__link" aria-hidden="true" />
                <span className="dt-node__dot" aria-hidden="true" />
                <span className="dc-ordinal">{step.ordinal}</span>
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
        className="dc-section dt-materials"
        aria-labelledby="dt-materials-title"
      >
        <div className="dc-container">
          <Reveal className="dt-head">
            <p className="dc-eyebrow">{MATERIAL_STORY_SECTION_COPY.overline}</p>
            <h2 id="dt-materials-title" className="dc-h2">
              {MATERIAL_STORY_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{MATERIAL_STORY_SECTION_COPY.introduction}</p>
          </Reveal>

          <div className="dt-materials__stage">
            <Reveal as="figure" className="dt-material dt-material--primary">
              <span className="dt-material__frame">
                <Image
                  src={MATERIAL_PRIMARY.asset.path}
                  alt={MATERIAL_PRIMARY.asset.alt}
                  width={MATERIAL_PRIMARY.asset.width}
                  height={MATERIAL_PRIMARY.asset.height}
                  loading="lazy"
                  sizes="(max-width: 899px) 100vw, 60vw"
                  style={{ objectPosition: MATERIAL_PRIMARY.asset.focalPoint }}
                />
              </span>
              <figcaption>
                <span className="dc-ordinal">{MATERIAL_PRIMARY.ordinal}</span>
                <span className="dt-material__caption">{MATERIAL_PRIMARY.caption}</span>
              </figcaption>
            </Reveal>

            <div className="dt-materials__column">
              {MATERIAL_SUPPORTING.map((item, index) => (
                <Reveal
                  as="figure"
                  key={item.id}
                  order={index + 1}
                  className="dt-material"
                >
                  <span className="dt-material__frame">
                    <Image
                      src={item.asset.path}
                      alt={item.asset.alt}
                      width={item.asset.width}
                      height={item.asset.height}
                      loading="lazy"
                      sizes="(max-width: 899px) 100vw, 34vw"
                      style={{ objectPosition: item.asset.focalPoint }}
                    />
                  </span>
                  <figcaption>
                    <span className="dc-ordinal">{item.ordinal}</span>
                    <span className="dt-material__caption">{item.caption}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>

          <p className="dc-provenance dt-materials__note">{ARTWORK_PROVENANCE_NOTE}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section
        id={SECTION_IDS.trust}
        className="dc-section dt-trust"
        aria-labelledby="dt-trust-title"
      >
        <div className="dc-container">
          <Reveal className="dt-head">
            <p className="dc-eyebrow">{TRUST_SECTION_COPY.overline}</p>
            <h2 id="dt-trust-title" className="dc-h2">
              {TRUST_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{TRUST_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="dt-trust__grid">
            {TRUST_PILLARS.map((pillar, index) => (
              <Reveal as="li" key={pillar.id} order={index} className="dt-trust__module">
                <span className="dt-trust__glyph" aria-hidden="true">
                  {pillar.ordinal}
                </span>
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
