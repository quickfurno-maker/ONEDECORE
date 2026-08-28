import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import {
  COMMERCE_FOOTER_BRAND_LINKS,
  COMMERCE_FOOTER_LEGAL_LINKS,
  COMMERCE_FOOTER_SHOP_LINKS,
  type CommerceNavNode,
} from "./commerce-nav.ts";

/**
 * Large light retail footer. Every column links to a route that exists; no
 * phone number, address, social handle or policy is invented here.
 */
export function CommerceFooter({ nodes }: { readonly nodes: readonly CommerceNavNode[] }) {
  const year = new Date().getFullYear();

  return (
    <footer className="odc-footer">
      <div className="odc-footer__inner">
        <div className="odc-footer__brand">
          <p className="odc-footer__wordmark">ONEDECORE</p>
          <p className="odc-footer__tag">Made for Pune</p>
          <p className="odc-footer__lede">
            Complete home interiors, modular kitchens and ready-made furniture from one
            coordinated team.
          </p>
        </div>

        <div className="odc-footer__cols">
          {nodes.length > 0 ? (
            <nav className="odc-footer__col" aria-labelledby="odc-footer-cats">
              <p className="odc-footer__colTitle" id="odc-footer-cats">
                Shop by category
              </p>
              <ul>
                {nodes.slice(0, 6).map((node) => (
                  <li key={node.slug}>
                    <Link href={node.href}>{node.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <nav className="odc-footer__col" aria-labelledby="odc-footer-shop">
            <p className="odc-footer__colTitle" id="odc-footer-shop">
              Furniture
            </p>
            <ul>
              {COMMERCE_FOOTER_SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="odc-footer__col" aria-labelledby="odc-footer-brand">
            <p className="odc-footer__colTitle" id="odc-footer-brand">
              Interiors
            </p>
            <ul>
              {COMMERCE_FOOTER_BRAND_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="odc-footer__col" aria-labelledby="odc-footer-legal">
            <p className="odc-footer__colTitle" id="odc-footer-legal">
              Policies
            </p>
            <ul>
              {COMMERCE_FOOTER_LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="odc-footer__base">
        <p>
          © {year} {SITE_CONFIG.name}. All prices are GST inclusive.
        </p>
        <p>Cash on delivery is the only payment method currently offered.</p>
      </div>
    </footer>
  );
}
