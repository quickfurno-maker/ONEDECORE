import Link from "next/link";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { DISCOVERY_BENEFIT_CARDS } from "./discovery-copy";

export function DiscoveryBenefitCards() {
  return (
    <section
      className="od-disc-benefits"
      data-od-disc-section="benefits"
      aria-labelledby="od-disc-benefits-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head od-disc-band__head--row">
          <div>
            <p className="od-disc-kicker">Why start now</p>
            <h2 id="od-disc-benefits-title">Premium interiors, built with confidence</h2>
          </div>
        </Reveal>
        <div className="od-disc-benefits__rail">
          {DISCOVERY_BENEFIT_CARDS.map((card, index) => (
            <Reveal key={card.id} order={index} className="od-disc-benefit-card">
              <Link href={card.href} className="od-disc-benefit-card__link">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <span className="od-disc-benefit-card__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
