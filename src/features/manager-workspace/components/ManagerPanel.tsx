import type { ReactNode } from "react";

/**
 * A dashboard section, including the case where its read failed.
 *
 * The unavailable body is a first-class state rather than an empty list,
 * because an empty list says "there is nothing" and a failed read does not
 * know that. Panels on this dashboard never fall back to zeros.
 */
export function ManagerPanel({
  title,
  caption,
  headerLink,
  children,
}: {
  readonly title: string;
  readonly caption?: string;
  /** A link, never a control: panels on this dashboard do not mutate. */
  readonly headerLink?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
          {caption ? (
            <p className="mt-0.5 text-xs text-neutral-500">{caption}</p>
          ) : null}
        </div>
        {headerLink}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function ManagerPanelUnavailable({ note }: { readonly note: string }) {
  return (
    <p className="text-sm text-neutral-400">
      <span className="font-semibold text-amber-300">Unavailable</span> — {note}
    </p>
  );
}

export function ManagerPanelEmpty({ message }: { readonly message: string }) {
  return <p className="text-sm text-neutral-500">{message}</p>;
}
