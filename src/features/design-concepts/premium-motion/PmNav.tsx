"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  PM_CTA,
  PM_HREF,
  PM_NAV_ITEMS,
  PM_TRACKED_SECTIONS,
} from "./content";
import { usePlan } from "./PlanContext";

/** Floating nav: scroll condensation, active-section tracking, inert drawer. */
export function PmNav() {
  const { openPlanner } = usePlan();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = PM_TRACKED_SECTIONS.map((id) =>
      document.getElementById(id)
    ).filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0.01, 0.25, 0.5] }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <header className="pm-nav" data-scrolled={scrolled ? "" : undefined}>
      <div className="pm-nav__bar">
        <Link href={PM_HREF} className="dc-wordmark pm-nav__mark" data-size="nav">
          <span className="dc-wordmark__one">ONE</span>
          <span className="dc-wordmark__decore">DECORE</span>
        </Link>

        <nav className="pm-nav__links" aria-label="Homepage sections">
          {PM_NAV_ITEMS.map((item) => {
            const id = item.href.replace("#", "");
            return (
              <a
                key={item.href}
                href={item.href}
                className="pm-nav__link"
                data-active={active === id ? "" : undefined}
              >
                <span>{item.label}</span>
                <span className="pm-nav__dot" aria-hidden="true" />
              </a>
            );
          })}
        </nav>

        <div className="pm-nav__actions">
          <button
            type="button"
            className="dc-btn pm-btn--nav pm-btn--sheen"
            onClick={() => {
              setOpen(false);
              openPlanner();
            }}
          >
            {PM_CTA.open}
          </button>
          <button
            ref={toggleRef}
            type="button"
            className="pm-nav__toggle"
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="pm-nav__bars" data-open={open ? "" : undefined} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="dc-sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div
        className="pm-drawer__scrim"
        data-open={open ? "" : undefined}
        aria-hidden="true"
        onClick={close}
      />

      <div
        id={drawerId}
        className="pm-drawer"
        data-open={open ? "" : undefined}
        inert={!open}
      >
        <nav className="pm-drawer__nav" aria-label="Homepage sections, mobile">
          {PM_NAV_ITEMS.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className="pm-drawer__link"
              style={{ "--pm-drawer-index": index } as React.CSSProperties}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/portfolio"
            className="pm-drawer__link"
            style={{ "--pm-drawer-index": PM_NAV_ITEMS.length } as React.CSSProperties}
            onClick={() => setOpen(false)}
          >
            {PM_CTA.projects}
          </Link>
        </nav>
        <button
          type="button"
          className="dc-btn dc-btn--primary pm-btn--sheen"
          onClick={() => {
            setOpen(false);
            openPlanner();
          }}
        >
          {PM_CTA.open}
        </button>
      </div>
    </header>
  );
}
