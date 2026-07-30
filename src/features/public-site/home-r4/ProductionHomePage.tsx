import type { LeadFormMode } from "../../lead-intake/public/lead-form-mode";
import { PlanProvider } from "./PlanContext";
import { HomeBudgetEstimator } from "./HomeBudgetEstimator";
import { HomeFactory } from "./HomeFactory";
import { HomeFaq } from "./HomeFaq";
import { HomeHero } from "./HomeHero";
import { HomePlan } from "./HomePlan";
import { HomeProcess } from "./HomeProcess";
import { HomeReviews } from "./HomeReviews";
import { HomeServicesRooms } from "./HomeServicesRooms";
import { HomeShell } from "./HomeShell";
import { HomeTruthMetrics } from "./HomeTruthMetrics";
import { HomeWhy } from "./HomeWhy";

/** Production homepage composition — R5.4 reviews and conversion order. */
export function ProductionHomePage({
  leadFormMode,
}: {
  readonly leadFormMode: LeadFormMode;
}) {
  return (
    <PlanProvider>
      <HomeShell>
        <HomeHero />
        <HomeTruthMetrics />
        <HomeServicesRooms />
        <HomeBudgetEstimator />
        <HomeWhy />
        <HomeFactory />
        <HomeProcess />
        <HomeReviews />
        <HomeFaq />
        <HomePlan leadFormMode={leadFormMode} />
      </HomeShell>
    </PlanProvider>
  );
}
