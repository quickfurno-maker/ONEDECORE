import type { ReactNode } from "react";
import Link from "next/link";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { SITE_CONFIG } from "@/config/site";
import {
  getPublicNavDestinations,
  PUBLIC_CONSULTATION,
  PUBLIC_FOOTER_LEGAL,
} from "./public-nav";

export function PublicSiteFooter({
  note,
  shopEnabled = false,
}: {
  readonly note?: ReactNode;
  readonly shopEnabled?: boolean;
}) {
  const destinations = getPublicNavDestinations(shopEnabled);

  return (
    <footer className="od-site-footer">
      <div className="od-site-footer__top">
        <div className="od-site-footer__brand">
          <OneDecoreWordmark size="footer" />
          <p>Premium interiors for homes across Pune — design to installation.</p>
          <Link href={PUBLIC_CONSULTATION.href} className="od-site-footer__cta">
            {PUBLIC_CONSULTATION.label}
          </Link>
        </div>
        <nav className="od-site-footer__nav" aria-label="Footer">
          <div>
            <p className="od-site-footer__heading">Explore</p>
            <ul>
              {destinations.map((item) => (
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
