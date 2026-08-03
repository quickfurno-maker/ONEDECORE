import { ACHIEVEMENT_INACTIVE_COPY } from "../../contracts/sales-target-contracts.ts";

export function AchievementInactiveNotice() {
  return (
    <section
      aria-label="Target achievement status"
      className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3"
    >
      <p className="text-sm font-medium text-amber-200">{ACHIEVEMENT_INACTIVE_COPY}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-400">
        Targets are configuration only. Authoritative commercial achievement will
        derive from accepted quotation evidence in Phase 7B.
      </p>
    </section>
  );
}
