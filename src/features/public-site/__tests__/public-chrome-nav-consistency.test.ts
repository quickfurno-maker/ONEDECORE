import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  getPublicNavDestinations,
  PUBLIC_CONSULTATION,
  PUBLIC_NAV_CORE,
  PUBLIC_NAV_SHOP,
} from "../chrome/public-nav.ts";
import {
  getPublicPhoneHref,
  getPublicWhatsAppHref,
  PUBLIC_PHONE,
  PUBLIC_WHATSAPP,
} from "../chrome/public-contact.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const NAV = "src/features/public-site/chrome/public-nav.ts";
const HEADER = "src/features/public-site/chrome/PublicSiteHeader.tsx";
const FOOTER = "src/features/public-site/chrome/PublicSiteFooter.tsx";
const CHROME_CSS = "src/features/public-site/chrome/public-site-chrome.css";
const DOCK = "src/features/public-site/chrome/PublicConversionDock.tsx";
const DARK_SHELL = "src/features/public-site/theme/PublicDarkShell.tsx";
const HOME_SHELL = "src/features/public-site/home-r4/HomeShell.tsx";
const PORTFOLIO_LAYOUT = "src/app/portfolio/layout.tsx";
const INTERIORS_PAGE =
  "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const HOME_CSS = "src/features/public-site/home-r4/styles/home-r4.css";
const WORDMARK = "src/features/public-site/home-r4/OneDecoreWordmark.tsx";

/** Source with comments stripped, so prose about a thing is not the thing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
 * ============================================================================
 * The menu lost two items, the drawer stopped covering the screen, the backdrop
 * started receiving taps, and Portfolio gained the homepage's conversion bar.
 *
 * Three of those are the kind of thing that grows back. A nav item is the
 * natural thing to add when someone wants a page reachable; a consultation pill
 * is the natural thing to add to a header; and a scrim is the natural thing to
 * nest inside the header it belongs to — which is exactly what broke it.
 * ============================================================================
 */

/* ========================================================================== */
/* 1. The menu                                                                 */
/* ========================================================================== */

describe("the public menu is Portfolio | About, plus a gated Shop", () => {
  test("Shop off: exactly Portfolio then About", () => {
    assert.deepEqual(
      getPublicNavDestinations(false).map((i) => i.label),
      ["Portfolio", "About"]
    );
    assert.deepEqual([...PUBLIC_NAV_CORE].map((i) => i.id), ["portfolio", "about"]);
  });

  test("Shop on: the gate still opens, and Shop is appended", () => {
    const on = getPublicNavDestinations(true);
    assert.deepEqual(on.map((i) => i.label), ["Portfolio", "About", "Shop"]);
    assert.deepEqual(on.at(-1), PUBLIC_NAV_SHOP);
    assert.equal(on.length, PUBLIC_NAV_CORE.length + 1);
  });

  test("Shop off offers no /shop destination at all", () => {
    assert.ok(
      getPublicNavDestinations(false).every((i) => !i.href.startsWith("/shop")),
      "a visible link to a gated surface is a dead end wearing a menu item's clothes"
    );
  });

  test("INTERIORS is absent from the menu in both gate states", () => {
    for (const shopEnabled of [false, true]) {
      const items = getPublicNavDestinations(shopEnabled);
      assert.ok(
        !items.some((i) => /interiors/i.test(i.label)),
        `Interiors label present with shop ${shopEnabled}`
      );
      assert.ok(
        !items.some((i) => (i.href as string) === "/"),
        `a link to the site root is present with shop ${shopEnabled} — that is the wordmark's job`
      );
    }
    assert.doesNotMatch(code(read(NAV)), /PUBLIC_NAV_INTERIORS/);
  });

  test("CONTACT is absent from the menu in both gate states", () => {
    for (const shopEnabled of [false, true]) {
      const items = getPublicNavDestinations(shopEnabled);
      assert.ok(
        !items.some((i) => /contact/i.test(i.label)),
        `Contact label present with shop ${shopEnabled}`
      );
      assert.ok(
        !items.some((i) => (i.href as string) === "/#contact"),
        `a #contact menu entry is present with shop ${shopEnabled}`
      );
    }
    assert.doesNotMatch(code(read(NAV)), /PUBLIC_NAV_CONTACT/);
  });

  test("the #contact ANCHOR survived — only the menu item went", () => {
    /*
     * Removing a menu item must not remove the destination. The consultation
     * target is unchanged, and it is what the sticky bar, the WhatsApp action
     * and the footer all still point at.
     */
    assert.equal(PUBLIC_CONSULTATION.href, "/#contact");
    assert.match(read(FOOTER), /PUBLIC_CONSULTATION\.href/);
  });
});

/* ========================================================================== */
/* 2. One header, no pill                                                      */
/* ========================================================================== */

describe("no public header carries a consultation pill", () => {
  test("the header renders no CTA and no longer takes the prop", () => {
    const header = read(HEADER);
    assert.doesNotMatch(code(header), /od-site-header__cta/);
    assert.doesNotMatch(code(header), /showConsultation/);
    assert.doesNotMatch(code(header), /PUBLIC_CONSULTATION/);
  });

  test("no caller passes it either", () => {
    for (const rel of [DARK_SHELL, HOME_SHELL, INTERIORS_PAGE]) {
      assert.doesNotMatch(code(read(rel)), /showConsultation/, rel);
    }
  });

  test("the pill's styles went with it", () => {
    const css = read(CHROME_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /\.od-site-header__cta\s*\{/);
    assert.doesNotMatch(css, /\.od-site-header__ctaShort\s*\{/);
  });

  test("the drawer offers navigation, not a second CTA", () => {
    const header = read(HEADER);
    const drawer = header.slice(header.indexOf("od-site-header__drawerNav"));
    assert.doesNotMatch(drawer, /PUBLIC_CONSULTATION/);
  });
});

/* ========================================================================== */
/* 3. The brand lockup                                                         */
/* ========================================================================== */

describe("ONEDECORE — MADE FOR PUNE, at every width", () => {
  test("the wordmark always renders the tagline", () => {
    const mark = read(WORDMARK);
    assert.match(mark, /MADE FOR PUNE/);
    // No opt-out prop: the lockup is the lockup.
    assert.doesNotMatch(code(mark), /withTagline/);
  });

  test("the narrow-phone rule shrinks it rather than hiding it", () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * `@media (max-width: 420px)` used to set `display: none` on the nav
     * tagline. That block is scoped to `[data-public-home-r4]`, which the
     * homepage shell carries and the Portfolio shell does not — so the SAME
     * header showed "MADE FOR PUNE" on Portfolio at 390px and hid it on the
     * homepage. One logo, two behaviours, same screen size.
     */
    const css = read(HOME_CSS);
    const block = css.slice(css.indexOf("@media (max-width: 420px)"));
    const narrow = block.slice(0, block.indexOf("@media", 10));
    assert.match(narrow, /\.od-wordmark__tag\s*\{[^}]*font-size/);
    assert.doesNotMatch(
      narrow,
      /\.od-wordmark__tag\s*\{[^}]*display:\s*none/,
      "the tagline must shrink to fit, never disappear"
    );
  });

  test("both shells render the same header component", () => {
    assert.match(read(DARK_SHELL), /<PublicSiteHeader/);
    assert.match(read(HOME_SHELL), /<PublicSiteHeader/);
  });
});

/* ========================================================================== */
/* 4. The drawer                                                               */
/* ========================================================================== */

describe("the drawer is a bounded right-side panel", () => {
  test("it is capped, not full-screen", () => {
    const css = read(CHROME_CSS);
    const panel = css.slice(
      css.indexOf(".od-site-header__drawer {"),
      css.indexOf(".od-site-header__drawer[data-open]")
    );
    assert.match(panel, /width: min\(80vw, 340px\)/);
    assert.match(panel, /right: 0/);
    assert.doesNotMatch(panel, /min\(22rem, 92vw\)/);
    /*
     * `max-width: 100vw` is a legitimate guard; a bare `width: 100vw` is the
     * takeover this change removed. Lookbehind would say that in one regex and
     * is not available at this TS target, so the guard is removed first.
     */
    const declaredWidths = panel.replace(/max-width:[^;]*;/g, "");
    assert.doesNotMatch(declaredWidths, /width:\s*100vw/);
    /*
     * And as tall as its contents, not as tall as the screen. Two menu items
     * in a `100dvh` panel is three-quarters of a phone of empty brown — the
     * other half of "too large and basic", which was never only the width.
     */
    assert.match(panel, /height: auto/);
    assert.match(panel, /max-height: 100dvh/);
    assert.doesNotMatch(panel.replace(/max-height:[^;]*;/g, ""), /height:\s*100dvh/);
  });

  test("the overlay is a SIBLING of the bar, never a child", () => {
    /*
     * THE FAILURE THIS PREVENTS, AND IT IS THE WHOLE BUG.
     *
     * `.od-site-header` carries `backdrop-filter`, which makes it the
     * containing block for fixed-position descendants. A scrim inside it with
     * `inset: 0` therefore sized itself to the 390x64 bar instead of the
     * viewport: the backdrop was a strip hidden behind the header and a tap
     * anywhere below it went to the page. Measured — `elementFromPoint(20,410)`
     * returned the page content while the drawer was open.
     */
    const header = read(HEADER);
    const closeTag = header.indexOf("</header>");
    const scrimAt = header.indexOf('className="od-site-header__scrim"');
    const drawerAt = header.indexOf('className="od-site-header__drawer"');
    assert.ok(closeTag > 0, "the header element must still exist");
    assert.ok(scrimAt > closeTag, "the scrim must be rendered after </header>");
    assert.ok(drawerAt > closeTag, "the drawer must be rendered after </header>");
    assert.match(header, /<>\s*\n\s*<header className="od-site-header">/);
  });

  test("the scrim stacks above the page and below the panel", () => {
    const css = read(CHROME_CSS);
    const scrim = css.slice(
      css.indexOf(".od-site-header__scrim {"),
      css.indexOf(".od-site-header__scrim[data-open]")
    );
    const panel = css.slice(
      css.indexOf(".od-site-header__drawer {"),
      css.indexOf(".od-site-header__drawer[data-open]")
    );
    const scrimZ = Number(/z-index:\s*(\d+)/.exec(scrim)?.[1]);
    const panelZ = Number(/z-index:\s*(\d+)/.exec(panel)?.[1]);
    const headerZ = Number(
      /\.od-site-header \{[\s\S]*?z-index:\s*(\d+)/.exec(css)?.[1]
    );
    assert.ok(Number.isFinite(scrimZ) && Number.isFinite(panelZ));
    assert.ok(scrimZ > headerZ, `scrim ${scrimZ} must clear the header ${headerZ}`);
    assert.ok(panelZ > scrimZ, `panel ${panelZ} must sit above the scrim ${scrimZ}`);
    // No negative-z-index scrim, which cannot receive a pointer event.
    assert.doesNotMatch(scrim, /z-index:\s*-/);
  });

  test("the scrim is interactive while open and inert while closed", () => {
    const css = read(CHROME_CSS);
    const scrim = css.slice(
      css.indexOf(".od-site-header__scrim {"),
      css.indexOf(".od-site-header__drawer {")
    );
    assert.match(scrim, /pointer-events: none/);
    assert.match(scrim, /\[data-open\][\s\S]{0,200}pointer-events: auto/);
    // It must be a real button, not a div nobody can reach without a pointer.
    assert.match(read(HEADER), /<button[\s\S]*?className="od-site-header__scrim"/);
    assert.match(read(HEADER), /aria-label="Close menu"/);
    assert.match(read(HEADER), /tabIndex=\{open \? 0 : -1\}/);
  });

  test("the drawer contains only the navigation, with no Interiors or Contact", () => {
    const header = read(HEADER);
    const drawer = header.slice(header.indexOf("od-site-header__drawerNav"));
    assert.match(drawer, /destinations\.map/);
    assert.doesNotMatch(drawer, /Interiors/);
    assert.doesNotMatch(drawer, /Contact/);
  });

  test("every dismissal path is wired", () => {
    const header = read(HEADER);
    // backdrop
    assert.match(header, /className="od-site-header__scrim"[\s\S]{0,220}onClick=\{close\}/);
    // close control
    assert.match(header, /className="od-site-header__drawerClose"\s*\n\s*onClick=\{close\}/);
    // escape
    assert.match(header, /event\.key === "Escape"/);
    // selecting a destination
    assert.match(header, /onClick=\{\(\) => setOpen\(false\)\}/);
    // body scroll lock and restore
    assert.match(header, /document\.body\.style\.overflow = "hidden"/);
    assert.match(header, /document\.body\.style\.overflow = previousOverflow/);
    // focus restore
    assert.match(header, /toggleRef\.current\?\.focus\(\)/);
    // focus trap
    assert.match(header, /event\.key !== "Tab"/);
  });

  test("opening focuses the dismissal, not the brand link", () => {
    /*
     * `focusables[0]` is the wordmark in the drawer head now. Landing a
     * keyboard user on "go to the homepage" the instant they open a menu is a
     * trap dressed as a shortcut — one stray Enter and they have navigated.
     */
    const header = read(HEADER);
    assert.match(header, /querySelector<HTMLElement>\(\s*"\.od-site-header__drawerClose"/);
    assert.match(header, /\(closeButton \?\? focusables\[0\]\)\?\.focus\(\)/);
    assert.doesNotMatch(header, /^\s*focusables\[0\]\?\.focus\(\);$/m);
  });

  test("the toggle keeps its 44px target and aria wiring", () => {
    const header = read(HEADER);
    assert.match(header, /aria-expanded=\{open\}/);
    assert.match(header, /aria-controls=\{drawerId\}/);
    const css = read(CHROME_CSS);
    assert.match(css, /\.od-site-header__toggle[\s\S]{0,200}min-width: 44px/);
    assert.match(css, /\.od-site-header__toggle[\s\S]{0,200}min-height: 44px/);
  });
});

/* ========================================================================== */
/* 5. One conversion treatment, shared                                         */
/* ========================================================================== */

describe("Portfolio gets the homepage's bottom CTA and WhatsApp", () => {
  test("the dock mounts the SAME two components the homepage mounts", () => {
    const dock = read(DOCK);
    assert.match(dock, /import \{ HomeStickyActions \}/);
    assert.match(dock, /import \{ DiscoveryWhatsAppFab \}/);
    assert.match(dock, /<HomeStickyActions \/>/);
    assert.match(dock, /<DiscoveryWhatsAppFab \/>/);

    const home = read(INTERIORS_PAGE);
    assert.match(home, /<DiscoveryWhatsAppFab \/>/);
    assert.match(read(HOME_SHELL), /<HomeStickyActions \/>/);
  });

  test("it re-implements nothing — no second bar, label or number", () => {
    const dock = code(read(DOCK));
    assert.doesNotMatch(dock, /wa\.me/);
    assert.doesNotMatch(dock, /tel:/);
    assert.doesNotMatch(dock, /\+\d{10,}/);
    assert.doesNotMatch(dock, /Free Consultation|Call Now/);
    assert.doesNotMatch(dock, /position: fixed/);
  });

  test("both surfaces read the same canonical helpers", () => {
    const sticky = read("src/features/public-site/home-r4/HomeStickyActions.tsx");
    const fab = read("src/features/public-site/discovery/DiscoveryWhatsAppFab.tsx");
    assert.match(sticky, /getPublicPhoneHref/);
    assert.match(fab, /getPublicWhatsAppHref/);
    // The helpers validate rather than trust, and yield null when unset.
    assert.equal(getPublicWhatsAppHref(null), null);
    assert.equal(getPublicPhoneHref(null), null);
    assert.equal(getPublicWhatsAppHref("not-a-number"), null);
    assert.match(
      getPublicWhatsAppHref("+919999999999") ?? "",
      /^https:\/\/wa\.me\/919999999999\?text=/
    );
    assert.equal(getPublicPhoneHref("+919999999999"), "tel:+919999999999");
    assert.equal(PUBLIC_PHONE.label, "Call Now");
    assert.equal(PUBLIC_WHATSAPP.label, "WhatsApp");
  });

  test("Portfolio opts in; the shell does not force it on every page", () => {
    assert.match(read(PORTFOLIO_LAYOUT), /showConversionDock/);
    const shell = read(DARK_SHELL);
    assert.match(shell, /showConversionDock = false/);
    assert.match(shell, /\{showConversionDock \? <PublicConversionDock \/> : null\}/);
  });

  test("the legal and shop surfaces do NOT get a consultation bar", () => {
    /*
     * The same shell serves privacy notices and the Shop boundary. A
     * consultation bar pinned over a legal document, or over a storefront with
     * its own checkout, would be another page's conversion path borrowed onto
     * one that has its own.
     */
    for (const rel of [
      "src/features/legal/components/LegalPageShell.tsx",
      "src/app/shop/layout.tsx",
    ]) {
      assert.doesNotMatch(code(read(rel)), /showConversionDock/, rel);
    }
  });

  test("the homepage does not mount the dock, so nothing doubles", () => {
    /*
     * `PublicConversionDock` brings its own `LeadConsultationHost`. The
     * homepage already wraps its whole tree in one and mounts both components
     * directly, so it must not also use this — two hosts would mean two plan
     * states and two sheets racing to submit one visitor.
     */
    assert.doesNotMatch(code(read(INTERIORS_PAGE)), /PublicConversionDock/);
    assert.doesNotMatch(code(read(HOME_SHELL)), /PublicConversionDock/);
    assert.match(read(DOCK), /<LeadConsultationHost>/);
  });

  test("the dock scopes the homepage stylesheet to itself", () => {
    /*
     * `.pm-sticky` and its `.dc-btn` classes are scoped to
     * `[data-public-home-r4]`. Wrapping only the dock in that attribute lets
     * those exact rules apply to the bar and to nothing else on the page —
     * rather than attaching the whole homepage stylesheet to Portfolio.
     */
    assert.match(read(DOCK), /data-public-home-r4=""/);
    assert.doesNotMatch(code(read(DARK_SHELL)), /data-public-home-r4/);
  });
});

/* ========================================================================== */
/* 6. Contact access, and what must not have moved                             */
/* ========================================================================== */

describe("contact access survived the menu change", () => {
  test("the footer still routes to the consultation and shows the studio", () => {
    const footer = read(FOOTER);
    assert.match(footer, /PUBLIC_CONSULTATION\.href/);
    assert.match(footer, /od-site-footer__address/);
    assert.match(footer, /BUSINESS_IDENTITY\.registeredOfficeAddress/);
    assert.match(footer, /serviceRegion/);
  });

  test("the consultation band is still the homepage's closing section", () => {
    const home = read(INTERIORS_PAGE);
    assert.match(home, /"consultation"/);
  });

  test("no migration and no database change came with this", () => {
    for (const rel of [NAV, HEADER, DOCK, DARK_SHELL, PORTFOLIO_LAYOUT, HOME_SHELL]) {
      assert.doesNotMatch(
        read(rel),
        /\b(create table|alter table|create policy|grant )\b/i,
        rel
      );
    }
  });
});
