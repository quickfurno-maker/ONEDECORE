"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { ShopCartLink } from "@/features/commerce/public/components/ShopCartLink";
import {
  getPublicNavDestinations,
  PUBLIC_CONSULTATION,
  type PublicNavCurrent,
} from "./public-nav";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node.getClientRects().length > 0
  );
}

function isCurrent(current: PublicNavCurrent, href: string): boolean {
  if (current === "home" && href === "/") return true;
  if (current === "interiors" && href.startsWith("/interiors")) return href === "/interiors";
  if (current === "shop" && href === "/shop") return true;
  if (current === "portfolio" && href === "/portfolio") return true;
  if (current === "about" && href === "/#about") return true;
  return false;
}

export function PublicSiteHeader({
  current,
  showConsultation = true,
  showShopSearch = false,
  shopEnabled = false,
}: {
  readonly current: PublicNavCurrent;
  readonly showConsultation?: boolean;
  readonly showShopSearch?: boolean;
  /** Fail-closed Shop nav — only true when public shop gate is ON. */
  readonly shopEnabled?: boolean;
}) {
  const destinations = useMemo(
    () => getPublicNavDestinations(shopEnabled),
    [shopEnabled]
  );
  const showSearch = current === "shop" || (current === "home" && showShopSearch);
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const inertTargets = Array.from(
      new Set(
        [
          document.querySelector<HTMLElement>("main"),
          document.querySelector<HTMLElement>(".od-site-footer"),
          document.querySelector<HTMLElement>(".od-disc-dock"),
        ].filter((node): node is HTMLElement => node !== null)
      )
    );
    for (const target of inertTargets) {
      if ("inert" in target) {
        (target as HTMLElement & { inert: boolean }).inert = true;
      }
    }

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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => {
      if (desktop.matches) setOpen(false);
    };

    closeAtDesktop();
    desktop.addEventListener("change", closeAtDesktop);
    window.addEventListener("resize", closeAtDesktop);
    return () => {
      desktop.removeEventListener("change", closeAtDesktop);
      window.removeEventListener("resize", closeAtDesktop);
    };
  }, []);

  return (
    <header className="od-site-header">
      <div className="od-site-header__bar">
        <OneDecoreWordmark size="nav" className="od-site-header__mark" />
        <nav className="od-site-header__links" aria-label="Public site">
          {destinations.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="od-site-header__link"
              aria-current={isCurrent(current, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="od-site-header__actions">
          {showSearch ? (
            <Link href="/shop/search" className="od-site-header__util">
              Search
            </Link>
          ) : null}
          {current === "shop" ? (
            <ShopCartLink className="od-site-header__util" />
          ) : null}
          {showConsultation ? (
            <Link href={PUBLIC_CONSULTATION.href} className="od-site-header__cta">
              <span className="od-site-header__ctaFull">{PUBLIC_CONSULTATION.label}</span>
              <span className="od-site-header__ctaShort">{PUBLIC_CONSULTATION.shortLabel}</span>
            </Link>
          ) : null}
          <button
            ref={toggleRef}
            type="button"
            className="od-site-header__toggle"
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            <span className="od-sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <div
        className="od-site-header__scrim"
        data-open={open ? "" : undefined}
        aria-hidden="true"
        onClick={close}
      />
      <div
        ref={drawerRef}
        id={drawerId}
        className="od-site-header__drawer"
        data-open={open ? "" : undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Site menu"
        aria-hidden={open ? undefined : true}
      >
        <button type="button" className="od-site-header__drawerClose" onClick={close}>
          Close menu
        </button>
        <nav className="od-site-header__drawerNav" aria-label="Public site, mobile">
          {destinations.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {showSearch ? (
            <Link href="/shop/search" onClick={() => setOpen(false)}>
              Search furniture
            </Link>
          ) : null}
          {current === "shop" ? (
            <ShopCartLink className="od-site-header__drawerCart" />
          ) : null}
          {showConsultation ? (
            <Link href={PUBLIC_CONSULTATION.href} onClick={() => setOpen(false)}>
              {PUBLIC_CONSULTATION.label}
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
