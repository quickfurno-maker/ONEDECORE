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
  title: "ONEDECORE — Homepage Concepts (internal review)",
  description:
    "Three complete homepage directions for Phase 2F owner review. Internal only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const REVIEW_STEPS = [
  {
    title: "Review on desktop first",
    body: "Open each concept at a 1440 or 1280 wide window. Scroll the whole page once without stopping to judge the overall rhythm, then scroll again slowly to read each section.",
  },
  {
    title: "Then review on a phone",
    body: "Open the same three URLs on your phone, or narrow the browser to about 390px. Check the hero composition, the menu button, and how the Selected Work section stacks.",
  },
  {
    title: "Compare like against like",
    body: "Look at one section across all three concepts before moving on — all three heroes, then all three service treatments, and so on. Mixing sections between concepts is a valid outcome.",
  },
  {
    title: "Record the decision",
    body: "Nothing here is preselected. Write your choices into OWNER_CONCEPT_DECISION.md; you can pick one concept outright or specify a hybrid section by section.",
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
          <span className="dc-review__tag">Phase 2F-R2 — internal</span>
          <h1 className="dcx-masthead__title">
            Three homepage directions for ONEDECORE
          </h1>
          <p className="dcx-masthead__lede">
            Each concept is a complete homepage built from the same approved
            ONEDECORE content, the same marketing artwork, and the same live
            Portfolio data. Only the visual language changes. These routes are
            internal review pages — they are not linked from the public site and
            they carry noindex metadata.
          </p>
        </div>
      </header>

      <main id="concepts-main" tabIndex={-1}>
        <section className="dcx-section" aria-labelledby="dcx-concepts-title">
          <div className="dc-container">
            <h2 id="dcx-concepts-title" className="dc-h2">
              The three concepts
            </h2>

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
                      priority={concept.letter === "A"}
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
                {CONCEPTS.map((concept) => (
                  <li key={concept.id}>
                    <Link href={concept.href} className="dc-textlink">
                      {concept.href}
                    </Link>
                    <span>
                      Concept {concept.letter} — {concept.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="dcx-section" aria-labelledby="dcx-matrix-title">
          <div className="dc-container">
            <h2 id="dcx-matrix-title" className="dc-h2">
              Comparison matrix
            </h2>
            <p className="dc-lede dcx-matrix__intro">{COMPARISON_INTRO}</p>

            {/* Focusable so the matrix can be scrolled without a pointer. */}
            <div
              className="dcx-table__scroll"
              tabIndex={0}
              role="region"
              aria-label="Concept comparison matrix, scrollable"
            >
              <table className="dcx-table">
                <caption className="dc-sr-only">
                  Design-team ratings from 1 to 5 for each concept across
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
              No concept is recommended here. A non-binding professional view is
              recorded separately in the owner decision document so it cannot
              bias this page.
            </p>
          </div>
        </section>
      </main>

      <footer className="dcx-foot">
        <div className="dc-container">
          <p>
            Phase 2F-R2 concept review. Committed only to the
            phase-2f-coffee-luxe-redesign branch; never merged to main in preview
            form.
          </p>
        </div>
      </footer>
    </div>
  );
}
