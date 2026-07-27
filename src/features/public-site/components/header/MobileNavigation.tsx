"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HeaderCtaConfig, NavigationItem } from "../../types/shell";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { cn } from "../../utils/cn";
import { CloseIcon, MenuIcon } from "./NavIcons";
import { PrimaryButton } from "../primitives/PrimaryButton";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export interface MobileNavigationProps {
  items: readonly NavigationItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  cta?: HeaderCtaConfig | null;
  onDarkSurface?: boolean;
}

function isActivePath(currentPath: string, href: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function MobileNavigation({
  items,
  open,
  onOpen,
  onClose,
  cta,
  onDarkSurface = false,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isFirstPathnameEffect = useRef(true);

  useBodyScrollLock(open);

  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (!open || event.key !== "Tab" || !panelRef.current) return;

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [open, trapFocus]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  }, [open]);

  useEffect(() => {
    if (isFirstPathnameEffect.current) {
      isFirstPathnameEffect.current = false;
      return;
    }
    onClose();
  }, [pathname, onClose]);

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <div className="ps-mobile-nav" data-reduced-motion={reducedMotion ? "true" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("ps-mobile-nav__trigger", onDarkSurface && "ps-mobile-nav__trigger--on-dark")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={open ? handleClose : onOpen}
      >
        <span className="ps-visually-hidden">{open ? "Close menu" : "Open menu"}</span>
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="ps-mobile-nav__backdrop"
            aria-label="Close menu"
            onClick={handleClose}
            tabIndex={-1}
          />
          <div
            className={cn("ps-mobile-nav__panel", reducedMotion && "ps-mobile-nav__panel--reduced")}
          >
            <div
              id={panelId}
              ref={panelRef}
              className="ps-mobile-nav__dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <div className="ps-mobile-nav__panel-header">
                <span className="ps-type-overline">Menu</span>
                <button
                  type="button"
                  className="ps-mobile-nav__close"
                  onClick={handleClose}
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav aria-label="Primary mobile" className="ps-mobile-nav__links">
                <ul className="ps-mobile-nav__list">
                  {items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "ps-mobile-nav__link",
                            active && "ps-mobile-nav__link--active"
                          )}
                          aria-current={active ? "page" : undefined}
                          onClick={handleClose}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {cta ? (
                <div className="ps-mobile-nav__cta">
                  <PrimaryButton href={cta.href}>{cta.label}</PrimaryButton>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
