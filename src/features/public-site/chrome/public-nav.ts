/**
 * The public information architecture, in one place.
 *
 * ONEDECORE is one brand with two customer journeys — designing a home, and
 * furnishing one — and the menu is where that decision is first offered. So the
 * order is deliberate: Interiors and Shop are the two verticals, Portfolio is
 * the proof, About and Contact are the brand and the way in.
 *
 * THERE IS NO "HOME" ITEM
 *
 * The wordmark links to `/` and is the home affordance every visitor already
 * expects. A separate Home entry spends a menu slot on something the logo
 * already does, and on mobile that slot is expensive.
 *
 * Header, mobile drawer and footer all read this list. They used to drift.
 */

/**
 * Interiors points at the site root, because that is where it lives now.
 *
 * The label stays "Interiors" rather than becoming "Home". It names the
 * business category a visitor is choosing between — the other being Shop — and
 * "Home" would name a position in the site instead, which the wordmark already
 * covers. So the wordmark and this item share a destination and say different
 * things: one is the way back, one is the vertical.
 *
 * `/interiors` is a 308 to `/`. Linking to it here would send every visitor
 * through a redirect to reach a page the menu could have pointed at directly.
 */
export const PUBLIC_NAV_INTERIORS = {
  id: "interiors",
  label: "Interiors",
  href: "/",
} as const;

export const PUBLIC_NAV_SHOP = {
  id: "shop",
  label: "Shop",
  href: "/shop",
} as const;

export const PUBLIC_NAV_PORTFOLIO = {
  id: "portfolio",
  label: "Portfolio",
  href: "/portfolio",
} as const;

export const PUBLIC_NAV_ABOUT = {
  id: "about",
  label: "About",
  href: "/#about",
} as const;

export const PUBLIC_NAV_CONTACT = {
  id: "contact",
  label: "Contact",
  href: "/#contact",
} as const;

/**
 * The menu when Shop is not publicly enabled.
 *
 * Shop is absent rather than disabled: a visible link to a gated surface is a
 * dead end wearing a menu item's clothes.
 */
export const PUBLIC_NAV_CORE = [
  PUBLIC_NAV_INTERIORS,
  PUBLIC_NAV_PORTFOLIO,
  PUBLIC_NAV_ABOUT,
  PUBLIC_NAV_CONTACT,
] as const;

/**
 * Locked public IA destinations.
 *
 * Shop takes SECOND position when the fail-closed gate is on — it is one of the
 * two verticals, not an appendix. It used to be appended last, which read as an
 * afterthought bolted onto an interiors site.
 */
export function getPublicNavDestinations(shopEnabled: boolean) {
  return shopEnabled
    ? ([
        PUBLIC_NAV_INTERIORS,
        PUBLIC_NAV_SHOP,
        PUBLIC_NAV_PORTFOLIO,
        PUBLIC_NAV_ABOUT,
        PUBLIC_NAV_CONTACT,
      ] as const)
    : PUBLIC_NAV_CORE;
}

/** @deprecated Prefer getPublicNavDestinations(shopEnabled). Kept for source-compat during simplification. */
export const PUBLIC_NAV_DESTINATIONS = getPublicNavDestinations(true);

/**
 * Canonical public consultation target.
 *
 * `#contact` is the homepage's closing section and the Contact menu
 * destination: one band, one purpose, one anchor. `#consultation` remains a
 * live alias on that same section — `/portfolio/[slug]` and the Shop nav link
 * to it, and breaking an anchor to save a word would be a poor trade.
 */
export const PUBLIC_CONSULTATION = {
  label: "Get Free Design Consultation",
  shortLabel: "Free Design Consultation",
  /** Compact label for mobile bottom dock */
  mobileLabel: "Get Free Design",
  href: "/#contact",
} as const;

/** Homepage consultation deep-links with safe service preselection. */
export const PUBLIC_CONSULTATION_BY_SERVICE = {
  "complete-home-interiors": "/?service=complete-home-interiors#consultation",
  "modular-kitchens": "/?service=modular-kitchens#consultation",
  "custom-wardrobes": "/?service=custom-wardrobes#consultation",
} as const;

export const PUBLIC_FOOTER_LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Data Rights", href: "/data-rights" },
  { label: "Communication Consent", href: "/communication-consent" },
  { label: "Warranty", href: "/warranty" },
] as const;

/**
 * Which public page is being rendered.
 *
 * `home` remains a page identity even though there is no Home menu item — the
 * header uses it to decide whether Shop utilities belong in the bar. Anchor
 * destinations deliberately have no current state: `#about` and `#contact` are
 * places on a page, and marking them "current" would be a claim the header
 * cannot keep as the visitor scrolls.
 */
export type PublicNavCurrent =
  | "home"
  | "interiors"
  | "shop"
  | "portfolio"
  | "none";
