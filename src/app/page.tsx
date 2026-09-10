import type { Metadata } from "next";
import { SITE_CONFIG } from "@/config/site";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { InteriorsConversionPage } from "@/features/public-site/interiors/InteriorsConversionPage";

/**
 * The homepage is the Interiors experience.
 *
 * ONE IMPLEMENTATION, NOT A COPY
 *
 * This route renders the same `InteriorsConversionPage` that `/interiors` used
 * to, and `/interiors` is now a 308 to here (see `next.config.ts`). Pasting the
 * page body into this file would have produced two implementations that look
 * identical on the day they are written and diverge on the first edit —
 * usually the one nobody remembers to make twice.
 *
 * WHAT LEFT THIS FILE
 *
 * The previous common homepage read featured commerce categories, featured
 * products and a portfolio preview before it could render. The Interiors page
 * needs none of them, so those fetches are gone rather than left running
 * invisibly behind a page that ignores their results. `DiscoveryHomePage` and
 * its sections stay in the repository; they are simply not mounted here any
 * more, and removing them is a cleanup lane of its own.
 *
 * Public marketing HTML must not be cacheable for a year by a shared cache.
 * Next.js requires the revalidate value to be a literal: a route segment config
 * is read by static analysis rather than by running the module, so an imported
 * constant is rejected outright. The decision therefore lives in
 * `PUBLIC_HTML_REVALIDATE_SECONDS` and a test asserts every public page's
 * literal still equals it. See `src/config/public-cache.ts`.
 */
export const revalidate = 300;

/*
 * The Interiors metadata, with the canonical moved to the site root.
 *
 * This is the copy `/interiors` published, unchanged apart from the URL: it
 * describes what the page actually offers, and rewriting it to sound more like
 * a homepage would only put new words in front of the same content.
 */
export const metadata: Metadata = {
  title: `Home Interiors & Modular Kitchens in Pune — ${SITE_CONFIG.name}`,
  description:
    "Plan complete home interiors, modular kitchens, and wardrobes in Pune with ONEDECORE. Start a free design consultation.",
  alternates: { canonical: SITE_CONFIG.url },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Home Interiors & Modular Kitchens in Pune — ${SITE_CONFIG.name}`,
    description:
      "Plan complete home interiors, modular kitchens, and wardrobes in Pune with ONEDECORE. Start a free design consultation.",
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className={publicSiteFontVariables}>
      <InteriorsConversionPage />
    </div>
  );
}
