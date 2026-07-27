import type { TrustPillar } from "../../content/trust";
import { Reveal } from "../primitives/Reveal";

export interface TrustPillarProps {
  pillar: TrustPillar;
  revealDelayMs?: number;
}

/**
 * Single trust philosophy pillar — Server Component.
 * No numeric claims, social proof quotes, trophies, or glyph markers.
 */
export function TrustPillarItem({ pillar, revealDelayMs = 0 }: TrustPillarProps) {
  return (
    <Reveal delayMs={revealDelayMs} className="ps-trust-pillar-reveal">
      <article id={`trust-pillar-${pillar.id}`} className="ps-trust-pillar">
        <h3 className="ps-type-heading-3 ps-trust-pillar__title">{pillar.title}</h3>
        <p className="ps-type-body ps-trust-pillar__body">{pillar.body}</p>
      </article>
    </Reveal>
  );
}
