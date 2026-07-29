"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PM_CTA, PM_CTA_SHORT, PM_STICKY } from "./content";
import { usePlan } from "./PlanContext";

/** Compact sticky conversion bar — one dominant plan CTA after hero on mobile. */
export function HomeStickyActions() {
  const { openPlanner, isOpen, service, property, timeline, getNextIncompleteStep } =
    usePlan();
  const [visible, setVisible] = useState(false);
  const started = Boolean(service || property || timeline);
  const planLabel = started ? PM_CTA.continuePlan : PM_STICKY.plan;
  const shortLabel = started ? PM_CTA_SHORT.continuePlan : PM_CTA_SHORT.open;

  useEffect(() => {
    const close = document.getElementById("plan");
    const heroCta = document.querySelector("[data-hero-primary-cta]");
    let frame = 0;
    let pending = false;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        const heroRect = heroCta?.getBoundingClientRect();
        const heroVisible =
          heroRect != null &&
          heroRect.bottom > 72 &&
          heroRect.top < window.innerHeight * 0.85;
        let overlapsClose = false;
        if (close) {
          const rect = close.getBoundingClientRect();
          overlapsClose = rect.top < window.innerHeight - 40;
        }
        setVisible(!heroVisible && !overlapsClose);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="pm-sticky"
      data-visible={visible && !isOpen ? "" : undefined}
      role="region"
      aria-label="Quick actions"
    >
      <button
        type="button"
        className="dc-btn dc-btn--primary pm-sticky__btn pm-btn--sheen"
        data-conversion-action="sticky-continue"
        aria-label={planLabel}
        onClick={() => openPlanner(getNextIncompleteStep())}
      >
        <span className="pm-cta-full">{planLabel}</span>
        <span className="pm-cta-short" aria-hidden="true">
          {shortLabel}
        </span>
      </button>
      <Link
        href="/portfolio"
        className="dc-btn dc-btn--ghost pm-sticky__btn"
        data-conversion-action="portfolio-view"
      >
        {PM_STICKY.projects}
      </Link>
    </div>
  );
}
