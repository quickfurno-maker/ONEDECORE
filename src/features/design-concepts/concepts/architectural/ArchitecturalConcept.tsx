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

interface ArchitecturalConceptProps {
  readonly featured: readonly PublicPortfolioCard[];
}

function projectMeta(card: PublicPortfolioCard): string | null {
  const place = card.locationLabel ?? card.services[0]?.serviceLabel ?? null;
  const year = card.completionYear ? String(card.completionYear) : null;
  return [place, year].filter(Boolean).join(" · ") || null;
}

export function ArchitecturalConcept({ featured }: ArchitecturalConceptProps) {
  const [leadService, ...pairedServices] = SERVICE_CARDS;
  const [lead, ...rest] = featured;
  const supporting = rest.slice(0, 3);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="arc-hero" aria-labelledby="arc-hero-title">
        <div className="dc-container arc-hero__inner">
          <Reveal className="arc-hero__copy">
            <p className="dc-eyebrow">ONEDECORE</p>
            <h1 id="arc-hero-title" className="arc-hero__title">
              {HOMEPAGE_COPY.h1}
            </h1>
            <p className="arc-hero__lede">{HOMEPAGE_COPY.supportingLine}</p>
            <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--primary">
              {HOMEPAGE_COPY.ctaLabel}
            </Link>

            <dl className="arc-hero__index">
              {SERVICE_CARDS.map((service) => (
                <div key={service.id} className="arc-hero__indexRow">
                  <dt>{service.ordinal}</dt>
                  <dd>{service.title}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal className="arc-hero__frame" order={1}>
            <Image
              src={HOMEPAGE_HERO_ASSET.path}
              alt={HOMEPAGE_HERO_ASSET.alt}
              width={HOMEPAGE_HERO_ASSET.width}
              height={HOMEPAGE_HERO_ASSET.height}
              priority
              quality={82}
              sizes="(max-width: 1023px) 100vw, 52vw"
              style={{ objectPosition: HOMEPAGE_HERO_ASSET.focalPoint }}
            />
            <p className="dc-provenance arc-hero__note">{ARTWORK_PROVENANCE_NOTE}</p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- proposition */}
      <section
        id={SECTION_IDS.proposition}
        className="dc-section arc-prop"
        aria-labelledby="arc-prop-title"
      >
        <div className="dc-container arc-prop__inner">
          <Reveal>
            <h2 id="arc-prop-title" className="dc-h2">
              {BRAND_PROPOSITION_COPY.heading}
            </h2>
          </Reveal>
          <Reveal order={1}>
            <p className="arc-prop__body">{BRAND_PROPOSITION_COPY.body}</p>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- services */}
      <section
        id={SECTION_IDS.services}
        className="dc-section arc-services"
        aria-labelledby="arc-services-title"
      >
        <div className="dc-container">
          <Reveal className="arc-head">
            <p className="dc-eyebrow">{SERVICES_SECTION_COPY.overline}</p>
            <h2 id="arc-services-title" className="dc-h2">
              {SERVICES_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{SERVICES_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="arc-services__stack">
            <Reveal as="li" className="arc-service arc-service--lead">
              <div className="arc-service__media">
                <Image
                  src={leadService.asset.path}
                  alt={leadService.asset.alt}
                  width={leadService.asset.width}
                  height={leadService.asset.height}
                  loading="lazy"
                  sizes="(max-width: 1023px) 100vw, 58vw"
                  style={{ objectPosition: leadService.asset.focalPoint }}
                />
              </div>
              <div className="arc-service__copy">
                <span className="dc-ordinal">{leadService.ordinal}</span>
                <h3 className="arc-service__title">{leadService.title}</h3>
                <p className="dc-body">{leadService.description}</p>
              </div>
            </Reveal>

            <li className="arc-services__pair">
              {pairedServices.map((service, index) => (
                <Reveal key={service.id} order={index} className="arc-service">
                  <div className="arc-service__media">
                    <Image
                      src={service.asset.path}
                      alt={service.asset.alt}
                      width={service.asset.width}
                      height={service.asset.height}
                      loading="lazy"
                      sizes="(max-width: 767px) 100vw, 46vw"
                      style={{ objectPosition: service.asset.focalPoint }}
                    />
                  </div>
                  <div className="arc-service__copy">
                    <span className="dc-ordinal">{service.ordinal}</span>
                    <h3 className="arc-service__title">{service.title}</h3>
                    <p className="dc-body">{service.description}</p>
                  </div>
                </Reveal>
              ))}
            </li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- portfolio */}
      <section
        id={SECTION_IDS.work}
        className="dc-section arc-work"
        aria-labelledby="arc-work-title"
      >
        <div className="dc-container">
          <Reveal className="arc-head arc-head--split">
            <div>
              <p className="dc-eyebrow">{FEATURED_PORTFOLIO_COPY.overline}</p>
              <h2 id="arc-work-title" className="dc-h2">
                {FEATURED_PORTFOLIO_COPY.heading}
              </h2>
            </div>
            <p className="dc-lede">{FEATURED_PORTFOLIO_COPY.description}</p>
          </Reveal>

          {lead ? (
            <div className="arc-work__grid">
              <Reveal className="arc-work__lead">
                <Link href={`/portfolio/${lead.slug}`} className="arc-work__link">
                  <span className="arc-work__media">
                    <Image
                      src={lead.cover.url}
                      alt={lead.cover.altText}
                      width={lead.cover.width}
                      height={lead.cover.height}
                      loading="lazy"
                      sizes="(max-width: 1023px) 100vw, 62vw"
                    />
                  </span>
                  <span className="arc-work__row">
                    <span className="arc-work__title">{lead.title}</span>
                    {projectMeta(lead) ? (
                      <span className="arc-work__meta">{projectMeta(lead)}</span>
                    ) : null}
                  </span>
                </Link>
              </Reveal>

              {supporting.length > 0 ? (
                <ul className="arc-work__column">
                  {supporting.map((card, index) => (
                    <Reveal as="li" key={card.slug} order={index + 1}>
                      <Link href={`/portfolio/${card.slug}`} className="arc-work__link">
                        <span className="arc-work__media arc-work__media--small">
                          <Image
                            src={card.cover.url}
                            alt={card.cover.altText}
                            width={card.cover.width}
                            height={card.cover.height}
                            loading="lazy"
                            sizes="(max-width: 1023px) 100vw, 34vw"
                          />
                        </span>
                        <span className="arc-work__row">
                          <span className="arc-work__title arc-work__title--small">
                            {card.title}
                          </span>
                          {projectMeta(card) ? (
                            <span className="arc-work__meta">{projectMeta(card)}</span>
                          ) : null}
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Reveal className="arc-work__empty">
              <h3 className="dc-h3">{FEATURED_PORTFOLIO_COPY.emptyHeading}</h3>
              <p className="dc-body">{FEATURED_PORTFOLIO_COPY.emptyBody}</p>
            </Reveal>
          )}

          <Reveal className="arc-work__cta" order={1}>
            <Link href={HOMEPAGE_COPY.ctaHref} className="dc-btn dc-btn--ghost">
              {FEATURED_PORTFOLIO_COPY.exploreLabel}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- process */}
      <section
        id={SECTION_IDS.process}
        className="dc-section arc-process"
        aria-labelledby="arc-process-title"
      >
        <div className="dc-container">
          <Reveal className="arc-head">
            <p className="dc-eyebrow">{PROCESS_SECTION_COPY.overline}</p>
            <h2 id="arc-process-title" className="dc-h2">
              {PROCESS_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{PROCESS_SECTION_COPY.introduction}</p>
          </Reveal>

          <ol className="arc-process__sequence">
            {PROCESS_STEPS.map((step, index) => (
              <Reveal as="li" key={step.id} order={index} className="arc-step">
                <span className="arc-step__marker" aria-hidden="true" />
                <span className="dc-ordinal">{step.ordinal}</span>
                <h3 className="arc-step__title">{step.title}</h3>
                <p className="dc-body">{step.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- materials */}
      <section
        id={SECTION_IDS.materials}
        className="dc-section arc-materials"
        aria-labelledby="arc-materials-title"
      >
        <div className="dc-container">
          <Reveal className="arc-head">
            <p className="dc-eyebrow">{MATERIAL_STORY_SECTION_COPY.overline}</p>
            <h2 id="arc-materials-title" className="dc-h2">
              {MATERIAL_STORY_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{MATERIAL_STORY_SECTION_COPY.introduction}</p>
          </Reveal>

          <div className="arc-materials__grid">
            <Reveal as="figure" className="arc-material arc-material--primary">
              <div className="arc-material__media">
                <Image
                  src={MATERIAL_PRIMARY.asset.path}
                  alt={MATERIAL_PRIMARY.asset.alt}
                  width={MATERIAL_PRIMARY.asset.width}
                  height={MATERIAL_PRIMARY.asset.height}
                  loading="lazy"
                  sizes="(max-width: 899px) 100vw, 56vw"
                  style={{ objectPosition: MATERIAL_PRIMARY.asset.focalPoint }}
                />
              </div>
              <figcaption>
                <span className="dc-ordinal">{MATERIAL_PRIMARY.ordinal}</span>
                <span className="arc-material__theme">{MATERIAL_PRIMARY.theme}</span>
                <span className="arc-material__caption">{MATERIAL_PRIMARY.caption}</span>
              </figcaption>
            </Reveal>

            {MATERIAL_SUPPORTING.map((item, index) => (
              <Reveal
                as="figure"
                key={item.id}
                order={index + 1}
                className="arc-material"
              >
                <div className="arc-material__media">
                  <Image
                    src={item.asset.path}
                    alt={item.asset.alt}
                    width={item.asset.width}
                    height={item.asset.height}
                    loading="lazy"
                    sizes="(max-width: 899px) 100vw, 38vw"
                    style={{ objectPosition: item.asset.focalPoint }}
                  />
                </div>
                <figcaption>
                  <span className="dc-ordinal">{item.ordinal}</span>
                  <span className="arc-material__theme">{item.theme}</span>
                  <span className="arc-material__caption">{item.caption}</span>
                </figcaption>
              </Reveal>
            ))}
          </div>

          <p className="dc-provenance arc-materials__note">{ARTWORK_PROVENANCE_NOTE}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section
        id={SECTION_IDS.trust}
        className="dc-section arc-trust"
        aria-labelledby="arc-trust-title"
      >
        <div className="dc-container">
          <Reveal className="arc-head">
            <p className="dc-eyebrow">{TRUST_SECTION_COPY.overline}</p>
            <h2 id="arc-trust-title" className="dc-h2">
              {TRUST_SECTION_COPY.heading}
            </h2>
            <p className="dc-lede">{TRUST_SECTION_COPY.introduction}</p>
          </Reveal>

          <ul className="arc-trust__columns">
            {TRUST_PILLARS.map((pillar, index) => (
              <Reveal as="li" key={pillar.id} order={index} className="arc-trust__column">
                <span className="dc-ordinal">{pillar.ordinal}</span>
                <h3 className="arc-trust__title">{pillar.title}</h3>
                <p className="dc-body">{pillar.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
