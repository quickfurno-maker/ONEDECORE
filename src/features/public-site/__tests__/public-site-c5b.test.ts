import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { PROCESS_SECTION_COPY, PROCESS_STEPS } from "../content/process.ts";
import {
  MATERIAL_STORY_ITEMS,
  MATERIAL_STORY_SECTION_COPY,
} from "../content/material-story.ts";
import { MATERIAL_MARKETING_ASSETS } from "../config/material-assets.ts";
import { TRUST_PILLARS, TRUST_SECTION_COPY } from "../content/trust.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE_ROOT = join(__dirname, "..");
const SRC_ROOT = join(__dirname, "../../..");
const APP_ROOT = join(SRC_ROOT, "app");
const REPO_ROOT = join(SRC_ROOT, "..");

function readPs(relativePath: string): string {
  return readFileSync(join(PUBLIC_SITE_ROOT, relativePath), "utf8");
}

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), "utf8");
}

const FORBIDDEN_COPY = [
  "award-winning",
  "best interior",
  "industry-leading",
  "warranty",
  "guaranteed",
  "on-time",
  "factory-direct",
  "trusted by",
  "testimonial",
  "10-year",
  "imported",
  "italian",
  "german",
  "fireproof",
  "waterproof",
  "scratch-proof",
  "OWNER CONTENT REQUIRED",
];

const FORBIDDEN_MATERIAL_CLAIMS = [
  "imported",
  "Italian",
  "German",
  "premium-grade",
  "fireproof",
  "waterproof",
  "scratch-proof",
  "maintenance-free",
  "warranty",
  "durable guarantee",
];

describe("Public Site C5B — ProcessSection contract", () => {
  test("ProcessSection is a Server Component without use client", () => {
    const source = readPs("components/home/ProcessSection.tsx");
    const step = readPs("components/home/ProcessStep.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.equal(step.includes('"use client"'), false);
    assert.match(source, /export function ProcessSection/);
    assert.match(source, /id="homepage-process-section"/);
    assert.match(source, /aria-labelledby="homepage-process-heading"/);
    assert.equal(source.includes("@supabase"), false);
    assert.equal(source.includes("fetch("), false);
  });

  test("exactly four owner-approved steps in stable 01–04 order", () => {
    assert.equal(PROCESS_STEPS.length, 4);
    assert.deepEqual(
      PROCESS_STEPS.map((s) => s.ordinal),
      ["01", "02", "03", "04"]
    );
    assert.deepEqual(
      PROCESS_STEPS.map((s) => s.title),
      ["Discover", "Define", "Detail", "Deliver"]
    );
    assert.equal(
      PROCESS_STEPS[0].description,
      "We begin by understanding the home, everyday requirements, priorities, and the direction you want the interiors to take."
    );
    assert.equal(
      PROCESS_STEPS[1].description,
      "Layouts, storage requirements, materials, and the overall design language are brought together into one clear direction."
    );
    assert.equal(
      PROCESS_STEPS[2].description,
      "Key interior elements are refined through proportion, finish, functionality, and considered material combinations."
    );
    assert.equal(
      PROCESS_STEPS[3].description,
      "The approved design is carried through execution, installation, final detailing, and handover as one coordinated interior journey."
    );
  });

  test("approved process section framing is exact", () => {
    assert.equal(PROCESS_SECTION_COPY.overline, "Our Process");
    assert.equal(
      PROCESS_SECTION_COPY.heading,
      "A considered path from first conversation to final handover"
    );
    assert.equal(
      PROCESS_SECTION_COPY.introduction,
      "Four clear stages bring the wider interior vision and its details into one coordinated journey."
    );
  });

  test("ProcessSection has no CTA and no /process or hash href", () => {
    const source = readPs("components/home/ProcessSection.tsx");
    const step = readPs("components/home/ProcessStep.tsx");
    const page = readApp("(public)/(home)/page.tsx");
    for (const blob of [source, step, page]) {
      assert.equal(blob.includes('href="/process"'), false);
      assert.equal(blob.includes("href=\"/process\""), false);
      assert.equal(blob.includes('href="#"'), false);
      assert.equal(blob.includes("PrimaryButton"), false);
      assert.equal(blob.includes("SecondaryLink"), false);
    }
    assert.equal(source.includes("cta"), false);
  });

  test("process content avoids duration, price, warranty and hype claims", () => {
    const blob = [
      JSON.stringify(PROCESS_SECTION_COPY),
      JSON.stringify(PROCESS_STEPS),
    ]
      .join("\n")
      .toLowerCase();
    for (const claim of FORBIDDEN_COPY) {
      assert.equal(blob.includes(claim.toLowerCase()), false, claim);
    }
    assert.equal(/\b\d+\s*(day|week|month|year)s?\b/.test(blob), false);
    assert.equal(/%/.test(blob), false);
  });

  test("process uses semantic H2/H3 structure", () => {
    const section = readPs("components/home/ProcessSection.tsx");
    const step = readPs("components/home/ProcessStep.tsx");
    assert.match(section, /as="h2"/);
    assert.match(step, /<h3/);
    assert.match(section, /<ol/);
  });
});

describe("Public Site C5B — MaterialStorySection contract", () => {
  test("MaterialStorySection is a Server Component on selective dark surface", () => {
    const source = readPs("components/home/MaterialStorySection.tsx");
    const item = readPs("components/home/MaterialStoryItem.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.equal(item.includes('"use client"'), false);
    assert.match(source, /surface="dark"/);
    assert.match(source, /id="homepage-material-story-section"/);
    assert.match(source, /aria-labelledby="homepage-material-story-heading"/);
    assert.equal(source.includes("@supabase"), false);
  });

  test("exactly three material items with approved captions", () => {
    assert.equal(MATERIAL_STORY_ITEMS.length, 3);
    assert.deepEqual(
      MATERIAL_STORY_ITEMS.map((i) => i.caption),
      [
        "Stone, light, and shadow brought together with restraint.",
        "Joinery considered through proportion, alignment, and material detail.",
        "Layers of texture held within a calm and coherent palette.",
      ]
    );
    assert.equal(MATERIAL_STORY_SECTION_COPY.overline, "Material Story");
    assert.equal(
      MATERIAL_STORY_SECTION_COPY.heading,
      "Materials considered as part of the wider composition"
    );
  });

  test("three local Category-C production assets with provenance", () => {
    const ids = Object.keys(MATERIAL_MARKETING_ASSETS);
    assert.equal(ids.length, 3);
    for (const id of ids) {
      const asset = MATERIAL_MARKETING_ASSETS[id as keyof typeof MATERIAL_MARKETING_ASSETS];
      assert.equal(asset.provenanceCategory, "C");
      assert.equal(asset.ownership, "ONEDECORE");
      assert.equal(asset.publicRedistribution, true);
      assert.equal(asset.attributionRequired, false);
      assert.equal(asset.depictsCompletedProject, false);
      assert.match(asset.path, /^\/marketing\/materials\//);
      assert.equal(asset.path.includes("http"), false);
      assert.equal(asset.path.includes("storage"), false);
      assert.equal(/quickfurno|jarvis/i.test(asset.path), false);
      const disk = join(REPO_ROOT, "public", asset.path.replace(/^\//, ""));
      assert.equal(existsSync(disk), true, disk);
      const bytes = statSync(disk).size;
      assert.equal(bytes, asset.bytes, `${id} byte metadata`);
      assert.ok(bytes <= 120000, `${id} ${bytes} exceeds 120KB`);
      assert.ok(asset.width / asset.height > 1.4 && asset.width / asset.height < 1.6);
      assert.match(asset.alt, /Abstract/);
      assert.equal(/project|ONEDECORE project/i.test(asset.alt), false);
    }
  });

  test("material captions and alts forbid performance claims", () => {
    const blob = [
      JSON.stringify(MATERIAL_STORY_SECTION_COPY),
      JSON.stringify(MATERIAL_STORY_ITEMS),
      JSON.stringify(MATERIAL_MARKETING_ASSETS),
    ].join("\n");
    for (const claim of FORBIDDEN_MATERIAL_CLAIMS) {
      assert.equal(blob.toLowerCase().includes(claim.toLowerCase()), false, claim);
    }
  });

  test("material layout has no carousel, parallax, or remote URLs", () => {
    const section = readPs("components/home/MaterialStorySection.tsx");
    const item = readPs("components/home/MaterialStoryItem.tsx");
    for (const blob of [section, item]) {
      assert.equal(/carousel|embla|swiper|parallax/i.test(blob), false);
      assert.equal(blob.includes("https://"), false);
      assert.equal(blob.includes('"use client"'), false);
    }
    assert.match(item, /loading|priority|ImageFrame/);
    assert.equal(item.includes("priority={true}"), false);
    assert.equal(item.includes("priority"), false);
  });
});

describe("Public Site C5B — TrustSection contract", () => {
  test("TrustSection is a Server Component with three philosophy pillars", () => {
    const source = readPs("components/home/TrustSection.tsx");
    const pillar = readPs("components/home/TrustPillar.tsx");
    assert.equal(source.includes('"use client"'), false);
    assert.equal(pillar.includes('"use client"'), false);
    assert.match(source, /id="homepage-trust-section"/);
    assert.match(source, /aria-labelledby="homepage-trust-heading"/);
    assert.equal(source.includes("@supabase"), false);
    assert.equal(source.includes("fetch("), false);
    assert.equal(TRUST_PILLARS.length, 3);
  });

  test("exact approved trust titles and bodies", () => {
    assert.equal(TRUST_SECTION_COPY.overline, "Why ONEDECORE");
    assert.equal(TRUST_SECTION_COPY.heading, "One vision carried through every detail");
    assert.equal(TRUST_PILLARS[0].title, "One coherent design direction");
    assert.equal(
      TRUST_PILLARS[0].body,
      "Every element is considered as part of the wider interior vision."
    );
    assert.equal(TRUST_PILLARS[1].title, "Clarity in every decision");
    assert.equal(
      TRUST_PILLARS[1].body,
      "Layouts, materials, and details are developed through a clear and considered design direction."
    );
    assert.equal(TRUST_PILLARS[2].title, "Details considered as part of the whole");
    assert.equal(
      TRUST_PILLARS[2].body,
      "Storage, finishes, proportions, and transitions are resolved together rather than in isolation."
    );
  });

  test("trust forbids stats, social proof, awards, CTA and hype", () => {
    const blob = [
      JSON.stringify(TRUST_SECTION_COPY),
      JSON.stringify(TRUST_PILLARS),
      readPs("components/home/TrustSection.tsx"),
      readPs("components/home/TrustPillar.tsx"),
    ]
      .join("\n")
      .toLowerCase();
    for (const claim of [
      "testimonial",
      "award",
      "rating",
      "warranty",
      "factory",
      "statistic",
      "trusted by",
      "expert team",
    ]) {
      assert.equal(blob.includes(claim), false, claim);
    }
    assert.equal(/\b\d+\s*%/.test(blob), false);
    const source = readPs("components/home/TrustSection.tsx");
    assert.equal(source.includes("PrimaryButton"), false);
    assert.equal(source.includes("SecondaryLink"), false);
    assert.equal(source.includes("href="), false);
  });

  test("trust uses semantic H2/H3 without icon components", () => {
    const section = readPs("components/home/TrustSection.tsx");
    const pillar = readPs("components/home/TrustPillar.tsx");
    assert.match(section, /as="h2"/);
    assert.match(pillar, /<h3/);
    assert.equal(/<\s*svg|Icon|emoji/i.test(pillar), false);
    assert.equal(/<\s*svg|Icon|emoji/i.test(section), false);
  });
});

describe("Public Site C5B — Homepage composition and deferrals", () => {
  test("canonical homepage order after C5B", () => {
    const page = readApp("(public)/(home)/page.tsx");
    const body = page.slice(page.indexOf("return"));
    const order = [
      "<HeroSection",
      "<BrandProposition",
      "<ServicesSection",
      "<FeaturedPortfolioSection",
      "<ProcessSection",
      "<MaterialStorySection",
      "<TrustSection",
    ];
    let cursor = -1;
    for (const name of order) {
      const idx = body.indexOf(name);
      assert.ok(idx > cursor, `${name} order`);
      cursor = idx;
    }
  });

  test("ConsultationBand and process/contact routes are absent", () => {
    const page = readApp("(public)/(home)/page.tsx");
    assert.equal(page.includes("ConsultationBand"), false);
    assert.equal(page.includes('href="/contact"'), false);
    assert.equal(page.includes('href="/process"'), false);
    assert.equal(page.includes("Book a Design Consultation"), false);
    assert.equal(existsSync(join(APP_ROOT, "(public)/(solid)/process")), false);
    assert.equal(existsSync(join(APP_ROOT, "(public)/(solid)/contact")), false);
    assert.equal(existsSync(join(APP_ROOT, "process")), false);
    assert.equal(existsSync(join(APP_ROOT, "contact")), false);
    assert.equal(existsSync(join(APP_ROOT, "phase2f-c5b-preview")), false);
  });

  test("C5B CSS ships process, material and trust without amber or glass", () => {
    const css = readFileSync(join(SRC_ROOT, "styles/public-site-tokens.css"), "utf8");
    assert.match(css, /\.ps-process__steps/);
    assert.match(css, /\.ps-material__grid/);
    assert.match(css, /\.ps-trust__pillars/);
    assert.equal(css.includes("#f59e0b"), false);
    assert.equal(css.includes("backdrop-filter"), false);
  });

  test("no package, migration, admin or portfolio contract drift in C5B files", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
    for (const forbidden of ["gsap", "framer-motion", "lenis", "three", "embla-carousel"]) {
      assert.equal(forbidden in (pkg.dependencies ?? {}), false, forbidden);
      assert.equal(forbidden in (pkg.devDependencies ?? {}), false, forbidden);
    }
    const c5Files = [
      "components/home/ProcessSection.tsx",
      "components/home/ProcessStep.tsx",
      "components/home/MaterialStorySection.tsx",
      "components/home/MaterialStoryItem.tsx",
      "components/home/TrustSection.tsx",
      "components/home/TrustPillar.tsx",
      "content/process.ts",
      "content/material-story.ts",
      "content/trust.ts",
      "config/material-assets.ts",
    ];
    for (const file of c5Files) {
      const source = readPs(file);
      assert.equal(source.includes('"use client"'), false, file);
      assert.equal(source.includes("@supabase"), false, file);
      assert.equal(/from\s+["']gsap/.test(source), false, file);
      assert.equal(/from\s+["']framer-motion/.test(source), false, file);
      assert.equal(/from\s+["']lenis/.test(source), false, file);
      assert.equal(/quickfurno|jarvis/i.test(source), false, file);
    }
  });
});
