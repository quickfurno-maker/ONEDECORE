"use client";

import { useRef } from "react";
import { CommandPalette } from "./CommandPalette.tsx";
import { QuickActionsMenu } from "./QuickActionsMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";
import { OpsIcon } from "./OpsIcon.tsx";
import type { OpsCommandRoute, OpsIdentity, OpsNavFlags } from "../types.ts";

interface AdminTopBarProps {
  readonly identity: OpsIdentity;
  readonly flags: OpsNavFlags;
  readonly routes: readonly OpsCommandRoute[];
  readonly commandOpen: boolean;
  readonly onOpenCommand: () => void;
  readonly onCloseCommand: () => void;
  readonly onOpenMobileNav: () => void;
}

export function AdminTopBar({
  identity,
  flags,
  routes,
  commandOpen,
  onOpenCommand,
  onCloseCommand,
  onOpenMobileNav,
}: AdminTopBarProps) {
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--od-border)] bg-[var(--od-bg)]/95 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="flex min-h-10 min-w-10 items-center justify-center rounded-[8px] text-[var(--od-text-2)] hover:bg-[var(--od-hover)] lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <OpsIcon name="menu" />
      </button>
      <div className="mx-auto flex w-full max-w-xl flex-1 justify-center">
        <button
          ref={searchButtonRef}
          type="button"
          onClick={onOpenCommand}
          className="flex min-h-10 w-full items-center gap-2 rounded-full border border-[var(--od-border)] bg-[var(--od-surface)] px-4 text-left text-sm text-[var(--od-muted)] transition hover:border-[var(--od-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
        >
          <OpsIcon name="search" className="h-4 w-4" />
          <span className="flex-1">Search anything...</span>
          <kbd className="hidden rounded border border-[var(--od-border)] px-1.5 py-0.5 text-[11px] sm:inline">
            Ctrl + K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <QuickActionsMenu flags={flags} />
        <UserMenu identity={identity} />
      </div>
      <CommandPalette
        open={commandOpen}
        routes={routes}
        onClose={onCloseCommand}
        returnFocusRef={searchButtonRef}
      />
    </header>
  );
}
