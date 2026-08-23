import type { ReactNode } from "react";
import Link from "next/link";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";

export type PublicChromeNavCurrent = "portfolio" | "shop" | "none";

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
        <header className="od-portfolio-chrome">
          <OneDecoreWordmark size="nav" className="od-portfolio-chrome__mark" />
          <nav className="od-portfolio-chrome__nav" aria-label="Public site">
            <Link
              href="/"
              className="od-portfolio-chrome__link od-portfolio-chrome__home"
            >
              Home
            </Link>
            <Link
              href="/portfolio"
              className="od-portfolio-chrome__link"
              aria-current={navCurrent === "portfolio" ? "page" : undefined}
            >
              Portfolio
            </Link>
            <Link
              href="/shop"
              className="od-portfolio-chrome__link"
              aria-current={navCurrent === "shop" ? "page" : undefined}
            >
              Shop
            </Link>
            <Link
              href="/#estimate"
              className="od-portfolio-chrome__link od-portfolio-chrome__cta"
              aria-label="Get Price Estimate"
            >
              <span className="od-portfolio-chrome__ctaFull">
                Get Price Estimate
              </span>
              <span className="od-portfolio-chrome__ctaShort" aria-hidden="true">
                Estimate
              </span>
            </Link>
          </nav>
        </header>
      ) : null}

      <div id="public-content" className="od-public-content" tabIndex={-1}>
        {children}
      </div>

      {showChrome ? (
        <footer className="od-portfolio-footer">
          <p>
            ONEDECORE · <Link href="/">Home</Link>
            {" · "}
            <Link href="/portfolio">Portfolio</Link>
            {" · "}
            <Link href="/shop">Shop</Link>
          </p>
          {footerNote ? (
            <p className="od-portfolio-footer__note">{footerNote}</p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
