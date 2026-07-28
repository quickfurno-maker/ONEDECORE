import type { Metadata } from "next";
import { getFeaturedProjects } from "@/features/portfolio/public/public-portfolio-cache";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { ProductionHomePage } from "@/features/public-site/home-r4/ProductionHomePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ONEDECORE — One Vision. Complete Interiors.",
  description:
    "ONEDECORE designs and delivers complete home interiors, modular kitchens and custom wardrobes for homes across Pune.",
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const featured = await getFeaturedProjects();

  return (
    <div className={publicSiteFontVariables}>
      <ProductionHomePage featured={featured} />
    </div>
  );
}
