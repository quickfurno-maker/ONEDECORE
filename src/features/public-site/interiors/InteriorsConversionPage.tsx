import { HomeBudgetEstimator } from "@/features/public-site/home-r4/HomeBudgetEstimator";
import { HomeFactory } from "@/features/public-site/home-r4/HomeFactory";
import { HomeFaq } from "@/features/public-site/home-r4/HomeFaq";
import { HomeHero } from "@/features/public-site/home-r4/HomeHero";
import { HomeMaterials } from "@/features/public-site/home-r4/HomeMaterials";
import { HomePlan } from "@/features/public-site/home-r4/HomePlan";
import { HomeProcess } from "@/features/public-site/home-r4/HomeProcess";
import { HomeReviews } from "@/features/public-site/home-r4/HomeReviews";
import { HomeServicesRooms } from "@/features/public-site/home-r4/HomeServicesRooms";
import { HomeShell } from "@/features/public-site/home-r4/HomeShell";
import { HomeWhy } from "@/features/public-site/home-r4/HomeWhy";
import { LeadConsultationHost } from "@/features/lead-intake/public/LeadConsultationHost";
import { DiscoveryWhatsAppFab } from "@/features/public-site/discovery/DiscoveryWhatsAppFab";
import "@/features/public-site/discovery/discovery.css";
import { InteriorsPromoCarousel } from "./InteriorsPromoCarousel";
import {
  InteriorsKitchenFeature,
  InteriorsPortfolioBridge,
  InteriorsRenovation,
  InteriorsServiceAreas,
  InteriorsWardrobes,
} from "./InteriorsServiceBlocks";
import "./interiors.css";

/*
 * `trust` is gone and `promo-carousel` takes the slot above the hero.
 *
 * The page was showing two numeric proof blocks within one screen of each
 * other — the hero's credibility row, then `DiscoveryProofStrip` immediately
 * below it. Two counters arguing the same point do not double the proof; they
 * make a visitor wonder which one is the real number. The hero's row stays and
 * now animates; the second strip is no longer composed into this page.
 *
 * `DiscoveryProofStrip` itself is untouched and still in the repository.
 */
export const INTERIORS_SECTION_ORDER = [
  "header",
  "promo-carousel",
  "hero",
  "complete-interiors",
  "modular-kitchen",
  "wardrobes",
  "renovation",
  "why",
  "factory",
  "estimator",
  "portfolio",
  "materials",
  "process",
  "service-areas",
  "testimonials",
  "faq",
  "consultation",
] as const;

export function InteriorsConversionPage() {
  return (
    <LeadConsultationHost>
      <HomeShell unifiedNav>
        <div data-od-interiors-order={INTERIORS_SECTION_ORDER.join("|")} hidden />
        {/*
          Campaigns sit above the hero, and the hero is unchanged beneath them.

          The carousel is the promotional surface — the thing that will carry a
          festive offer or a new service the week it launches. The hero is the
          page's argument and does not get rewritten every time a campaign
          changes, which is exactly why the two are separate blocks rather than
          one banner that tries to be both.
        */}
        <InteriorsPromoCarousel />
        <HomeHero />
        <HomeServicesRooms />
        <InteriorsKitchenFeature />
        <InteriorsWardrobes />
        <InteriorsRenovation />
        <HomeWhy />
        <HomeFactory />
        <HomeBudgetEstimator />
        <InteriorsPortfolioBridge />
        <HomeMaterials />
        <HomeProcess />
        <InteriorsServiceAreas />
        <HomeReviews />
        <HomeFaq />
        <HomePlan />
        {/*
          THE SAME FAB THE HOMEPAGE USES — one component, one instance.

          Not a copy styled to match: a second implementation would be two
          places to keep the validated href, the reduced-motion handling and the
          tap haptic in step, and they would drift. This page already imports
          `discovery.css`, so the existing styles apply as they are.

          It renders inside the shell so it sits above `.pm-sticky` in the same
          stacking context the sticky bar lives in.
        */}
        <DiscoveryWhatsAppFab />
      </HomeShell>
    </LeadConsultationHost>
  );
}
