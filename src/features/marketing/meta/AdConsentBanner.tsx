"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { writeAdConsent, type AdConsentState } from "./ad-consent.ts";
import { useAdConsent, useHydrated } from "./use-ad-consent.ts";
import { isMetaTrackablePath } from "./meta-tracking-config.ts";
import "./ad-consent-banner.css";

/**
 * The advertising-cookie choice, asked once and changeable afterwards.
 *
 * NO DARK PATTERNS, AND THE TESTS SAY SO
 *
 * Two buttons, equally reachable, both one tap. "Necessary only" is not hidden
 * behind a "Manage preferences" step, not rendered as a faint link beside a
 * filled button, and not smaller than the other. Nothing is pre-checked
 * because nothing is checked at all — there is no state to arrive
 * pre-selected. Dismissing without choosing leaves the answer `unknown`, which
 * means no tracking; there is no close button that quietly means yes.
 *
 * WHY IT RENDERS NOTHING UNTIL IT KNOWS
 *
 * The server cannot read the cookie, so the first render is `unknown` on both
 * sides and the banner is mounted but hidden. `ready` flips after the first
 * client effect. Rendering the banner during SSR and hiding it on the client
 * would flash it at visitors who decided months ago.
 *
 * WHY IT IS NOT A MODAL
 *
 * A blocking dialog over a marketing page is a dark pattern of a different
 * kind: it makes "yes" the cost of reading the page. This is a dismissible
 * strip that leaves the site usable and the answer genuinely optional.
 */
export function AdConsentBanner() {
  const pathname = usePathname();
  const state: AdConsentState = useAdConsent();
  const ready = useHydrated();
  const [reopened, setReopened] = useState(false);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  /*
   * `state` and `ready` are both read from outside React rather than mirrored
   * into component state by an effect. `writeAdConsent` dispatches the change
   * event the store listens on, so this component, the Pixel and any other tab
   * all re-render from the one source of truth: the cookie itself. Only
   * `reopened` is genuine component state, because only it is a fact about
   * this UI rather than about the visitor's decision.
   */
  const decide = useCallback((next: "granted" | "denied") => {
    writeAdConsent(next);
    setReopened(false);
  }, []);

  /*
   * Public pages only, and by the SAME gate the Pixel uses.
   *
   * Sharing `isMetaTrackablePath` is deliberate: a surface that may never be
   * measured should never be asked about measurement either. Two lists would
   * eventually disagree, and the disagreement would show up as a cookie banner
   * on the admin console.
   */
  if (!isMetaTrackablePath(pathname)) return null;
  if (!ready) return null;
  if (state !== "unknown" && !reopened) {
    return <AdConsentReopener onReopen={() => setReopened(true)} state={state} />;
  }

  return (
    <>
      <section
        className="od-cookie"
        role="region"
        aria-label="Cookie preferences"
        data-od-cookie-banner=""
      >
        <div className="od-cookie__body">
          <p className="od-cookie__title">Cookies on ONEDECORE</p>
          <p className="od-cookie__text">
            Necessary cookies keep the site working. With your permission we
            also use Meta advertising measurement, which tells us which ads led
            to a real enquiry. It is optional, and the site works either way.{" "}
            <Link href="/privacy#advertising-measurement" className="od-cookie__link">
              How we use cookies
            </Link>
          </p>
        </div>
        <div className="od-cookie__actions">
          {/*
            "Necessary only" is FIRST in the DOM, so it is the first tab stop
            and the first thing a screen reader reaches. The two buttons carry
            the same size and the same tap target; only the colour differs, and
            the declining one is not the quiet one.
          */}
          <button
            ref={firstButtonRef}
            type="button"
            className="od-cookie__btn od-cookie__btn--secondary"
            onClick={() => decide("denied")}
            data-od-cookie-action="deny"
          >
            Necessary only
          </button>
          <button
            type="button"
            className="od-cookie__btn od-cookie__btn--primary"
            onClick={() => decide("granted")}
            data-od-cookie-action="grant"
          >
            Allow advertising cookies
          </button>
        </div>
      </section>
    </>
  );
}

/**
 * The way back to the choice.
 *
 * Withdrawal has to be as easy as granting — that is the rule the legal
 * consent registry already states for every other consent in this system, and
 * an advertising cookie does not get an exception. A small persistent control
 * rather than a buried settings page.
 */
function AdConsentReopener({
  onReopen,
  state,
}: {
  readonly onReopen: () => void;
  readonly state: AdConsentState;
}) {
  return (
    <button
      type="button"
      className="od-cookie-reopen"
      onClick={onReopen}
      data-od-cookie-reopen=""
      aria-label={
        state === "granted"
          ? "Cookie preferences — advertising cookies are currently allowed"
          : "Cookie preferences — necessary cookies only"
      }
    >
      Cookie preferences
    </button>
  );
}
