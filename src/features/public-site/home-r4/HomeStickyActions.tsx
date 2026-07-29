"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PM_CTA, PM_STICKY } from "./content";
import { usePlan } from "./PlanContext";

/** Compact sticky conversion bar — state-aware, never covers final plan. */
export function HomeStickyActions() {
  const { openPlanner, isOpen, service, property, timeline, getNextIncompleteStep } =
    usePlan();
  const [visible, setVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const planLabel =
    service || property || timeline ? PM_CTA.continuePlan : PM_STICKY.plan;

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
      <Link
        href={PM_STICKY.estimateHref}
        className="dc-btn dc-btn--ghost pm-sticky__btn"
        data-conversion-action="sticky-estimate"
      >
        {PM_STICKY.estimate}
      </Link>
    </div>
  );
}
