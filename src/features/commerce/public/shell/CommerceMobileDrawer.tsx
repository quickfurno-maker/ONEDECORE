"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { COMMERCE_UTILITY_LINKS, type CommerceNavNode } from "./commerce-nav.ts";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node.getClientRects().length > 0
  );
}

/**
 * Commerce drawer for tablet and mobile: hamburger trigger plus a category
 * accordion. Owns its own focus trap, Escape handling and focus restoration.
 */
export function CommerceMobileDrawer({ nodes }: { readonly nodes: readonly CommerceNavNode[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
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
    if (drawer) {
      getFocusables(drawer)[0]?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = getFocusables(drawerRef.current);
      if (focusables.length === 0) return;
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

    const inertTargets = [
      document.querySelector<HTMLElement>(".odc-shell__main"),
      document.querySelector<HTMLElement>(".odc-footer"),
    ].filter((node): node is HTMLElement => node !== null);

    for (const target of inertTargets) {
      target.inert = true;
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const target of inertTargets) {
        target.inert = false;
      }
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="odc-header__burger"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        <span className="od-sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <div
        className="odc-drawer__scrim"
        data-open={open ? "" : undefined}
        aria-hidden="true"
        onClick={close}
      />

      <div
        ref={drawerRef}
        id={drawerId}
        className="odc-drawer"
        data-open={open ? "" : undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Furniture menu"
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
      >
        <div className="odc-drawer__head">
          <p className="odc-drawer__title">Browse furniture</p>
          <button type="button" className="odc-drawer__close" onClick={close}>
            Close
          </button>
        </div>

        <nav className="odc-drawer__nav" aria-label="Furniture categories, mobile">
          <Link href="/shop" className="odc-drawer__top" onClick={() => setOpen(false)}>
            All furniture
          </Link>

          <ul className="odc-drawer__list">
            {nodes.map((node) => {
              const hasChildren = node.children.length > 0;
              if (!hasChildren) {
                return (
                  <li key={node.slug}>
                    <Link
                      href={node.href}
                      className="odc-drawer__link"
                      onClick={() => setOpen(false)}
                    >
                      {node.name}
                    </Link>
                  </li>
                );
              }
              const isExpanded = expanded === node.slug;
              return (
                <li key={node.slug}>
                  <button
                    type="button"
                    className="odc-drawer__link odc-drawer__accordion"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((current) => (current === node.slug ? null : node.slug))
                    }
                  >
                    {node.name}
                    <span className="odc-drawer__chevron" aria-hidden="true">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </button>
                  {isExpanded ? (
                    <ul className="odc-drawer__sublist">
                      <li>
                        <Link href={node.href} onClick={() => setOpen(false)}>
                          All {node.name}
                        </Link>
                      </li>
                      {node.children.map((child) => (
                        <li key={child.slug}>
                          <Link href={child.href} onClick={() => setOpen(false)}>
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="odc-drawer__utility">
            {COMMERCE_UTILITY_LINKS.map((link) => (
              <Link key={link.id} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
