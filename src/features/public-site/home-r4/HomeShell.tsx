import type { ReactNode } from "react";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { getLeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
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
  const shopEnabled = isShopPublicEnabled();
  /*
   * Resolved on the SERVER and passed down, so the sheet renders the same mode
   * on both sides of hydration. Reading it in the client component would give a
   * different answer during SSR and flip the form on first paint.
   */
  const leadFormMode = getLeadFormMode();

  return (
    <div data-public-home-r4="" data-public-dark-theme="">
      <HomeScrollProgress />
      <a className="dc-skip" href={`#${MAIN_ID}`}>
        Skip to content
      </a>

      {unifiedNav ? (
        <PublicSiteHeader current="interiors" shopEnabled={shopEnabled} />
      ) : (
        <HomeNavigation />
      )}

      <main id={MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <HomeStickyActions />
      {unifiedNav ? (
        <PublicSiteFooter shopEnabled={shopEnabled} />
      ) : (
        <HomeFooter />
      )}
      <HomePlannerSheet leadFormMode={leadFormMode} />
      <RevealRuntime />
    </div>
  );
}
