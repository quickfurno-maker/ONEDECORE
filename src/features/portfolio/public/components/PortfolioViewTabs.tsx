import Link from "next/link";
import {
  PORTFOLIO_VIEWS,
  type PortfolioViewCode,
} from "../portfolio-rooms.ts";

/**
 * `Projects | Living Room | Bedroom | Kitchen`
 *
 * WHY LINKS AND NOT BUTTONS
 *
 * Each view is a distinct, addressable listing. A visitor should be able to
 * send someone the bedrooms, open them in a new tab, and have the back button
 * do the obvious thing — all of which a button that swaps client state takes
 * away. It is navigation, so it is a nav element containing links.
 *
 * `aria-current="page"` rather than a styled-only selection: the visual weight
 * says which view is active to someone looking at it, and this says the same
 * thing to someone who is not.
 *
 * MOBILE
 *
 * The row scrolls horizontally rather than wrapping or shrinking. Four labels
 * do not fit across a narrow phone at a legible size, and the two usual escapes
 * — wrapping to a second line, or shrinking the text — either push the content
 * down or make the targets too small to hit. Sizing lives in the stylesheet,
 * which keeps every target at 44px minimum.
 */
export function PortfolioViewTabs({
  activeView,
}: {
  readonly activeView: PortfolioViewCode;
}) {
  return (
    <nav className="od-portfolio-views" aria-label="Portfolio views">
      <ul className="od-portfolio-views__rail" data-od-portfolio-views="">
        {PORTFOLIO_VIEWS.map((view) => {
          const isActive = view.id === activeView;
          return (
            <li key={view.id}>
              <Link
                href={view.href}
                className="od-portfolio-views__tab"
                data-active={isActive ? "" : undefined}
                aria-current={isActive ? "page" : undefined}
                data-od-view={view.id}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
