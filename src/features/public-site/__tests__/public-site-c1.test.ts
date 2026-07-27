import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import {
  PUBLIC_SITE_COLORS,
  PUBLIC_SITE_LAYOUT,
  PUBLIC_SITE_MOTION,
  PUBLIC_SITE_RADIUS,
  PUBLIC_SITE_TOKEN_SCOPE,
  PUBLIC_SITE_Z_INDEX,
  FORBIDDEN_PUBLIC_SITE_COLORS,
} from "../tokens.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Public Site C1 — Font module", () => {
  test("exports frozen CSS variable names in fonts module source", () => {
    const source = readSrc("features/public-site/fonts.ts");
    assert.ok(source.includes('display: "--font-cormorant"'));
    assert.ok(source.includes('body: "--font-inter"'));
  });

  test("next/font modules expose variable class names in source", () => {
    const source = readSrc("features/public-site/fonts.ts");
    assert.ok(source.includes("variable: \"--font-cormorant\""));
    assert.ok(source.includes("variable: \"--font-inter\""));
    assert.ok(source.includes("publicSiteFontVariables"));
  });

  test("fonts module uses next/font/google without runtime CDN URLs", () => {
    const source = readSrc("features/public-site/fonts.ts");
    assert.ok(source.includes('from "next/font/google"'));
    assert.ok(source.includes("Cormorant_Garamond"));
    assert.ok(source.includes("display: \"swap\""));
    assert.equal(source.includes("fonts.googleapis.com"), false);
  });
});

describe("Public Site C1 — Token contract", () => {
  test("canvas, charcoal and bronze anchors match frozen architecture", () => {
    assert.equal(PUBLIC_SITE_COLORS.canvas, "#F7F5F2");
    assert.equal(PUBLIC_SITE_COLORS.textPrimary, "#1A1816");
    assert.equal(PUBLIC_SITE_COLORS.accent, "#8B6F47");
  });

  test("token scope uses data-public-site attribute", () => {
    assert.equal(PUBLIC_SITE_TOKEN_SCOPE, "[data-public-site]");
  });

  test("forbidden amber template colours are not approved tokens", () => {
    const approved = Object.values(PUBLIC_SITE_COLORS).map((v) => v.toUpperCase());
    for (const forbidden of FORBIDDEN_PUBLIC_SITE_COLORS) {
      assert.equal(approved.includes(forbidden), false, `${forbidden} must not be approved`);
    }
  });

  test("CSS token file scopes variables under data-public-site", () => {
    const css = readSrc("styles/public-site-tokens.css");
    assert.ok(css.includes("[data-public-site]"));
    assert.ok(css.includes("--color-canvas: #f7f5f2"));
    assert.ok(css.includes("--color-accent: #8b6f47"));
    assert.equal(css.includes("#f59e0b"), false);
    assert.equal(css.includes("backdrop-filter"), false);
  });

  test("layout and motion tokens match frozen values", () => {
    assert.equal(PUBLIC_SITE_LAYOUT.containerContent, "1280px");
    assert.equal(PUBLIC_SITE_MOTION.ioThreshold, 0.2);
    assert.equal(PUBLIC_SITE_RADIUS.md, "4px");
    assert.equal(PUBLIC_SITE_Z_INDEX.skipLink, 100);
  });
});

describe("Public Site C1 — Primitive source contracts", () => {
  test("Container supports frozen width variants", () => {
    const source = readSrc("features/public-site/components/primitives/Container.tsx");
    assert.ok(source.includes("content:"));
    assert.ok(source.includes("wide:"));
    assert.ok(source.includes("full:"));
    assert.ok(source.includes("--container-content"));
  });

  test("Section exposes surface and spacing variants", () => {
    const source = readSrc("features/public-site/components/primitives/Section.tsx");
    assert.ok(source.includes("ps-surface-stone"));
    assert.ok(source.includes("ps-surface-dark"));
    assert.ok(source.includes("--space-32"));
  });

  test("EditorialSectionHeading uses semantic heading level prop", () => {
    const source = readSrc("features/public-site/components/primitives/EditorialSectionHeading.tsx");
    assert.ok(source.includes('as: HeadingTag = "h2"'));
    assert.ok(source.includes("ps-type-heading-2"));
    assert.ok(source.includes("max-width: 65ch") === false);
    assert.ok(source.includes("ps-type-body"));
  });

  test("PrimaryButton uses link semantics and touch target", () => {
    const source = readSrc("features/public-site/components/primitives/PrimaryButton.tsx");
    assert.ok(source.includes('from "next/link"'));
    assert.ok(source.includes("min-h-11"));
    assert.ok(source.includes("--color-accent"));
    assert.equal(source.includes("Book a Design Consultation"), false);
  });

  test("SecondaryLink includes SVG arrow and link semantics", () => {
    const source = readSrc("features/public-site/components/primitives/SecondaryLink.tsx");
    assert.ok(source.includes("<svg"));
    assert.ok(source.includes('from "next/link"'));
    assert.ok(source.includes("min-h-11"));
  });

  test("ImageFrame enforces aspect ratio variants", () => {
    const source = readSrc("features/public-site/components/primitives/ImageFrame.tsx");
    assert.ok(source.includes("aspect-[16/9]"));
    assert.ok(source.includes("aspect-[4/3]"));
    assert.ok(source.includes('from "next/image"'));
    assert.ok(source.includes("object-cover"));
  });

  test("VisuallyHidden uses robust screen-reader-only class", () => {
    const source = readSrc("features/public-site/components/primitives/VisuallyHidden.tsx");
    assert.ok(source.includes("ps-visually-hidden"));
  });

  test("SkipLink targets main-content landmark", () => {
    const source = readSrc("features/public-site/components/primitives/SkipLink.tsx");
    assert.ok(source.includes('targetId = "main-content"'));
    assert.ok(source.includes("ps-skip-link"));
    assert.ok(source.includes("Skip to main content"));
  });
});

describe("Public Site C1 — Reveal foundation", () => {
  test("Reveal is the only primitive client component in C1", () => {
    const primitiveFiles = [
      "Container.tsx",
      "Section.tsx",
      "EditorialSectionHeading.tsx",
      "PrimaryButton.tsx",
      "SecondaryLink.tsx",
      "ImageFrame.tsx",
      "VisuallyHidden.tsx",
      "SkipLink.tsx",
    ];
    for (const file of primitiveFiles) {
      const source = readSrc(`features/public-site/components/primitives/${file}`);
      assert.equal(source.includes('"use client"'), false, `${file} must remain a Server Component`);
    }
    const reveal = readSrc("features/public-site/components/primitives/Reveal.tsx");
    assert.ok(reveal.includes('"use client"'));
    const hook = readSrc("features/public-site/hooks/useReducedMotion.ts");
    assert.ok(hook.includes('"use client"'));
  });

  test("Reveal uses Intersection Observer without GSAP or Motion", () => {
    const source = readSrc("features/public-site/components/primitives/Reveal.tsx");
    assert.ok(source.includes("IntersectionObserver"));
    assert.ok(source.includes("useReducedMotion"));
    assert.ok(source.includes("ps-reveal-prep"));
    assert.equal(source.includes("gsap"), false);
    assert.equal(source.includes("framer-motion"), false);
  });

  test("Reveal progressive enhancement keeps default state visible", () => {
    const source = readSrc("features/public-site/components/primitives/Reveal.tsx");
    assert.ok(source.includes('data-reveal-state={reducedMotion ? "static" : "idle"}'));
    assert.ok(source.includes("SSR / no-JS"));
    assert.ok(source.includes("public-site-reveal-client"));
  });

  test("Reveal disconnects observer on cleanup", () => {
    const source = readSrc("features/public-site/components/primitives/Reveal.tsx");
    assert.ok(source.includes("observer.disconnect()"));
  });
});

describe("Public Site C1 — Root layout isolation", () => {
  test("root layout does not apply public-site font classes globally", () => {
    const layout = readSrc("app/layout.tsx");
    assert.equal(layout.includes("publicSiteFontVariables"), false);
    assert.equal(layout.includes("--font-cormorant"), false);
    assert.ok(layout.includes("font-sans"));
  });

  test("globals imports scoped public-site tokens only", () => {
    const globals = readSrc("app/globals.css");
    assert.ok(globals.includes("public-site-tokens.css"));
  });
});
