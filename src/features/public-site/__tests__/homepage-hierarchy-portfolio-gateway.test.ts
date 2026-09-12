import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { R5_ROOMS, R5_ROOMS_COPY } from "../homepage-r5/content.ts";
import { PORTFOLIO_VIEWS } from "@/features/portfolio/public/portfolio-rooms";
import { getPublicNavDestinations } from "../chrome/public-nav.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const HEADER = "src/features/public-site/chrome/PublicSiteHeader.tsx";
const CHROME_CSS = "src/features/public-site/chrome/public-site-chrome.css";
const DARK_SHELL = "src/features/public-site/theme/PublicDarkShell.tsx";
const HOME_SHELL = "src/features/public-site/home-r4/HomeShell.tsx";
const DISCOVERY = "src/features/public-site/discovery/DiscoveryHomePage.tsx";
const PORTFOLIO_LAYOUT = "src/app/portfolio/layout.tsx";
const LEGAL_SHELL = "src/features/legal/components/LegalPageShell.tsx";
const R5_CSS = "src/features/public-site/homepage-r5/homepage-r5.css";
const HOME_CSS = "src/features/public-site/home-r4/styles/home-r4.css";
const ROOMS = "src/features/public-site/homepage-r5/sections/R5RoomExplorer.tsx";
const CONTENT = "src/features/public-site/homepage-r5/content.ts";

/** Source with comments stripped, so prose about a thing is not the thing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
 * ============================================================================
 * Three corrections, and the one that is easiest to get wrong twice.
 *
 * The header pill was removed globally when only two pages wanted it gone. It
 * is a prop again, defaulted ON, and the two pages that own their conversion
 * opt out — so the lock here is not "no pill anywhere", it is "off exactly
 * where a sticky bar exists, on everywhere else".
 * ============================================================================
 */

/* ========================================================================== */
/* 1. The header pill is scoped, not deleted                                   */
/* ========================================================================== */

describe("the consultation pill is per-surface", () => {
  test("the shared header still supports it, and defaults to on", () => {
    const header = read(HEADER);
    assert.match(header, /showConsultation = true/);
    assert.match(header, /readonly showConsultation\?: boolean/);
    assert.match(header, /\{showConsultation \? \(/);
    assert.match(header, /className="od-site-header__cta"/);
    // And its styles exist to render with.
    const css = read(CHROME_CSS);
    assert.match(css, /\.od-site-header__cta \{/);
    assert.match(css, /\.od-site-header__ctaShort \{/);
  });

  test("the two surfaces that own their conversion opt OUT", () => {
    /*
     * Both mount the sticky bottom bar, where the same action sits under a
     * thumb. Carrying the pill as well spends header width restating it.
     */
    assert.match(read(HOME_SHELL), /showConsultation=\{false\}/);
    assert.match(read(DISCOVERY), /showConsultation=\{false\}/);
    assert.match(read(PORTFOLIO_LAYOUT), /showConsultation=\{false\}/);
  });

  test("every other shared surface keeps what it had", () => {
    /*
     * THE REGRESSION THIS PREVENTS.
     *
     * The capability was deleted outright once, which silently took the pill
     * off the legal documents too. They have no sticky bar and no WhatsApp
     * action, so there it was the only conversion affordance above the footer
     * — a Portfolio decision applied to a page that never asked.
     *
     * The shell's default reproduces the pre-existing contract: on everywhere
     * except the Shop boundary, which has its own commerce actions.
     */
    const shell = read(DARK_SHELL);
    assert.match(shell, /showConsultation=\{showConsultation \?\? navCurrent !== "shop"\}/);
    // Legal opts into nothing; it takes the default.
    assert.doesNotMatch(code(read(LEGAL_SHELL)), /showConsultation/);
    assert.doesNotMatch(code(read(LEGAL_SHELL)), /showConversionDock/);
  });

  test("the drawer carries the same decision, not its own", () => {
    const header = read(HEADER);
    const drawer = header.slice(header.indexOf("od-site-header__drawerNav"));
    assert.match(drawer, /\{showConsultation \? \(/);
    assert.match(drawer, /od-site-header__drawerCta/);
  });
});

/* ========================================================================== */
/* 2. PR #181 navigation and drawer are untouched                              */
/* ========================================================================== */

describe("the approved navigation and drawer survive this correction", () => {
  test("Shop off is Portfolio | About; Shop on appends Shop", () => {
    assert.deepEqual(
      getPublicNavDestinations(false).map((i) => i.label),
      ["Portfolio", "About"]
    );
    assert.deepEqual(
      getPublicNavDestinations(true).map((i) => i.label),
      ["Portfolio", "About", "Shop"]
    );
  });

  test("Interiors and Contact are still absent", () => {
    for (const shopEnabled of [false, true]) {
      const items = getPublicNavDestinations(shopEnabled);
      assert.ok(!items.some((i) => /interiors|contact/i.test(i.label)));
      assert.ok(!items.some((i) => (i.href as string) === "/"));
    }
  });

  test("the overlay is still a sibling of the filtered bar", () => {
    const header = read(HEADER);
    const closeTag = header.indexOf("</header>");
    assert.ok(header.indexOf('className="od-site-header__scrim"') > closeTag);
    assert.ok(header.indexOf('className="od-site-header__drawer"') > closeTag);
  });

  test("the drawer is still bounded and the scrim still interactive", () => {
    const css = read(CHROME_CSS);
    const panel = css.slice(
      css.indexOf(".od-site-header__drawer {"),
      css.indexOf(".od-site-header__drawer[data-open]")
    );
    assert.match(panel, /width: min\(80vw, 340px\)/);
    assert.match(panel, /height: auto/);
    assert.match(css, /\.od-site-header__scrim\[data-open\][\s\S]{0,200}pointer-events: auto/);
  });

  test("the tagline still shrinks rather than hiding", () => {
    const css = read(HOME_CSS);
    const block = css.slice(css.indexOf("@media (max-width: 420px)"));
    const narrow = block.slice(0, block.indexOf("@media", 10));
    assert.doesNotMatch(narrow, /\.od-wordmark__tag \{[^}]*display:\s*none/);
  });

  test("Portfolio still mounts the canonical conversion dock", () => {
    assert.match(read(PORTFOLIO_LAYOUT), /showConversionDock/);
    const dock = read("src/features/public-site/chrome/PublicConversionDock.tsx");
    assert.match(dock, /<HomeStickyActions \/>/);
    assert.match(dock, /<DiscoveryWhatsAppFab \/>/);
    assert.doesNotMatch(code(dock), /wa\.me|tel:/);
  });
});

/* ========================================================================== */
/* 3. Section eyebrows are readable landmarks                                  */
/* ========================================================================== */

describe("major section eyebrows are a single readable contract", () => {
  test("one token set drives every eyebrow", () => {
    const css = read(R5_CSS);
    assert.match(css, /--r5-eyebrow-size:\s*clamp\(/);
    assert.match(css, /--r5-eyebrow-weight:\s*700/);
    assert.match(css, /--r5-eyebrow-track:\s*0\.12em/);
    assert.match(css, /--r5-eyebrow-leading:\s*1\.3/);
  });

  test("the sizing lands in the readable band, not the caption band", () => {
    /*
     * Measured before this change: 11.52px at weight 600. `clamp(0.8125rem …
     * 0.875rem)` is 13px rising to 14px, which is the band the owner asked for
     * and still less than half the 30px heading it sits above.
     */
    const css = read(R5_CSS);
    const clampRule = /--r5-eyebrow-size:\s*clamp\(([^)]*)\)/.exec(css)?.[1] ?? "";
    const [min, , max] = clampRule.split(",").map((p) => p.trim());
    assert.equal(min, "0.8125rem");
    assert.equal(max, "0.875rem");
    assert.doesNotMatch(css, /\.r5-eyebrow \{[^}]*font-size:\s*0\.72rem/);
  });

  test("both eyebrow classes read the same tokens", () => {
    const r5 = read(R5_CSS);
    const eyebrow = r5.slice(r5.indexOf("[data-public-home-r4] .r5-eyebrow {"));
    assert.match(eyebrow.slice(0, 400), /font-size: var\(--r5-eyebrow-size\)/);
    assert.match(eyebrow.slice(0, 400), /font-weight: var\(--r5-eyebrow-weight\)/);

    /*
     * `.pm-eyebrow` is the legacy variant on the reviews and consultation
     * bands. It was 11.2px at 0.2em — a different size AND tracking from the
     * eight r5 sections it sits between, so one scroll met two ideas of what a
     * section marker looks like.
     */
    const home = read(HOME_CSS);
    const pm = home.slice(home.indexOf("[data-public-home-r4] .pm-eyebrow {"));
    assert.match(pm.slice(0, 500), /font-size: var\(--r5-eyebrow-size/);
    assert.match(pm.slice(0, 500), /font-weight: var\(--r5-eyebrow-weight/);
    assert.match(pm.slice(0, 500), /letter-spacing: var\(--r5-eyebrow-track/);
  });

  test("the eyebrow sits clear of its heading", () => {
    assert.match(read(R5_CSS), /--r5-eyebrow-gap:\s*14px/);
  });
});

/* ========================================================================== */
/* 4. Major sections begin and end visibly                                     */
/* ========================================================================== */

describe("the homepage has one section rhythm and a visible boundary", () => {
  test("a hairline divides every major section, across both systems", () => {
    const css = read(R5_CSS);
    assert.match(css, /--r5-section-divider:\s*rgba\(255, 249, 240, 0\.07\)/);
    assert.match(
      css,
      /:is\(\.od-int-promo, \.r5-section, \.pm-section\)[\s\S]{0,80}\+ :is\(\.r5-section, \.pm-section\)/
    );
    assert.match(css, /border-top: 1px solid var\(--r5-section-divider\)/);
  });

  test("it is a hairline, not ornament", () => {
    /*
     * The r5 redesign removed a page of bordered cards inside bordered cards.
     * A gold rule or a heavy neutral here would put it straight back.
     */
    const css = read(R5_CSS);
    const rule = css.slice(css.indexOf("--r5-section-divider"));
    assert.doesNotMatch(rule.slice(0, 900), /border-top: [2-9]px/);
    assert.doesNotMatch(rule.slice(0, 900), /border-top:[^;]*gold/i);
  });

  test("the two legacy sections join the shared rhythm", () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * Measured at 390px: every `.r5-section` had 88px of block padding while
     * `.pm-reviews` had 32px and `.pm-close` 36px. Two major sections at a
     * third of their neighbours' spacing is why the page stuttered on the way
     * down. They take `--dc-section-y` now — the same foundation token, not a
     * new scale, and the seven generous sections are untouched.
     */
    const css = read(R5_CSS);
    assert.match(
      css,
      /\[data-public-home-r4\] \.pm-reviews,\s*\n\s*\[data-public-home-r4\] \.pm-close \{\s*\n\s*padding-block: var\(--dc-section-y\);/
    );
    // And the override that held reviews at 32px is gone.
    assert.doesNotMatch(read(HOME_CSS), /\.pm-reviews \{\s*\n\s*padding-block: clamp\(32px/);
  });

  test("no section heading was lost to the restyle", () => {
    for (const section of [
      "R5Services",
      "R5RoomExplorer",
      "R5Why",
      "R5Process",
      "R5Factory",
      "R5Budget",
      "R5Portfolio",
      "R5Faq",
    ]) {
      const src = read(
        `src/features/public-site/homepage-r5/sections/${section}.tsx`
      );
      assert.match(src, /<h2/, `${section} lost its heading`);
      assert.match(src, /r5-eyebrow/, `${section} lost its eyebrow`);
    }
  });
});

/* ========================================================================== */
/* 5. Room by Room is a Portfolio gateway                                      */
/* ========================================================================== */

describe("Room by Room hands off to the real galleries", () => {
  test("the selector is exactly Kitchen | Living Room | Bedroom", () => {
    assert.deepEqual(R5_ROOMS.map((r) => r.label), [
      "Kitchen",
      "Living Room",
      "Bedroom",
    ]);
  });

  test("WARDROBES is gone, and no wardrobes route was invented", () => {
    /*
     * THE FAILURE THIS PREVENTS.
     *
     * Wardrobes was the fourth room. There is no Wardrobes tab in the
     * Portfolio — the taxonomy is Kitchen, Living Room, Bedroom, Projects — so
     * the one option a visitor could pick that led nowhere was in a section
     * inviting them to explore. Minting `?view=wardrobes` would have published
     * a URL for a category the database does not have.
     */
    assert.ok(!R5_ROOMS.some((r) => /wardrobe/i.test(r.label)));
    assert.ok(!R5_ROOMS.some((r) => /wardrobe/i.test(r.id)));
    assert.ok(!R5_ROOMS.some((r) => /wardrobe/i.test(r.portfolioHref)));
    /*
     * Comment-stripped: both files EXPLAIN why `?view=wardrobes` was not
     * minted, and a test that trips on its own documentation teaches people to
     * delete the documentation.
     */
    assert.doesNotMatch(code(read(CONTENT)), /view=wardrobes/);
    assert.doesNotMatch(code(read(ROOMS)), /wardrobe/i);
  });

  test("the room order matches the Portfolio's public order", () => {
    /*
     * A section that previews rooms in one order and hands off to galleries in
     * another asks the visitor to re-find their place on arrival.
     */
    const portfolioRooms = PORTFOLIO_VIEWS.filter((v) => v.isRoomView).map(
      (v) => v.label
    );
    assert.deepEqual(R5_ROOMS.map((r) => r.label), portfolioRooms);
  });

  test("every room points at its real gallery", () => {
    const byId = Object.fromEntries(R5_ROOMS.map((r) => [r.id, r]));
    assert.equal(byId.kitchen!.portfolioHref, "/portfolio");
    assert.equal(byId["living-room"]!.portfolioHref, "/portfolio?view=living-room");
    assert.equal(byId.bedroom!.portfolioHref, "/portfolio?view=bedroom");
    assert.equal(R5_ROOMS_COPY.allProjectsHref, "/portfolio?view=projects");
  });

  test("those hrefs are the Portfolio's own canonical URLs", () => {
    /*
     * Asserted against `PORTFOLIO_VIEWS` rather than retyped, so a future
     * change to the Portfolio's URL model breaks here instead of leaving the
     * homepage pointing at addresses that have moved.
     */
    for (const room of R5_ROOMS) {
      const view = PORTFOLIO_VIEWS.find((v) => v.label === room.label);
      assert.ok(view, `${room.label} has no matching portfolio view`);
      assert.equal(room.portfolioHref, view!.href);
    }
    assert.equal(
      R5_ROOMS_COPY.allProjectsHref,
      PORTFOLIO_VIEWS.find((v) => v.id === "projects")!.href
    );
  });

  test("each room carries its own View <Room> Portfolio label", () => {
    assert.deepEqual(R5_ROOMS.map((r) => r.portfolioLabel), [
      "View Kitchen Portfolio",
      "View Living Room Portfolio",
      "View Bedroom Portfolio",
    ]);
    assert.equal(R5_ROOMS_COPY.allProjectsLabel, "View All Projects");
    assert.match(read(ROOMS), /\{room\.portfolioLabel\}/);
    assert.match(read(ROOMS), /href=\{room\.portfolioHref\}/);
  });

  test("View All Projects is a link OUTSIDE the tablist", () => {
    /*
     * THE ACCESSIBILITY FAILURE THIS PREVENTS.
     *
     * It reads as the fourth control but it navigates to another page. Inside
     * `role="tablist"` it would be a child the pattern does not allow, and the
     * arrow keys would either skip it or "select" a tab that leaves the page.
     */
    const rooms = read(ROOMS);
    const tablistStart = rooms.indexOf('role="tablist"');
    const tablistEnd = rooms.indexOf("</ul>");
    const allAt = rooms.indexOf("r5-rooms-rail__all");
    assert.ok(tablistStart > 0 && tablistEnd > tablistStart);
    assert.ok(allAt > tablistEnd, "the all-projects link must sit after </ul>");
    assert.match(rooms, /<div className="r5-rooms-rail">/);
  });

  test("the tab pattern itself is intact", () => {
    const rooms = read(ROOMS);
    assert.match(rooms, /role="tab"/);
    assert.match(rooms, /aria-selected=\{selected\}/);
    assert.match(rooms, /tabIndex=\{selected \? 0 : -1\}/);
    assert.match(rooms, /role="tabpanel"/);
    assert.match(rooms, /case "ArrowRight"/);
  });

  test("the clickable media does not duplicate the announced link", () => {
    /*
     * The picture is a shortcut for a pointer. Without `aria-hidden` and a
     * removed tab stop, a screen reader would meet the same destination twice
     * in a row — once named after a reference photograph's alt text.
     */
    const rooms = read(ROOMS);
    const media = rooms.slice(rooms.indexOf('className="r5-panel__media"'));
    assert.match(media.slice(0, 300), /aria-hidden="true"/);
    assert.match(media.slice(0, 300), /tabIndex=\{-1\}/);
  });

  test("no nested interactive elements were introduced", () => {
    /*
     * The media link sits in the tabpanel, not inside the tab button, so
     * nothing wraps a control in a control. Asserted structurally: the panel
     * markup must not contain a <button>.
     */
    const rooms = read(ROOMS);
    const panel = rooms.slice(
      rooms.indexOf('role="tabpanel"'),
      rooms.indexOf("</section>")
    );
    assert.doesNotMatch(panel, /<button/);
  });

  test("the portfolio link is a text link, not a second gold button", () => {
    const css = read(R5_CSS);
    const link = css.slice(css.indexOf("[data-public-home-r4] .r5-panel__portfolio {"));
    assert.match(link.slice(0, 500), /border-bottom: 1px solid/);
    assert.doesNotMatch(link.slice(0, 500), /background:\s*var\(--pm-bronze/);
    assert.match(link.slice(0, 500), /min-height: 44px/);
  });

  test("the rail scrolls on one line rather than wrapping", () => {
    const css = read(R5_CSS);
    const rail = css.slice(css.indexOf("[data-public-home-r4] .r5-rooms-rail {"));
    assert.match(rail.slice(0, 400), /overflow-x: auto/);
    assert.doesNotMatch(rail.slice(0, 400), /flex-wrap: wrap/);
    assert.match(css, /\.r5-rooms-rail__all[\s\S]{0,400}min-height: 44px/);
  });

  test("the shared tab list is not dissolved for everyone", () => {
    /*
     * THE REGRESSION THIS PREVENTS, AND IT WAS REAL.
     *
     * `.r5-tabs` is shared — the Budget estimator has its own tablist using the
     * same class. Putting `display: contents` on the bare class to let the room
     * rail lay out four siblings on one line also dissolved the estimator's
     * list, whose parent is not a flex container: its tabs lost their row. The
     * rule is scoped to `.r5-rooms-rail .r5-tabs`, and the shared class keeps
     * the wrapping flex row it always had.
     */
    const css = read(R5_CSS);
    // Comment-stripped: the note above the rail rule explains `display:
    // contents`, and a test that trips on its own documentation teaches people
    // to delete the documentation.
    const shared = code(
      css.slice(
        css.indexOf("[data-public-home-r4] .r5-tabs {"),
        css.indexOf("[data-public-home-r4] .r5-rooms-rail .r5-tabs {")
      )
    );
    assert.match(shared, /display: flex/);
    assert.doesNotMatch(shared, /display: contents/);
    assert.match(css, /\.r5-rooms-rail \.r5-tabs \{[\s\S]{0,40}display: contents/);
    // The estimator still renders a tablist of its own.
    assert.match(
      read("src/features/public-site/homepage-r5/sections/R5Budget.tsx"),
      /className="r5-tabs" role="tablist"/
    );
  });

  test("the scrolling rail says it scrolls", () => {
    /*
     * Measured at 320px: three pills plus the link need ~471px inside a 280px
     * rail, so something is off-screen at every phone width whatever the
     * layout — the owner's preferred answer is a scrolling rail over two
     * cramped rows. The trailing fade is what makes that scroll discoverable
     * instead of looking like a clipped control.
     *
     * `mask-image`, not an overlaid gradient: nothing is painted over the last
     * pill and nothing intercepts a tap. It lifts once everything fits, so a
     * full rail does not sit there looking permanently truncated.
     */
    const css = read(R5_CSS);
    assert.match(css, /@media \(max-width: 620px\)[\s\S]{0,260}\.r5-rooms-rail \{[\s\S]{0,200}mask-image/);
    assert.doesNotMatch(
      css.slice(css.indexOf("[data-public-home-r4] .r5-rooms-rail {"), css.indexOf(".r5-rooms-rail::-webkit-scrollbar")),
      /mask-image/,
      "the fade must not apply at widths where the rail already fits"
    );
  });

  test("the reference disclaimer keeps its meaning", () => {
    /*
     * Homepage room imagery is approved reference work, not delivered project
     * photography. The new link is the route to the real thing, which makes
     * the caption more important rather than less.
     */
    const content = read(CONTENT);
    assert.match(content, /Reference visual\. Approved project photography lives on the portfolio\./);
    assert.match(read(ROOMS), /REFERENCE_IMAGERY_NOTE/);
  });
});

/* ========================================================================== */
/* 6. Nothing underneath moved                                                 */
/* ========================================================================== */

describe("this stayed a presentation change", () => {
  test("no schema DDL in anything this touched", () => {
    for (const rel of [HEADER, DARK_SHELL, PORTFOLIO_LAYOUT, ROOMS, CONTENT, HOME_SHELL]) {
      assert.doesNotMatch(
        read(rel),
        /\b(create table|alter table|create policy|grant )\b/i,
        rel
      );
    }
  });

  test("the Portfolio URL model is unchanged", () => {
    assert.deepEqual(PORTFOLIO_VIEWS.map((v) => v.label), [
      "Kitchen",
      "Living Room",
      "Bedroom",
      "Projects",
    ]);
    assert.equal(PORTFOLIO_VIEWS[0]!.href, "/portfolio");
  });
});
