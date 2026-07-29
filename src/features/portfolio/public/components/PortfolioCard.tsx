import Image from "next/image";
import Link from "next/link";
import { PublicPortfolioCard } from "../types";

export interface PortfolioCardProps {
  card: PublicPortfolioCard;
  eagerImage?: boolean;
}

const CARD_SIZES =
  "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw";

export function PortfolioCard({ card, eagerImage = false }: PortfolioCardProps) {
  const hasMeta = Boolean(card.locationLabel || card.completionYear);

  return (
    <article id={`portfolio-card-${card.slug}`} className="od-card">
      <div className="od-card__media">
        <Image
          src={card.cover.url}
          alt={card.cover.altText}
          width={card.cover.width}
          height={card.cover.height}
          sizes={CARD_SIZES}
          loading={eagerImage ? "eager" : "lazy"}
        />
        {card.isFeatured ? (
          <span className="od-card__badge">Featured</span>
        ) : null}
      </div>

      <div className="od-card__body">
        <div className="od-card__services">
          {card.services.map((svc) => (
            <span key={svc.serviceCode} className="od-chip">
              {svc.serviceLabel}
            </span>
          ))}
        </div>

        <h3 className="od-card__title">
          <Link
            id={`portfolio-card-link-${card.slug}`}
            href={`/portfolio/${card.slug}`}
          >
            {card.title}
          </Link>
        </h3>

        <p className="od-card__summary">{card.summary}</p>

        {hasMeta ? (
          <div className="od-card__meta">
            {card.locationLabel ? <span>{card.locationLabel}</span> : null}
            {card.completionYear ? <span>{card.completionYear}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
