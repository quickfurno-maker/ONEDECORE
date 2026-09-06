"use client";

/**
 * The manager's top bar: who is signed in, and the way out.
 *
 * No command palette and no global search. The owner's top bar carries both
 * because the owner navigates the whole product from it; offering the manager
 * a palette of routes they cannot open would be a worse answer than not
 * offering one.
 */
export function ManagerTopBar({
  displayName,
  roleLabel,
  onOpenNav,
}: {
  readonly displayName: string;
  readonly roleLabel: string;
  readonly onOpenNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-300 lg:hidden"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ☰
          </span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-100">
            {displayName}
          </p>
          <p className="truncate text-xs text-neutral-500">{roleLabel}</p>
        </div>
      </div>

      {/*
        * The same sign-out the rest of the workspace uses: an ordinary POST to
        * the existing route, so it works with JavaScript disabled and clears
        * the session through the one path that knows how.
        */}
      <form method="post" action="/auth/signout">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
