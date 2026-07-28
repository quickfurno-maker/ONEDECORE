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
  title: "ONEDECORE — Phase 2F-R4 Concepts (internal review)",
  description:
    "Premium Motion Homepage is the active owner-review direction. R3 Conversion Master and the R2 themes remain for comparison. Internal only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const REVIEW_STEPS = [
  {
    title: "Start with Premium Motion Homepage",
    body: "Open the active R4 direction on a 1440 or 1280 wide window. Let the hero settle, then scroll the whole page once so every section reveal plays before you judge it. Repeat on a phone.",
  },
  {
    title: "Exercise the interior plan",
    body: "On desktop, pick a service in the hero card and watch it expand in place. On mobile, open the bottom sheet from the nav CTA or the sticky bar. The plan is shared, so a choice made in Services appears in the closing summary.",
  },
  {
    title: "Judge the motion",
    body: "Check the process stage walker, the FAQ accordion, the service selector crossfade, and the material reveals. Then enable reduced motion in your OS and confirm everything is still readable and complete.",
  },
  {
    title: "Compare against R3 and R2 if useful",
    body: "Conversion Master (R3.1) and the three R2 themes are kept below for memory. They are not the active recommendation.",
  },
  {
    title: "Record the decision",
    body: "Capture approval, hybrid notes, or blockers in the owner decision document for Phase 2F-R4.",
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
          <span className="dc-review__tag">Phase 2F-R4 — internal</span>
          <h1 className="dcx-masthead__title">
            Premium Motion Homepage is the active owner-review direction
          </h1>
          <p className="dcx-masthead__lede">
            Phase 2F-R4 ships one premium, motion-led conversion homepage
            prototype for owner approval. Conversion Master (R3.1) and the three
            R2 visual themes remain below for comparison only. These routes are
            internal — not linked from the public site — and carry noindex
            metadata.
          </p>
        </div>
      </header>

      <main id="concepts-main" tabIndex={-1}>
        <section className="dcx-section" aria-labelledby="dcx-active-title">
          <div className="dc-container">
            <h2 id="dcx-active-title" className="dc-h2">
              Active — Premium Motion Homepage
            </h2>
            <p className="dc-lede" style={{ marginBottom: "1.5rem" }}>
              A motion-led premium conversion homepage: a split hero with a
              framed image stage and an inline interior-plan card, an
              image-driven service selector, a stage walker for the process,
              tactile material reveals, and one closing conversion panel.
            </p>

            <ul className="dcx-cards">
              <li className="dcx-card">
                <Link
                  href="/design-concepts/premium-motion-homepage"
                  className="dcx-card__media"
                >
                  <Image
                    src="/marketing/r4/hero-living-warmth.webp"
                    alt="Warm neutral living room with an oak slatted wall, cream curved seating and a round travertine table in raking daylight"
                    width={1536}
                    height={1024}
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    priority
                  />
                  <span className="dcx-card__letter">R4</span>
                </Link>

                <div className="dcx-card__body">
                  <h3 className="dcx-card__title">Premium Motion Homepage</h3>
                  <p className="dcx-card__thesis">
                    ACTIVE owner-review direction. Higher-contrast espresso and
                    ivory palette, layered glass panels, and an app-like interior
                    plan carried through one shared journey — local prototype
                    state only.
                  </p>

                  <h4 className="dcx-card__heading">Dominant strengths</h4>
                  <ul className="dcx-card__list">
                    <li>Strongest hero impact and visual depth so far</li>
                    <li>Interactive service selector, stage walker, and accordion</li>
                    <li>One shared interior plan across every entry point</li>
                  </ul>

                  <h4 className="dcx-card__heading">Known trade-offs</h4>
                  <ul className="dcx-card__list dcx-card__list--muted">
                    <li>Lead intake is local preview — not production CRM yet</li>
                    <li>Marketing artwork stands in until project photography exists</li>
                    <li>More interaction states to maintain than R3</li>
                  </ul>

                  <p className="dcx-card__motion">
                    Motion range 200–900ms (CSS only, no animation package)
                  </p>

                  <Link
                    href="/design-concepts/premium-motion-homepage"
                    className="dc-btn dc-btn--primary"
                  >
                    Open Premium Motion Homepage
                  </Link>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="dcx-section" aria-labelledby="dcx-previous-title">
          <div className="dc-container">
            <h2 id="dcx-previous-title" className="dc-h2">
              Previous — Conversion Master (R3.1)
            </h2>
            <p className="dc-lede" style={{ marginBottom: "1.5rem" }}>
              Warm Conversion Luxury: cinematic dark hero, ivory services and
              projects, charcoal process, tactile materials, and a final
              consultation band. Kept for comparison — superseded by R4.
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
                  />
                  <span className="dcx-card__letter">R3</span>
                </Link>

                <div className="dcx-card__body">
                  <h3 className="dcx-card__title">Conversion Master</h3>
                  <p className="dcx-card__thesis">
                    The conversion architecture R4 builds on: shared lead
                    planner, portfolio proof, scope brief, FAQ, and consultation
                    form — local prototype state only.
                  </p>

                  <h4 className="dcx-card__heading">Dominant strengths</h4>
                  <ul className="dcx-card__list">
                    <li>Clear primary conversion path across the page</li>
                    <li>Desktop inline planner + mobile bottom sheet</li>
                    <li>Uses live featured Portfolio covers when available</li>
                  </ul>

                  <h4 className="dcx-card__heading">Known trade-offs</h4>
                  <ul className="dcx-card__list dcx-card__list--muted">
                    <li>Visual depth and motion richness below the R4 bar</li>
                    <li>Before/after is storytelling fallback until CMS pairs exist</li>
                    <li>Budget bands omitted pending owner approval</li>
                  </ul>

                  <p className="dcx-card__motion">Motion range 700–900ms (CSS only)</p>

                  <Link
                    href="/design-concepts/conversion-master"
                    className="dc-btn dc-btn--ghost"
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
                    href="/design-concepts/premium-motion-homepage"
                    className="dc-textlink"
                  >
                    /design-concepts/premium-motion-homepage
                  </Link>
                  <span>ACTIVE — Premium Motion Homepage (R4)</span>
                </li>
                <li>
                  <Link
                    href="/design-concepts/conversion-master"
                    className="dc-textlink"
                  >
                    /design-concepts/conversion-master
                  </Link>
                  <span>Previous — Conversion Master (R3.1)</span>
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
              R2 ratings are historical. Premium Motion Homepage (R4) is the
              active direction for owner review.
            </p>
          </div>
        </section>
      </main>

      <footer className="dcx-foot">
        <div className="dc-container">
          <p>
            Phase 2F-R4 concept review. Committed only to the
            phase-2f-r4-premium-motion-homepage branch; never merged to main in
            preview form.
          </p>
        </div>
      </footer>
    </div>
  );
}
