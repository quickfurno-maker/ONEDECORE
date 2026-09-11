/**
 * The Website Manager: what the owner may change, and what nobody may.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 *  1. The code/data boundary. The database may reorder and hide sections. It
 *     may not choose components, invent sections, move the hero, or put a
 *     `javascript:` URL on the homepage. Every one of those is a row away if
 *     the boundary is ever relaxed.
 *
 *  2. The fallback. A homepage that renders nothing because Supabase is down is
 *     an outage; a homepage that renders the code default is a Tuesday. The
 *     resolver is written to assume its input is wrong.
 *
 *  3. `/` staying static. The entire value of this feature is "change the
 *     homepage without a deploy". It is worthless if the cost is turning the
 *     front page dynamic, and the failure is silent — a `ƒ` in a build log
 *     nobody reads.
 *
 *  4. One lead form. A banner that opens the consultation must open THE
 *     consultation, not a second copy with its own validation and consent
 *     record.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  BANNER_LINK_TYPES,
  MAX_ENABLED_BANNERS,
  bannerImageUrl,
  bannerLinkRel,
  describeBannerRatio,
  isBannerLinkType,
  validateBannerLink,
} from "../banner-model.ts";
import {
  HOMEPAGE_SECTION_KEYS,
  HOMEPAGE_SECTION_REGISTRY,
  defaultHomepageSections,
  getHomepageSection,
  isHomepageSectionKey,
  resolveHomepageSections,
} from "../homepage-registry.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MIGRATION = "supabase/migrations/20260911120000_website_manager_cms.sql";
const PAGE = "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const CAROUSEL = "src/features/public-site/interiors/InteriorsPromoCarousel.tsx";
const ROOT_ROUTE = "src/app/page.tsx";
const ACTIONS = "src/features/website-manager/server/website-actions.ts";
const CONFIG_READER = "src/features/website-manager/public/public-homepage-config.ts";
const ADMIN_PAGE = "src/app/admin/website/page.tsx";
const PREVIEW_PAGE = "src/app/admin/website/preview/page.tsx";

/* -------------------------------------------------------------------------- */
/* 1. The section registry is the only place a key means a component           */
/* -------------------------------------------------------------------------- */

describe("the homepage section registry", () => {
  test("every key has exactly one definition, in a stable slug form", () => {
    assert.equal(HOMEPAGE_SECTION_REGISTRY.length, HOMEPAGE_SECTION_KEYS.length);
    const keys = HOMEPAGE_SECTION_REGISTRY.map((entry) => entry.key);
    assert.equal(new Set(keys).size, keys.length, "keys must be unique");
    for (const key of keys) {
      assert.match(key, /^[a-z][a-z0-9-]*$/, `${key} must be a stable slug`);
    }
  });

  test("default orders are a contiguous sequence with no ties", () => {
    const orders = HOMEPAGE_SECTION_REGISTRY.map((e) => e.defaultOrder).sort((a, b) => a - b);
    assert.deepEqual(orders, orders.map((_, index) => index));
  });

  test("the component map covers the registry exactly", () => {
    /*
     * THE REGRESSION THIS EXISTS FOR.
     *
     * A section added to the registry but not to `SECTION_COMPONENTS` renders
     * as nothing — a silent hole in the homepage that only shows up when
     * somebody scrolls. A component mapped without a registry entry can never
     * be ordered or hidden. They must be the same set.
     */
    const page = read(PAGE);
    const block = /const SECTION_COMPONENTS: Record<[\s\S]*?\n\};/.exec(page);
    assert.ok(block, "the component map must exist");
    const mapped = [...block[0].matchAll(/^\s{2}"?([a-z][a-z0-9-]*)"?:/gm)].map((m) => m[1]!);
    assert.deepEqual(
      [...mapped].sort(),
      [...HOMEPAGE_SECTION_KEYS].sort(),
      "the component map and the registry describe different homepages"
    );
  });

  test("no component name is ever stored in the database", () => {
    /*
     * A CMS that stores `"HomeHero"` in a row turns a database write into code
     * execution. The migration must carry keys and nothing else.
     */
    const migration = read(MIGRATION);
    for (const component of [
      "HomeHero",
      "InteriorsPromoCarousel",
      "HomeServicesRooms",
      "HomePlan",
    ]) {
      assert.doesNotMatch(
        migration,
        new RegExp(`'${component}'`),
        `${component} must never be a stored value`
      );
    }
  });

  test("the hero is pinned first and cannot be hidden", () => {
    const hero = getHomepageSection("hero");
    assert.equal(hero.pin, "first");
    assert.equal(hero.canHide, false);
    assert.equal(hero.defaultOrder, 0);
  });

  test("the consultation close is pinned last and cannot be hidden", () => {
    const close = getHomepageSection("consultation");
    assert.equal(close.pin, "last");
    assert.equal(close.canHide, false);
    assert.equal(close.defaultOrder, HOMEPAGE_SECTION_REGISTRY.length - 1);
  });

  test("global chrome is not a manageable section", () => {
    /*
     * The header, the WhatsApp FAB, the sticky Call Now bar and the footer are
     * contact surfaces with their own fail-closed config. "Hide the phone
     * number" is not an editorial choice this tool offers.
     */
    for (const forbidden of ["header", "footer", "nav", "fab", "whatsapp", "sticky"]) {
      assert.equal(
        isHomepageSectionKey(forbidden),
        false,
        `${forbidden} must not be manageable`
      );
    }
  });

  test("the default order is the approved homepage", () => {
    assert.deepEqual(
      defaultHomepageSections().map((s) => s.key),
      [
        "hero",
        "promo-carousel",
        "complete-interiors",
        "modular-kitchen",
        "wardrobes",
        "renovation",
        "why",
        "factory",
        "estimator",
        "portfolio",
        "materials",
        "process",
        "service-areas",
        "testimonials",
        "faq",
        "consultation",
      ]
    );
    assert.ok(defaultHomepageSections().every((s) => s.visible));
  });
});

/* -------------------------------------------------------------------------- */
/* 2. The resolver assumes its input is wrong                                  */
/* -------------------------------------------------------------------------- */

describe("resolving a stored config into a renderable homepage", () => {
  test("null, empty and unusable configs fall back to the code default", () => {
    const expected = defaultHomepageSections();
    assert.deepEqual(resolveHomepageSections(null), expected);
    assert.deepEqual(resolveHomepageSections(undefined), expected);
    assert.deepEqual(resolveHomepageSections([]), expected);
    assert.deepEqual(
      resolveHomepageSections([{ key: "not-a-section", order: 0, visible: true }]),
      expected,
      "a config of only unknown keys is no config at all"
    );
  });

  test("unknown keys are dropped, not thrown on", () => {
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: true },
      { key: "evil-injected-section", order: 1, visible: true },
      { key: "why", order: 2, visible: true },
    ]);
    assert.ok(!resolved.some((s) => s.key === ("evil-injected-section" as never)));
    assert.ok(resolved.some((s) => s.key === "why"));
  });

  test("a stored order cannot move the hero off the top", () => {
    const resolved = resolveHomepageSections([
      { key: "faq", order: 0, visible: true },
      { key: "hero", order: 99, visible: true },
    ]);
    assert.equal(resolved[0]!.key, "hero", "the hero is pinned first whatever the data says");
  });

  test("a stored flag cannot hide the hero or the close", () => {
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: false },
      { key: "consultation", order: 1, visible: false },
    ]);
    assert.equal(resolved.find((s) => s.key === "hero")!.visible, true);
    assert.equal(resolved.find((s) => s.key === "consultation")!.visible, true);
  });

  test("the consultation close stays last", () => {
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: true },
      { key: "consultation", order: 1, visible: true },
      { key: "faq", order: 2, visible: true },
    ]);
    assert.equal(resolved[resolved.length - 1]!.key, "consultation");
  });

  test("duplicates keep their first occurrence", () => {
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: true },
      { key: "why", order: 1, visible: false },
      { key: "why", order: 2, visible: true },
    ]);
    assert.equal(resolved.filter((s) => s.key === "why").length, 1);
    assert.equal(resolved.find((s) => s.key === "why")!.visible, false);
  });

  test("a section the config never heard of is appended, not lost", () => {
    /*
     * This is what happens when a release adds a section: the stored config
     * predates it. Dropping it would ship new code invisible until somebody
     * happens to publish.
     */
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: true },
      { key: "consultation", order: 1, visible: true },
    ]);
    assert.equal(resolved.length, HOMEPAGE_SECTION_KEYS.length);
    assert.ok(resolved.some((s) => s.key === "materials"));
  });

  test("ordering is deterministic when the stored orders tie", () => {
    const tied = HOMEPAGE_SECTION_KEYS.map((key) => ({ key, order: 0, visible: true }));
    const once = resolveHomepageSections(tied).map((s) => s.key);
    const twice = resolveHomepageSections([...tied].reverse()).map((s) => s.key);
    assert.deepEqual(once, twice, "a tie must not depend on row arrival order");
  });

  test("visibility survives a reorder", () => {
    const resolved = resolveHomepageSections([
      { key: "hero", order: 0, visible: true },
      { key: "faq", order: 1, visible: false },
      { key: "why", order: 2, visible: true },
    ]);
    assert.equal(resolved.find((s) => s.key === "faq")!.visible, false);
    assert.equal(resolved.find((s) => s.key === "why")!.visible, true);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Banner links                                                             */
/* -------------------------------------------------------------------------- */

describe("banner links are validated in one place", () => {
  test("the four link types, and nothing else", () => {
    assert.deepEqual([...BANNER_LINK_TYPES], ["none", "internal", "external", "consultation"]);
    assert.equal(isBannerLinkType("javascript"), false);
    assert.equal(isBannerLinkType("none"), true);
  });

  test("unsafe schemes are refused whatever the link type claims", () => {
    for (const evil of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://evil.example/x",
      "ftp://evil.example/x",
    ]) {
      for (const type of ["internal", "external"] as const) {
        const result = validateBannerLink(type, evil);
        assert.equal(result.valid, false, `${type} must refuse ${evil}`);
      }
    }
  });

  test("a protocol-relative URL is not an internal page", () => {
    /*
     * `//evil.com` starts with a slash and navigates off-site. It is the single
     * most common way an "internal only" field becomes an open redirect.
     */
    assert.equal(validateBannerLink("internal", "//evil.com").valid, false);
    assert.equal(validateBannerLink("internal", "///evil.com").valid, false);
  });

  test("internal links must start with exactly one slash", () => {
    assert.equal(validateBannerLink("internal", "portfolio").valid, false);
    assert.equal(validateBannerLink("internal", "https://onedecore.in/x").valid, false);
    const ok = validateBannerLink("internal", "/portfolio");
    assert.equal(ok.valid, true);
    assert.equal(ok.value, "/portfolio");
    assert.equal(validateBannerLink("internal", "/#contact").valid, true);
  });

  test("external links must be https, with a real domain", () => {
    assert.equal(validateBannerLink("external", "http://example.com").valid, false);
    assert.equal(validateBannerLink("external", "https://localhost").valid, false);
    assert.equal(validateBannerLink("external", "not a url").valid, false);
    assert.equal(validateBannerLink("external", "https://example.com/offer").valid, true);
  });

  test("link types that carry no target store null, never a leftover", () => {
    /*
     * A target left on a `none` banner reappears the moment somebody switches
     * the type back, which is a link nobody chose to publish.
     */
    for (const type of ["none", "consultation"] as const) {
      const result = validateBannerLink(type, "https://example.com");
      assert.equal(result.valid, true);
      assert.equal(result.value, null);
    }
  });

  test("an empty target on a link type that needs one is refused", () => {
    assert.equal(validateBannerLink("internal", "").valid, false);
    assert.equal(validateBannerLink("external", "   ").valid, false);
  });

  test("only an external new tab gets a rel that severs the opener", () => {
    assert.equal(bannerLinkRel("external", true), "noopener noreferrer");
    assert.equal(bannerLinkRel("external", false), undefined);
    assert.equal(bannerLinkRel("internal", true), undefined);
    assert.equal(bannerLinkRel("consultation", true), undefined);
  });

  test("the database refuses the same values independently", () => {
    /*
     * The model protects the UX; the constraint protects the data. Only one of
     * them is out of reach of a script, and it is this one.
     */
    const migration = read(MIGRATION);
    const constraint = /constraint chk_website_banner_link_value check \(([\s\S]*?)\n  \)/.exec(
      migration
    );
    assert.ok(constraint, "the link constraint must exist");
    assert.match(constraint[1]!, /link_value !~ '\^\/\/'/, "protocol-relative must be refused");
    assert.match(constraint[1]!, /\^https:\/\//, "external must be https only");
    assert.match(constraint[1]!, /link_type = 'none' and link_value is null/);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Banner model                                                             */
/* -------------------------------------------------------------------------- */

describe("banner model", () => {
  test("the enabled ceiling matches the database", () => {
    assert.equal(MAX_ENABLED_BANNERS, 20);
    assert.match(read(MIGRATION), /v_enabled_count > 20/);
  });

  test("off-ratio artwork is a warning, never a rejection", () => {
    assert.equal(describeBannerRatio(1000, 1600).offRatio, false);
    assert.equal(describeBannerRatio(1000, 1601).offRatio, false, "a rounding error is fine");
    const landscape = describeBannerRatio(1600, 900);
    assert.equal(landscape.offRatio, true);
    assert.match(landscape.message ?? "", /5:8/);
    // Nonsense dimensions must not produce a scary message.
    assert.equal(describeBannerRatio(0, 0).offRatio, false);
  });

  test("a stored path becomes a public URL, and a missing one stays null", () => {
    assert.equal(bannerImageUrl(null), null);
    assert.equal(bannerImageUrl("   "), null);
    const url = bannerImageUrl("abc/def.webp");
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      assert.match(url ?? "", /\/storage\/v1\/object\/public\/website-banners\/abc\/def\.webp$/);
    }
  });

  test("the database stores a path, not a URL", () => {
    /*
     * A stored absolute URL bakes the project reference into every row and
     * breaks the day the storage host changes.
     */
    const actions = code(read(ACTIONS));
    assert.match(actions, /path = `\$\{bannerId\}\/\$\{randomUUID\(\)\}\./);
    assert.doesNotMatch(actions, /getPublicUrl/);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. The public page stays static, and falls back                             */
/* -------------------------------------------------------------------------- */

describe("the public homepage", () => {
  test("reads config through an anonymous, cookie-free client", () => {
    /*
     * ONE `cookies()` ANYWHERE IN THIS TREE TURNS `/` DYNAMIC.
     *
     * The failure is silent: the build reports `ƒ` instead of `○` and every
     * visitor gets a server round trip forever.
     */
    const reader = code(read(CONFIG_READER));
    assert.doesNotMatch(reader, /cookies\(\)|headers\(\)|force-dynamic/);
    assert.doesNotMatch(reader, /SERVICE_ROLE/);
    assert.match(reader, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(reader, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.match(reader, /persistSession: false/);

    const route = code(read(ROOT_ROUTE));
    assert.doesNotMatch(route, /cookies\(\)|headers\(\)|force-dynamic/);
    assert.match(route, /export const revalidate = 300;/);
  });

  test("the config read is cached by tag and never expires on a timer", () => {
    const reader = code(read(CONFIG_READER));
    assert.match(reader, /unstable_cache\(/);
    assert.match(reader, /tags: \[HOMEPAGE_CONFIG_TAG\]/);
    assert.match(reader, /revalidate: false/);
  });

  test("every failure path returns null rather than throwing", () => {
    const reader = code(read(CONFIG_READER));
    // No credentials, RPC error, no data, and an exception all return null.
    assert.match(reader, /if \(!url \|\| !key\) return null;/);
    assert.match(reader, /if \(error \|\| !data\) return null;/);
    assert.match(reader, /catch \{\s*return null;/);
  });

  test("publishing expires both the tag and the rendered path", () => {
    /*
     * Expiring only the tag leaves the prerendered HTML on disk, which is
     * exactly the "I published and nothing changed" report this exists to
     * avoid.
     */
    const reader = code(read(CONFIG_READER));
    assert.match(reader, /revalidateTag\(HOMEPAGE_CONFIG_TAG, \{ expire: 0 \}\)/);
    assert.match(reader, /revalidatePath\(path\)/);
    assert.match(reader, /return \["\/"\];/);
  });

  test("a null config renders the approved homepage from code", () => {
    const page = code(read(PAGE));
    assert.match(page, /config = null/);
    assert.match(page, /resolveHomepageSections\(/);
  });

  test("a hidden section is absent, not merely invisible", () => {
    /*
     * `display: none` still costs the visitor the markup, the data and the
     * images. "Hidden" in this tool means not sent.
     */
    const page = code(read(PAGE));
    assert.match(page, /section\.visible \? \(/);
    assert.doesNotMatch(page, /display: ?["']none["']/);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. The carousel is dynamic and never assumes six                            */
/* -------------------------------------------------------------------------- */

describe("the public carousel", () => {
  test("nothing hardcodes a banner count", () => {
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /=== 6|length === 6|slice\(0, ?6\)/);
    assert.match(carousel, /const slideCount = slides\.length/);
  });

  test("no banners means no section, and that is distinct from no config", () => {
    /*
     * `null` is "no config" and falls back to the code slots. `[]` is the owner
     * publishing a homepage with no banners. Collapsing the two would make
     * "remove every banner" impossible to express.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /banners === null \? getEnabledInteriorsPromoSlides\(\) : toSlides\(banners\)/);
    assert.match(carousel, /if \(slideCount === 0\) \{\s*return null;/);
  });

  test("the empty frame still renders for an enabled banner with no artwork", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /hasInteriorsPromoCreative\(slide\) \? \(/);
    assert.match(carousel, /od-int-promo__empty/);
  });

  test("each link type renders exactly one appropriate control", () => {
    const carousel = code(read(CAROUSEL));
    // consultation -> a button that opens the planner
    assert.match(carousel, /linkType === "consultation" \? \(/);
    assert.match(carousel, /onClick=\{onConsultation\}/);
    // external -> a plain anchor with the opener severed
    assert.match(carousel, /rel=\{bannerLinkRel\("external", slide\.newTab === true\)\}/);
    assert.match(carousel, /target=\{slide\.newTab \? "_blank" : undefined\}/);
    // internal -> next/link
    assert.match(carousel, /<Link\s+href=\{slide\.href\}/);
    // none -> inert
    assert.match(carousel, /<article className=\{frameClass\}>\{body\}<\/article>/);
  });

  test("a consultation banner opens the one canonical form", () => {
    /*
     * `usePlan` is the same context the hero CTA and the sticky bar use. Not a
     * second form, not a new endpoint, not a link to an anchor.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /usePlan\(\)/);
    assert.match(carousel, /openPlanner\(getNextIncompleteStep\(\)\)/);
    assert.doesNotMatch(carousel, /<form|fetch\(|LeadConsultationHost/);

    const page = code(read(PAGE));
    assert.equal(
      (page.match(/<LeadConsultationHost>/g) ?? []).length,
      1,
      "exactly one consultation host on the page"
    );
  });

  test("the approved geometry is untouched", () => {
    const css = read("src/features/public-site/interiors/interiors.css");
    assert.match(css, /aspect-ratio: 5 \/ 8/);
    assert.match(css, /scroll-snap-type: x mandatory/);
    assert.match(css, /flex: 0 0 min\(74vw, calc\(60vh \* 5 \/ 8\)\)/);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Admin surface and permission                                             */
/* -------------------------------------------------------------------------- */

describe("the admin surface is gated on its own permission", () => {
  test("website.manage exists and is not portfolio.manage reused", () => {
    const migration = read(MIGRATION);
    assert.match(migration, /'website\.manage'/);
    const actions = read(ACTIONS);
    assert.doesNotMatch(actions, /portfolio\.manage/);
  });

  test("it is granted to super_admin only", () => {
    const migration = read(MIGRATION);
    const grant = /insert into public\.role_permissions[\s\S]*?p\.code = 'website\.manage'[\s\S]*?;/.exec(
      migration
    );
    assert.ok(grant, "the grant must exist");
    assert.match(grant[0], /r\.code = 'super_admin'/);
    for (const role of ["content_manager", "sales", "designer", "management"]) {
      assert.doesNotMatch(grant[0], new RegExp(role), `${role} must not be granted by default`);
    }
  });

  test("the route, the preview, the queries and the actions all check", () => {
    assert.match(code(read(ADMIN_PAGE)), /hasWebsiteManagePermission\(\)/);
    assert.match(code(read(PREVIEW_PAGE)), /hasWebsiteManagePermission\(\)/);
    assert.match(
      code(read("src/features/website-manager/server/website-queries.ts")),
      /await requireWebsiteManage\(\)/
    );
    const actions = code(read(ACTIONS));
    assert.equal(
      (actions.match(/await requireWebsiteManage\(\)/g) ?? []).length,
      3,
      "save, publish and upload must each check"
    );
  });

  test("the database checks again, inside every mutation", () => {
    const migration = read(MIGRATION);
    for (const fn of [
      "save_website_homepage_draft",
      "publish_website_homepage",
      "get_website_homepage_draft",
    ]) {
      const block = new RegExp(`create function public\\.${fn}[\\s\\S]*?\\$\\$;`).exec(migration);
      assert.ok(block, `${fn} must exist`);
      assert.match(
        block[0],
        /private\.website_require_manager\(\)/,
        `${fn} must authorize inside the function`
      );
      assert.match(block[0], /set search_path = ''/, `${fn} must pin its search_path`);
    }
  });

  test("anon may call the public reader and nothing else", () => {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /grant execute on function public\.get_published_homepage_config\(\) to anon, authenticated;/
    );
    for (const fn of [
      "get_website_homepage_draft\\(\\)",
      "save_website_homepage_draft\\(uuid, jsonb, jsonb\\)",
      "publish_website_homepage\\(uuid\\)",
    ]) {
      assert.match(
        migration,
        new RegExp(`revoke execute on function public\\.${fn} from public, anon;`),
        `${fn} must be revoked from anon`
      );
    }
  });

  test("no management table is granted to anon", () => {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /revoke all on table[\s\S]*?from public, anon, authenticated;/,
      "tables start with nothing granted"
    );
    assert.doesNotMatch(migration, /grant [a-z, ]+ on table[^;]*to anon/);
  });

  test("the nav link and the page agree about who may open it", () => {
    const flags = code(read("src/features/admin-ops/server/resolve-ops-nav-flags.ts"));
    assert.match(flags, /permissions\.includes\("website\.manage"\)/);
    assert.match(code(read("src/features/admin-ops/nav-routes.ts")), /flags\.website/);
    assert.match(code(read("src/features/admin-ops/components/AdminSidebar.tsx")), /flags\.website/);
  });

  test("the admin routes are dynamic and the preview is noindex", () => {
    assert.match(read(ADMIN_PAGE), /export const dynamic = "force-dynamic"/);
    assert.match(read(ADMIN_PAGE), /robots: \{ index: false/);
    const preview = read(PREVIEW_PAGE);
    assert.match(preview, /export const dynamic = "force-dynamic"/);
    assert.match(preview, /robots: \{ index: false, follow: false, nocache: true \}/);
  });

  test("the preview renders the real page, not a second implementation", () => {
    const preview = code(read(PREVIEW_PAGE));
    assert.match(preview, /<InteriorsConversionPage/);
    assert.match(preview, /previewMode/);
    // And it shows what publishing would show: disabled banners filtered out.
    assert.match(preview, /\.filter\(\(banner\) => banner\.enabled\)/);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Upload security                                                          */
/* -------------------------------------------------------------------------- */

describe("banner uploads", () => {
  test("the bytes decide the type, not the filename", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /validateImageMetadata\(bytes, file\.type \|\| undefined\)/);
    assert.match(actions, /createSanitisedMaster\(bytes, validation\.format!\)/);
    // The Portfolio pipeline, reused rather than reimplemented.
    assert.match(actions, /portfolio-image-pipeline/);
  });

  test("the object path is server-chosen, never the uploaded name", () => {
    /*
     * A client-supplied filename is how `../` and overwriting someone else's
     * object happen.
     */
    const actions = code(read(ACTIONS));
    assert.doesNotMatch(actions, /file\.name/);
    assert.match(actions, /randomUUID\(\)/);
    assert.match(actions, /\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(bannerId\)/);
  });

  test("uploads never overwrite", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /upsert: false/);
  });

  test("no service-role credential is used", () => {
    const actions = read(ACTIONS);
    assert.doesNotMatch(actions, /SERVICE_ROLE|service_role/);
    // The request-scoped client, so the storage policy re-checks the permission.
    assert.match(code(actions), /await createClient\(\)/);
  });

  test("the bucket refuses anything but images, with a size cap", () => {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /'website-banners'[\s\S]*?array\['image\/jpeg', 'image\/png', 'image\/webp'\]/
    );
    assert.match(migration, /'website-banners', true, 8388608/);
  });

  test("only a website manager may write to the bucket", () => {
    const migration = read(MIGRATION);
    for (const op of ["insert", "update", "delete"]) {
      const policy = new RegExp(
        `create policy "Website managers ${op} banner objects"[\\s\\S]*?;`
      ).exec(migration);
      assert.ok(policy, `${op} policy must exist`);
      assert.match(policy[0], /public\.authorize\('website\.manage'\)/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 9. The version model                                                        */
/* -------------------------------------------------------------------------- */

describe("draft, publish and the pointer", () => {
  test("exactly one draft and at most one published, enforced by index", () => {
    const migration = read(MIGRATION);
    assert.match(migration, /create unique index uq_website_single_draft[\s\S]*?where state = 'draft';/);
    assert.match(
      migration,
      /create unique index uq_website_single_published[\s\S]*?where state = 'published';/
    );
  });

  test("publish archives, points, and clones a fresh draft in one transaction", () => {
    const publish = /create function public\.publish_website_homepage[\s\S]*?\$\$;/.exec(
      read(MIGRATION)
    );
    assert.ok(publish);
    assert.match(publish[0], /set state = 'archived'/);
    assert.match(publish[0], /set state = 'published'/);
    assert.match(publish[0], /update public\.website_homepage_publication/);
    assert.match(publish[0], /insert into public\.website_homepage_versions[\s\S]*?'draft'/);
    // Archive before publish, or the single-published index rejects the new one.
    assert.ok(
      publish[0].indexOf("set state = 'archived'") < publish[0].indexOf("set state = 'published'"),
      "the previous version must be archived first"
    );
  });

  test("a stale draft id is refused rather than overwriting newer work", () => {
    const migration = read(MIGRATION);
    assert.equal(
      (migration.match(/WEBSITE_STALE_DRAFT/g) ?? []).length,
      2,
      "both save and publish must detect staleness"
    );
    assert.match(migration, /errcode = '40001'/);
  });

  test("publish re-checks the invariants the save enforced", () => {
    const publish = /create function public\.publish_website_homepage[\s\S]*?\$\$;/.exec(
      read(MIGRATION)
    );
    assert.match(publish![0], /WEBSITE_HERO_REQUIRED/);
    assert.match(publish![0], /WEBSITE_TOO_MANY_BANNERS/);
  });

  test("the public reader goes through the pointer and hides disabled banners", () => {
    const reader = /create function public\.get_published_homepage_config[\s\S]*?\$\$;/.exec(
      read(MIGRATION)
    );
    assert.ok(reader);
    assert.match(reader[0], /from public\.website_homepage_publication/);
    assert.match(reader[0], /b\.is_enabled = true/);
    // No draft, no archived, no version id, no actor in the payload.
    assert.doesNotMatch(reader[0], /'draft'|'archived'|version_id'|created_by|updated_by/);
    assert.doesNotMatch(reader[0], /internal_name/);
  });

  test("a failed publish invalidates nothing", () => {
    /*
     * Expiring the homepage cache after a refused publish serves a fresh render
     * of the SAME content, which makes the failure look like a success that did
     * not take.
     */
    const actions = code(read(ACTIONS));
    const publish = /export async function publishWebsiteDraft[\s\S]*?\n\}/.exec(actions);
    assert.ok(publish);
    const errorBranch = publish[0].slice(publish[0].indexOf("if (error)"));
    assert.doesNotMatch(
      errorBranch.slice(0, errorBranch.indexOf("}")),
      /invalidatePublishedHomepage/
    );
    assert.match(publish[0], /invalidatePublishedHomepage\(\)/);
  });

  test("saving a draft does not touch the public homepage", () => {
    const actions = code(read(ACTIONS));
    const save = /export async function saveWebsiteDraft[\s\S]*?\n\}/.exec(actions);
    assert.ok(save);
    assert.doesNotMatch(save[0], /invalidatePublishedHomepage/);
    assert.match(save[0], /revalidatePath\("\/admin\/website"\)/);
  });

  test("the seed reproduces the approved homepage exactly", () => {
    const migration = read(MIGRATION);
    const seed = /do \$\$[\s\S]*?v_keys text\[\] := array\[([\s\S]*?)\];/.exec(migration);
    assert.ok(seed, "the seed must list its section keys");
    const keys = [...seed[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
    assert.deepEqual(
      keys,
      defaultHomepageSections().map((s) => s.key),
      "the seeded order must match the code-defined approved order"
    );
    assert.match(migration, /for i in 1\.\.6 loop/, "six banner slots are seeded");
    assert.match(migration, /'Banner ' \|\| i/);
  });
});

/* -------------------------------------------------------------------------- */
/* 10. Server-side validation cannot be skipped by the UI                      */
/* -------------------------------------------------------------------------- */

describe("the action re-derives what the client sent", () => {
  test("unknown section keys are dropped server-side", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /!isHomepageSectionKey\(section\.key\)\) continue;/);
  });

  test("the pins are re-applied server-side", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /const hero = ordered\.findIndex/);
    assert.match(actions, /\{ key: heroRow\.key, visible: true \}/);
    assert.match(actions, /closeRow \? \[\{ key: closeRow\.key, visible: true \}\] : \[\]/);
  });

  test("a section the client omitted is restored, not lost", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /for \(const entry of HOMEPAGE_SECTION_REGISTRY\)/);
  });

  test("newTab is forced off for anything but an external link", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /newTab: linkType === "external" && banner\.newTab === true/);
  });

  test("alt text is required server-side once there is an image", () => {
    const actions = code(read(ACTIONS));
    assert.match(actions, /if \(image && !alt\)/);
    assert.match(read(MIGRATION), /chk_website_banner_alt_required/);
  });
});

/* -------------------------------------------------------------------------- */
/* 11. Nothing else regressed                                                  */
/* -------------------------------------------------------------------------- */

describe("the approved homepage is unchanged at seed", () => {
  test("the contact surfaces are still global chrome, outside the CMS", () => {
    const page = code(read(PAGE));
    assert.equal((page.match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length, 1);
    // The FAB is mounted outside the managed section loop.
    const loop = /\{sections\.map\(\(section\) =>[\s\S]*?\)\}/.exec(page);
    assert.ok(loop);
    assert.doesNotMatch(loop[0], /DiscoveryWhatsAppFab/);
  });

  test("the migration file exists and is forward-only", () => {
    assert.ok(existsSync(join(root, MIGRATION)));
    const migration = read(MIGRATION);
    assert.doesNotMatch(migration, /drop table|drop function public\.authorize/i);
  });

  test("the hero and its counter were not touched by this feature", () => {
    const hero = code(read("src/features/public-site/home-r4/HomeHero.tsx"));
    assert.match(hero, /pm-hero__credibility/);
    assert.match(hero, /useCountUp\(item\.value\)/);
    assert.doesNotMatch(hero, /website-manager/);
  });
});
