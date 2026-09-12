"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { ShopCartLink } from "@/features/commerce/public/components/ShopCartLink";
import {
  getPublicNavDestinations,
  type PublicNavCurrent,
} from "./public-nav";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node.getClientRects().length > 0
  );
}

/**
 * Whether a menu item points at the page being rendered.
 *
 * Anchor destinations are deliberately never current. `#about` and `#contact`
 * are positions within the homepage, and a header cannot honestly claim the
 * visitor is "on" one of them — scrolling would make the claim false without
 * anything re-rendering.
 */
function isCurrent(current: PublicNavCurrent, href: string): boolean {
  /*
   * There is no `/` branch any more. The menu no longer carries a link to the
   * site root — the wordmark is that — so on the homepage nothing in this list
   * is current, which is the truth rather than an omission. `"interiors"` and
   * `"home"` remain valid page identities because the header still uses them to
   * decide whether Shop utilities belong in the bar.
   */
  if (current === "shop" && href === "/shop") return true;
  if (current === "portfolio" && href === "/portfolio") return true;
  return false;
}

/**
 * The one public header.
 *
 * NO CONSULTATION PILL, ANYWHERE
 *
 * It used to be a prop, and the homepage already passed `false`: carrying a
 * full-size gold pill next to the wordmark and the menu button cost real width
 * in a 390px bar to duplicate an action that is pinned to the bottom of the
 * screen, where a thumb actually is. Every public surface now agrees, so there
 * is nothing left to configure — the conversion path is the sticky bar, the
 * WhatsApp action and the footer link.
 *
 * THE OVERLAY IS A SIBLING OF THE BAR, NOT A CHILD
 *
 * This is the load-bearing detail of the whole component. `.od-site-header`
 * carries `backdrop-filter`, and a backdrop-filtered element becomes the
 * CONTAINING BLOCK for its fixed-position descendants — exactly as `transform`
 * does. A scrim inside it with `position: fixed; inset: 0` therefore resolved
 * against the 390x64 header box rather than the viewport, so the "full-screen"
 * backdrop was a 64px strip hidden behind the bar and a tap anywhere below it
 * reached the page instead. Measured, not guessed: `elementFromPoint(20, 410)`
 * returned the page content while the drawer was open.
 *
 * Keeping the scrim and the panel outside the filtered element is what makes
 * `inset: 0` mean the viewport again.
 */
export function PublicSiteHeader({
  current,
  showShopSearch = false,
  shopEnabled = false,
}: {
  readonly current: PublicNavCurrent;
  readonly showShopSearch?: boolean;
  /** Fail-closed Shop nav — only true when public shop gate is ON. */
  readonly shopEnabled?: boolean;
}) {
  const destinations = useMemo(
    () => getPublicNavDestinations(shopEnabled),
    [shopEnabled]
  );
  // Shop utilities are commerce navigation: they must stay fail-closed with the
  // gate, including on the /shop inactive boundary (current === "shop").
  const showSearch =
    shopEnabled && (current === "shop" || (current === "home" && showShopSearch));
  const showCart = shopEnabled && current === "shop";
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
    /*
     * Close first, not the brand link.
     *
     * `focusables[0]` is now the wordmark in the drawer head, and landing a
     * keyboard user on "go to the homepage" the instant they open a menu is a
     * trap dressed as a shortcut — one stray Enter and they have navigated.
     * The dismissal is the safe thing to start on.
     */
    const closeButton = drawer?.querySelector<HTMLElement>(
      ".od-site-header__drawerClose"
    );
    (closeButton ?? focusables[0])?.focus();

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
    <>
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
            {showCart ? <ShopCartLink className="od-site-header__util" /> : null}
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
      </header>

      {/*
        A BUTTON, NOT A DIV WITH AN onClick.

        The backdrop is the largest and most obvious way to dismiss the drawer,
        so it should be reachable the way every other dismissal is. As a real
        button it is keyboard-operable and announced, and it sits first in the
        drawer's tab order rather than being a silent region only a pointer can
        use. `tabIndex={-1}` while closed keeps it out of the page's tab order
        when there is nothing to dismiss.
      */}
      <button
        type="button"
        className="od-site-header__scrim"
        data-open={open ? "" : undefined}
        tabIndex={open ? 0 : -1}
        aria-label="Close menu"
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
        <div className="od-site-header__drawerHead">
          <OneDecoreWordmark size="drawer" className="od-site-header__drawerMark" />
          <button
            type="button"
            className="od-site-header__drawerClose"
            onClick={close}
          >
            <span aria-hidden="true">✕</span>
            <span className="od-sr-only">Close menu</span>
          </button>
        </div>
        <nav className="od-site-header__drawerNav" aria-label="Public site, mobile">
          {destinations.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isCurrent(current, item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {showSearch ? (
            <Link href="/shop/search" onClick={() => setOpen(false)}>
              Search furniture
            </Link>
          ) : null}
          {showCart ? (
            <ShopCartLink className="od-site-header__drawerCart" />
          ) : null}
        </nav>
      </div>
    </>
  );
}
