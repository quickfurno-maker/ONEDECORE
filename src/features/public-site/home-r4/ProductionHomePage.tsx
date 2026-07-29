import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PlanProvider } from "./PlanContext";
import { HomeBudgetEstimator } from "./HomeBudgetEstimator";
import { HomeFactory } from "./HomeFactory";
import { HomeFaq } from "./HomeFaq";
import { HomeHero } from "./HomeHero";
import { HomePlan } from "./HomePlan";
import { HomeProcess } from "./HomeProcess";
import { HomeProjects } from "./HomeProjects";
import { HomeServicesRooms } from "./HomeServicesRooms";
import { HomeShell } from "./HomeShell";
import { HomeTruthMetrics } from "./HomeTruthMetrics";
import { HomeWhy } from "./HomeWhy";

interface ProductionHomePageProps {
  readonly featured: readonly PublicPortfolioCard[];
}

/** Production homepage composition — R5.3 conversion master order. */
export function ProductionHomePage({ featured }: ProductionHomePageProps) {
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
        <HomeProjects featured={featured} />
        <HomeFaq />
        <HomePlan />
      </HomeShell>
    </PlanProvider>
  );
}
