import type { ReactNode } from "react";
import Link from "next/link";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { SITE_CONFIG } from "@/config/site";
import { PUBLIC_FOOTER_LEGAL, PUBLIC_NAV_DESTINATIONS } from "./public-nav";

export function PublicSiteFooter({
  note,
}: {
  readonly note?: ReactNode;
}) {
  return (
    <footer className="od-site-footer">
      <div className="od-site-footer__grid">
        <div>
          <OneDecoreWordmark size="footer" />
          <p className="od-site-footer__tagline">{SITE_CONFIG.tagline}</p>
          <p>Complete interiors, modular kitchens, and furniture for homes in Pune.</p>
        </div>
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
      </div>
      <p className="od-site-footer__base">
        © {new Date().getFullYear()} {SITE_CONFIG.name}. Production ordering is not enabled.
      </p>
      {note ? <p className="od-site-footer__note">{note}</p> : null}
    </footer>
  );
}
