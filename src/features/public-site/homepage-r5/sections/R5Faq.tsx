"use client";

import { useId, useState } from "react";
import { PM_FAQS } from "@/features/public-site/home-r4/content";
import { R5_FAQ_COPY, R5_FAQ_IDS } from "../content";

/**
 * FAQ — five approved answers, one open at a time.
 *
 * THE ANSWERS ARE NOT WRITTEN HERE
 *
 * They are read out of `PM_FAQS` by id. That set has already been through claim
 * review — it is where the warranty wording, the "estimate is not a quotation"
 * distinction and the service-area answer live. Retyping any of it into this
 * file would create a second copy that nobody reviews and that drifts the first
 * time a commercial term changes.
 *
 * Some entries carry a `questionActive`/resolver variant because their wording
 * depends on what is currently evidenced, so the shape is read defensively and
 * an entry that cannot be resolved is skipped rather than rendered half-formed.
 *
 * `areas` is deliberately one of the five: with the standalone Pune locality
 * section gone from the flow, this is the only place the homepage still answers
 * "do you work in my part of the city".
 *
 * SINGLE-OPEN, AND WHY IT IS NOT A <details>
 *
 * Native `<details>` would be less code and worse behaviour here: closing the
 * previously-open item requires script anyway, and the animated panel needs a
 * wrapper `<details>` will not give. This is the APG disclosure pattern — a
 * real button, `aria-expanded`, `aria-controls`, and a region labelled by it.
 */
interface ResolvedFaq {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

function resolveFaqs(): readonly ResolvedFaq[] {
  const byId = new Map(
    (PM_FAQS as readonly Record<string, unknown>[]).map((entry) => [
      String(entry.id ?? ""),
      entry,
    ])
  );

  const resolved: ResolvedFaq[] = [];
  for (const id of R5_FAQ_IDS) {
    const entry = byId.get(id);
    if (!entry) continue;
    const question = typeof entry.question === "string" ? entry.question : null;
    const answer = typeof entry.answer === "string" ? entry.answer : null;
    // An entry whose copy is gated behind evidence is skipped, never guessed at.
    if (!question || !answer) continue;
    resolved.push({ id, question, answer });
  }
  return resolved;
}

export function R5Faq() {
  const faqs = resolveFaqs();
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);
  const baseId = useId();

  if (faqs.length === 0) return null;

  return (
    <section className="r5-section" aria-labelledby="r5-faq-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_FAQ_COPY.eyebrow}</p>
          <h2 id="r5-faq-title" className="r5-heading">
            {R5_FAQ_COPY.heading}
          </h2>
        </header>

        <div className="r5-faq">
          {faqs.map((faq) => {
            const open = faq.id === openId;
            const triggerId = `${baseId}-t-${faq.id}`;
            const panelId = `${baseId}-p-${faq.id}`;
            return (
              <div key={faq.id} className="r5-faq__item">
                <h3>
                  <button
                    type="button"
                    id={triggerId}
                    className="r5-faq__trigger"
                    aria-expanded={open}
                    aria-controls={panelId}
                    // Toggling closed is allowed: an open panel the reader has
                    // finished with should be dismissable.
                    onClick={() => setOpenId(open ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <span className="r5-faq__sign" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="r5-faq__panel"
                  data-open={open ? "true" : undefined}
                  /*
                   * Hidden from assistive tech when closed as well as visually.
                   * The grid collapse alone leaves the text in the accessibility
                   * tree, so a screen reader would read five answers whether or
                   * not they were open.
                   */
                  hidden={!open}
                >
                  <div className="r5-faq__panelInner">
                    <p className="r5-faq__answer">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
