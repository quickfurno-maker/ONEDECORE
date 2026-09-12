/**
 * The public information architecture, in one place.
 *
 * TWO DESTINATIONS, NOT FIVE
 *
 * `Portfolio | About`, plus Shop when its gate is on. That is the whole menu.
 *
 * WHY INTERIORS LEFT
 *
 * It pointed at `/`, which is exactly where the wordmark beside it already
 * goes. Two controls a thumb's width apart, with different words, doing the
 * same thing — and on the homepage itself the item was marked current while
 * naming a place the visitor was already standing. It cost a menu slot to
 * restate the logo.
 *
 * WHY CONTACT LEFT
 *
 * It pointed at `/#contact`, and every public page already carries at least
 * two live routes to that section: the sticky conversion bar with its
 * consultation button and call link, the WhatsApp action, and the footer's
 * consultation link. A menu entry was a fourth path to the same band, spending
 * the scarcest slot on the smallest screen on something three other controls
 * were already doing better.
 *
 * NOTHING BEHIND EITHER WAS REMOVED. `/` is the homepage, `/interiors` is
 * still a 308 to it, `#contact` is still the consultation band and still the
 * target of `PUBLIC_CONSULTATION`. This list decides what the MENU shows.
 *
 * THERE IS NO "HOME" ITEM
 *
 * The wordmark links to `/` and is the home affordance every visitor already
 * expects. A separate Home entry spends a menu slot on something the logo
 * already does, and on mobile that slot is expensive.
 *
 * Header, mobile drawer and footer all read this list. They used to drift.
 */

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

/**
 * The menu when Shop is not publicly enabled.
 *
 * Shop is absent rather than disabled: a visible link to a gated surface is a
 * dead end wearing a menu item's clothes.
 */
export const PUBLIC_NAV_CORE = [
  PUBLIC_NAV_PORTFOLIO,
  PUBLIC_NAV_ABOUT,
] as const;

/**
 * Locked public IA destinations.
 *
 * Shop is APPENDED, not inserted second.
 *
 * It used to sit second because Interiors sat first and the two were the
 * brand's two verticals — Shop ahead of Portfolio and About said "this is the
 * other half of the business, not an afterthought". Interiors is gone from the
 * menu, so that pairing no longer exists to lead: the remaining two items are
 * the proof and the brand, and Shop reads correctly after them as the third
 * destination rather than jumping the queue ahead of the work.
 */
export function getPublicNavDestinations(shopEnabled: boolean) {
  return shopEnabled
    ? ([PUBLIC_NAV_PORTFOLIO, PUBLIC_NAV_ABOUT, PUBLIC_NAV_SHOP] as const)
    : PUBLIC_NAV_CORE;
}

/** @deprecated Prefer getPublicNavDestinations(shopEnabled). Kept for source-compat during simplification. */
export const PUBLIC_NAV_DESTINATIONS = getPublicNavDestinations(true);

/**
 * Canonical public consultation target.
 *
 * `#contact` is the homepage's closing section: one band, one purpose, one
 * anchor. `#consultation` remains a live alias on that same section —
 * `/portfolio/[slug]` and the Shop nav link to it, and breaking an anchor to
 * save a word would be a poor trade.
 *
 * This anchor OUTLIVED the Contact menu item, and is now the whole reason
 * removing that item cost nothing: the sticky conversion bar, the WhatsApp
 * action and the footer all still arrive here.
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
