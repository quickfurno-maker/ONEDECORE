import type { ReactNode } from "react";
import Link from "next/link";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { SITE_CONFIG } from "@/config/site";
import { BUSINESS_IDENTITY } from "@/features/legal/business-identity";
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
          <div className="od-site-footer__col od-site-footer__col--explore">
            <p className="od-site-footer__heading">Explore</p>
            <ul className="od-site-footer__links od-site-footer__links--inline">
              {destinations.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="od-site-footer__col od-site-footer__col--legal">
            <p className="od-site-footer__heading">Legal</p>
            <ul className="od-site-footer__links od-site-footer__links--legal">
              {PUBLIC_FOOTER_LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="od-site-footer__col od-site-footer__col--contact">
            <p className="od-site-footer__heading">Studio</p>
            {/*
              * WHERE the business is, not another way to contact it.
              *
              * The public marketing UI deliberately carries no e-mail link and
              * no sales address: the consultation form is the one conversion
              * path, and an e-mail link would produce enquiries that never
              * reach CRM and carry no attribution. That rule is asserted
              * elsewhere and is not relaxed here. The published business
              * address remains on the legal pages, where it is a governance
              * contact rather than a call to action.
              *
              * What this block adds is the address and service area — a trust
              * signal, and the name/address a Google Business Profile listing
              * has to agree with. Both come from BUSINESS_IDENTITY, the same
              * owner-recorded source the legal documents are generated from, so
              * the site and the Privacy Notice cannot drift apart.
              */}
            <ul className="od-site-footer__links od-site-footer__links--contact">
              <li>
                <address className="od-site-footer__address">
                  {BUSINESS_IDENTITY.registeredOfficeAddress}
                </address>
              </li>
              <li>Serving {BUSINESS_IDENTITY.serviceRegion}</li>
              <li>
                <Link href={PUBLIC_CONSULTATION.href}>
                  {PUBLIC_CONSULTATION.shortLabel}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="od-site-footer__base">
        <p>
          © {new Date().getFullYear()} {SITE_CONFIG.name} ·{" "}
          {BUSINESS_IDENTITY.legalEntityName} · Pune, India
        </p>
      </div>
      {note ? <p className="od-site-footer__note">{note}</p> : null}
    </footer>
  );
}
