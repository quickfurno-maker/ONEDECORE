import type { ReactNode } from "react";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";

/**
 * Portfolio gets the homepage's conversion treatment.
 *
 * A visitor who has just looked through a room gallery is the most qualified
 * traffic on the site, and until now the page ended with a footer. The sticky
 * consultation bar and the WhatsApp action are the same two components the
 * homepage mounts — see `PublicConversionDock`.
 *
 * The header pill goes off HERE rather than in the shared header, because the
 * reason is local: this page now owns the conversion at the bottom of the
 * screen. Pages without a sticky bar keep theirs.
 */
export default function PortfolioLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <PublicDarkShell showConsultation={false} showConversionDock>
      {children}
    </PublicDarkShell>
  );
}
