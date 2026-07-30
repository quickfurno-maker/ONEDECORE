import type { Metadata } from "next";
import { getLeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { ProductionHomePage } from "@/features/public-site/home-r4/ProductionHomePage";

export const metadata: Metadata = {
  title: "ONEDECORE — Complete Home Interiors in Pune",
  description:
    "ONEDECORE designs, manufactures and installs complete home interiors, modular kitchens and custom wardrobes across Pune. Explore indicative pricing and start a free design consultation.",
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const leadFormMode = getLeadFormMode();
  return (
    <div className={publicSiteFontVariables}>
      <ProductionHomePage leadFormMode={leadFormMode} />
    </div>
  );
}
