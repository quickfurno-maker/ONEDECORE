import Image from "next/image";
import Link from "next/link";
import { PublicPortfolioCard } from "../types";

export interface PortfolioCardProps {
  card: PublicPortfolioCard;
  eagerImage?: boolean;
}

export function PortfolioCard({ card, eagerImage = false }: PortfolioCardProps) {
  return (
    <article
      id={`portfolio-card-${card.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Cover Image Container */}
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

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Service Badges */}
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

        {/* Title */}
        <h3 className="mb-2 text-lg font-bold tracking-tight text-neutral-900 group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-400">
          <Link
            id={`portfolio-card-link-${card.slug}`}
            href={`/portfolio/${card.slug}`}
            className="after:absolute after:inset-0 focus:outline-hidden"
          >
            {card.title}
          </Link>
        </h3>

        {/* Summary */}
        <p className="mb-4 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {card.summary}
        </p>

        {/* Metadata Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-400">
          {card.locationLabel && <span>{card.locationLabel}</span>}
          {card.completionYear && <span>{card.completionYear}</span>}
        </div>
      </div>
    </article>
  );
}
