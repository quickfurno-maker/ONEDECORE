import Image from "next/image";
import Link from "next/link";
import { HOME_PUNE_AREAS } from "@/features/public-site/home-r4/claims";
import { PM_ASSETS, PM_CTA } from "@/features/public-site/home-r4/content";

export function InteriorsKitchenFeature() {
  const asset = PM_ASSETS.modularKitchens;
  return (
    <section
      id="modular-kitchen"
      className="pm-section od-int-block"
      aria-labelledby="od-int-kitchen-title"
    >
      <div className="dc-container od-int-block__grid">
        <div>
          <p className="pm-eyebrow">Modular Kitchen</p>
          <h2 id="od-int-kitchen-title" className="pm-h2">
            Machine-finished kitchens, planned for how you cook
          </h2>
          <p className="pm-lede">
            Custom layouts, smart storage, and end-to-end installation from the same team that
            designs the rest of the home.
          </p>
        </div>
        <figure className="od-int-block__media">
          <Image
            src={asset.path}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes="(max-width: 800px) 100vw, 46vw"
          />
        </figure>
      </div>
    </section>
  );
}

export function InteriorsWardrobes() {
  const asset = PM_ASSETS.customWardrobes;
  return (
    <section className="pm-section od-int-block" aria-labelledby="od-int-wardrobe-title">
      <div className="dc-container od-int-block__grid">
        <div>
          <p className="pm-eyebrow">Wardrobes</p>
          <h2 id="od-int-wardrobe-title" className="pm-h2">
            Storage that fits the architecture
          </h2>
          <p className="pm-lede">
            Custom wardrobes planned with room layouts, finishes, and daily use — not as an
            afterthought.
          </p>
        </div>
        <figure className="od-int-block__media">
          <Image
            src={asset.path}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes="(max-width: 800px) 100vw, 46vw"
          />
        </figure>
      </div>
    </section>
  );
}

export function InteriorsRenovation() {
  const asset = PM_ASSETS.completeHomeInteriors;
  return (
    <section className="pm-section od-int-block" aria-labelledby="od-int-reno-title">
      <div className="dc-container">
        <p className="pm-eyebrow">Renovation</p>
        <h2 id="od-int-reno-title" className="pm-h2">
          Refresh the home with one coordinated team
        </h2>
        <p className="pm-lede">
          Renovation work stays aligned with interiors, kitchens, and storage so the finished
          home reads as one vision.
        </p>
        <figure className="od-int-block__media od-int-block__media--wide">
          <Image
            src={asset.path}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes="100vw"
          />
        </figure>
      </div>
    </section>
  );
}

export function InteriorsPortfolioBridge() {
  return (
    <section className="pm-section od-int-block" aria-labelledby="od-int-portfolio-title">
      <div className="dc-container">
        <p className="pm-eyebrow">Portfolio</p>
        <h2 id="od-int-portfolio-title" className="pm-h2">
          See finished ONEDECORE homes
        </h2>
        <p className="pm-lede">
          Approved project photography lives on the portfolio. This page does not invent product
          placement inside those homes.
        </p>
        <Link href="/portfolio" className="dc-btn dc-btn--primary">
          {PM_CTA.projects}
        </Link>
      </div>
    </section>
  );
}

export function InteriorsServiceAreas() {
  return (
    <section className="pm-section od-int-block" aria-labelledby="od-int-areas-title">
      <div className="dc-container">
        <p className="pm-eyebrow">Service areas</p>
        <h2 id="od-int-areas-title" className="pm-h2">
          Interior execution across Pune
        </h2>
        <p className="pm-lede">
          ONEDECORE currently plans and installs interiors for homes across Pune. Furniture
          pincode serviceability is a separate shop check.
        </p>
        <ul className="od-int-areas">
          {HOME_PUNE_AREAS.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
