"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CM_HREF, CM_NAV_ITEMS, CM_TRACKED_SECTIONS } from "./content";
import { useLead } from "./LeadContext";

/**
 * Floating conversion-master navigation: desktop bar + accessible mobile drawer.
 */
export function CmNav() {
  const { openPlanner } = useLead();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = CM_TRACKED_SECTIONS.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => node !== null
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const toggle = toggleRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "a[href], button:not([disabled])"
    );
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])"
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      (previouslyFocused ?? toggle)?.focus();
    };
  }, [open, close]);

  const renderLink = (
    item: (typeof CM_NAV_ITEMS)[number],
    className: string
  ) => {
    const isActive =
      item.kind === "anchor" &&
      activeId !== null &&
      item.href === `#${activeId}`;
    const shared = {
      className,
      "data-active": isActive ? "" : undefined,
      "aria-current": isActive ? ("location" as const) : undefined,
    };

    return item.kind === "route" ? (
      <Link key={item.href} href={item.href} {...shared} onClick={close}>
        <span className="dc-nav__label">{item.label}</span>
        <span className="dc-nav__underline" aria-hidden="true" />
      </Link>
    ) : (
      <a key={item.href} href={item.href} {...shared} onClick={close}>
        <span className="dc-nav__label">{item.label}</span>
        <span className="dc-nav__underline" aria-hidden="true" />
      </a>
    );
  };

  return (
    <header className="dc-nav cm-nav" data-scrolled={scrolled ? "" : undefined}>
      <div className="dc-nav__bar">
        <Link href={CM_HREF} className="dc-wordmark" data-size="nav">
          <span className="dc-wordmark__one">ONE</span>
          <span className="dc-wordmark__decore">DECORE</span>
        </Link>

        <nav className="dc-nav__links" aria-label="Conversion master sections">
          {CM_NAV_ITEMS.filter((item) => item.label !== "Home").map((item) =>
            renderLink(item, "dc-nav__link")
          )}
        </nav>

        <div className="dc-nav__actions">
          <button
            type="button"
            className="dc-btn dc-btn--nav"
            onClick={() => {
              close();
              openPlanner();
            }}
          >
            Plan My Interiors
          </button>
          <button
            ref={toggleRef}
            type="button"
            className="dc-nav__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="dc-nav__toggle-bars" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="dc-sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div
        id={panelId}
        ref={panelRef}
        className="dc-drawer"
        data-open={open ? "" : undefined}
        hidden={!open}
      >
        <nav className="dc-drawer__nav" aria-label="Conversion master sections, mobile">
          {CM_NAV_ITEMS.map((item) => renderLink(item, "dc-drawer__link"))}
        </nav>
        <button
          type="button"
          className="dc-btn dc-btn--primary"
          onClick={() => {
            close();
            openPlanner();
          }}
        >
          Plan My Interiors
        </button>
      </div>

      <button
        type="button"
        className="dc-drawer__scrim"
        data-open={open ? "" : undefined}
        hidden={!open}
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
      />
    </header>
  );
}
