export const PUBLIC_NAV_DESTINATIONS = [
  { id: "interiors", label: "Interiors", href: "/interiors" },
  { id: "kitchens", label: "Kitchens", href: "/interiors#modular-kitchen" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "shop", label: "Shop Furniture", href: "/shop" },
  { id: "about", label: "About", href: "/#about" },
] as const;

export const PUBLIC_CONSULTATION = {
  label: "Get Free Consultation",
  shortLabel: "Consult",
  href: "/interiors#consultation",
} as const;

export const PUBLIC_FOOTER_LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Warranty", href: "/warranty" },
] as const;

export type PublicNavCurrent = "home" | "interiors" | "shop" | "portfolio" | "none";
