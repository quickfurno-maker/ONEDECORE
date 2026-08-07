import type { ReactNode } from "react";

interface WhatsappPageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}

export function WhatsappPageHeader({
  title,
  description,
  actions,
}: WhatsappPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
          WhatsApp Inbox
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-50">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
