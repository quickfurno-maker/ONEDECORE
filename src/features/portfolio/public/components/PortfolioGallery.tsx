import Image from "next/image";
import { PublicPortfolioImage } from "../types";

export interface PortfolioGalleryProps {
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
  projectTitle: string;
}

export function PortfolioGallery({
  cover,
  gallery,
  projectTitle,
}: PortfolioGalleryProps) {
  const allImages = [cover, ...gallery];

  return (
    <section
      id="portfolio-gallery-section"
      aria-label="Project photo gallery"
      className="od-gallery"
    >
      <h2>Project Gallery</h2>
      <div id="portfolio-gallery-grid" className="od-gallery__grid">
        {allImages.map((img, index) => (
          <figure
            key={`${img.url}-${index}`}
            id={`portfolio-gallery-item-${index}`}
            className="od-figure"
          >
            <div className="od-figure__media">
              <Image
                src={img.url}
                alt={img.altText || `${projectTitle} photo ${index + 1}`}
                width={img.width}
                height={img.height}
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
            {img.caption ? <figcaption>{img.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
