import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { BrandProposition } from "./BrandProposition";
import { CmHero } from "./CmHero";
import { CmShell } from "./CmShell";
import { FaqSection } from "./FaqSection";
import { FinalForm } from "./FinalForm";
import { LeadProvider } from "./LeadContext";
import { MaterialsSection } from "./MaterialsSection";
import { ProcessSection } from "./ProcessSection";
import { ProjectStorySection } from "./ProjectStorySection";
import { ProjectsSection } from "./ProjectsSection";
import { ScopePlanner } from "./ScopePlanner";
import { ServicesSection } from "./ServicesSection";
import { WhySection } from "./WhySection";

interface ConversionMasterProps {
  readonly featured: readonly PublicPortfolioCard[];
}

/** Server Component assembling the Conversion Master homepage prototype. */
export function ConversionMaster({ featured }: ConversionMasterProps) {
  return (
    <LeadProvider>
      <CmShell>
        <CmHero />
        <BrandProposition />
        <ServicesSection />
        <ProjectsSection featured={featured} />
        <ProjectStorySection />
        <WhySection />
        <ProcessSection />
        <MaterialsSection />
        <ScopePlanner />
        <FaqSection />
        <FinalForm />
      </CmShell>
    </LeadProvider>
  );
}
