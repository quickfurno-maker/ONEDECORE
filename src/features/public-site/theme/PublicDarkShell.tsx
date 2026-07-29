import type { ReactNode } from "react";
import Link from "next/link";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";

interface PublicDarkShellProps {
  readonly children: ReactNode;
  readonly showChrome?: boolean;
}

/** Server-rendered public dark shell — no client theme runtime. */
export function PublicDarkShell({
  children,
  showChrome = true,
}: PublicDarkShellProps) {
  return (
    <div
      className={`${publicSiteFontVariables} od-portfolio-shell`}
      data-public-dark-theme=""
    >
      {showChrome ? (
        <header className="od-portfolio-chrome">
          <OneDecoreWordmark size="nav" />
          <nav className="od-portfolio-chrome__nav" aria-label="Public site">
            <Link href="/" className="od-portfolio-chrome__link">
              Home
            </Link>
            <Link href="/portfolio" className="od-portfolio-chrome__link">
              Portfolio
            </Link>
            <Link
              href="/#estimate"
              className="od-portfolio-chrome__link od-portfolio-chrome__cta"
            >
              Get Estimate
            </Link>
          </nav>
        </header>
      ) : null}
      {children}
      {showChrome ? (
        <footer className="od-portfolio-footer">
          <p>
            ONEDECORE ·{" "}
            <Link href="/">Home</Link>
            {" · "}
            <Link href="/portfolio">Portfolio</Link>
          </p>
        </footer>
      ) : null}
    </div>
  );
}
