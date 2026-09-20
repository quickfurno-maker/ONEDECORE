import { describe, expect, it } from "vitest";
import { PUNE_AREA_PAGES } from "@/features/seo/pune-areas";
import { AREA_DEEP_CONTENT } from "@/features/seo/area-content";
import { ALL_SEO_GUIDES } from "@/features/seo/guides";
import { getServiceJsonLd } from "@/features/seo/service-schema";

describe("SEO architecture", () => {
  it("keeps Pune area slugs unique and every area materially enriched", () => {
    const slugs=PUNE_AREA_PAGES.map(a=>a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for(const area of PUNE_AREA_PAGES){expect(AREA_DEEP_CONTENT[area.slug]).toBeTruthy();}
  });
  it("keeps editorial guide slugs unique", () => {
    const slugs=ALL_SEO_GUIDES.map(g=>g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("emits Pune service and breadcrumb structured data", () => {
    const graph=getServiceJsonLd({name:"Modular Kitchens",path:"services/modular-kitchens",description:"Test"});
    expect(graph["@graph"][0].areaServed).toEqual({"@type":"City",name:"Pune"});
    expect(graph["@graph"][1]["@type"]).toBe("BreadcrumbList");
  });
});
