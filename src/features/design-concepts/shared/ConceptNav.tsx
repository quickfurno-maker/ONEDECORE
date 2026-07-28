"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ConceptNavItem } from "../content/shared-content";

interface ConceptNavProps {
  readonly conceptHref: string;
  readonly items: readonly ConceptNavItem[];
  readonly ctaLabel: string;
  readonly ctaHref: string;
  /** Section ids tracked for active-anchor feedback, in DOM order. */
  readonly sectionIds: readonly string[];
}

function NavLabel({ item }: { item: ConceptNavItem }) {
  return (
    <>
      <span className="dc-nav__label">{item.label}</span>
      <span className="dc-nav__underline" aria-hidden="true" />
    </>
  );
}

/**
 * Shared concept navigation: floating bar on desktop, drawer on mobile.
 *
 * This is the only client component the concepts need for interaction. It owns
 * the drawer open state, focus containment and restoration, Escape handling,
 * body scroll locking, and scroll-spy for the in-page anchors.
 */
export function ConceptNav({
  conceptHref,
  items,
  ctaLabel,
  ctaHref,
  sectionIds,
}: ConceptNavProps) {
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
    if (sectionIds.length === 0) return;
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
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
  }, [sectionIds]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const toggle = toggleRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const firstLink = panelRef.current?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

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

  const renderLink = (item: ConceptNavItem, className: string) => {
    const isActive =
      item.kind === "anchor" && activeId !== null && item.href === `#${activeId}`;
    const shared = {
      className,
      "data-active": isActive ? "" : undefined,
      "aria-current": isActive ? ("location" as const) : undefined,
    };

    return item.kind === "route" ? (
      <Link key={item.href} href={item.href} {...shared} onClick={close}>
        <NavLabel item={item} />
      </Link>
    ) : (
      <a key={item.href} href={item.href} {...shared} onClick={close}>
        <NavLabel item={item} />
      </a>
    );
  };

  return (
    <header className="dc-nav" data-scrolled={scrolled ? "" : undefined}>
      <div className="dc-nav__bar">
        <Link href={conceptHref} className="dc-wordmark" data-size="nav">
          <span className="dc-wordmark__one">ONE</span>
          <span className="dc-wordmark__decore">DECORE</span>
        </Link>

        <nav className="dc-nav__links" aria-label="Concept sections">
          {items
            .filter((item) => item.label !== "Home")
            .map((item) => renderLink(item, "dc-nav__link"))}
        </nav>

        <div className="dc-nav__actions">
          <Link href={ctaHref} className="dc-btn dc-btn--nav">
            {ctaLabel}
          </Link>
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
        <nav className="dc-drawer__nav" aria-label="Concept sections, mobile">
          {items.map((item) => renderLink(item, "dc-drawer__link"))}
        </nav>
        <Link href={ctaHref} className="dc-btn dc-btn--primary" onClick={close}>
          {ctaLabel}
        </Link>
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
