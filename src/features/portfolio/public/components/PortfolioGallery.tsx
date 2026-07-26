import Image from "next/image";
import { PublicPortfolioImage } from "../types";

export interface PortfolioGalleryProps {
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
  projectTitle: string;
}

export function PortfolioGallery({ cover, gallery, projectTitle }: PortfolioGalleryProps) {
  const allImages = [cover, ...gallery];

  return (
    <section id="portfolio-gallery-section" aria-label="Project photo gallery" className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
        Project Gallery
      </h2>
      <div
        id="portfolio-gallery-grid"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {allImages.map((img, index) => (
          <figure
            key={`${img.url}-${index}`}
            id={`portfolio-gallery-item-${index}`}
            className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-xs dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={img.url}
                alt={img.altText || `${projectTitle} photo ${index + 1}`}
                width={img.width}
                height={img.height}
                loading={index === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            {img.caption && (
              <figcaption className="p-3 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-100 dark:border-neutral-800">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
