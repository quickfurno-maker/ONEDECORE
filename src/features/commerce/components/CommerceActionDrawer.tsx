"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { captureDrawerRestorationTarget, isDrawerEscapeKey, restoreDrawerFocus, type DrawerFocusTarget } from "../ui/drawer-keys";

function focusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
}

export function CommerceActionDrawer({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  const restorationTargetRef = useRef<DrawerFocusTarget | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    restorationTargetRef.current = captureDrawerRestorationTarget({
      wasOpen: wasOpenRef.current,
      isOpen: open,
      currentlyFocused: document.activeElement,
      existingTarget: restorationTargetRef.current,
    });
    wasOpenRef.current = open;

    if (!open) {
      return;
    }

    const panel = panelRef.current;
    const focusFirst = () => {
      const items = panel ? focusableElements(panel) : [];
      (items[0] ?? panel)?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (isDrawerEscapeKey(event.key)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const items = focusableElements(panel);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
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
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreDrawerFocus(restorationTargetRef.current);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-[61] flex h-full w-full max-w-full flex-col border-l border-[var(--od-border)] bg-[var(--od-surface)] shadow-[0_0_40px_rgba(0,0,0,0.45)] motion-safe:animate-[od-fade-up_180ms_ease-out] sm:max-w-[560px]"
      >
        <div className="flex items-center justify-between border-b border-[var(--od-border)] px-5 py-4">
          <h2 id={titleId} className="text-[17px] font-semibold text-[var(--od-text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-[8px] text-[var(--od-muted)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 ops-scrollbar">{children}</div>
      </div>
    </div>
  );
}
