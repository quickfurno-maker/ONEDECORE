import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export interface ServiceSeoInput {
  readonly name: string;
  readonly path: string;
  readonly description: string;
}

export function getServiceJsonLd(input: ServiceSeoInput) {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: input.name,
        description: input.description,
        url,
        areaServed: { "@type": "City", name: "Pune" },
        provider: { "@id": `${SITE_CONFIG.url}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_CONFIG.url },
          { "@type": "ListItem", position: 2, name: "Services", item: absoluteUrl("services") },
          { "@type": "ListItem", position: 3, name: input.name, item: url },
        ],
      },
    ],
  };
}
