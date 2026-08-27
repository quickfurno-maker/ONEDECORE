"use client";

import type { ReactNode } from "react";

interface CrmActivityDialogShellProps {
  readonly open: boolean;
  readonly title: string;
  readonly titleId: string;
  readonly description?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly tone?: "default" | "danger";
}

export function CrmActivityDialogShell({
  open,
  title,
  titleId,
  description,
  onClose,
  children,
  testId,
  tone = "default",
}: CrmActivityDialogShellProps) {
  if (!open) {
    return null;
  }

  const borderClass =
    tone === "danger" ? "border-[var(--crm-danger)]/30" : "border-[var(--crm-border-strong)]";
  const titleClass =
    tone === "danger" ? "text-red-200" : "text-[var(--crm-text)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border ${borderClass} bg-[var(--crm-surface)] shadow-xl sm:rounded-lg`}
        onClick={(event) => event.stopPropagation()}
        data-testid={testId}
      >
        <div className="border-b border-[var(--crm-border)] px-5 py-4">
          <h3 id={titleId} className={`text-lg font-semibold ${titleClass}`}>
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-[var(--crm-muted)]">{description}</p>
          ) : null}
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
