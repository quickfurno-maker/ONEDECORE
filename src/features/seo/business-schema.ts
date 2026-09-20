import { SITE_CONFIG } from "@/config/site";

/**
 * Search-engine entity graph for ONEDECORE.
 *
 * Keep this deliberately conservative: only facts already asserted by the
 * public site are represented here. Address, phone, ratings and social
 * profiles belong here only after they are verified and approved for public
 * display.
 */
export function getBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_CONFIG.url}/#organization`,
        name: SITE_CONFIG.name,
        url: SITE_CONFIG.url,
        slogan: SITE_CONFIG.tagline,
        areaServed: {
          "@type": "City",
          name: "Pune",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_CONFIG.url}/#website`,
        url: SITE_CONFIG.url,
        name: SITE_CONFIG.name,
        publisher: { "@id": `${SITE_CONFIG.url}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  };
}
