import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import type { PublicFooterConfig } from "../../types/shell";
import { APPROVED_SERVICE_NAMES } from "../../config/public-navigation";
import { cn } from "../../utils/cn";
import { Container } from "../primitives/Container";

export interface PublicFooterProps {
  config: PublicFooterConfig;
  className?: string;
}

export function PublicFooter({ config, className }: PublicFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("ps-footer", className)}>
      <Container width="wide" className="ps-footer__inner">
        <div className="ps-footer__grid">
          <div className="ps-footer__brand">
            <p className="ps-footer__wordmark">{SITE_CONFIG.name}</p>
            <p className="ps-footer__tagline">{SITE_CONFIG.tagline}</p>
          </div>

          {config.showServiceNames ? (
            <div className="ps-footer__group">
              <h2 className="ps-footer__heading">Services</h2>
              <ul className="ps-footer__service-list" aria-label="Service offerings">
                {APPROVED_SERVICE_NAMES.map((name) => (
                  <li key={name} className="ps-footer__service-item">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {config.linkGroups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="ps-footer__group">
              <h2 className="ps-footer__heading">{group.title}</h2>
              <ul className="ps-footer__link-list">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="ps-footer__link"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="ps-footer__link">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="ps-footer__meta">
          <p className="ps-footer__copyright">
            © {year} {SITE_CONFIG.name}. All rights reserved.
          </p>
          {config.legalLinks.length > 0 ? (
            <nav aria-label="Legal" className="ps-footer__legal">
              <ul className="ps-footer__legal-list">
                {config.legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="ps-footer__link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
