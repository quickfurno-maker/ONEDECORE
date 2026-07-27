import type { NavigationItem, PublicShellConfig } from "../types/shell";

export const PUBLIC_MAIN_ID = "main-content" as const;

/** Frozen scroll threshold — docs/design/phase-2f-implementation-plan.md §8 */
export const HEADER_SCROLL_THRESHOLD_PX = 80;

export const APPROVED_SERVICE_NAMES = [
  "Complete Home Interiors",
  "Modular Kitchens",
  "Custom Wardrobes",
] as const;

/** Production routes verified in Phase 2E3B / 2F-C1 — no future-route links. */
export const PRODUCTION_PUBLIC_NAVIGATION: readonly NavigationItem[] = [
  { label: "Home", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
] as const;

export const PRODUCTION_SHELL_CONFIG: PublicShellConfig = {
  headerMode: "solid",
  navigation: PRODUCTION_PUBLIC_NAVIGATION,
  cta: null,
  footer: {
    showServiceNames: true,
    linkGroups: [
      {
        title: "Explore",
        links: [
          { label: "Home", href: "/" },
          { label: "Portfolio", href: "/portfolio" },
        ],
      },
    ],
    legalLinks: [],
    contact: null,
    socialLinks: [],
  },
};

const UNSAFE_HREF_PATTERN = /^(?:javascript:|data:|mailto:|tel:)/i;

export function isSafeInternalHref(href: string): href is `/${string}` {
  return href.startsWith("/") && !href.startsWith("//") && !UNSAFE_HREF_PATTERN.test(href);
}

export function assertProductionNavigation(items: readonly NavigationItem[]): void {
  for (const item of items) {
    if (!isSafeInternalHref(item.href)) {
      throw new Error(`Unsafe navigation href: ${item.href}`);
    }
    if (item.href.includes("#")) {
      throw new Error(`Placeholder navigation href is forbidden in production: ${item.href}`);
    }
  }
}
