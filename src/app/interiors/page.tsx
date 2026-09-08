import type { Metadata } from "next";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { InteriorsConversionPage } from "@/features/public-site/interiors/InteriorsConversionPage";

/**
 * Public marketing HTML must not be cacheable for a year by a shared cache.
 *
 * Next.js requires this to be a literal: a route segment config is read by
 * static analysis rather than by running the module, so an imported constant is
 * rejected outright. The decision therefore lives in
 * `PUBLIC_HTML_REVALIDATE_SECONDS` and a test asserts every public page's
 * literal still equals it. See `src/config/public-cache.ts`.
 */
export const revalidate = 300;

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
  return (
    <div className={publicSiteFontVariables}>
      <InteriorsConversionPage />
    </div>
  );
}
