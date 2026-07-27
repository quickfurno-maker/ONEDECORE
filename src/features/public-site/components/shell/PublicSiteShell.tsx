import type { ReactNode } from "react";
import type { HeaderCtaConfig, HeaderVisualMode, PublicFooterConfig } from "../../types/shell";
import type { NavigationItem } from "../../types/shell";
import { PUBLIC_MAIN_ID } from "../../config/public-navigation";
import { publicSiteFontVariables } from "../../fonts";
import { cn } from "../../utils/cn";
import { SkipLink } from "../primitives/SkipLink";
import { PublicHeader } from "../header/PublicHeader";
import { PublicFooter } from "../footer/PublicFooter";

export interface PublicSiteShellProps {
  children: ReactNode;
  navigation: readonly NavigationItem[];
  headerMode?: HeaderVisualMode;
  cta?: HeaderCtaConfig | null;
  footer: PublicFooterConfig;
  className?: string;
}

export function PublicSiteShell({
  children,
  navigation,
  headerMode = "solid",
  cta = null,
  footer,
  className,
}: PublicSiteShellProps) {
  return (
    <div
      data-public-site=""
      className={cn("ps-shell", publicSiteFontVariables, className)}
    >
      <SkipLink targetId={PUBLIC_MAIN_ID} />
      <PublicHeader navigation={navigation} headerMode={headerMode} cta={cta} />
      <main id={PUBLIC_MAIN_ID} className="ps-main" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter config={footer} />
    </div>
  );
}
