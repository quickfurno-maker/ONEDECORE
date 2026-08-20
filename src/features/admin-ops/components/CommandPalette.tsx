"use client";

import { useMemo, useState } from "react";
import type { OpsCommandRoute } from "../types.ts";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly routes: readonly OpsCommandRoute[];
  readonly onClose: () => void;
}

export function CommandPalette({ open, routes, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search navigation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[12px] border border-[var(--od-border-strong)] bg-[var(--od-elevated)] shadow-2xl">
        <label className="sr-only" htmlFor="od-command-input">
          Search anything
        </label>
        <input
          id="od-command-input"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anything..."
          className="min-h-12 w-full border-b border-[var(--od-border)] bg-transparent px-4 text-[15px] text-[var(--od-text)] outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--od-muted)]">No matching routes</li>
          ) : (
            filtered.map((route) => (
              <li key={route.href}>
                <a
                  href={route.href}
                  className="flex min-h-11 items-center justify-between rounded-[8px] px-3 text-sm text-[var(--od-text-2)] transition hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"
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
