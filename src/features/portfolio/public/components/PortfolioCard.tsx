import Image from "next/image";
import Link from "next/link";
import { PublicPortfolioCard } from "../types";

export type PortfolioCardVariant = "listing" | "featuredEditorial";

export interface PortfolioCardProps {
  card: PublicPortfolioCard;
  eagerImage?: boolean;
  /** Default remains listing so /portfolio appearance stays stable. */
  variant?: PortfolioCardVariant;
}

function metadataLine(card: PublicPortfolioCard): string | null {
  const parts: string[] = [];
  if (card.locationLabel) parts.push(card.locationLabel);
  else if (card.services[0]?.serviceLabel) parts.push(card.services[0].serviceLabel);
  if (card.completionYear) parts.push(String(card.completionYear));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PortfolioCard({
  card,
  eagerImage = false,
  variant = "listing",
}: PortfolioCardProps) {
  if (variant === "featuredEditorial") {
    const meta = metadataLine(card);
    return (
      <article
        id={`portfolio-card-${card.slug}`}
        className="ps-featured-card group relative"
        data-variant="featuredEditorial"
      >
        <div className="ps-featured-card__media">
          <Image
            src={card.cover.url}
            alt={card.cover.altText}
            width={card.cover.width}
            height={card.cover.height}
            loading={eagerImage ? "eager" : "lazy"}
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 60vw"
            className="ps-featured-card__image"
          />
        </div>
        <div className="ps-featured-card__copy">
          <h3 className="ps-featured-card__title">
            <Link
              id={`portfolio-card-link-${card.slug}`}
              href={`/portfolio/${card.slug}`}
              className="ps-featured-card__link"
            >
              {card.title}
            </Link>
          </h3>
          {meta ? <p className="ps-featured-card__meta">{meta}</p> : null}
        </div>
      </article>
    );
  }

  return (
    <article
      id={`portfolio-card-${card.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
      data-variant="listing"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <Image
          src={card.cover.url}
          alt={card.cover.altText}
          width={card.cover.width}
          height={card.cover.height}
          loading={eagerImage ? "eager" : "lazy"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {card.isFeatured && (
          <span className="absolute top-3 right-3 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {card.services.map((svc) => (
            <span
              key={svc.serviceCode}
              className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {svc.serviceLabel}
            </span>
          ))}
        </div>

        <h3 className="mb-2 text-lg font-bold tracking-tight text-neutral-900 group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-400">
          <Link
            id={`portfolio-card-link-${card.slug}`}
            href={`/portfolio/${card.slug}`}
            className="after:absolute after:inset-0 focus:outline-hidden"
          >
            {card.title}
          </Link>
        </h3>

        <p className="mb-4 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {card.summary}
        </p>

        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-400">
          {card.locationLabel && <span>{card.locationLabel}</span>}
          {card.completionYear && <span>{card.completionYear}</span>}
        </div>
      </div>
    </article>
  );
}
