/**
 * Phase 2F-R3.1 Conversion Master isolation and CTA guards.
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
const SITEMAP = join(ROOT, "src", "app", "sitemap.ts");
const HOME = join(ROOT, "src", "app", "(public)", "(home)", "page.tsx");
const PKG = join(ROOT, "package.json");

const CTA_OPEN = "Start My Interior Plan";
const CTA_SUBMIT = "Request a Design Call";
const CTA_PROJECTS = "View Projects";
const CTA_CONTINUE = "Continue My Interior Plan";

const DISALLOWED_CTA = [
  "Plan My Interiors",
  "View Our Work",
  "Start With Your Home",
  "Plan this service",
  "Continue to contact",
  "View Portfolio",
  "Book Free",
  "Get Instant",
  "saved locally",
] as const;

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

function cmUiSources() {
  return cmSources().filter(
    (f) => !f.endsWith(`${join("conversion-master", "content.ts")}`) && !f.includes("__tests__")
  );
}

test("R3.1 conversion-master route exists and is noindex", () => {
  assert.equal(existsSync(CM_ROUTE), true);
  const source = read(CM_ROUTE);
  assert.match(source, /index:\s*false/);
  assert.match(source, /follow:\s*false/);
});

test("R3.1 conversion-master is absent from sitemap", () => {
  const source = read(SITEMAP);
  assert.equal(source.includes("conversion-master"), false);
  assert.equal(source.includes("design-concepts"), false);
});

test("R3.1 production homepage unchanged by conversion master", () => {
  const source = read(HOME);
  assert.equal(source.includes("conversion-master"), false);
  assert.equal(source.includes(CTA_OPEN), false);
  assert.equal(source.includes("LeadPlanner"), false);
});

test("R3.1 CTA freeze constants are exact", () => {
  const source = read(join(CM_DIR, "content.ts"));
  assert.match(source, new RegExp(`open:\\s*"${CTA_OPEN}"`));
  assert.match(source, new RegExp(`submit:\\s*"${CTA_SUBMIT}"`));
  assert.match(source, new RegExp(`projects:\\s*"${CTA_PROJECTS}"`));
  assert.match(source, new RegExp(`continuePlan:\\s*"${CTA_CONTINUE}"`));
});

test("R3.1 disallows legacy CTA phrases outside the allowlist file", () => {
  for (const file of cmUiSources()) {
    const source = read(file);
    const rel = relative(ROOT, file);
    for (const phrase of DISALLOWED_CTA) {
      assert.equal(
        source.includes(phrase),
        false,
        `${rel} must not contain disallowed CTA phrase: ${phrase}`
      );
    }
  }
});

test("R3.1 forbids unsupported claims and QuickFurno identity", () => {
  for (const file of cmSources()) {
    if (file.includes("__tests__")) continue;
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
      "wa.me/",
      "whatsapp.com",
      "+91",
      "₹",
      'href="#"',
      "saved locally",
    ]) {
      assert.equal(
        source.includes(needle),
        false,
        `${rel} must not contain ${needle}`
      );
    }
  }
});

test("R3.1 forbids unbuilt route links", () => {
  const forbidden =
    /["'`]\/(services|process|contact|about|privacy|terms)(?=["'`/])/;
  for (const file of cmSources()) {
    if (file.includes("__tests__")) continue;
    const source = read(file);
    assert.equal(
      forbidden.test(source),
      false,
      `${relative(ROOT, file)} links to an unbuilt route`
    );
  }
});

test("R3.1 consent defaults are false in LeadContext", () => {
  const source = read(join(CM_DIR, "LeadContext.tsx"));
  assert.match(
    source,
    /whatsappConsent,\s*setWhatsappConsent\]\s*=\s*useState\(false\)/
  );
  assert.match(
    source,
    /privacyConsent,\s*setPrivacyConsent\]\s*=\s*useState\(false\)/
  );
});

test("R3.1 privacy acknowledgement copy is frozen", () => {
  const source = read(join(CM_DIR, "content.ts"));
  assert.match(
    source,
    /I agree that ONEDECORE may use these details to respond to my interior enquiry\./
  );
});

test("R3.1 success copy does not claim local save or submission", () => {
  const source = read(join(CM_DIR, "content.ts"));
  assert.match(source, /enquiry preview is ready/);
  assert.match(source, /does not submit data/);
  assert.equal(source.includes("saved locally"), false);
});

test("R3.1 premium UI does not show Category-C stand-in disclaimer", () => {
  for (const file of ["ProjectsSection.tsx", "CmHero.tsx", "ServicesSection.tsx"]) {
    const source = read(join(CM_DIR, file));
    assert.equal(source.includes("Local review note"), false);
    assert.equal(source.includes("Category-C stand-in"), false);
    assert.equal(source.includes("ARTWORK_PROVENANCE_NOTE"), false);
  }
});

test("R3.1 LeadPlanner sheet effect does not depend on full lead object", () => {
  const source = read(join(CM_DIR, "LeadPlanner.tsx"));
  assert.match(source, /\[\s*open\s*,\s*closePlanner\s*\]/);
  assert.equal(/\[\s*open\s*,\s*lead\s*\]/.test(source), false);
});

test("R3.1 CSS is scoped to conversion-master", () => {
  const css = read(join(CM_DIR, "styles", "conversion-master.css"));
  assert.match(
    css,
    /\[data-design-concept\]\[data-concept=["']conversion-master["']\]/
  );
});

test("R3.1 does not add animation packages", () => {
  const pkg = read(PKG);
  for (const needle of ["gsap", "framer-motion", "lenis", "swiper"]) {
    assert.equal(pkg.includes(needle), false);
  }
});

test("R3.1 LeadContext exposes getNextIncompleteStep and message", () => {
  const source = read(join(CM_DIR, "LeadContext.tsx"));
  assert.match(source, /getNextIncompleteStep/);
  assert.match(source, /setMessage/);
  assert.match(source, /editSubmission/);
  assert.match(source, /resetAll/);
});
