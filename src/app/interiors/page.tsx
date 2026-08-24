import type { Metadata } from "next";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { getLeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { InteriorsConversionPage } from "@/features/public-site/interiors/InteriorsConversionPage";

export const metadata: Metadata = {
  title: `Home Interiors & Modular Kitchens in Pune — ${SITE_CONFIG.name}`,
  description:
    "Plan complete home interiors, modular kitchens, and wardrobes in Pune with ONEDECORE. Start a free design consultation.",
  alternates: { canonical: absoluteUrl("interiors") },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Home Interiors & Modular Kitchens in Pune — ${SITE_CONFIG.name}`,
    description:
      "Plan complete home interiors, modular kitchens, and wardrobes in Pune with ONEDECORE. Start a free design consultation.",
    url: absoluteUrl("interiors"),
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    type: "website",
  },
};

export default function InteriorsPage() {
  const leadFormMode = getLeadFormMode();
  return (
    <div className={publicSiteFontVariables}>
      <InteriorsConversionPage leadFormMode={leadFormMode} />
    </div>
  );
}
