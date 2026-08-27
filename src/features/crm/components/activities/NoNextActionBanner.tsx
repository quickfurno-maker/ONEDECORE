"use client";

interface NoNextActionBannerProps {
  readonly onCreateClick: () => void;
  readonly canManage: boolean;
}

export function NoNextActionBanner({
  onCreateClick,
  canManage,
}: NoNextActionBannerProps) {
  return (
    <section
      className="rounded-xl border border-red-900/70 bg-red-950/20 p-5"
      data-testid="crm-no-next-action-banner"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
            Risk
          </p>
          <h2 className="mt-1 text-lg font-semibold text-red-100">
            No next action
          </h2>
          <p className="mt-1 text-sm text-red-200/80">
            This lead has no primary next action scheduled. Every open lead needs
            a clear next step.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[var(--od-gold)] px-5 py-2 text-sm font-semibold text-neutral-950"
            data-testid="crm-create-next-action-cta"
          >
            Create next action
          </button>
        ) : null}
      </div>
    </section>
  );
}
