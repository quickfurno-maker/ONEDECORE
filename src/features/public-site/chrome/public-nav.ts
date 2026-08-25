export const PUBLIC_NAV_CORE = [
  { id: "home", label: "Home", href: "/" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
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

export const PUBLIC_CONSULTATION = {
  label: "Get Free Consultation",
  shortLabel: "Free Consultation",
  href: "/interiors#consultation",
} as const;

export const PUBLIC_FOOTER_LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Data Rights", href: "/data-rights" },
  { label: "Communication Consent", href: "/communication-consent" },
  { label: "Warranty", href: "/warranty" },
] as const;

export type PublicNavCurrent = "home" | "interiors" | "shop" | "portfolio" | "none";
