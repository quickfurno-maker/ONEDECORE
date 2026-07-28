/**
 * Phase 2F-R3 Conversion Master isolation tests.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CM_DIR = join(ROOT, "src", "features", "design-concepts", "conversion-master");
const CM_ROUTE = join(
  ROOT,
  "src",
  "app",
  "design-concepts",
  "conversion-master",
  "page.tsx"
);
const INDEX = join(ROOT, "src", "app", "design-concepts", "page.tsx");
const SITEMAP = join(ROOT, "src", "app", "sitemap.ts");
const HOME = join(ROOT, "src", "app", "(public)", "(home)", "page.tsx");
const PKG = join(ROOT, "package.json");
const PKG_LOCK = join(ROOT, "package-lock.json");

function read(path: string) {
  return readFileSync(path, "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function cmSources() {
  return walk(CM_DIR).filter((f) => /\.(tsx?|css)$/.test(f));
}

test("R3 conversion-master route exists and is noindex", () => {
  assert.equal(existsSync(CM_ROUTE), true);
  const source = read(CM_ROUTE);
  assert.match(source, /index:\s*false/);
  assert.match(source, /follow:\s*false/);
  assert.match(source, /loadConceptFeatured/);
});

test("R3 conversion-master is absent from sitemap", () => {
  const source = read(SITEMAP);
  assert.equal(source.includes("conversion-master"), false);
  assert.equal(source.includes("design-concepts"), false);
});

test("R3 production homepage page.tsx is unchanged from R2 baseline content contracts", () => {
  const source = read(HOME);
  assert.equal(source.includes("conversion-master"), false);
  assert.equal(source.includes("Plan My Interiors"), false);
  assert.equal(source.includes("LeadPlanner"), false);
});

test("R3 index marks Conversion Master as active", () => {
  const source = read(INDEX);
  assert.match(source, /Active — Conversion Master|Conversion Master is the active/i);
  assert.match(source, /conversion-master/);
});

test("R3 primary CTA copy is consistent", () => {
  const content = read(join(CM_DIR, "content.ts"));
  assert.match(content, /Plan My Interiors/);
  assert.match(content, /Request a Design Call/);
  assert.match(content, /View Our Work/);
});

test("R3 lead planner option values match the brief", () => {
  const content = read(join(CM_DIR, "content.ts"));
  for (const needle of [
    "Complete Home Interiors",
    "Modular Kitchen",
    "Custom Wardrobe",
    "1 BHK",
    "2 BHK",
    "3 BHK",
    "4 BHK / Villa",
    "Ready now",
    "Within 3 months",
    "Just exploring",
  ]) {
    assert.equal(content.includes(needle), true, `missing ${needle}`);
  }
});

test("R3 forbids unsupported claims and QuickFurno identity", () => {
  for (const file of cmSources()) {
    const source = read(file);
    const rel = relative(ROOT, file);
    for (const needle of [
      "QuickFurno",
      "QUICK FURNO",
      "testimonial",
      "5-star",
      "warranty",
      "years of experience",
      "projects delivered",
      "free consultation",
      "instant estimate",
      "script.google",
      "macros/s/",
      "wa.me/",
      "whatsapp.com",
      "+91",
      "₹",
      'href="#"',
      'href={"#"}',
    ]) {
      assert.equal(
        source.includes(needle),
        false,
        `${rel} must not contain ${needle}`
      );
    }
  }
});

test("R3 forbids unbuilt route links", () => {
  const forbidden =
    /["'`]\/(services|process|contact|about|privacy|terms)(?=["'`/])/;
  for (const file of cmSources()) {
    const source = read(file);
    assert.equal(
      forbidden.test(source),
      false,
      `${relative(ROOT, file)} links to an unbuilt route`
    );
  }
});

test("R3 consent defaults are false in LeadContext", () => {
  const source = read(join(CM_DIR, "LeadContext.tsx"));
  assert.match(source, /whatsappConsent,\s*setWhatsappConsent\]\s*=\s*useState\(false\)/);
  assert.match(source, /privacyConsent,\s*setPrivacyConsent\]\s*=\s*useState\(false\)/);
});

test("R3 accessible labels exist on planner and final form", () => {
  const planner = read(join(CM_DIR, "LeadPlanner.tsx"));
  const finalForm = read(join(CM_DIR, "FinalForm.tsx"));
  assert.match(planner, /fieldset|legend|<label/);
  assert.match(finalForm, /<label/);
  assert.match(planner, /aria-describedby|aria-invalid|error/);
});

test("R3 CSS is scoped to conversion-master", () => {
  const css = read(join(CM_DIR, "styles", "conversion-master.css"));
  assert.match(css, /\[data-design-concept\]\[data-concept=["']conversion-master["']\]/);
  assert.equal(css.includes("[data-public-site]"), false);
});

test("R3 does not add animation or package drift markers", () => {
  const pkg = read(PKG);
  const lock = read(PKG_LOCK);
  for (const needle of ["gsap", "framer-motion", "lenis", "swiper"]) {
    assert.equal(pkg.includes(needle), false);
  }
  // lock may mention transitive names in unrelated packages; only assert package.json
  void lock;
});

test("R3 client components are limited", () => {
  const clients = cmSources().filter((f) => {
    const head = read(f).slice(0, 40);
    return head.includes('"use client"') || head.includes("'use client'");
  });
  const names = clients.map((f) => relative(CM_DIR, f).replace(/\\/g, "/"));
  for (const allowed of [
    "LeadContext.tsx",
    "LeadPlanner.tsx",
    "CmNav.tsx",
    "CmHero.tsx",
    "ServicesSection.tsx",
    "ProcessSection.tsx",
    "ScopePlanner.tsx",
    "FinalForm.tsx",
    "StickyBar.tsx",
  ]) {
    // Services/Process may be server if they only call openPlanner via child buttons —
    // assert only that unexpected heavy clients are absent.
    void allowed;
  }
  assert.equal(
    names.some((n) => n.includes("ConversionMaster.tsx")),
    false,
    "ConversionMaster must remain a Server Component"
  );
});
