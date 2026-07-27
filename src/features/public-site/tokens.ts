/**
 * Frozen Direction A token contract — values must match docs/design/phase-2f-design-tokens.md
 */
export const PUBLIC_SITE_TOKEN_SCOPE = "[data-public-site]" as const;

export const PUBLIC_SITE_COLORS = {
  canvas: "#F7F5F2",
  surface: "#FDFCFA",
  stone: "#EDE9E3",
  textPrimary: "#1A1816",
  textMuted: "#5C574F",
  accent: "#8B6F47",
  accentHover: "#7A6240",
  accentPressed: "#6B5538",
  border: "#E8E4DE",
  borderStrong: "#D4CEC4",
  darkSection: "#1A1816",
  darkSectionText: "#F7F5F2",
  darkSectionMuted: "#B8B2A8",
  scrim: "rgba(139, 111, 71, 0.25)",
  scrimStrong: "rgba(26, 24, 22, 0.45)",
  focus: "#8B6F47",
  selection: "rgba(139, 111, 71, 0.2)",
  error: "#B42318",
  success: "#2D6A4F",
  headerTransparent: "transparent",
  headerSolid: "#FDFCFA",
} as const;

/** Prohibited amber/yellow template values — must never appear in public-site tokens. */
export const FORBIDDEN_PUBLIC_SITE_COLORS = [
  "#F59E0B",
  "#D97706",
  "#FBBF24",
  "#FCD34D",
] as const;

export const PUBLIC_SITE_SPACING = {
  space1: "4px",
  space2: "8px",
  space3: "12px",
  space4: "16px",
  space6: "24px",
  space8: "32px",
  space12: "48px",
  space16: "64px",
  space24: "96px",
  space32: "128px",
} as const;

export const PUBLIC_SITE_LAYOUT = {
  containerContent: "1280px",
  containerWide: "1440px",
  editorialWidth: "720px",
  gutterLg: "48px",
  gutterMd: "32px",
  gutterSm: "20px",
} as const;

export const PUBLIC_SITE_MOTION = {
  durationFast: "300ms",
  durationBase: "600ms",
  durationSlow: "800ms",
  revealDistance: "24px",
  ioThreshold: 0.2,
} as const;

export const PUBLIC_SITE_RADIUS = {
  none: "0",
  sm: "2px",
  md: "4px",
} as const;

export const PUBLIC_SITE_Z_INDEX = {
  header: 50,
  mobileNavOverlay: 60,
  mobileNavDrawer: 70,
  skipLink: 100,
} as const;

export type ContainerWidth = "content" | "wide" | "full";
export type SectionSurface = "default" | "stone" | "dark";
export type SectionSpacing = "default" | "compact" | "none";
export type ImageFrameRatio = "hero" | "service" | "portfolio" | "square" | "material";
