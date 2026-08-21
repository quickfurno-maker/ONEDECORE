"use client";

import { useEffect, useId, useState } from "react";
import type { OpsIdentity } from "../types.ts";

interface UserMenuProps {
  readonly identity: OpsIdentity;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function UserMenu({ identity }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-3 rounded-[10px] px-2 py-1 text-left transition hover:bg-[var(--od-hover)]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--od-gold)]/15 text-xs font-semibold text-[var(--od-gold)]">
          {initials(identity.displayName)}
        </span>
        <span className="hidden sm:block">
          <span className="block text-sm font-medium text-[var(--od-text)]">
            {identity.displayName}
          </span>
          <span className="block text-xs text-[var(--od-muted)]">
            {identity.roleLabel ?? identity.email ?? "Staff"}
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-40 mt-2 w-56 rounded-[10px] border border-[var(--od-border-strong)] bg-[var(--od-elevated)] p-2 shadow-xl"
        >
          <p className="truncate px-2 py-1 text-xs text-[var(--od-muted)]">
            {identity.email}
          </p>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="mt-1 flex min-h-10 w-full items-center rounded-[8px] px-2 text-sm text-[var(--od-text-2)] hover:bg-[var(--od-hover)]"
            >
              Sign Out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
