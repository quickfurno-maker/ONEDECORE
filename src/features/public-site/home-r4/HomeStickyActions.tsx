"use client";

import { useEffect, useState } from "react";
import {
  getPublicPhoneHref,
  PUBLIC_PHONE,
} from "@/features/public-site/chrome/public-contact";
import { trackMetaContact } from "@/features/marketing/meta/meta-pixel-events";
import { PM_CTA, PM_STICKY } from "./content";
import { usePlan } from "./PlanContext";

/**
 * A restrained handset, not a ringing-phone emoji.
 *
 * `aria-hidden` because the anchor's own text already says "Call Now" — a
 * screen reader announcing a decorative glyph before it would be noise.
 */
function PhoneGlyph() {
  return (
    <svg
      className="pm-sticky__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"
      />
    </svg>
  );
}

/** Compact sticky conversion bar — state-aware, never covers final plan. */
export function HomeStickyActions() {
  const { openPlanner, isOpen, service, property, timeline, getNextIncompleteStep } =
    usePlan();
  const [visible, setVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const planLabel =
    service || property || timeline ? PM_CTA.continuePlan : PM_STICKY.plan;
  /*
   * Configured or absent, never dead.
   *
   * `null` means no valid `NEXT_PUBLIC_ONEDECORE_PHONE_E164`, and then the bar
   * renders the consultation button alone. `.pm-sticky__btn` is `flex: 1`, so a
   * single child fills the bar without a layout rule of its own — which is why
   * the fallback is one conditional and not a second variant of the component.
   */
  const callHref = getPublicPhoneHref();

  useEffect(() => {
    const close = document.getElementById("plan");
    const nav = document.querySelector(".pm-nav");
    let frame = 0;
    let pending = false;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        const pastHero = window.scrollY > 320;
        let overlapsClose = false;
        if (close) {
          const rect = close.getBoundingClientRect();
          overlapsClose = rect.top < window.innerHeight - 40;
        }
        setDrawerOpen(nav?.hasAttribute("data-drawer-open") ?? false);
        setVisible(pastHero && !overlapsClose);
      });
    };

    const observer = nav
      ? new MutationObserver(onScroll)
      : null;
    observer?.observe(nav!, { attributes: true, attributeFilter: ["data-drawer-open"] });

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="pm-sticky"
      data-visible={visible && !isOpen && !drawerOpen ? "" : undefined}
      role="region"
      aria-label="Quick actions"
    >
      <button
        type="button"
        className="dc-btn dc-btn--primary pm-sticky__btn pm-btn--sheen pm-cta-short"
        data-conversion-action="sticky-continue"
        onClick={() => openPlanner(getNextIncompleteStep())}
      >
        {planLabel}
      </button>
      {/*
        A plain same-tab `tel:` anchor, not a router Link and not a button with
        a handler. The browser and the OS own what happens next — dial, offer a
        calling app, or copy the number on a desktop — and every one of those
        outcomes is better than anything this component could stage.
      */}
      {callHref ? (
        <a
          href={callHref}
          className="dc-btn dc-btn--ghost pm-sticky__btn pm-sticky__call"
          data-conversion-action="sticky-call"
          aria-label={PUBLIC_PHONE.ariaLabel}
          /*
           * Contact, on a real tap. No `preventDefault` and no async work: the
           * browser hands the `tel:` URL to the OS immediately, and the event
           * is fire-and-forget by design. If the pixel is blocked this does
           * nothing at all and the call still places.
           */
          onClick={() => trackMetaContact()}
        >
          <PhoneGlyph />
          {PUBLIC_PHONE.label}
        </a>
      ) : null}
    </div>
  );
}
