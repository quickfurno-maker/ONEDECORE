import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PlanProvider } from "./PlanContext";
import { HomeApproach } from "./HomeApproach";
import { HomeFaq } from "./HomeFaq";
import { HomeHero } from "./HomeHero";
import { HomeMaterials } from "./HomeMaterials";
import { HomePlan } from "./HomePlan";
import { HomeProcess } from "./HomeProcess";
import { HomeProjects } from "./HomeProjects";
import { HomeReadiness } from "./HomeReadiness";
import { HomeRoomExplorer } from "./HomeRoomExplorer";
import { HomeScopeIncluded } from "./HomeScopeIncluded";
import { HomeServices } from "./HomeServices";
import { HomeShell } from "./HomeShell";
import { HomeTruthMetrics } from "./HomeTruthMetrics";
import { HomeVision } from "./HomeVision";

interface ProductionHomePageProps {
  readonly featured: readonly PublicPortfolioCard[];
}

/** Production homepage composition — R5 homeowner value order. */
export function ProductionHomePage({ featured }: ProductionHomePageProps) {
  return (
    <PlanProvider>
      <HomeShell>
        <HomeHero />
        <HomeTruthMetrics />
        <HomeVision />
        <HomeServices />
        <HomeRoomExplorer />
        <HomeScopeIncluded />
        <HomeProjects featured={featured} />
        <HomeApproach />
        <HomeProcess />
        <HomeMaterials />
        <HomeReadiness />
        <HomeFaq />
        <HomePlan />
      </HomeShell>
    </PlanProvider>
  );
}
