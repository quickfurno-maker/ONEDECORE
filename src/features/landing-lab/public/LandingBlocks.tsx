import type {
  FaqBlock,
  FooterBlock,
  HeroBlock,
  LeadFormPlaceholderBlock,
  OfferCtaBlock,
  PortfolioPreviewBlock,
  ProcessBlock,
  ServiceHighlightsBlock,
  TestimonialsBlock,
  TrustProofBlock,
} from "../contracts/blocks.ts";
import { LandingCta } from "./LandingCta.tsx";
import type { LandingProjectCard } from "./resolve-landing-projects.ts";

/**
 * The presentation of every landing block, shared by the live page and the
 * admin preview.
 *
 * ONE SET OF COMPONENTS, TWO MOUNT POINTS.
 *
 * Before this, `LandingPublicRenderer` and `LandingPagePreview` were two
 * hand-maintained descriptions of the same ten blocks, and they had already
 * drifted — the preview prefixed project slugs with "Projects: ", rendered
 * process steps on one line, and used `<h3>` where the page used `<h2>`. An
 * author approving a layout in the preview was approving something that did
 * not exist. These components are the only description now; the preview is the
 * same code at a narrower width.
 *
 * No `"use client"` here on purpose: these are shared components. They become
 * client components when the preview imports them and stay server-rendered on
 * the live page, which keeps the public HTML free of unnecessary JavaScript.
 * The only interactive piece is `LandingCta`, which is a client component in
 * its own right.
 */

/* ----------------------------------------------------------------- hero */

export function HeroSection({
  block,
  priority,
}: {
  readonly block: HeroBlock;
  readonly priority?: boolean;
}) {
  return (
    <header className="lp-hero" data-lp-block="hero">
      {block.imageUrl ? (
        <div className="lp-hero__media">
          {/*
            A plain <img>, not next/image.
            The URL is author-supplied and may point at any host the contract's
            safe-URL rule allows. next/image would need every one of those hosts
            in remotePatterns, and a campaign page that renders a broken image
            because a domain was not pre-registered is worse than one that skips
            the optimiser. Sizing is fixed by CSS, so there is no layout shift.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.imageUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
          />
        </div>
      ) : null}
      <div className="lp-hero__scrim" aria-hidden="true" />
      <div className="lp-hero__inner">
        <p className="lp-hero__brand">ONEDECORE</p>
        <h1 className="lp-hero__title">{block.headline}</h1>
        {block.subheadline ? (
          <p className="lp-hero__sub">{block.subheadline}</p>
        ) : null}
        <div className="lp-hero__actions">
          <LandingCta
            label={block.primaryCtaLabel}
            url={block.primaryCtaUrl}
            source="hero"
          />
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- trust proof */

export function TrustProofSection({ block }: { readonly block: TrustProofBlock }) {
  return (
    <section className="lp-section" data-lp-block="trust_proof">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        <div className="lp-trust__grid">
          {block.items.map((item, index) => (
            <div className="lp-trust__item" key={`${block.blockId}-${index}`}>
              <span className="lp-trust__label">{item.label}</span>
              <span className="lp-trust__value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- services */

export function ServiceHighlightsSection({
  block,
}: {
  readonly block: ServiceHighlightsBlock;
}) {
  return (
    <section className="lp-section lp-section--tint" data-lp-block="service_highlights">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        <ul className="lp-services__grid">
          {block.items.map((item, index) => (
            <li className="lp-card" key={`${block.blockId}-${index}`}>
              {item.iconLabel ? (
                <span className="lp-card__icon">{item.iconLabel}</span>
              ) : null}
              <h3 className="lp-card__title">{item.title}</h3>
              <p className="lp-card__body">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- process */

export function ProcessSection({ block }: { readonly block: ProcessBlock }) {
  return (
    <section className="lp-section" data-lp-block="process">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        {/*
          An <ol> with a CSS counter rather than a printed "Step 1".
          The number is presentation; the ordered list is the semantics. A
          screen reader announces the list position without the visual label
          being read out twice.
        */}
        <ol className="lp-process__list">
          {block.steps.map((step, index) => (
            <li className="lp-process__item" key={`${block.blockId}-${index}`}>
              <span className="lp-process__num" aria-hidden="true" />
              <div>
                <h3 className="lp-process__title">{step.title}</h3>
                <p className="lp-process__body">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ portfolio */

export function PortfolioPreviewSection({
  block,
  projects,
}: {
  readonly block: PortfolioPreviewBlock;
  readonly projects: readonly LandingProjectCard[];
}) {
  /*
   * A slug that no longer resolves is simply absent.
   *
   * Projects get unpublished. When that happens the page must not print the
   * raw slug — an internal identifier is not customer-facing copy — and must
   * not collapse either. Unresolved slugs are dropped upstream, and if every
   * one of them is gone the section removes itself rather than rendering a
   * heading over an empty grid.
   */
  if (projects.length === 0) return null;

  return (
    <section className="lp-section lp-section--tint" data-lp-block="portfolio_preview">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        <ul className="lp-projects__grid">
          {projects.map((project) => (
            <li className="lp-project" key={project.slug}>
              <a className="lp-project__link" href={project.href}>
                <div className="lp-project__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.imageUrl}
                    alt={project.imageAlt}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: project.objectPosition }}
                  />
                </div>
                <div className="lp-project__body">
                  <h3 className="lp-project__title">{project.title}</h3>
                  {project.meta ? (
                    <p className="lp-project__meta">{project.meta}</p>
                  ) : null}
                </div>
              </a>
            </li>
          ))}
        </ul>
        {block.ctaLabel ? (
          <div className="lp-projects__cta">
            <LandingCta
              label={block.ctaLabel}
              url={block.ctaUrl}
              variant="secondary"
              source="portfolio"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- testimonials */

export function TestimonialsSection({
  block,
}: {
  readonly block: TestimonialsBlock;
}) {
  return (
    <section className="lp-section" data-lp-block="testimonials">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        {/*
          No stars, no scores, no aggregate rating.
          `legal/claim-evidence.ts` records that `average-rating` and
          `client-reviews` have no public evidence, so a star row here would be
          a fabricated claim rendered by the system itself rather than typed by
          an author. Quotes are authored content and are shown as written.
        */}
        <ul className="lp-quotes__grid">
          {block.items.map((item, index) => (
            <li className="lp-quote" key={`${block.blockId}-${index}`}>
              <span className="lp-quote__mark" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="lp-quote__text">{item.quote}</blockquote>
              <p className="lp-quote__by">
                <span className="lp-quote__name">{item.author}</span>
                {item.role ? ` · ${item.role}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */

export function FaqSection({ block }: { readonly block: FaqBlock }) {
  return (
    <section className="lp-section" data-lp-block="faq">
      <div className="lp-section__inner">
        <h2 className="lp-h2">{block.title}</h2>
        {/*
          Native <details>/<summary>.
          Keyboard operation, focus handling and the expanded/collapsed state
          announced to assistive technology all come from the platform. A
          hand-rolled accordion would need aria-expanded, aria-controls, key
          handlers and a roving tabindex to reach the same place, and would
          leave the answers invisible to in-page search when collapsed.
        */}
        <div className="lp-faq__list">
          {block.items.map((item, index) => (
            <details className="lp-faq__item" key={`${block.blockId}-${index}`}>
              <summary className="lp-faq__q">
                {item.question}
                <span className="lp-faq__sign" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="lp-faq__a">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- offer */

export function OfferCtaSection({ block }: { readonly block: OfferCtaBlock }) {
  return (
    <section className="lp-section" data-lp-block="offer_cta">
      <div className="lp-offer__inner">
        <h2 className="lp-offer__title">{block.headline}</h2>
        <p className="lp-offer__body">{block.body}</p>
        <div className="lp-offer__actions">
          <LandingCta label={block.ctaLabel} url={block.ctaUrl} source="offer" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- enquiry */

export function LeadFormSection({
  block,
}: {
  readonly block: LeadFormPlaceholderBlock;
}) {
  return (
    <section
      className="lp-section lp-section--tint"
      id="enquiry"
      data-lp-block="lead_form_placeholder"
      data-od-landing-lead-block=""
    >
      <div className="lp-enquiry__inner">
        <h2 className="lp-enquiry__title">{block.headline}</h2>
        {block.helperText ? (
          <p className="lp-enquiry__body">{block.helperText}</p>
        ) : null}
        <div className="lp-enquiry__actions">
          {/*
            No url: this always opens the canonical consultation form.
            The submit label is the author's, the form behind it is not theirs
            to change.
          */}
          <LandingCta label={block.submitLabel} url={null} source="enquiry" />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- footer */

export function FooterSection({ block }: { readonly block: FooterBlock }) {
  /*
   * Real tel: and mailto: links.
   *
   * On the phone this page is mostly viewed on, a printed phone number is a
   * number you have to memorise and retype. The contract stores these as free
   * text, so the href is built from a stripped copy while the visible label
   * stays exactly as the author wrote it.
   */
  const telHref = block.contactPhone
    ? `tel:${block.contactPhone.replace(/[^\d+]/g, "")}`
    : null;

  return (
    <footer className="lp-footer" data-lp-block="footer">
      <div className="lp-footer__inner">
        <p className="lp-footer__legal">{block.legalLine}</p>
        {block.contactEmail || block.contactPhone ? (
          <ul className="lp-footer__contact">
            {block.contactPhone && telHref ? (
              <li>
                <a href={telHref}>{block.contactPhone}</a>
              </li>
            ) : null}
            {block.contactEmail ? (
              <li>
                <a href={`mailto:${block.contactEmail}`}>{block.contactEmail}</a>
              </li>
            ) : null}
            <li>
              <a href="/privacy">Privacy</a>
            </li>
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
