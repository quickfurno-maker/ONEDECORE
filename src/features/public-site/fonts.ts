import { Plus_Jakarta_Sans, Raleway } from "next/font/google";

/**
 * Homepage typefaces. Self-hosted through next/font; no runtime CDN.
 * Raleway is loaded at two weights because the wordmark is the only place it
 * appears, and it needs the light/bold contrast for the split treatment.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--dc-font-ui",
  preload: true,
});

export const raleway = Raleway({
  subsets: ["latin"],
  weight: ["200", "800"],
  display: "swap",
  variable: "--dc-font-wordmark",
  preload: true,
});

export const publicSiteFontVariables = `${jakarta.variable} ${raleway.variable}`;
