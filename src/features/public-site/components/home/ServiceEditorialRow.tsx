import { SERVICE_MARKETING_ASSETS } from "../../config/service-assets";
import type { ServiceStory } from "../../content/services";
import { cn } from "../../utils/cn";
import { ImageFrame } from "../primitives/ImageFrame";
import { Reveal } from "../primitives/Reveal";
import { SecondaryLink } from "../primitives/SecondaryLink";

export interface ServiceEditorialRowProps {
  service: ServiceStory;
  /** Optional production CTA — omitted on C4 homepage until Phase 2F-D routes exist. */
  ctaHref?: string;
  ctaLabel?: string;
  revealDelayMs?: number;
}

/**
 * Alternating image/text service row. Server Component.
 * Does not wrap the entire row in a link. CTA is opt-in for tests / Phase 2F-D.
 */
export function ServiceEditorialRow({
  service,
  ctaHref,
  ctaLabel = "Learn more",
  revealDelayMs = 0,
}: ServiceEditorialRowProps) {
  const asset = SERVICE_MARKETING_ASSETS[service.assetId];
  const imageFirst = service.imagePosition === "left";

  return (
    <Reveal delayMs={revealDelayMs} className="ps-service-row-reveal">
      <article
        id={`service-row-${service.id}`}
        className={cn(
          "ps-service-row",
          imageFirst ? "ps-service-row--image-left" : "ps-service-row--image-right"
        )}
        data-image-position={service.imagePosition}
      >
        <div className="ps-service-row__media">
          <ImageFrame
            src={asset.path}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            ratio="service"
            sizes="(max-width: 767px) 100vw, 50vw"
            objectPosition={asset.focalPoint}
            className="ps-service-row__frame"
          />
        </div>
        <div className="ps-service-row__copy">
          <p className="ps-type-overline ps-service-row__ordinal" aria-hidden="true">
            {service.ordinal}
          </p>
          <h3 className="ps-type-heading-2 ps-service-row__title">{service.title}</h3>
          <p className="ps-type-body-lg ps-service-row__description">{service.description}</p>
          {ctaHref ? (
            <div className="ps-service-row__cta">
              <SecondaryLink
                id={`service-cta-${service.id}`}
                href={ctaHref}
                className="ps-service-row__cta-link"
              >
                {ctaLabel}
              </SecondaryLink>
            </div>
          ) : null}
        </div>
      </article>
    </Reveal>
  );
}
