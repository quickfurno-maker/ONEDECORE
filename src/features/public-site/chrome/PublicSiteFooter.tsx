import type { ReactNode } from "react";
import Link from "next/link";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { SITE_CONFIG } from "@/config/site";
import { PUBLIC_CONSULTATION, PUBLIC_FOOTER_LEGAL, PUBLIC_NAV_DESTINATIONS } from "./public-nav";

export function PublicSiteFooter({
  note,
}: {
  readonly note?: ReactNode;
}) {
  return (
    <footer className="od-site-footer">
      <div className="od-site-footer__top">
        <div className="od-site-footer__brand">
          <OneDecoreWordmark size="footer" />
          <p>
            Premium interiors, modular kitchens and furniture for homes across Pune.
          </p>
          <Link href={PUBLIC_CONSULTATION.href} className="od-site-footer__cta">
            {PUBLIC_CONSULTATION.label}
          </Link>
        </div>
        <nav className="od-site-footer__nav" aria-label="Footer">
          <div>
            <p className="od-site-footer__heading">Explore</p>
            <ul>
              {PUBLIC_NAV_DESTINATIONS.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="od-site-footer__heading">Legal</p>
            <ul>
              {PUBLIC_FOOTER_LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
      <div className="od-site-footer__base">
        <p>
          © {new Date().getFullYear()} {SITE_CONFIG.name} · Pune, India
        </p>
      </div>
      {note ? <p className="od-site-footer__note">{note}</p> : null}
    </footer>
  );
}
