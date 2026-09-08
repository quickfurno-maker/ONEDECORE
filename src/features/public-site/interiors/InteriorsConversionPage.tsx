import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
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
import { PlanProvider } from "@/features/public-site/home-r4/PlanContext";
import { DiscoveryProofStrip } from "@/features/public-site/discovery/DiscoveryProofStrip";
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

export function InteriorsConversionPage({
  leadFormMode,
}: {
  readonly leadFormMode: LeadFormMode;
}) {
  return (
    <PlanProvider>
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
        <HomeFaq leadFormMode={leadFormMode} />
        <HomePlan leadFormMode={leadFormMode} />
      </HomeShell>
    </PlanProvider>
  );
}
