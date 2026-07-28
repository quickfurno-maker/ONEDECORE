"use client";

import { useEffect, useState } from "react";
import { PM_STICKY } from "./content";
import { usePlan } from "./PlanContext";

/** Mobile conversion bar. Hidden near the closing block so it never covers it. */
export function HomeStickyActions() {
  const { openPlanner, isOpen } = usePlan();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const close = document.getElementById("plan");
    const onScroll = () => {
      const pastHero = window.scrollY > 320;
      let overlapsClose = false;
      if (close) {
        const rect = close.getBoundingClientRect();
        overlapsClose = rect.top < window.innerHeight - 40;
      }
      setVisible(pastHero && !overlapsClose);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
        onClick={() => openPlanner()}
      >
        {PM_STICKY.plan}
      </button>
      <a href={PM_STICKY.projectsHref} className="dc-btn dc-btn--ghost pm-sticky__btn">
        {PM_STICKY.projects}
      </a>
    </div>
  );
}
