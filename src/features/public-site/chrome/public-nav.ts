export const PUBLIC_NAV_ABOUT = {
  id: "about",
  label: "About",
  href: "/#about",
} as const;

export const PUBLIC_NAV_CORE = [
  { id: "home", label: "Home", href: "/" },
  { id: "interiors", label: "Interiors", href: "/interiors" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  PUBLIC_NAV_ABOUT,
] as const;

export const PUBLIC_NAV_SHOP = {
  id: "shop",
  label: "Shop",
  href: "/shop",
} as const;

/** Locked public IA destinations; Shop is appended only when the fail-closed gate is ON. */
export function getPublicNavDestinations(shopEnabled: boolean) {
  return shopEnabled
    ? ([...PUBLIC_NAV_CORE, PUBLIC_NAV_SHOP] as const)
    : PUBLIC_NAV_CORE;
}

/** @deprecated Prefer getPublicNavDestinations(shopEnabled). Kept for source-compat during simplification. */
export const PUBLIC_NAV_DESTINATIONS = [
  ...PUBLIC_NAV_CORE,
  PUBLIC_NAV_SHOP,
] as const;

/** Canonical public consultation target — homepage owns the lead form. */
export const PUBLIC_CONSULTATION = {
  label: "Get Free Design Consultation",
  shortLabel: "Free Design Consultation",
  /** Compact label for mobile bottom dock */
  mobileLabel: "Get Free Design",
  href: "/#consultation",
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

export type PublicNavCurrent = "home" | "interiors" | "shop" | "portfolio" | "about" | "none";
