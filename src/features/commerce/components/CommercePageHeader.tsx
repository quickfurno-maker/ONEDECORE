import Link from "next/link";
import type { ReactNode } from "react";

export function CommercePageHeader({
  title,
  subtitle,
  actions,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight text-[var(--od-text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--od-muted)]">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CommerceGoldButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408] transition duration-150 hover:brightness-110"
    >
      {children}
    </Link>
  );
}

export function CommerceGhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border-strong)] px-4 text-sm text-[var(--od-text-2)] transition duration-150 hover:border-[var(--od-gold)]/50 hover:text-[var(--od-text)]"
    >
      {children}
    </Link>
  );
}
