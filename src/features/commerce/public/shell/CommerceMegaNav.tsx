"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CommerceNavNode } from "./commerce-nav.ts";

/**
 * Desktop category navigation. Roots with published children open an accessible
 * mega panel; roots without children are plain links straight to the category.
 */
export function CommerceMegaNav({ nodes }: { readonly nodes: readonly CommerceNavNode[] }) {
  const pathname = usePathname();
  const activeSlug = pathname?.startsWith("/shop/c/")
    ? decodeURIComponent(pathname.slice("/shop/c/".length).split("/")[0] ?? "")
    : null;
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const panelIdBase = useId();
  const navRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpenSlug((current) => {
        if (current && restoreFocus) {
          triggerRefs.current.get(current)?.focus();
        }
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!openSlug) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const nav = navRef.current;
      if (nav && !nav.contains(event.target as Node)) {
        close(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, openSlug]);

  if (nodes.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="odc-meganav"
      aria-label="Furniture categories"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          close(false);
        }
      }}
    >
      <ul className="odc-meganav__row">
        {nodes.map((node) => {
          const hasChildren = node.children.length > 0;
          const panelId = `${panelIdBase}-${node.slug}`;
          const isOpen = openSlug === node.slug;
          const isActive = activeSlug === node.slug;

          if (!hasChildren) {
            return (
              <li key={node.slug} className="odc-meganav__item">
                <Link
                  href={node.href}
                  className="odc-meganav__link"
                  aria-current={isActive ? "page" : undefined}
                >
                  {node.name}
                </Link>
              </li>
            );
          }

          return (
            <li key={node.slug} className="odc-meganav__item" data-open={isOpen ? "" : undefined}>
              <button
                ref={(element) => {
                  triggerRefs.current.set(node.slug, element);
                }}
                type="button"
                className="odc-meganav__link odc-meganav__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                data-current={isActive ? "" : undefined}
                onClick={() => setOpenSlug((current) => (current === node.slug ? null : node.slug))}
              >
                {node.name}
                <span className="odc-meganav__chevron" aria-hidden="true" />
              </button>

              <div
                id={panelId}
                className="odc-meganav__panel"
                data-open={isOpen ? "" : undefined}
                hidden={!isOpen}
              >
                <div className="odc-meganav__panelInner">
                  <div className="odc-meganav__panelHead">
                    <p className="odc-meganav__panelTitle">{node.name}</p>
                    {node.shortDescription ? (
                      <p className="odc-meganav__panelLede">{node.shortDescription}</p>
                    ) : null}
                    <Link
                      href={node.href}
                      className="odc-meganav__panelAll"
                      onClick={() => close(false)}
                    >
                      Browse all {node.name}
                    </Link>
                  </div>
                  <ul className="odc-meganav__panelList">
                    {node.children.map((child) => (
                      <li key={child.slug}>
                        <Link href={child.href} onClick={() => close(false)}>
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
