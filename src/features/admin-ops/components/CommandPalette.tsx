"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpsCommandRoute } from "../types.ts";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly routes: readonly OpsCommandRoute[];
  readonly onClose: () => void;
  readonly returnFocusRef: { readonly current: HTMLElement | null };
}

export function CommandPalette({
  open,
  routes,
  onClose,
  returnFocusRef,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return routes;
    }
    return routes.filter(
      (route) =>
        route.label.toLowerCase().includes(needle) ||
        route.href.toLowerCase().includes(needle) ||
        route.group.toLowerCase().includes(needle)
    );
  }, [query, routes]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = returnFocusRef.current;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const nodes = [
          ...panelRef.current.querySelectorAll<HTMLElement>(
            "input, a[href], button:not([disabled])"
          ),
        ].filter((node) => !node.hasAttribute("aria-hidden"));
        if (nodes.length === 0) {
          event.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search navigation"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[12px] border border-[var(--od-border-strong)] bg-[var(--od-elevated)] shadow-2xl"
      >
        <label className="sr-only" htmlFor="od-command-input">
          Search anything
        </label>
        <input
          ref={inputRef}
          id="od-command-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anything..."
          className="min-h-12 w-full border-b border-[var(--od-border)] bg-transparent px-4 text-[15px] text-[var(--od-text)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--od-gold)]"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--od-muted)]">No matching routes</li>
          ) : (
            filtered.map((route) => (
              <li key={route.href}>
                <a
                  href={route.href}
                  className="flex min-h-11 items-center justify-between rounded-[8px] px-3 text-sm text-[var(--od-text-2)] transition hover:bg-[var(--od-hover)] hover:text-[var(--od-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
                  onClick={onClose}
                >
                  <span>{route.label}</span>
                  <span className="text-xs text-[var(--od-muted)]">{route.group}</span>
                </a>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-[var(--od-border)] px-4 py-2 text-xs text-[var(--od-muted)]">
          Navigation search only. Record search is not wired.
        </p>
      </div>
    </div>
  );
}
