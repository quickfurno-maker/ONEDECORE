/**
 * L1 — public launch acceptance, asserted from source.
 *
 * WHAT THIS SUITE IS FOR
 *
 * The public site is about to receive paid traffic. This file pins the
 * properties that make that safe, and each one exists because the L0/L1 audit
 * found it either broken or one careless edit away from breaking:
 *
 *   - marketing HTML must not be cacheable for a year by a shared cache;
 *   - the storefront must stay contained while the funnel is interiors-only;
 *   - the site must say where the business is without offering a way
 *     around the consultation form;
 *   - no page may become a dead end;
 *   - and no analytics, Pixel or tag manager may appear before L2 has
 *     corrected the legal copy that currently says none exists.
 *
 * That last one is the important one. Installing a tag is a two-line change
 * that anybody could make in good faith, and doing it before L2 would make the
 * published Privacy Notice false. The refusal is asserted, not remembered.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { PUBLIC_HTML_REVALIDATE_SECONDS } from "../../../config/public-cache.ts";
import {
  PUBLIC_CONSULTATION,
  PUBLIC_FOOTER_LEGAL,
  PUBLIC_NAV_CORE,
  PUBLIC_NAV_SHOP,
  getPublicNavDestinations,
} from "../chrome/public-nav.ts";
import { BUSINESS_IDENTITY } from "../../legal/business-identity.ts";
import {
  PUBLIC_CLAIM_IDS,
  PUBLIC_CLAIM_EVIDENCE,
  getUnevidencedClaimIds,
  isClaimPubliclyEvidenced,
} from "../../legal/claim-evidence.ts";
import {
  canPublishWarrantyPolicy,
  getLegalRobots,
  isWarrantyPublicationReady,
  LEGAL_PUBLICATION_MODE,
} from "../../legal/legal-publication.ts";
import {
  canQuotePublicClaim,
  publicClaimLabel,
  resolvePublicClaim,
} from "../home-r4/claims.ts";
import { canShowAggregateReviewSummary } from "../home-r4/reviews.ts";
import {
  PM_FAQS,
  PM_FOOTER,
  PM_NAV_ITEMS,
  PM_REVIEWS,
  PM_REVIEWS_NAV_LABEL,
  resolveFaqEntry,
} from "../home-r4/content.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips comments: these files DESCRIBE the tags they refuse to load. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const HOME = "src/app/page.tsx";
const INTERIORS = "src/app/interiors/page.tsx";
const ROBOTS = "src/app/robots.ts";
const SITEMAP = "src/app/sitemap.ts";
const ROOT_LAYOUT = "src/app/layout.tsx";
const FOOTER = "src/features/public-site/chrome/PublicSiteFooter.tsx";
const HEADER = "src/features/public-site/chrome/PublicSiteHeader.tsx";
const PORTFOLIO_GRID = "src/features/portfolio/public/components/PortfolioGrid.tsx";
const LEGAL_METADATA = "src/features/legal/legal-metadata.ts";

const LEGAL_PAGES = [
  "src/app/(legal)/privacy/page.tsx",
  "src/app/(legal)/terms/page.tsx",
  "src/app/(legal)/communication-consent/page.tsx",
  "src/app/(legal)/data-rights/page.tsx",
  "src/app/(legal)/warranty/page.tsx",
] as const;

/** Every statically prerendered public page. */
const PRERENDERED_PUBLIC_PAGES = [HOME, INTERIORS, ...LEGAL_PAGES] as const;

/* ========================================================================== */
/* 1. Cache policy — the L1 launch blocker                                     */
/* ========================================================================== */

describe("public marketing HTML is not frozen for a year", () => {
  /*
   * A prerendered Next page that declares no `revalidate` is served with
   * `Cache-Control: s-maxage=31536000`. Verified against a local production
   * build: with these exports the header becomes
   * `s-maxage=300, stale-while-revalidate=...`.
   */
  test("the policy is one number, and it is minutes rather than a year", () => {
    assert.equal(PUBLIC_HTML_REVALIDATE_SECONDS, 300);
    assert.ok(
      PUBLIC_HTML_REVALIDATE_SECONDS > 0 &&
        PUBLIC_HTML_REVALIDATE_SECONDS <= 3600,
      "a shared cache must refresh public HTML within the hour"
    );
  });

  for (const rel of PRERENDERED_PUBLIC_PAGES) {
    test(`${rel} declares that policy`, () => {
      const source = read(rel);
      const match = source.match(/export const revalidate = (\d+);/);
      assert.ok(match, `${rel} must export a revalidate`);
      /*
       * The literal is required: Next reads a route segment config by static
       * analysis, so an imported constant is rejected at build time. This
       * assertion is what keeps the seven literals and the one decision in
       * agreement.
       */
      assert.equal(
        Number(match![1]),
        PUBLIC_HTML_REVALIDATE_SECONDS,
        `${rel} must match PUBLIC_HTML_REVALIDATE_SECONDS`
      );
    });
  }

  test("no public page opts out of caching wholesale instead", () => {
    // `no-store` on a landing page would trade the blocker for a slow page.
    for (const rel of PRERENDERED_PUBLIC_PAGES) {
      assert.doesNotMatch(
        code(read(rel)),
        /export const dynamic = "force-dynamic"/,
        `${rel} should stay prerendered`
      );
    }
  });

  test("the homepage's runtime gates are re-read, not frozen at build", () => {
    /*
     * `/` reads `isShopPublicEnabled()`, a runtime environment gate. Fully
     * static, that gate was fixed at build time while the `force-dynamic`
     * sitemap read it live — so turning the storefront off would have produced
     * a sitemap without /shop and a homepage still advertising it. A revalidate
     * window is what makes the two agree.
     */
    const home = code(read(HOME));
    assert.match(home, /isShopPublicEnabled\(\)/);
    assert.match(home, /export const revalidate = \d+;/);
  });
});

/* ========================================================================== */
/* 2. No tags before L2                                                        */
/* ========================================================================== */

describe("no analytics, Pixel or tag manager exists yet", () => {
  /*
   * `data-inventory.ts` and `processor-register.ts` currently state, in
   * published legal copy, that no analytics, Meta Pixel or advertising cookie
   * is approved. Until L2 corrects that copy, adding a tag would make the
   * published Privacy Notice false. This is the guard on that ordering.
   */
  const FORBIDDEN_TAGS = [
    "googletagmanager",
    "connect.facebook.net",
    "www.google-analytics.com",
    "gtag(",
    "fbq(",
    "dataLayer",
    "GTM-",
    "next/script",
  ] as const;

  const SURFACES = [
    ROOT_LAYOUT,
    HOME,
    INTERIORS,
    FOOTER,
    HEADER,
    "src/features/public-site/discovery/DiscoveryHomePage.tsx",
  ] as const;

  for (const rel of SURFACES) {
    test(`${rel} loads no third-party tag`, () => {
      const source = read(rel);
      for (const tag of FORBIDDEN_TAGS) {
        assert.ok(
          !source.includes(tag),
          `${rel} must not reference ${tag} before L2/L3`
        );
      }
    });
  }

  test("the root layout still ships no third-party script at all", () => {
    const layout = code(read(ROOT_LAYOUT));
    assert.doesNotMatch(layout, /<script/i);
    assert.doesNotMatch(layout, /<Script/);
  });
});

/* ========================================================================== */
/* 3. Storefront containment — the funnel is interiors only                     */
/* ========================================================================== */

describe("the storefront stays contained while the funnel is interiors-only", () => {
  test("Shop is appended to the public nav only when the gate is on", () => {
    const off = getPublicNavDestinations(false);
    const on = getPublicNavDestinations(true);
    assert.ok(
      off.every((item) => !item.href.startsWith("/shop")),
      "gate off must offer no /shop destination"
    );
    assert.deepEqual([...on], [...PUBLIC_NAV_CORE, PUBLIC_NAV_SHOP]);
  });

  test("header and footer default to the gate being off", () => {
    for (const rel of [HEADER, FOOTER]) {
      assert.match(
        read(rel),
        /shopEnabled = false/,
        `${rel} must fail closed`
      );
    }
  });

  test("shop utilities are gated too, not just the nav entry", () => {
    const header = code(read(HEADER));
    // Search and cart are commerce navigation; they must not survive the gate.
    assert.match(header, /const showSearch =\s*\n?\s*shopEnabled &&/);
    assert.match(header, /const showCart = shopEnabled &&/);
  });

  test("the sitemap lists /shop only behind the same gate", () => {
    const sitemap = code(read(SITEMAP));
    const shopAt = sitemap.indexOf('absoluteUrl("shop")');
    const gateAt = sitemap.indexOf("if (shopPublic)");
    assert.ok(gateAt > 0 && shopAt > gateAt, "/shop must sit inside the gate");
  });

  test("the interiors funnel pages carry no storefront link", () => {
    for (const rel of [INTERIORS, PORTFOLIO_GRID]) {
      assert.doesNotMatch(
        read(rel),
        /href=["']\/shop/,
        `${rel} must not divert campaign traffic into commerce`
      );
    }
  });
});

/* ========================================================================== */
/* 4. The site publishes a way to reach the business                           */
/* ========================================================================== */

describe("the public site says where the business is, without leaking the funnel", () => {
  const footer = read(FOOTER);

  test("the address and service area come from the owner-recorded identity", () => {
    /*
     * The legal documents are generated from BUSINESS_IDENTITY. Typing an
     * address into the footer as well would let the site and the Privacy
     * Notice drift apart silently — and a Google Business Profile listing has
     * to agree with both.
     */
    assert.match(footer, /BUSINESS_IDENTITY\.registeredOfficeAddress/);
    assert.match(footer, /BUSINESS_IDENTITY\.serviceRegion/);
    assert.match(footer, /<address/);
  });

  test("the marketing UI still offers NO alternative to the consultation form", () => {
    /*
     * A locked prior decision, and the launch plan depends on it: an e-mail or
     * phone link on a marketing page produces enquiries that never reach CRM
     * and carry no attribution, which is precisely what L7 exists to prevent.
     * The published business address stays on the legal pages as a governance
     * contact. L1 did not relax this to add a footer contact block.
     */
    assert.doesNotMatch(footer, /onedecore@gmail\.com/);
    assert.doesNotMatch(code(footer), /href="tel:/);
    assert.doesNotMatch(footer, /BUSINESS_IDENTITY\.businessEmail/);
    assert.match(footer, /PUBLIC_CONSULTATION\.(href|shortLabel)/);
  });

  test("a channel the owner has not recorded is not invented anywhere", () => {
    assert.equal(BUSINESS_IDENTITY.businessPhoneE164, null);
    for (const rel of [FOOTER, HEADER, HOME, INTERIORS]) {
      assert.doesNotMatch(
        code(read(rel)),
        /href="tel:\+?\d/,
        `${rel} must not publish a phone number the owner has not recorded`
      );
    }
  });

  test("no WhatsApp destination is invented in source", () => {
    /*
     * L1.1 replaced the hard-coded `null` with
     * NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164, validated. The requirement is
     * unchanged — no number is invented — and the button is absent rather than
     * dead when nothing valid is configured.
     */
    const contact = read("src/features/public-site/chrome/public-contact.ts");
    assert.match(contact, /NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164/);
    assert.doesNotMatch(contact, /wa\.me\/\d/);
    assert.doesNotMatch(contact, /\+\d{8,}/);
    for (const rel of [FOOTER, HEADER, HOME, INTERIORS]) {
      assert.doesNotMatch(
        read(rel),
        /wa\.me|api\.whatsapp\.com/,
        `${rel} must not hard-code a WhatsApp link`
      );
    }
  });

  test("every legal document is reachable from the footer", () => {
    assert.deepEqual(
      PUBLIC_FOOTER_LEGAL.map((item) => item.href),
      [
        "/privacy",
        "/terms",
        "/data-rights",
        "/communication-consent",
        "/warranty",
      ]
    );
    assert.match(footer, /PUBLIC_FOOTER_LEGAL\.map/);
  });
});

/* ========================================================================== */
/* 5. No dead ends                                                             */
/* ========================================================================== */

describe("no public page leaves the visitor without a next step", () => {
  test("an empty portfolio offers the consultation, not a link to itself", () => {
    /*
     * The reset link is the right answer to a filter that matched nothing and
     * the wrong answer to a portfolio with nothing in it — it returns the
     * visitor to the page they are already on. The live portfolio is currently
     * empty, so this is the state real ad traffic would meet.
     */
    const grid = read(PORTFOLIO_GRID);
    assert.match(grid, /activeService \?/);
    assert.match(grid, /portfolio-empty-reset-button/);
    assert.match(grid, /portfolio-empty-consultation-button/);
    assert.match(grid, /PUBLIC_CONSULTATION\.href/);
  });

  test("the consultation target is one canonical destination", () => {
    assert.equal(PUBLIC_CONSULTATION.href, "/#consultation");
    for (const rel of [FOOTER, HEADER]) {
      assert.match(read(rel), /PUBLIC_CONSULTATION\.href/, rel);
    }
  });
});

/* ========================================================================== */
/* 6. Indexability                                                             */
/* ========================================================================== */

describe("crawlers are pointed at the launch surface and away from the rest", () => {
  test("internal and token-gated routes are disallowed", () => {
    const robots = read(ROBOTS);
    for (const path of ["/admin/", "/api/admin/", "/auth/", "/manager/", "/q/"]) {
      assert.ok(robots.includes(`"${path}"`), `robots must disallow ${path}`);
    }
  });

  test("the legal pages are submitted only while they are indexable", () => {
    const sitemap = code(read(SITEMAP));
    assert.match(sitemap, /getLegalRobots\(\)\.index/);
    for (const path of [
      "privacy",
      "terms",
      "data-rights",
      "communication-consent",
      "warranty",
    ]) {
      assert.ok(
        sitemap.includes(`"${path}"`),
        `the sitemap must list ${path} when published`
      );
    }
  });

  test("a legal page declares a canonical only when it is indexable", () => {
    /*
     * A draft is `noindex` and is not the canonical address of anything. A
     * published page is indexable and now appears in the sitemap, so it must
     * say where it lives or the submitted URL has no canonical to agree with.
     */
    const meta = code(read(LEGAL_METADATA));
    assert.match(meta, /canonical: robots\.index \?/);
    assert.match(meta, /absoluteUrl\(/);
  });

  test("the launch pages declare their own canonical and OpenGraph", () => {
    for (const rel of [HOME, INTERIORS]) {
      const source = read(rel);
      assert.match(source, /alternates: \{ canonical:/, rel);
      assert.match(source, /openGraph: \{/, rel);
      assert.match(source, /robots: \{ index: true, follow: true \}/, rel);
    }
  });
});

/* ========================================================================== */
/* 7. The consultation funnel is untouched                                     */
/* ========================================================================== */

describe("L1 did not disturb the working lead funnel", () => {
  /*
   * THE FUNNEL IS ONE FORM NOW.
   *
   * `ConsultationLeadForm` was one of four public lead forms and is deleted.
   * The guarantees below moved to the canonical brief — and one of them
   * INVERTED: consent used to be two visible checkboxes plus an optional
   * WhatsApp box, and is now a single combined consent. An optional consent
   * nobody is shown must be ABSENT from the request, never recorded as false.
   */
  const form = read("src/features/lead-intake/public/UnifiedLeadBrief.tsx");

  test("one visible consent, and no marketing consent is fabricated", () => {
    assert.match(form, /SINGLE_CONSENT_CONCISE_COPY/);
    assert.doesNotMatch(code(form), /serviceEnquiryConsent|servicePhoneConsent/);
    assert.doesNotMatch(code(form), /whatsappService/);
    for (const forbidden of [
      "marketingConsent",
      "promotionalConsent",
      "marketing: true",
    ]) {
      assert.ok(
        !form.includes(forbidden),
        `the public form must not fabricate ${forbidden}`
      );
    }
  });

  test("the Indian phone UX is still declared", () => {
    assert.match(form, /national-10/);
  });

  test("attribution collection is unchanged — persistence is L3A, not L1", () => {
    const attribution = read(
      "src/features/lead-intake/public/lead-form-attribution.ts"
    );
    assert.match(attribution, /collectLeadFormAttribution/);
    // L1 must not quietly start writing cookies or storage for attribution.
    assert.doesNotMatch(code(attribution), /localStorage|sessionStorage|document\.cookie/);
  });
});

/* ========================================================================== */
/* 8. Warranty answers to its own gate, not the global legal one               */
/* ========================================================================== */

describe("a legal document that is not publication-ready is not indexed", () => {
  test("the global legal gate is open and warranty's is not", () => {
    /*
     * The two are genuinely independent. Privacy, Terms, Data Rights and
     * Communication Consent are published together. Warranty carries its own
     * readiness — owner approval, category periods, a claims contact — and none
     * of those is satisfied.
     */
    assert.equal(LEGAL_PUBLICATION_MODE, "published");
    assert.equal(getLegalRobots().index, true);
    assert.equal(canPublishWarrantyPolicy(), false);
  });

  test("an unready document is forced to noindex, nofollow", () => {
    /*
     * `legal-metadata.ts` imports through the `@/` alias, which plain node
     * cannot resolve, so its decision is read rather than executed. The
     * behaviour under test is the override itself: `published: false` must beat
     * the global gate, not merely be considered alongside it.
     */
    const meta = code(read(LEGAL_METADATA));
    assert.match(meta, /input\.published === false/);
    assert.match(meta, /\{ index: false, follow: false \}/);
    assert.match(meta, /const globalRobots = getLegalRobots\(\)/);
  });

  test("the canonical follows indexability, so an unready page has none", () => {
    const meta = code(read(LEGAL_METADATA));
    assert.match(meta, /canonical: robots\.index \?/);
    // `robots` is the OVERRIDDEN value, not the global one.
    const robotsAt = meta.indexOf("const robots =");
    const canonicalAt = meta.indexOf("canonical: robots.index");
    assert.ok(robotsAt > 0 && canonicalAt > robotsAt);
  });

  test("the warranty page passes its own readiness, not the global gate", () => {
    const page = read("src/app/(legal)/warranty/page.tsx");
    assert.match(page, /published: canPublishWarrantyPolicy\(\)/);
  });

  test("the four globally published documents are unaffected", () => {
    // They pass no override, so they keep the global gate, which is open.
    for (const rel of LEGAL_PAGES) {
      if (rel.includes("warranty")) continue;
      assert.doesNotMatch(
        read(rel),
        /published:/,
        `${rel} must keep riding the global legal gate`
      );
    }
    assert.equal(getLegalRobots().index, true);
    // And the default path of the builder is the global gate.
    assert.match(code(read(LEGAL_METADATA)), /readonly published\?: boolean;/);
  });

  test("warranty is absent from the sitemap while unready", () => {
    const sitemap = code(read(SITEMAP));
    const loopStart = sitemap.indexOf("const LEGAL_PATHS");
    const loopEnd = sitemap.indexOf("] as const;", loopStart);
    assert.ok(loopStart > 0);
    assert.ok(
      !sitemap.slice(loopStart, loopEnd).includes("warranty"),
      "warranty must not ride the global legal gate"
    );
    assert.match(sitemap, /if \(canPublishWarrantyPolicy\(\)\)/);
    const gateAt = sitemap.indexOf("if (canPublishWarrantyPolicy())");
    const pushAt = sitemap.indexOf('absoluteUrl("warranty")');
    assert.ok(pushAt > gateAt, "warranty must be pushed only inside its own gate");
  });

  test("a ready warranty would become indexable, canonical and listed", () => {
    /*
     * The gate is a real switch, not a permanent refusal. Only `published:
     * false` forces noindex, so a ready warranty takes the global (open) gate
     * and gains its canonical with it; and the sitemap pushes it the moment
     * `canPublishWarrantyPolicy()` turns true.
     */
    const meta = code(read(LEGAL_METADATA));
    assert.match(meta, /input\.published === false\s*\?/);
    assert.doesNotMatch(meta, /input\.published !== true/);

    assert.equal(
      isWarrantyPublicationReady({
        status: "owner-approved",
        periodsPending: false,
        matrixApproved: true,
        legalReviewComplete: true,
        identity: {
          ...BUSINESS_IDENTITY,
          warrantyClaimsEmail: "warranty@onedecore.test",
        },
      }),
      true,
      "a fully recorded warranty must be able to become ready"
    );
  });
});

/* ========================================================================== */
/* 9. Unevidenced claims are not published as figures                          */
/* ========================================================================== */

describe("owner-approved wording is not the same thing as public evidence", () => {
  test("every public claim is still recorded as unevidenced", () => {
    /*
     * This is the state of the world, not a preference. If somebody records
     * real evidence and flips a status, this tells them which assertions below
     * stop applying — it does not stop them.
     */
    assert.deepEqual([...getUnevidencedClaimIds()], [...PUBLIC_CLAIM_IDS]);
    for (const id of PUBLIC_CLAIM_IDS) {
      assert.equal(isClaimPubliclyEvidenced(id), false, id);
    }
  });

  test("a claim needs verified evidence, and a warranty needs terms as well", () => {
    /*
     * THE RULE, not the current state: verified evidence alone is not enough
     * for a claim that also promises contractual terms. The real warranty
     * record now carries approved terms (owner-approved display wording,
     * 2026-09-07), so the fixture puts them back to pending to keep exercising
     * the rule rather than the configuration.
     */
    const verifiedOnly = {
      ...PUBLIC_CLAIM_EVIDENCE,
      "warranty-years": {
        ...PUBLIC_CLAIM_EVIDENCE["warranty-years"],
        evidence: "verified" as const,
        legalTerms: "pending" as const,
      },
      "projects-delivered": {
        ...PUBLIC_CLAIM_EVIDENCE["projects-delivered"],
        evidence: "verified" as const,
      },
    };
    assert.equal(
      isClaimPubliclyEvidenced("projects-delivered", verifiedOnly),
      true
    );
    assert.equal(isClaimPubliclyEvidenced("warranty-years", verifiedOnly), false);
    assert.equal(
      isClaimPubliclyEvidenced("warranty-years", {
        ...verifiedOnly,
        "warranty-years": {
          ...verifiedOnly["warranty-years"],
          legalTerms: "approved" as const,
        },
      }),
      true
    );
  });

  test("no figure without a source or an attestation may be quoted", () => {
    // `projects-delivered` is owner-attested since L1.1 and is asserted in
    // `l11-homepage-conversion-refinement`. Everything else stays withheld.
    for (const id of [
      "average-rating",
      "client-reviews",
      "client-satisfaction",
    ] as const) {
      assert.equal(canQuotePublicClaim(id), false, id);
    }
    /*
     * `custom-designs` moved out of this list on 2026-09-07: the owner attested
     * it for the homepage proof strip. It is still UNEVIDENCED — the assertion
     * that matters is the one below, and it has not moved.
     */
    assert.equal(isClaimPubliclyEvidenced("custom-designs"), false);
  });

  test("a rating has no qualitative substitute — it disappears instead", () => {
    /*
     * "Highly rated" would be the same unsourced claim in vaguer words. A claim
     * that can only be made as a number is withheld entirely.
     */
    assert.equal(publicClaimLabel("average-rating"), null);
    assert.equal(publicClaimLabel("client-reviews"), null);
    assert.equal(publicClaimLabel("client-satisfaction"), null);
  });

  test("claims that describe the work, rather than measure it, survive", () => {
    /*
     * These have no verified figure, so what survives is the qualitative
     * wording. `custom-designs` and `own-manufacturing-unit` are no longer in
     * this list: both are owner-attested for the proof strip and therefore
     * resolve to their quantified form, which is the point of the attestation.
     * Their qualitative copy still exists — asserted directly below — so
     * withdrawing an attestation leaves an honest sentence behind rather than a
     * blank.
     */
    for (const id of ["free-design-consultation"] as const) {
      const label = publicClaimLabel(id);
      assert.ok(label && label.length > 0, `${id} needs qualitative copy`);
      assert.doesNotMatch(label!, /\d/, `${id} must not carry a figure`);
    }

    for (const id of [
      "custom-designs",
      "own-manufacturing-unit",
      "warranty-years",
    ] as const) {
      const fallback = resolvePublicClaim(id).qualitative;
      assert.ok(fallback && fallback.length > 0, `${id} needs qualitative copy`);
      assert.doesNotMatch(fallback!, /\d/, `${id} fallback must carry no figure`);
    }
  });

  test("the aggregate review block needs evidence AND a source to cite", () => {
    assert.equal(canShowAggregateReviewSummary(), false);
    // A source URL alone is not enough while the figures are unevidenced.
    assert.equal(
      canShowAggregateReviewSummary("https://example.test/reviews"),
      false
    );
  });

  test("the business truth register reports the statuses it enforces", () => {
    /*
     * The statuses used to be written twice — once in the register, once
     * implicitly by whatever the page rendered. They are read from one place
     * now, so the register cannot say "pending" while the page says 4.9/5.
     */
    const registry = code(read("src/features/legal/business-truth-registry.ts"));
    assert.match(registry, /evidenceOf\(/);
    assert.match(registry, /legalTermsOf\(/);
    assert.doesNotMatch(registry, /publicEvidenceStatus: "pending"/);
  });
});

/* ========================================================================== */
/* 10. The rendered surfaces carry no unsupported figure                       */
/* ========================================================================== */

describe("the launch surfaces publish no unsupported number", () => {
  const SURFACE_MODULES = [
    "src/features/public-site/discovery/discovery-copy.ts",
    "src/features/public-site/discovery/DiscoveryHomePage.tsx",
    "src/features/public-site/discovery/DiscoveryHeroTrustBar.tsx",
    "src/features/public-site/home-r4/content.ts",
    "src/features/public-site/home-r4/HomeReviews.tsx",
  ] as const;

  test("no surface hard-codes a claim figure", () => {
    for (const rel of SURFACE_MODULES) {
      const source = code(read(rel));
      for (const forbidden of [
        "500+",
        "4.9/5",
        "200+ Client",
        "98% Client",
        "100% Custom",
        "10-Year Warranty",
        "10-year warranty",
      ]) {
        assert.ok(
          !source.includes(forbidden),
          `${rel} must not hard-code "${forbidden}"`
        );
      }
    }
  });

  test("every surface that shows a figure asks the gate first", () => {
    for (const rel of [
      /*
       * `discovery-copy.ts` no longer renders figures — it hands the proof
       * strip claim IDs, and the strip asks the register (asserted below).
       */
      "src/features/public-site/discovery/DiscoveryProofStrip.tsx",
      "src/features/public-site/discovery/DiscoveryHeroTrustBar.tsx",
      "src/features/public-site/home-r4/content.ts",
    ]) {
      assert.match(
        code(read(rel)),
        /canQuotePublicClaim\(|publicClaimLabel\(|isClaimDisplayable\(/,
        `${rel} must derive its claims from the evidence gate`
      );
    }
    /*
     * The proof strip is the surface that actually renders figures now. The
     * copy module hands it claim IDs; the component asks the register. Neither
     * half may publish a number on its own authority.
     */
    const strip = code(
      read("src/features/public-site/discovery/DiscoveryProofStrip.tsx")
    );
    assert.match(strip, /isClaimDisplayable\(metric\.claimId\)/);
  });

  test("the rating block and its decorative stars are gated together", () => {
    const reviews = code(read("src/features/public-site/home-r4/HomeReviews.tsx"));
    assert.match(reviews, /canShowAggregateReviewSummary\(\)/);
    assert.match(reviews, /showAggregate \?/);
    // The star field must not survive the number it illustrates.
    const gateAt = reviews.indexOf("{showAggregate ?");
    const starAt = reviews.indexOf("<DecorativeStars");
    assert.ok(gateAt > 0, "the aggregate gate must exist");
    assert.ok(starAt > gateAt, "stars must sit inside the gate");
  });

  test("no fabricated evidence was added to make any of this pass", () => {
    const reviews = read("src/features/public-site/home-r4/reviews.ts");
    assert.match(
      reviews,
      /HOME_VERIFIED_REVIEWS: readonly VerifiedHomeReview\[\] = \[\]/
    );
    assert.match(reviews, /HOME_REVIEW_SOURCE_URL: string \| null = null/);
    // And the warranty policy was not quietly approved.
    assert.equal(canPublishWarrantyPolicy(), false);
  });
});

/* ========================================================================== */
/* 11. Tap targets measured in a real browser                                  */
/* ========================================================================== */

describe("the tap targets a real viewport pass found too small are fixed", () => {
  const blockFor = (css: string, selector: string) => {
    const at = css.indexOf(selector);
    assert.ok(at > 0, `${selector} needs its own rule`);
    return css.slice(at, css.indexOf("}", at));
  };

  test("the /interiors service triggers reach 44px", () => {
    /*
     * Measured at 299x28 in a real 390px viewport: the button had no padding
     * and no minimum, so it was exactly its text height. It is the primary
     * interaction on the paid-search landing page.
     */
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(blockFor(css, ".pm-service__trigger {"), /min-height: 44px/);
  });

  test("the plan summary edit control reaches 44px", () => {
    const css = read("src/features/public-site/home-r4/styles/home-r4.css");
    assert.match(blockFor(css, ".pm-summary__edit {"), /min-height: 44px/);
  });

  test("the header brand link reaches 44px", () => {
    const css = read("src/features/public-site/chrome/public-site-chrome.css");
    assert.match(blockFor(css, ".od-site-header__mark {"), /min-height: 44px/);
  });
});

/* ========================================================================== */
/* 12. The copy says what the page actually does                               */
/* ========================================================================== */

describe("public copy matches the page it describes", () => {
  const faq = (id: string) => {
    const entry = PM_FAQS.find((item) => item.id === id);
    assert.ok(entry, `the ${id} FAQ must exist`);
    return entry!;
  };

  test("the reviews FAQ no longer describes a rating the page withholds", () => {
    /*
     * It used to answer "the homepage shows ONEDECORE's owner-approved
     * aggregate rating and review count" — describing a section that the
     * evidence gate now suppresses. Restoring the claim to match the answer
     * would have been the wrong repair.
     */
    assert.equal(canShowAggregateReviewSummary(), false);
    const entry = faq("reviews");
    for (const forbidden of [
      "aggregate rating",
      "review count",
      "The homepage shows",
    ]) {
      assert.ok(
        !entry.answer.includes(forbidden),
        `the reviews FAQ must not claim "${forbidden}"`
      );
    }
    assert.doesNotMatch(entry.answer, /\d+(\.\d+)?\s*\/\s*5/);
    assert.ok(entry.answer.length > 0);
  });

  test("the submission FAQ tells the truth for the build it ships in", () => {
    /*
     * "No — secure lead submission will connect in a later release" stopped
     * being true the moment the form went active, and `/interiors` renders the
     * live form in that mode. The answer follows the build's mode, the same way
     * PM_CLOSE already switches its copy.
     */
    const content = code(read("src/features/public-site/home-r4/content.ts"));
    const faqComponent = code(read("src/features/public-site/home-r4/HomeFaq.tsx"));

    // The copy module carries both forms...
    assert.match(
      content,
      /Your consultation request is sent to ONEDECORE for review and follow-up\./
    );
    assert.match(
      content,
      /Submitting the form does not confirm an appointment or quotation\./
    );
    assert.match(content, /questionActive:/);
    assert.match(content, /answerActive:/);

    /*
     * ...and the COMPONENT picks, because `content.ts` is a copy module that
     * must not reach into the intake feature — a boundary the Phase 4A guard
     * asserts. Threading the mode through the component is how PM_CLOSE
     * already does it.
     */
    assert.doesNotMatch(content, /leadFormMode/);
    /*
     * The FAQ answers describe a site whose form submits, because it does.
     * Whether the backend can accept a lead at this instant is answered by the
     * sheet when it opens, not by copy compiled into the page.
     */
    assert.match(faqComponent, /const formActive = true/);
    assert.match(faqComponent, /resolveFaqEntry\(entry, formActive\)/);

    // Resolution is truthful in both directions.
    const raw = PM_FAQS.find((item) => item.id === "submitted")!;
    const copyOnly = resolveFaqEntry(raw, false);
    const active = resolveFaqEntry(raw, true);
    assert.match(copyOnly.answer, /^No\./);
    assert.match(active.question, /What happens when I submit/);
    assert.doesNotMatch(active.answer, /later release/i);
    assert.doesNotMatch(active.answer, /^No\./);
  });

  test("the warranty FAQ promises neither a duration nor universal cover", () => {
    /*
     * The proof strip now carries a hedged headline ("Up to N+ Years"), because
     * the owner approved that display wording. The FAQ is where a visitor goes
     * for the detail, and the DETAIL is still pending — so the FAQ must keep
     * saying so, and must still not name a duration or promise universal cover.
     * The headline and the FAQ are allowed to differ in precision; they are not
     * allowed to contradict.
     */
    const entry = faq("warranty");
    /*
     * A hedged ceiling ("up to N+ years") is allowed now that the owner has
     * approved that wording; a FLAT duration ("10-year warranty") is not, and
     * neither is universal cover.
     */
    assert.match(entry.answer, /up to \d+\+ years/i);
    assert.doesNotMatch(entry.answer, /\b\d+\s*-\s*year/i);
    for (const forbidden of ["10-year", "10-Year", "all ", "every "]) {
      assert.ok(
        !entry.answer.includes(forbidden),
        `the warranty FAQ must not say "${forbidden}"`
      );
    }
    assert.match(entry.answer, /where applicable/i);
    assert.match(entry.answer, /not yet published/i);
  });

  test("no FAQ answer carries a suppressed figure", () => {
    for (const entry of PM_FAQS) {
      for (const forbidden of ["500+", "4.9/5", "200+", "98%", "100% Custom"]) {
        assert.ok(
          !entry.answer.includes(forbidden),
          `FAQ "${entry.id}" must not carry ${forbidden}`
        );
      }
    }
  });

  test("navigation does not label the suppressed section Reviews", () => {
    assert.equal(PM_REVIEWS_NAV_LABEL, "How We Work");
    for (const item of PM_NAV_ITEMS) {
      assert.notEqual(item.label, "Reviews");
    }
    for (const item of PM_FOOTER.explore) {
      assert.notEqual(item.label, "Reviews");
    }
    // The section itself agrees with its own label.
    assert.equal(PM_REVIEWS.eyebrow, "How We Work");
    assert.doesNotMatch(PM_REVIEWS.heading, /\d+(\.\d+)?\s*\/\s*5/);
  });

  test("the anchor id is unchanged, so existing links still resolve", () => {
    /*
     * Only the LABEL is conditional. Renaming `#reviews` would break inbound
     * links and the scroll-spy list for no gain.
     */
    const reviewsNav = PM_NAV_ITEMS.find(
      (item) => item.label === PM_REVIEWS_NAV_LABEL
    );
    assert.equal(reviewsNav?.href, "#reviews");
    assert.ok(
      PM_FOOTER.explore.some((item) => item.href === "#reviews"),
      "the footer must keep the same anchor"
    );
  });

  test("the label follows the gate rather than being hard-coded", () => {
    const content = code(read("src/features/public-site/home-r4/content.ts"));
    assert.match(
      content,
      /PM_REVIEWS_NAV_LABEL = canShowAggregateReviewSummary\(\)/
    );
    assert.match(content, /label: PM_REVIEWS_NAV_LABEL/);
  });
});
