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
import { HomeTruthMetrics } from "@/features/public-site/home-r4/HomeTruthMetrics";
import { HomeWhy } from "@/features/public-site/home-r4/HomeWhy";
import { PlanProvider } from "@/features/public-site/home-r4/PlanContext";
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
        <HomeTruthMetrics />
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
        <HomePlan leadFormMode={leadFormMode} />
      </HomeShell>
    </PlanProvider>
  );
}
