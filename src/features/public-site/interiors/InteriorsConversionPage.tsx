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
 * The hero opens the page; the promo rail follows it.
 *
 * The rail was briefly first, and putting it there cost the page its
 * introduction: a visitor arriving at onedecore.in met six unexplained frames
 * before anything said what the company does. Promotions are worth reading
 * once you know whose promotions they are — so the hero makes the argument,
 * the rail carries whatever is running this month, and the established
 * interiors journey continues underneath exactly as it did.
 *
 * `trust` is absent and stays absent. The page was showing two numeric proof
 * blocks within one screen of each other — the hero's credibility row, then
 * `DiscoveryProofStrip` immediately below it. Two counters arguing the same
 * point do not double the proof; they make a visitor wonder which is the real
 * number. `DiscoveryProofStrip` itself is untouched and still in the
 * repository.
 *
 * This array is rendered into `data-od-interiors-order` and asserted against
 * the mounted components, so it cannot drift from the DOM silently.
 */
export const INTERIORS_SECTION_ORDER = [
  "header",
  "hero",
  "promo-carousel",
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
        <HomeHero />
        {/*
          Campaigns sit BELOW the hero, and the hero is unchanged above them.

          The carousel is the promotional surface — the thing that will carry a
          festive offer or a new service the week it launches. The hero is the
          page's argument, and it does not get rewritten every time a campaign
          changes, which is why the two are separate blocks rather than one
          banner trying to be both.

          Order matters between them: six unexplained frames are not an
          introduction. The hero says what ONEDECORE does, the rail says what is
          on right now, and the service journey below carries on unchanged.
        */}
        <InteriorsPromoCarousel />
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
