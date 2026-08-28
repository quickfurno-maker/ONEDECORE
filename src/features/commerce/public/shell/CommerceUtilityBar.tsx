import Link from "next/link";
import { COMMERCE_UTILITY_LINKS } from "./commerce-nav.ts";

/**
 * Thin retail utility bar. Carries only factual, contract-backed statements:
 * GST-inclusive display and cash on delivery are the storefront's actual terms.
 */
export function CommerceUtilityBar() {
  return (
    <div className="odc-utility">
      <div className="odc-utility__inner">
        <p className="odc-utility__note">GST-inclusive pricing · Cash on delivery</p>
        <nav className="odc-utility__links" aria-label="Shop utilities">
          {COMMERCE_UTILITY_LINKS.map((link) => (
            <Link key={link.id} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
