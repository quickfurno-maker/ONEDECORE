import type { ReactNode } from "react";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import type { PublicNavCurrent } from "@/features/public-site/chrome/public-nav";
import "@/features/public-site/theme/public-dark-theme.css";
import "@/features/public-site/chrome/public-site-chrome.css";

export type PublicChromeNavCurrent = PublicNavCurrent;

interface PublicDarkShellProps {
  readonly children: ReactNode;
  readonly showChrome?: boolean;
  /** Which primary nav item is current. Legal drafts use `"none"`. */
  readonly navCurrent?: PublicChromeNavCurrent;
  /** Optional compact footer note (e.g. draft-review disclaimer). */
  readonly footerNote?: ReactNode;
}

/** Server-rendered public dark shell — no client theme runtime. */
export function PublicDarkShell({
  children,
  showChrome = true,
  navCurrent = "portfolio",
  footerNote,
}: PublicDarkShellProps) {
  const shopEnabled = isShopPublicEnabled();

  return (
    <div
      className={`${publicSiteFontVariables} od-portfolio-shell`}
      data-public-dark-theme=""
    >
      {showChrome ? (
        <a className="od-skip" href="#public-content">
          Skip to content
        </a>
      ) : null}

      {showChrome ? (
        <PublicSiteHeader
          current={navCurrent}
          showConsultation={navCurrent !== "shop"}
          shopEnabled={shopEnabled}
          showShopSearch={shopEnabled && navCurrent === "shop"}
        />
      ) : null}

      <div id="public-content" className="od-public-content" tabIndex={-1}>
        {children}
      </div>

      {showChrome ? <PublicSiteFooter note={footerNote} shopEnabled={shopEnabled} /> : null}
    </div>
  );
}
