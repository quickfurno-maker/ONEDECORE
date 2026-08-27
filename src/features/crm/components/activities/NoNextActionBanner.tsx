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
      className="crm-surface relative overflow-hidden p-4 sm:p-5"
      data-testid="crm-no-next-action-banner"
      role="status"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--crm-danger)]"
      />
      <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--crm-danger)]">Needs action</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--crm-text)] sm:text-lg">
            No next action
          </h2>
          <p className="mt-1 text-sm text-[var(--crm-text-secondary)]">
            This lead has no primary next action scheduled. Every open lead needs
            a clear next step.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="crm-btn crm-btn-primary shrink-0"
            data-testid="crm-create-next-action-cta"
          >
            Create next action
          </button>
        ) : null}
      </div>
    </section>
  );
}
