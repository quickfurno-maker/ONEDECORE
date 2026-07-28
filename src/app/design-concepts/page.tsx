import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  COMPARISON_INTRO,
  COMPARISON_ROWS,
  LOWER_IS_BETTER_CATEGORIES,
} from "@/features/design-concepts/content/comparison";
import { CONCEPTS } from "@/features/design-concepts/content/concepts";

export const metadata: Metadata = {
  title: "ONEDECORE — Phase 2F-R3 Concepts (internal review)",
  description:
    "Conversion Master is the active owner-review direction. R2 concepts remain for historical comparison. Internal only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const REVIEW_STEPS = [
  {
    title: "Start with Conversion Master",
    body: "Open the active R3 direction first on a 1440 or 1280 wide window. Walk the full funnel once — hero planner, services, projects, scope, FAQ, and final form — then repeat on a phone.",
  },
  {
    title: "Exercise the lead planner",
    body: "On desktop, use the inline hero planner. On mobile, open the bottom sheet from the nav CTA or sticky bar. Confirm shared state across entry points and that nothing auto-opens.",
  },
  {
    title: "Compare R2 history only if needed",
    body: "The three R2 concepts below are kept for side-by-side memory. They are not the active recommendation.",
  },
  {
    title: "Record the decision",
    body: "Capture approval, hybrid notes, or blockers in the owner decision document for Phase 2F-R3.",
  },
] as const;

function RatingCell({
  value,
  category,
}: {
  value: number;
  category: string;
}) {
  const inverted = (LOWER_IS_BETTER_CATEGORIES as readonly string[]).includes(
    category
  );
  return (
    <td className="dcx-table__cell">
      <span className="dcx-rating">
        <span className="dcx-rating__value">{value}</span>
        <span className="dcx-rating__track" aria-hidden="true">
          <span
            className="dcx-rating__fill"
            data-inverted={inverted ? "" : undefined}
            style={{ width: `${(value / 5) * 100}%` }}
          />
        </span>
      </span>
    </td>
  );
}

export default function DesignConceptsIndexPage() {
  return (
    <div data-design-concept="" data-concept="index" className="dcx">
      <a className="dc-skip" href="#concepts-main">
        Skip to concepts
      </a>

      <header className="dcx-masthead">
        <div className="dc-container">
          <span className="dc-review__tag">Phase 2F-R3 — internal</span>
          <h1 className="dcx-masthead__title">
            Conversion Master is the active owner-review direction
          </h1>
          <p className="dcx-masthead__lede">
            Phase 2F-R3 ships one conversion-focused homepage prototype for
            owner approval. The three R2 visual themes remain below as
            historical comparison only. These routes are internal — not linked
            from the public site — and carry noindex metadata.
          </p>
        </div>
      </header>

      <main id="concepts-main" tabIndex={-1}>
        <section className="dcx-section" aria-labelledby="dcx-active-title">
          <div className="dc-container">
            <h2 id="dcx-active-title" className="dc-h2">
              Active — Conversion Master
            </h2>
            <p className="dc-lede" style={{ marginBottom: "1.5rem" }}>
              Warm Conversion Luxury: cinematic dark hero, ivory services and
              projects, charcoal process, tactile materials, and a final
              consultation band — with a shared lead planner and mobile sticky
              CTAs.
            </p>

            <ul className="dcx-cards">
              <li className="dcx-card">
                <Link
                  href="/design-concepts/conversion-master"
                  className="dcx-card__media"
                >
                  <Image
                    src="/marketing/hero/homepage-hero-architectural.webp"
                    alt="Abstract architectural composition of layered travertine and limestone planes with slim bronze reveals and deep charcoal shadow"
                    width={1920}
                    height={1280}
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    priority
                  />
                  <span className="dcx-card__letter">R3</span>
                </Link>

                <div className="dcx-card__body">
                  <h3 className="dcx-card__title">Conversion Master</h3>
                  <p className="dcx-card__thesis">
                    ACTIVE owner-review direction. Premium conversion landing
                    page with lead planner, portfolio proof, scope brief, FAQ,
                    and consultation form — local prototype state only.
                  </p>

                  <h4 className="dcx-card__heading">Dominant strengths</h4>
                  <ul className="dcx-card__list">
                    <li>Clear primary conversion path across the page</li>
                    <li>Desktop inline planner + mobile bottom sheet</li>
                    <li>Uses live featured Portfolio covers when available</li>
                  </ul>

                  <h4 className="dcx-card__heading">Known trade-offs</h4>
                  <ul className="dcx-card__list dcx-card__list--muted">
                    <li>Lead intake is local preview — not production CRM yet</li>
                    <li>Before/after is storytelling fallback until CMS pairs exist</li>
                    <li>Budget bands omitted pending owner approval</li>
                  </ul>

                  <p className="dcx-card__motion">Motion range 700–900ms (CSS only)</p>

                  <Link
                    href="/design-concepts/conversion-master"
                    className="dc-btn dc-btn--primary"
                  >
                    Open Conversion Master
                  </Link>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="dcx-section dcx-section--alt" aria-labelledby="dcx-how-title">
          <div className="dc-container">
            <h2 id="dcx-how-title" className="dc-h2">
              How to review
            </h2>
            <ol className="dcx-steps">
              {REVIEW_STEPS.map((step, index) => (
                <li key={step.title} className="dcx-step">
                  <span className="dc-ordinal">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="dc-h3">{step.title}</h3>
                  <p className="dc-body">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="dcx-urls">
              <h3 className="dc-h3">Review URLs</h3>
              <ul className="dcx-urls__list">
                <li>
                  <Link href="/design-concepts" className="dc-textlink">
                    /design-concepts
                  </Link>
                  <span>This overview</span>
                </li>
                <li>
                  <Link
                    href="/design-concepts/conversion-master"
                    className="dc-textlink"
                  >
                    /design-concepts/conversion-master
                  </Link>
                  <span>ACTIVE — Conversion Master (R3)</span>
                </li>
                {CONCEPTS.map((concept) => (
                  <li key={concept.id}>
                    <Link href={concept.href} className="dc-textlink">
                      {concept.href}
                    </Link>
                    <span>
                      Historical — Concept {concept.letter} — {concept.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="dcx-section" aria-labelledby="dcx-concepts-title">
          <div className="dc-container">
            <h2 id="dcx-concepts-title" className="dc-h2">
              Historical — Phase 2F-R2 concepts
            </h2>
            <p className="dc-lede" style={{ marginBottom: "1.5rem" }}>
              Kept for comparison. Not the active owner-review direction.
            </p>

            <ul className="dcx-cards">
              {CONCEPTS.map((concept) => (
                <li key={concept.id} className="dcx-card">
                  <Link href={concept.href} className="dcx-card__media">
                    <Image
                      src={concept.previewAsset.path}
                      alt={concept.previewAsset.alt}
                      width={concept.previewAsset.width}
                      height={concept.previewAsset.height}
                      sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    />
                    <span className="dcx-card__letter">{concept.letter}</span>
                  </Link>

                  <div className="dcx-card__body">
                    <h3 className="dcx-card__title">{concept.name}</h3>
                    <p className="dcx-card__thesis">{concept.thesis}</p>

                    <h4 className="dcx-card__heading">Dominant strengths</h4>
                    <ul className="dcx-card__list">
                      {concept.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <h4 className="dcx-card__heading">Known trade-offs</h4>
                    <ul className="dcx-card__list dcx-card__list--muted">
                      {concept.tradeoffs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <p className="dcx-card__motion">
                      Motion range {concept.motionRange}
                    </p>

                    <Link href={concept.href} className="dc-btn dc-btn--primary">
                      Open Concept {concept.letter}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="dcx-section dcx-section--alt" aria-labelledby="dcx-matrix-title">
          <div className="dc-container">
            <h2 id="dcx-matrix-title" className="dc-h2">
              R2 comparison matrix (historical)
            </h2>
            <p className="dc-lede dcx-matrix__intro">{COMPARISON_INTRO}</p>

            <div
              className="dcx-table__scroll"
              tabIndex={0}
              role="region"
              aria-label="Concept comparison matrix, scrollable"
            >
              <table className="dcx-table">
                <caption className="dc-sr-only">
                  Design-team ratings from 1 to 5 for each R2 concept across
                  thirteen categories. Lower is better for implementation
                  complexity and performance risk.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">A — Cinematic</th>
                    <th scope="col">B — Architectural</th>
                    <th scope="col">C — Design-Tech</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.category}>
                      <th scope="row">
                        <span className="dcx-table__category">{row.category}</span>
                        <span className="dcx-table__note">{row.note}</span>
                      </th>
                      <RatingCell value={row.cinematic} category={row.category} />
                      <RatingCell value={row.architectural} category={row.category} />
                      <RatingCell value={row.designTech} category={row.category} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="dcx-matrix__footnote">
              R2 ratings are historical. Conversion Master (R3) is the active
              direction for owner review.
            </p>
          </div>
        </section>
      </main>

      <footer className="dcx-foot">
        <div className="dc-container">
          <p>
            Phase 2F-R3 concept review. Committed only to the
            phase-2f-coffee-luxe-redesign branch; never merged to main in preview
            form.
          </p>
        </div>
      </footer>
    </div>
  );
}
