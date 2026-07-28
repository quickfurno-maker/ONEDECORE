import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PlanProvider } from "./PlanContext";
import { HomeApproach } from "./HomeApproach";
import { HomeFaq } from "./HomeFaq";
import { HomeHero } from "./HomeHero";
import { HomeMaterials } from "./HomeMaterials";
import { HomePlan } from "./HomePlan";
import { HomeProcess } from "./HomeProcess";
import { HomeProjects } from "./HomeProjects";
import { HomeServices } from "./HomeServices";
import { HomeShell } from "./HomeShell";
import { HomeVision } from "./HomeVision";

interface ProductionHomePageProps {
  readonly featured: readonly PublicPortfolioCard[];
}

/** Production homepage composition. */
export function ProductionHomePage({ featured }: ProductionHomePageProps) {
  return (
    <PlanProvider>
      <HomeShell>
        <HomeHero />
        <HomeVision />
        <HomeServices />
        <HomeProjects featured={featured} />
        <HomeApproach />
        <HomeProcess />
        <HomeMaterials />
        <HomeFaq />
        <HomePlan />
      </HomeShell>
    </PlanProvider>
  );
}
