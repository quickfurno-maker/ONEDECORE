import { R5_WHY, R5_WHY_COPY } from "../content";

/**
 * Why ONEDECORE — four proof panels, no border, no CTA.
 *
 * Server-rendered: there is nothing to interact with, and the brief is explicit
 * that this section does not get another call to action. The page already asks
 * three times; a fourth ask between "here is why you can trust us" and "here is
 * how it works" interrupts the argument it is supposed to be making.
 *
 * The four claims are the same four the hero counter states, deliberately. They
 * are the company's actual differentiators, and repeating them as sentences
 * rather than numbers is the point of the section.
 */
export function R5Why() {
  return (
    <section className="r5-section" aria-labelledby="r5-why-title">
      {/*
        The About menu target.

        `/#about` has pointed at the Why section since the common homepage
        existed, and the anchor lived on the section this one replaces. Without
        it the menu item scrolls nowhere — which is worse than not offering it.

        A separate span rather than an id on the section, because the section
        already carries `aria-labelledby` and an element can only have one id;
        `od-disc-anchor-alias` supplies the scroll-margin that keeps the heading
        clear of the sticky header.
      */}
      <span id="about" className="od-disc-anchor-alias" aria-hidden="true" />
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_WHY_COPY.eyebrow}</p>
          <h2 id="r5-why-title" className="r5-heading">
            {R5_WHY_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_WHY_COPY.supporting}</p>
        </header>

        <ul className="r5-proof r5-proof--four">
          {R5_WHY.map((item) => (
            <li key={item.id} className="r5-proofItem">
              <h3 className="r5-proofItem__title">{item.title}</h3>
              <p className="r5-proofItem__text">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
