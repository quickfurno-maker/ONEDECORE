import Image from "next/image";
import type { CSSProperties } from "react";
import { HOMEPAGE_HERO_ASSET } from "../../config/home-hero";
import { HOMEPAGE_COPY } from "../../content/homepage";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { SecondaryLink } from "../primitives/SecondaryLink";
import { HeroMediaMotion } from "./HeroMediaMotion";

export function HeroSection() {
  return (
    <section
      id="homepage-hero-section"
      className="ps-hero"
      aria-label="Introduction"
      style={
        {
          "--ps-hero-focal": HOMEPAGE_HERO_ASSET.focalPoint,
          "--ps-hero-focal-mobile": HOMEPAGE_HERO_ASSET.mobileFocalPoint,
        } as CSSProperties
      }
    >
      <HeroMediaMotion>
        <Image
          src={HOMEPAGE_HERO_ASSET.path}
          alt={HOMEPAGE_HERO_ASSET.alt}
          fill
          priority
          sizes="100vw"
          className="ps-hero__image"
        />
      </HeroMediaMotion>
      <div className="ps-hero__scrim" aria-hidden="true" />
      <Container width="wide" className="ps-hero__content">
        <Reveal className="ps-hero__copy">
          <p className="ps-type-overline ps-hero__brand">ONEDECORE</p>
          <h1 className="ps-type-display-xl ps-hero__title text-balance max-w-[12ch]">
            {HOMEPAGE_COPY.h1}
          </h1>
          <p className="ps-type-body-lg ps-hero__supporting max-w-[36ch]">
            {HOMEPAGE_COPY.supportingLine}
          </p>
          <div className="ps-hero__cta">
            <SecondaryLink
              id="hero-portfolio-cta-button"
              href={HOMEPAGE_COPY.ctaHref}
              className="ps-hero__cta-link text-[var(--color-dark-section-text)]"
            >
              {HOMEPAGE_COPY.ctaLabel}
            </SecondaryLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
