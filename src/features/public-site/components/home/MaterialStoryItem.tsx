import { MATERIAL_MARKETING_ASSETS } from "../../config/material-assets";
import type { MaterialStoryItem } from "../../content/material-story";
import { cn } from "../../utils/cn";
import { ImageFrame } from "../primitives/ImageFrame";
import { Reveal } from "../primitives/Reveal";

export interface MaterialStoryItemProps {
  item: MaterialStoryItem;
  revealDelayMs?: number;
}

/**
 * Single material story moment — Server Component.
 * Category-C marketing artwork; captions are editorial, not specifications.
 */
export function MaterialStoryItemView({
  item,
  revealDelayMs = 0,
}: MaterialStoryItemProps) {
  const asset = MATERIAL_MARKETING_ASSETS[item.assetId];

  return (
    <Reveal delayMs={revealDelayMs} className="ps-material-item-reveal">
      <figure
        id={`material-story-${item.id}`}
        className={cn(
          "ps-material-item",
          item.role === "primary" ? "ps-material-item--primary" : "ps-material-item--supporting"
        )}
      >
        <ImageFrame
          src={asset.path}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          ratio="material"
          sizes={
            item.role === "primary"
              ? "(max-width: 767px) 100vw, 62vw"
              : "(max-width: 767px) 100vw, 34vw"
          }
          objectPosition={asset.focalPoint}
          className="ps-material-item__frame"
        />
        <figcaption className="ps-material-item__caption">
          <span className="ps-type-overline ps-material-item__ordinal" aria-hidden="true">
            {item.ordinal}
          </span>
          <span className="ps-type-body ps-material-item__text">{item.caption}</span>
        </figcaption>
      </figure>
    </Reveal>
  );
}
