import Image from "next/image";
import {
  R5_SERVICES,
  R5_SERVICES_COPY,
  REFERENCE_IMAGERY_NOTE,
} from "../content";

/**
 * Interactive Services.
 *
 * A SERVER COMPONENT, BECAUSE NOTHING HERE NEEDS JAVASCRIPT.
 *
 * The interaction is a scroll-snap rail and a CSS hover — both of which the
 * browser does natively and better. Making this a client component to get a
 * 1.03 image scale would ship a bundle for something a stylesheet already does,
 * and would cost the page a chunk of its static render for no behaviour.
 *
 * WHY THE CARDS ARE NOT LINKS
 *
 * There are no per-service routes in this application. A card that looks
 * clickable and goes nowhere is worse than a card that does not, and inventing
 * `/services/modular-kitchens` to satisfy the pattern would be four dead URLs
 * in the sitemap. `href` exists on the model for the day those pages are built.
 *
 * WHY THERE IS NO CTA ON EVERY CARD
 *
 * Four "Get a free consultation" buttons stacked down a phone screen is the
 * clutter this redesign is removing. The consultation is offered by the hero
 * above, the sticky bar throughout, and the closing section — a visitor is
 * never more than a thumb away from it.
 */
export function R5Services() {
  const hasReferenceImagery = R5_SERVICES.some((service) => service.image !== null);

  return (
    <section className="r5-section" aria-labelledby="r5-services-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_SERVICES_COPY.eyebrow}</p>
          <h2 id="r5-services-title" className="r5-heading">
            {R5_SERVICES_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_SERVICES_COPY.supporting}</p>
        </header>
      </div>

      {/*
        The rail breaks out of the container on a phone so the next card can
        peek at the screen edge; from 768px it becomes a grid inside the
        container again. The wrapper clips so six cards never widen the page.
      */}
      <div className="r5-railWrap">
        <div className="dc-container r5-railHost">
          <ul className="r5-rail">
            {R5_SERVICES.map((service) => (
              <li key={service.id}>
                <article className="r5-card">
                  {service.image ? (
                    <div className="r5-card__media">
                      <Image
                        src={service.image}
                        alt={service.imageAlt}
                        width={640}
                        height={480}
                        sizes="(min-width: 1100px) 300px, (min-width: 768px) 45vw, 86vw"
                        /*
                          Below the fold by definition — the hero and the banner
                          rail are both above it. Eager loading here would
                          compete with the hero's LCP image for the same
                          connection.
                        */
                        loading="lazy"
                        quality={75}
                      />
                    </div>
                  ) : null}

                  <div className="r5-card__body">
                    <h3 className="r5-card__title">{service.title}</h3>
                    <p className="r5-card__text">{service.description}</p>
                    <ul className="r5-tags">
                      {service.tags.map((tag) => (
                        <li key={tag} className="r5-tag">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {hasReferenceImagery ? (
        <div className="dc-container">
          <p className="r5-note">{REFERENCE_IMAGERY_NOTE}</p>
        </div>
      ) : null}
    </section>
  );
}
