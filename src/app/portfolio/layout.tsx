import type { ReactNode } from "react";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";

/**
 * Portfolio gets the homepage's conversion treatment.
 *
 * A visitor who has just looked through a room gallery is the most qualified
 * traffic on the site, and until now the page ended with a footer. The sticky
 * consultation bar and the WhatsApp action are the same two components the
 * homepage mounts — see `PublicConversionDock`.
 */
export default function PortfolioLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PublicDarkShell showConversionDock>{children}</PublicDarkShell>;
}
