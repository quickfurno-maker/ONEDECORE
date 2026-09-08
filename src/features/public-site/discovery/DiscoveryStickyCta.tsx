"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { DiscoveryConsultCta } from "./DiscoveryConsultCta";

/**
 * The bottom conversion dock — Portfolio beside the consultation CTA.
 *
 * WhatsApp moved OUT of this bar and became `DiscoveryWhatsAppFab`, a floating
 * action on the right. Three actions in one bar left none of them dominant, and
 * the two that belong together are "see the work" and "start a conversation
 * about my home" — a browse action and a conversion action, weighted 35/65 so
 * the primary one still reads as primary.
 *
 * The `data-conversion-action` hooks are stable names for a later measurement
 * layer to bind to. Nothing reads them yet — no tag manager, no analytics — and
 * L2 has to correct the published legal copy before anything does.
 */
export function DiscoveryStickyCta() {
  const [visible, setVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const consultation = document.getElementById("consultation");
    const footer = document.querySelector<HTMLElement>(".od-site-footer");
    const drawer = document.querySelector<HTMLElement>(".od-site-header__drawer");
    let frame = 0;
    let pending = false;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        let overlapsTarget = false;
        for (const node of [consultation, footer]) {
          if (!node) continue;
          const rect = node.getBoundingClientRect();
          if (rect.top < window.innerHeight - 72) overlapsTarget = true;
        }
        setVisible(!overlapsTarget);
      });
    };

    const onDrawerChange = () => {
      setDrawerOpen(Boolean(drawer?.hasAttribute("data-open")));
    };

    const drawerObserver = drawer ? new MutationObserver(onDrawerChange) : null;
    drawerObserver?.observe(drawer!, {
      attributes: true,
      attributeFilter: ["data-open"],
    });

    onScroll();
    onDrawerChange();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      drawerObserver?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="od-disc-dock"
      data-visible={visible && !drawerOpen ? "" : undefined}
      role="region"
      aria-label="Conversion actions"
    >
      <Link
        href="/portfolio"
        className="od-disc-dock__btn od-disc-dock__btn--secondary"
        data-conversion-action="portfolio-sticky"
      >
        <span>Portfolio</span>
      </Link>
      <DiscoveryConsultCta
        className="od-disc-dock__btn od-disc-dock__btn--primary"
        conversionAction="consultation-sticky"
        ariaLabel={PUBLIC_CONSULTATION.label}
      >
        <span className="od-disc-dock__labelFull">{PUBLIC_CONSULTATION.label}</span>
        <span className="od-disc-dock__labelShort">{PUBLIC_CONSULTATION.mobileLabel}</span>
      </DiscoveryConsultCta>
    </div>
  );
}
