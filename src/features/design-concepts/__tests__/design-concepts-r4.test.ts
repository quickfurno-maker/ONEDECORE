/**
 * Phase 2F-R4 Premium Motion Homepage isolation, honesty, and motion guards.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const PM_DIR = join(ROOT, "src", "features", "design-concepts", "premium-motion");
const PM_CSS = join(PM_DIR, "styles", "premium-motion.css");
const PM_CONTENT = join(PM_DIR, "content.ts");
const PM_ROUTE = join(
  ROOT,
  "src",
  "app",
  "design-concepts",
  "premium-motion-homepage",
  "page.tsx"
);
const DC_LAYOUT = join(ROOT, "src", "app", "design-concepts", "layout.tsx");
const DC_INDEX = join(ROOT, "src", "app", "design-concepts", "page.tsx");
const SITEMAP = join(ROOT, "src", "app", "sitemap.ts");
const HOME = join(ROOT, "src", "app", "(public)", "(home)", "page.tsx");
const PKG = join(ROOT, "package.json");
const PUBLIC_DIR = join(ROOT, "public");

const CONCEPT_ATTR = '[data-concept="premium-motion"]';

const CTA_OPEN = "Start My Interior Plan";
const CTA_SUBMIT = "Request a Design Call";
const CTA_PROJECTS = "View Projects";
const CTA_CONTINUE = "Continue My Interior Plan";

/** Phrases that would imply a claim, price, or identity ONEDECORE has not given. */
const FORBIDDEN_SUBSTRINGS = [
  "QuickFurno",
  "quickfurno",
  "Livspace",
  "HomeLane",
  "Lakhs",
  "₹",
  "warranty",
  "Warranty",
  "years of experience",
  "happy customers",
  "projects completed",
  "5-star",
  "rating",
  "testimonial",
  "Testimonial",
  "guarantee",
  "Guarantee",
  "factory",
  "Factory",
  "free consultation",
  "Free Consultation",
  "45 days",
  "saved locally",
  "wa.me",
  "whatsapp.com",
] as const;

/** Only routes that exist in this repository may be linked from the concept. */
const ALLOWED_INTERNAL_HREFS = [
  "/portfolio",
  "/design-concepts",
  "/design-concepts/premium-motion-homepage",
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Claims guards inspect shipped copy, not the notes explaining what is banned. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function pmSources(): string[] {
  return walk(PM_DIR).filter((file) => /\.(tsx?|css)$/.test(file));
}

function pmNonTestSources(): string[] {
  return pmSources().filter((file) => !file.includes("__tests__"));
}

test("R4 route exists, is noindex, and is server-rendered", () => {
  assert.equal(existsSync(PM_ROUTE), true);
  const source = read(PM_ROUTE);
  assert.match(source, /index:\s*false/);
  assert.match(source, /follow:\s*false/);
  assert.match(source, /nocache:\s*true/);
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /loadConceptFeatured/);
});

test("R4 route is absent from the sitemap", () => {
  const source = read(SITEMAP);
  assert.equal(source.includes("premium-motion"), false);
  assert.equal(source.includes("design-concepts"), false);
});

test("R4 does not leak into the production homepage", () => {
  const source = read(HOME);
  assert.equal(source.includes("premium-motion"), false);
  assert.equal(source.includes("PremiumMotionHomepage"), false);
  assert.equal(source.includes(CTA_OPEN), false);
  assert.equal(source.includes("PlanProvider"), false);
});

test("R4 stylesheet is registered in the concept layout only", () => {
  const layout = read(DC_LAYOUT);
  assert.match(
    layout,
    /premium-motion\/styles\/premium-motion\.css/,
    "concept layout must import the R4 stylesheet"
  );
});

test("R4 overview card links the concept route", () => {
  const index = read(DC_INDEX);
  assert.match(index, /\/design-concepts\/premium-motion-homepage/);
  assert.match(index, /Premium Motion Homepage/);
});

test("R4 CSS is double-scoped and never bare", () => {
  const css = read(PM_CSS);
  assert.match(css, /\[data-design-concept\]\[data-concept="premium-motion"\]/);

  const ruleSelectors = css
    // strip comments so commented examples cannot fail the guard
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((block) => block.split("{")[0]?.trim() ?? "")
    .filter(Boolean)
    .filter(
      (selector) =>
        !selector.startsWith("@") &&
        !/^(from|to|\d+%)$/.test(selector) &&
        !selector.includes("prefers-reduced-motion")
    );

  for (const selector of ruleSelectors) {
    // Keyframe steps and at-rule bodies are already filtered out above.
    if (/^(from|to)$/.test(selector) || /^\d+%/.test(selector)) continue;
    assert.ok(
      selector.includes(CONCEPT_ATTR),
      `every R4 rule must be scoped to the concept: "${selector}"`
    );
  }
});

test("R4 CSS honours reduced motion", () => {
  const css = read(PM_CSS);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important/);
});

test("R4 adds no animation or UI packages", () => {
  const pkg = JSON.parse(read(PKG)) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const banned of [
    "gsap",
    "framer-motion",
    "motion",
    "lenis",
    "@studio-freight/lenis",
    "locomotive-scroll",
    "swiper",
    "three",
    "aos",
    "animejs",
    "react-spring",
    "@react-spring/web",
  ]) {
    assert.equal(
      Object.hasOwn(all, banned),
      false,
      `R4 must not introduce ${banned}`
    );
  }
});

test("R4 CTA freeze constants are exact", () => {
  const source = read(PM_CONTENT);
  assert.match(source, new RegExp(`open:\\s*"${CTA_OPEN}"`));
  assert.match(source, new RegExp(`submit:\\s*"${CTA_SUBMIT}"`));
  assert.match(source, new RegExp(`projects:\\s*"${CTA_PROJECTS}"`));
  assert.match(source, new RegExp(`continuePlan:\\s*"${CTA_CONTINUE}"`));
});

test("R4 forbids unsupported claims and foreign brand identity", () => {
  for (const file of pmNonTestSources()) {
    const source = withoutComments(read(file));
    const rel = relative(ROOT, file);
    for (const phrase of FORBIDDEN_SUBSTRINGS) {
      assert.equal(
        source.includes(phrase),
        false,
        `${rel} must not contain "${phrase}"`
      );
    }
  }
});

test("R4 uses no remote image or script sources", () => {
  for (const file of pmNonTestSources()) {
    const source = read(file);
    const rel = relative(ROOT, file);
    assert.equal(
      /https?:\/\//.test(source),
      false,
      `${rel} must not reference an absolute remote URL`
    );
  }
});

test("R4 links only routes that exist", () => {
  const pattern = /href=(?:"|\{")(\/[^"#]*)(?:"|"\})/g;
  for (const file of pmNonTestSources()) {
    const source = read(file);
    const rel = relative(ROOT, file);
    for (const match of source.matchAll(pattern)) {
      const href = match[1]!;
      assert.ok(
        (ALLOWED_INTERNAL_HREFS as readonly string[]).includes(href) ||
          href.startsWith("/portfolio/"),
        `${rel} links an unbuilt route: ${href}`
      );
    }
  }
});

test("R4 consent defaults are false and privacy is unlinked", () => {
  const context = read(join(PM_DIR, "PlanContext.tsx"));
  assert.match(
    context,
    /const \[whatsappConsent, setWhatsappConsent\] = useState\(false\)/
  );
  assert.match(
    context,
    /const \[privacyConsent, setPrivacyConsent\] = useState\(false\)/
  );

  const content = read(PM_CONTENT);
  assert.match(
    content,
    /privacyUrl: null as string \| null/,
    "privacy route does not exist yet, so it must stay unlinked"
  );
});

test("R4 success copy does not claim storage or submission", () => {
  const content = read(PM_CONTENT);
  assert.match(content, /does not submit data/);
  assert.equal(content.includes("saved"), false);
  assert.equal(content.includes("submitted successfully"), false);
});

test("R4 sheet overlay effect does not depend on the whole plan object", () => {
  const planner = read(join(PM_DIR, "PmPlanner.tsx"));
  assert.match(
    planner,
    /\}, \[open, closePlanner\]\);/,
    "the overlay effect must depend only on open and closePlanner"
  );
  assert.match(planner, /document\.body\.style\.overflow = "hidden"/);
  assert.match(planner, /event\.key === "Escape"/);
  assert.match(planner, /aria-modal="true"/);
});

test("R4 declares exactly one H1", () => {
  const h1Files = pmNonTestSources().filter((file) => read(file).includes("<h1"));
  assert.deepEqual(
    h1Files.map((file) => relative(ROOT, file)),
    [relative(ROOT, join(PM_DIR, "PmHero.tsx"))]
  );
  const hero = read(join(PM_DIR, "PmHero.tsx"));
  assert.equal(hero.split("<h1").length - 1, 1);
});

test("R4 marketing assets exist locally and are declared with sizes", () => {
  const content = read(PM_CONTENT);
  const paths = [...content.matchAll(/path: "(\/marketing\/r4\/[^"]+)"/g)].map(
    (match) => match[1]!
  );
  assert.ok(paths.length >= 7, "R4 must ship at least seven marketing assets");

  for (const assetPath of paths) {
    const onDisk = join(PUBLIC_DIR, assetPath.replace(/\//g, "\\"));
    assert.equal(
      existsSync(onDisk),
      true,
      `declared asset is missing on disk: ${assetPath}`
    );
    assert.match(assetPath, /\.webp$/, `${assetPath} must be webp`);
  }
});

test("R4 marketing artwork is never declared as project photography", () => {
  const content = read(PM_CONTENT);
  const categories = [...content.matchAll(/provenanceCategory: "([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.ok(categories.length >= 7);
  for (const category of categories) assert.equal(category, "C");

  const claims = [...content.matchAll(/depictsCompletedProject: (\w+)/g)].map(
    (match) => match[1]
  );
  assert.ok(claims.length >= 7);
  for (const claim of claims) assert.equal(claim, "false");
});

test("R4 portfolio proof stays CMS-driven with an honest empty state", () => {
  const projects = read(join(PM_DIR, "PmProjects.tsx"));
  assert.match(projects, /PublicPortfolioCard/);
  assert.match(projects, /emptyHeading/);
  assert.match(projects, /emptyBody/);
  assert.equal(
    projects.includes("/marketing/r4/"),
    false,
    "portfolio proof must not fall back to marketing artwork"
  );
});

test("R4 keeps one shared plan journey", () => {
  const entryPoints = ["PmHero.tsx", "PmNav.tsx", "PmServices.tsx", "PmProcess.tsx", "PmSticky.tsx"];
  for (const file of entryPoints) {
    const source = read(join(PM_DIR, file));
    assert.match(
      source,
      /usePlan\(\)/,
      `${file} must route its CTA through the shared plan context`
    );
  }
  const close = read(join(PM_DIR, "PmClose.tsx"));
  assert.match(close, /usePlan\(\)/);
  assert.equal(
    close.includes("useState<PmServiceId"),
    false,
    "the closing section must not hold its own service state"
  );
});

test("R4.1 mobile hero uses overlay media plus first-viewport copy actions", () => {
  const hero = read(join(PM_DIR, "PmHero.tsx"));
  assert.match(hero, /pm-hero__media/);
  assert.match(hero, /pm-hero__mediaScrim/);
  assert.match(hero, /pm-hero__actions/);
  assert.match(hero, /PM_HERO\.primaryCta/);
  assert.match(hero, /PM_HERO\.secondaryCta/);
});

test("R4.1 FAQ does not use the broken hidden attribute pattern", () => {
  const faq = read(join(PM_DIR, "PmFaq.tsx"));
  assert.equal(faq.includes("hidden={!"), false);
  assert.equal(faq.includes("hidden={"), false);
  assert.match(faq, /aria-expanded/);
  assert.match(faq, /aria-controls/);
  assert.match(faq, /pm-faq__panel/);
});

test("R4.1 CTA freeze uses Continue for steps and resume label separately", () => {
  const content = read(PM_CONTENT);
  assert.match(content, /continueLabel:\s*"Continue"/);
  assert.match(content, /resumeLabel:\s*PM_CTA\.continuePlan/);
  assert.match(content, /continuePlan:\s*"Continue My Interior Plan"/);

  const planner = read(join(PM_DIR, "PmPlanner.tsx"));
  assert.match(planner, /PM_PLANNER\.continueLabel/);
  assert.match(planner, /PM_PLANNER\.resumeLabel/);
});

test("R4.1 hero entrance opacity is gated behind reduced-motion preference", () => {
  const css = read(PM_CSS);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /\.pm-hero__mediaScrim/);
  assert.match(css, /align-items:\s*flex-end/);
});

test("R4.1 close section has no service option grids", () => {
  const close = read(join(PM_DIR, "PmClose.tsx"));
  assert.equal(close.includes("PM_PLANNER.services.map"), false);
  assert.equal(close.includes("type=\"radio\""), false);
  assert.match(close, /pm-summary/);
  assert.match(close, /Request a Design Call|PM_CLOSE\.submitLabel/);
});
