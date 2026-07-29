import { PM_FOOTER, SITE_CONFIG } from "./content";
import { OneDecoreWordmark } from "./OneDecoreWordmark";
import Link from "next/link";

export function HomeFooter() {
  return (
    <footer className="pm-footer">
      <div className="dc-container">
        <div className="pm-footer__grid">
          <div>
            <OneDecoreWordmark size="footer" />
            <p className="pm-footer__positioning">{PM_FOOTER.positioning}</p>
          </div>

          <div>
            <p className="pm-footer__heading">{PM_FOOTER.servicesHeading}</p>
            <ul className="pm-footer__list">
              {PM_FOOTER.serviceNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="pm-footer__heading">{PM_FOOTER.exploreHeading}</p>
            <ul className="pm-footer__list">
              {PM_FOOTER.explore.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("#") ? (
                    <a href={item.href} className="pm-footer__link">
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="pm-footer__link"
                      data-conversion-action={
                        item.href === "/portfolio" ? "portfolio-view" : undefined
                      }
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pm-footer__base">
          <span>
            © {new Date().getFullYear()} {SITE_CONFIG.name}. {PM_FOOTER.rights}
          </span>
          <span>{SITE_CONFIG.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
