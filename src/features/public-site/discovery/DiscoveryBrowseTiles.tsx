import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { DISCOVERY_CATEGORY_TILES } from "./discovery-copy";
import { getDiscoveryAsset } from "./discovery-assets";

export function DiscoveryBrowseTiles() {
  return (
    <section
      className="od-disc-band od-disc-band--surface od-disc-band--divided"
      data-od-disc-section="browse"
      aria-labelledby="od-disc-browse-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head">
          <p className="od-disc-kicker">Browse collections</p>
          <h2 id="od-disc-browse-title">What are you planning?</h2>
          <p className="od-disc-lede">
            Explore ONEDECORE interiors like a premium storefront — each collection leads to your
            consultation path.
          </p>
        </Reveal>
        <div className="od-disc-browse">
          {DISCOVERY_CATEGORY_TILES.map((tile, index) => {
            const asset = getDiscoveryAsset(tile.assetKey);
            const className = [
              "od-disc-browse-tile",
              tile.featured ? "od-disc-browse-tile--featured" : "",
              tile.comingSoon ? "od-disc-browse-tile--soon" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const inner = (
              <>
                <div className="od-disc-browse-tile__media">
                  <Image
                    src={asset.path}
                    alt={tile.comingSoon ? "" : asset.alt}
                    fill
                    sizes={
                      tile.featured
                        ? "(max-width: 768px) 88vw, 50vw"
                        : "(max-width: 768px) 88vw, 25vw"
                    }
                    style={{ objectPosition: asset.focalPoint }}
                    loading="lazy"
                  />
                </div>
                <div className="od-disc-browse-tile__overlay">
                  {tile.comingSoon && tile.badge ? (
                    <span className="od-disc-browse-tile__badge">{tile.badge}</span>
                  ) : null}
                  <h3>{tile.title}</h3>
                  <p>{tile.lede}</p>
                  <span className="od-disc-browse-tile__cta">
                    {tile.cta}
                    <span aria-hidden="true"> →</span>
                  </span>
                </div>
              </>
            );

            return (
              <Reveal key={tile.id} order={index} className={className}>
                {tile.comingSoon ? (
                  <div className="od-disc-browse-tile__surface">{inner}</div>
                ) : (
                  <Link href={tile.href} className="od-disc-browse-tile__surface">
                    {inner}
                  </Link>
                )}
                {tile.comingSoon ? (
                  <Link href={tile.href} className="od-disc-browse-tile__soon-cta od-disc-btn od-disc-btn--ghost">
                    {tile.cta}
                  </Link>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
