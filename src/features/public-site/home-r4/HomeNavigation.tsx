"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  PM_CTA,
  PM_NAV_ITEMS,
  PM_TRACKED_SECTIONS,
} from "./content";
import { usePlan } from "./PlanContext";
import { OneDecoreWordmark } from "./OneDecoreWordmark";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node.getClientRects().length > 0
  );
}

/** Floating nav: scroll condensation, active-section tracking, accessible drawer. */
export function HomeNavigation() {
  const { openPlanner, progress, service, property, timeline } = usePlan();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const planLabel =
    service || property || timeline ? PM_CTA.continuePlan : PM_CTA.openShort;

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  const openPlannerFromNav = useCallback(() => {
    setOpen(false);
    openPlanner();
  }, [openPlanner]);

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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const main = document.querySelector<HTMLElement>("main");
    const sticky = document.querySelector<HTMLElement>(".pm-sticky");
    const footer = document.querySelector<HTMLElement>(".pm-footer");
    const inertTargets = [main, sticky, footer].filter(
      (node): node is HTMLElement => node !== null
    );

    for (const target of inertTargets) {
      if ("inert" in target) {
        (target as HTMLElement & { inert: boolean }).inert = true;
      }
    }

    const drawer = drawerRef.current;
    const focusables = drawer ? getFocusables(drawer) : [];
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const target of inertTargets) {
        if ("inert" in target) {
          (target as HTMLElement & { inert: boolean }).inert = false;
        }
      }
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <header
      className="pm-nav"
      data-scrolled={scrolled ? "" : undefined}
      data-drawer-open={open ? "" : undefined}
    >
      <div className="pm-nav__bar">
        <OneDecoreWordmark size="nav" className="pm-nav__mark" />

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
          {progress > 0 ? (
            <span className="pm-nav__progress" aria-hidden="true">
              {progress}%
            </span>
          ) : null}
          <Link
            href="/portfolio"
            className="pm-nav__portfolio"
            data-conversion-action="portfolio-view"
          >
            {PM_CTA.projects}
          </Link>
          <button
            type="button"
            className="dc-btn pm-btn--nav pm-btn--sheen pm-nav__planCta pm-cta-short"
            data-conversion-action="nav-start-plan"
            onClick={openPlannerFromNav}
          >
            {planLabel}
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
        ref={drawerRef}
        id={drawerId}
        className="pm-drawer"
        data-open={open ? "" : undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Homepage menu"
        aria-hidden={open ? undefined : true}
      >
        <button
          type="button"
          className="pm-drawer__close"
          onClick={close}
        >
          Close menu
        </button>

        <OneDecoreWordmark size="drawer" className="pm-drawer__mark" />
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
            data-conversion-action="portfolio-view"
          >
            {PM_CTA.projects}
          </Link>
        </nav>
        <button
          type="button"
          className="dc-btn dc-btn--primary pm-btn--sheen"
          data-conversion-action="nav-start-plan"
          onClick={openPlannerFromNav}
        >
          {planLabel}
        </button>
      </div>
    </header>
  );
}
