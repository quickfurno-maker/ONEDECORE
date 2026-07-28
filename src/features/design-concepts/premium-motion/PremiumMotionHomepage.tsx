import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PlanProvider } from "./PlanContext";
import { PmApproach } from "./PmApproach";
import { PmClose } from "./PmClose";
import { PmFaq } from "./PmFaq";
import { PmHero } from "./PmHero";
import { PmMaterials } from "./PmMaterials";
import { PmProcess } from "./PmProcess";
import { PmProjects } from "./PmProjects";
import { PmServices } from "./PmServices";
import { PmShell } from "./PmShell";
import { PmVision } from "./PmVision";

interface PremiumMotionHomepageProps {
  readonly featured: readonly PublicPortfolioCard[];
}

/** Phase 2F-R4 Premium Motion Conversion Homepage (owner-review concept). */
export function PremiumMotionHomepage({ featured }: PremiumMotionHomepageProps) {
  return (
    <PlanProvider>
      <PmShell>
        <PmHero />
        <PmVision />
        <PmServices />
        <PmProjects featured={featured} />
        <PmApproach />
        <PmProcess />
        <PmMaterials />
        <PmFaq />
        <PmClose />
      </PmShell>
    </PlanProvider>
  );
}
