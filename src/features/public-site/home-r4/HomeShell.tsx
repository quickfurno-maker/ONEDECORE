import type { ReactNode } from "react";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { HomeFooter } from "./HomeFooter";
import { HomeNavigation } from "./HomeNavigation";
import { HomeScrollProgress } from "./HomeScrollProgress";
import { HomeStickyActions } from "./HomeStickyActions";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import "@/features/public-site/chrome/public-site-chrome.css";

const MAIN_ID = "pm-main";

/**
 * Production page chrome: skip link, nav, main, sticky actions, footer.
 *
 * It no longer mounts the consultation sheet. `LeadConsultationHost` owns that,
 * once per page — a shell that mounted its own would give a page two sheets
 * with two independent plan states whenever the host was also present.
 */
export function HomeShell({
  children,
  unifiedNav = false,
}: {
  readonly children: ReactNode;
  readonly unifiedNav?: boolean;
}) {
  const shopEnabled = isShopPublicEnabled();

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
      <RevealRuntime />
    </div>
  );
}
