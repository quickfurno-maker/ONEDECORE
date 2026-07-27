import { Cormorant_Garamond, Inter } from "next/font/google";

/**
 * Direction A display typography — self-hosted at build via next/font/google.
 * Apply only within `[data-public-site]` consumers; do not attach to root body.
 */
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-cormorant",
  preload: true,
});

/**
 * Direction A body/UI typography — self-hosted at build via next/font/google.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

/** Stable CSS variable names exported for tests and composition. */
export const PUBLIC_SITE_FONT_VARIABLES = {
  display: "--font-cormorant",
  body: "--font-inter",
} as const;

/** Class string applying both font CSS variables for public-site scopes. */
export const publicSiteFontVariables = `${cormorantGaramond.variable} ${inter.variable}`;
