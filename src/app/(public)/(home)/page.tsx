import { FeaturedPortfolioSection } from "@/features/portfolio/public/components/FeaturedPortfolioSection";
import { BrandProposition } from "@/features/public-site/components/home/BrandProposition";
import { HeroSection } from "@/features/public-site/components/home/HeroSection";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BrandProposition />
      <FeaturedPortfolioSection />
    </>
  );
}
