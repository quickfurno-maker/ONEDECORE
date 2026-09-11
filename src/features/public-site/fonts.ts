import { Inter, Raleway } from "next/font/google";

/**
 * Public site typefaces. Self-hosted through next/font; no runtime CDN request.
 *
 * INTER FOR THE INTERFACE
 *
 * The UI face was Plus Jakarta Sans, which is a personable display sans with
 * wide apertures and a slight geometric bounce. It reads well at headline size
 * and works against the interface at body size: the homepage carries a lot of
 * short labels, tags, numbers and tabular budget ranges, and Jakarta makes all
 * of them slightly warmer and slightly less legible than they need to be.
 *
 * Inter is drawn for screens at exactly those sizes — tall x-height, unambiguous
 * figures, tight vertical metrics — which is why it costs nothing in elegance
 * and buys back a great deal of calm. The luxury in this redesign comes from
 * whitespace, photography and restraint, not from the typeface having opinions.
 *
 * RALEWAY STAYS, AND ONLY FOR THE WORDMARK
 *
 * The ONEDECORE logo is a Raleway 200/800 split treatment. It is brand
 * artwork, not interface, so it is deliberately untouched by this change — a
 * logo redrawn in a different face is a different logo. `--dc-font-wordmark`
 * continues to feed only the wordmark component; nothing else may use it.
 */
export const inter = Inter({
  subsets: ["latin"],
  /*
   * 400 body, 500 navigation, 600 buttons/eyebrows/card titles, 700 headings
   * and metrics. 800/900 are deliberately absent: the old scale leaned on 800
   * for emphasis, and at Inter's weight-per-step that reads as shouting.
   */
  weight: ["400", "500", "600", "700"],
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

export const publicSiteFontVariables = `${inter.variable} ${raleway.variable}`;
