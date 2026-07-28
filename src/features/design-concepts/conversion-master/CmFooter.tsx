import Link from "next/link";
import { CM_FOOTER, CM_HREF } from "./content";
import { WordmarkStatic } from "../shared/Wordmark";

export function CmFooter() {
  return (
    <footer className="cm-footer" aria-label="Site footer">
      <div className="dc-container">
        <div className="cm-footer__grid">
          <div>
            <Link href={CM_HREF} className="cm-footer__brand">
              <WordmarkStatic size="footer" />
            </Link>
            <p className="cm-footer__tagline">{CM_FOOTER.tagline}</p>
            <p className="cm-footer__positioning">{CM_FOOTER.positioning}</p>
          </div>

          <div>
            <h2 className="cm-footer__heading">Explore</h2>
            <ul className="cm-footer__list">
              {CM_FOOTER.explore.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  {link.href.startsWith("#") ? (
                    <a href={link.href} className="cm-footer__link">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="cm-footer__link">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="cm-footer__base">
          <span>
            © {new Date().getFullYear()} ONEDECORE. {CM_FOOTER.rights}
          </span>
          <span>Conversion Master preview — internal review only.</span>
        </div>
      </div>
    </footer>
  );
}
