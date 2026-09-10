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
import { DiscoveryProofStrip } from "@/features/public-site/discovery/DiscoveryProofStrip";
import { DiscoveryWhatsAppFab } from "@/features/public-site/discovery/DiscoveryWhatsAppFab";
import "@/features/public-site/discovery/discovery.css";
import {
  InteriorsKitchenFeature,
  InteriorsPortfolioBridge,
  InteriorsRenovation,
  InteriorsServiceAreas,
  InteriorsWardrobes,
} from "./InteriorsServiceBlocks";
import "./interiors.css";

export const INTERIORS_SECTION_ORDER = [
  "header",
  "hero",
  "trust",
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
          THE PROOF COUNTER LIVES HERE NOW.

          It used to sit second on the homepage, animating four figures at
          someone who had not yet been told what the company does. On this page
          the visitor has already chosen to read about the work, so the figures
          answer a question they are actually asking. Nothing about the claim
          gating changed with the move: every metric is still rendered only if
          `isClaimDisplayable` says so.
        */}
        <DiscoveryProofStrip />
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
