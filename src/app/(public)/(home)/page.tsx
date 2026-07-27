import { FeaturedPortfolioSection } from "@/features/portfolio/public/components/FeaturedPortfolioSection";
import { BrandProposition } from "@/features/public-site/components/home/BrandProposition";
import { HeroSection } from "@/features/public-site/components/home/HeroSection";
import { MaterialStorySection } from "@/features/public-site/components/home/MaterialStorySection";
import { ProcessSection } from "@/features/public-site/components/home/ProcessSection";
import { ServicesSection } from "@/features/public-site/components/home/ServicesSection";
import { TrustSection } from "@/features/public-site/components/home/TrustSection";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BrandProposition />
      <ServicesSection />
      <FeaturedPortfolioSection />
      <ProcessSection />
      <MaterialStorySection />
      <TrustSection />
    </>
  );
}
