/** Frozen shell header visual mode — overlay reserved for approved hero surfaces (C3+). */
export type HeaderVisualMode = "solid" | "overlay";

export type ShellHeaderMode = HeaderVisualMode;

/** Internal navigation destination — statically controlled paths only. */
export type InternalRouteHref = `/${string}`;

export interface NavigationItem {
  readonly label: string;
  readonly href: InternalRouteHref;
}

export interface HeaderCtaConfig {
  readonly label: string;
  readonly href: string;
  /** When true, href is allowed for preview QA only and must not ship in production shell. */
  readonly previewOnly?: boolean;
}

export interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface FooterLinkGroup {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

export interface PublicFooterConfig {
  readonly showServiceNames: boolean;
  readonly linkGroups: readonly FooterLinkGroup[];
  readonly legalLinks: readonly FooterLink[];
  readonly contact: null;
  readonly socialLinks: readonly FooterLink[];
}

export interface PublicShellConfig {
  readonly headerMode: ShellHeaderMode;
  readonly navigation: readonly NavigationItem[];
  readonly cta: HeaderCtaConfig | null;
  readonly footer: PublicFooterConfig;
}
