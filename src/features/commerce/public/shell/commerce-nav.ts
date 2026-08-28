import { PUBLIC_FOOTER_LEGAL } from "@/features/public-site/chrome/public-nav.ts";
import type { PublicCommerceCategory } from "../public-types.ts";

export interface CommerceNavNode {
  readonly name: string;
  readonly slug: string;
  readonly href: string;
  readonly shortDescription: string | null;
  readonly children: readonly CommerceNavNode[];
}

/** Maximum root categories surfaced in the desktop mega-nav bar. */
export const COMMERCE_NAV_ROOT_LIMIT = 8;

function toNode(row: PublicCommerceCategory, children: readonly CommerceNavNode[]): CommerceNavNode {
  return {
    name: row.name,
    slug: row.slug,
    href: `/shop/c/${row.slug}`,
    shortDescription: row.shortDescription,
    children,
  };
}

/**
 * Builds the real catalogue hierarchy for the retail nav.
 * Only categories published by the catalogue appear — no invented departments.
 */
export function buildCommerceNavTree(
  categories: readonly PublicCommerceCategory[]
): readonly CommerceNavNode[] {
  const bySortOrder = (a: PublicCommerceCategory, b: PublicCommerceCategory) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

  const roots = categories.filter((row) => row.isRoot).slice().sort(bySortOrder);

  return roots.slice(0, COMMERCE_NAV_ROOT_LIMIT).map((root) => {
    const children = categories
      .filter((row) => !row.isRoot && row.parentSlug === root.slug)
      .slice()
      .sort(bySortOrder)
      .map((child) => toNode(child, []));
    return toNode(root, children);
  });
}

/**
 * Utility-bar destinations. Every entry is a route that exists in this app —
 * no store locator, support phone, or bulk-order desk is implied.
 */
export const COMMERCE_UTILITY_LINKS = [
  { id: "track", label: "Track order", href: "/shop/track" },
  { id: "interiors", label: "Interior design", href: "/" },
  { id: "portfolio", label: "Our work", href: "/portfolio" },
] as const;

/** Large retail footer columns — real routes only. */
export const COMMERCE_FOOTER_SHOP_LINKS = [
  { label: "All furniture", href: "/shop" },
  { label: "Search furniture", href: "/shop/search" },
  { label: "Your cart", href: "/shop/cart" },
  { label: "Track an order", href: "/shop/track" },
] as const;

export const COMMERCE_FOOTER_BRAND_LINKS = [
  { label: "Complete home interiors", href: "/" },
  { label: "Interior services", href: "/interiors" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Free design consultation", href: "/#consultation" },
] as const;

export const COMMERCE_FOOTER_LEGAL_LINKS = PUBLIC_FOOTER_LEGAL;
