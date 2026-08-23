import type { ReactNode } from "react";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { HomeFooter } from "./HomeFooter";
import { HomeNavigation } from "./HomeNavigation";
import { HomePlannerSheet } from "./HomePlanner";
import { HomeScrollProgress } from "./HomeScrollProgress";
import { HomeStickyActions } from "./HomeStickyActions";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import "@/features/public-site/chrome/public-site-chrome.css";

const MAIN_ID = "pm-main";

/** Production homepage chrome: skip link, nav, main, sticky, footer, planner sheet. */
export function HomeShell({
  children,
  unifiedNav = false,
}: {
  readonly children: ReactNode;
  readonly unifiedNav?: boolean;
}) {
  return (
    <div data-public-home-r4="" data-public-dark-theme="">
      <HomeScrollProgress />
      <a className="dc-skip" href={`#${MAIN_ID}`}>
        Skip to content
      </a>

      {unifiedNav ? <PublicSiteHeader current="interiors" /> : <HomeNavigation />}

      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <HomeStickyActions />
      {unifiedNav ? <PublicSiteFooter /> : <HomeFooter />}
      <HomePlannerSheet />
      <RevealRuntime />
    </div>
  );
}
