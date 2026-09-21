import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUNE_AREA_PAGES } from "@/features/seo/pune-areas";
import { AREA_DEEP_CONTENT } from "@/features/seo/area-content";
import { ALL_SEO_GUIDES } from "@/features/seo/guides";
import { getServiceJsonLd } from "@/features/seo/service-schema";

describe("SEO architecture", () => {
  it("keeps Pune area slugs unique and every area materially enriched", () => {
    const slugs=PUNE_AREA_PAGES.map(a=>a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for(const area of PUNE_AREA_PAGES){assert.ok(AREA_DEEP_CONTENT[area.slug]);}
  });
  it("keeps editorial guide slugs unique", () => {
    const slugs=ALL_SEO_GUIDES.map(g=>g.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
  it("emits Pune service and breadcrumb structured data", () => {
    const graph=getServiceJsonLd({name:"Modular Kitchens",path:"services/modular-kitchens",description:"Test"});
    assert.deepEqual(graph["@graph"][0].areaServed, {"@type":"City",name:"Pune"});
    assert.equal(graph["@graph"][1]["@type"], "BreadcrumbList");
  });
});
