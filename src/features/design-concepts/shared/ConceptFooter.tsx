import Link from "next/link";
import { FOOTER_COPY } from "../content/shared-content";
import { WordmarkStatic } from "./Wordmark";

interface ConceptFooterProps {
  /** Drives per-concept footer styling; structure stays constant. */
  readonly variant: "cinematic" | "architectural" | "design-tech";
}

export function ConceptFooter({ variant }: ConceptFooterProps) {
  return (
    <footer className="dc-footer" data-variant={variant} aria-label="Site footer">
      <div className="dc-container">
        <div className="dc-footer__grid">
          <div>
            <WordmarkStatic size="footer" />
            <p className="dc-footer__tagline">{FOOTER_COPY.tagline}</p>
          </div>

          <div>
            <h2 className="dc-footer__heading">{FOOTER_COPY.servicesHeading}</h2>
            <ul className="dc-footer__list">
              {FOOTER_COPY.serviceNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="dc-footer__heading">{FOOTER_COPY.exploreHeading}</h2>
            <ul className="dc-footer__list">
              {FOOTER_COPY.exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="dc-footer__link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="dc-footer__base">
          <span>
            © {new Date().getFullYear()} ONEDECORE. {FOOTER_COPY.rights}
          </span>
          <span>Design concept preview — internal review only.</span>
        </div>
      </div>
    </footer>
  );
}
