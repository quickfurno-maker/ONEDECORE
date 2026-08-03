"use client";

import { useActionState } from "react";
import type { CrmAccessContext } from "../../contracts/crm-access.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import {
  formatInrFromPaise,
  type SalesTargetSummary,
} from "../../contracts/sales-target-contracts.ts";
import {
  createSalesTargetAction,
  lockSalesTargetAction,
  reopenSalesTargetAction,
  reviseSalesTargetAction,
} from "../../server/crm-sales-target-actions.ts";
import { AchievementInactiveNotice } from "./AchievementInactiveNotice.tsx";

interface SalesTargetsPanelProps {
  readonly context: CrmAccessContext;
  readonly targets: readonly SalesTargetSummary[];
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly isExecutiveView: boolean;
}

const initialState = { success: false, message: "" } as const;

function scopeLabel(scope: SalesTargetSummary["targetScope"]): string {
  return scope === "sales_team" ? "Team target" : "Executive personal";
}

export function SalesTargetsPanel({
  context,
  targets,
  assignees,
  isExecutiveView,
}: SalesTargetsPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    createSalesTargetAction,
    initialState
  );

  if (targets.length === 0) {
    return (
      <div className="space-y-6">
        <AchievementInactiveNotice />
        <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 p-8 text-center">
          <p className="text-sm text-neutral-300">No sales target configured yet.</p>
          <p className="mt-2 text-xs text-neutral-500">
            {context.canManageSalesTargets
              ? "Create a monthly team or executive target below."
              : "Your administrator has not configured a target for this period."}
          </p>
        </div>
        {context.canManageSalesTargets ? (
          <CreateTargetForm
            assignees={assignees}
            action={createAction}
            pending={createPending}
            state={createState}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AchievementInactiveNotice />
      {targets
        .filter(
          (target) =>
            !isExecutiveView || target.targetScope !== "sales_team"
        )
        .map((target) => (
        <TargetCard
          key={target.id}
          target={target}
          canManage={context.canManageSalesTargets}
        />
      ))}
      {context.canManageSalesTargets ? (
        <CreateTargetForm
          assignees={assignees}
          action={createAction}
          pending={createPending}
          state={createState}
        />
      ) : null}
    </div>
  );
}

function TargetCard({
  target,
  canManage,
}: {
  readonly target: SalesTargetSummary;
  readonly canManage: boolean;
}) {
  const [reviseState, reviseAction, revisePending] = useActionState(
    reviseSalesTargetAction,
    initialState
  );
  const [lockState, lockAction, lockPending] = useActionState(
    lockSalesTargetAction,
    initialState
  );
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenSalesTargetAction,
    initialState
  );

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-400/80">
            {scopeLabel(target.targetScope)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-50">
            {target.targetMonth.slice(0, 7)}
            {target.targetDisplayName ? ` · ${target.targetDisplayName}` : ""}
          </h2>
        </div>
        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
          {target.status} · rev {target.revision}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Revenue target</dt>
          <dd className="text-sm text-neutral-100">
            {formatInrFromPaise(target.revenueTargetPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Closed-Won count target</dt>
          <dd className="text-sm text-neutral-100">{target.closedWonCountTarget}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-neutral-500">
        Last updated {new Date(target.updatedAt).toLocaleString("en-IN")} ·{" "}
        {target.lastReason}
      </p>

      {canManage && target.status === "open" ? (
        <form action={reviseAction} className="mt-4 space-y-3 border-t border-neutral-800 pt-4">
          <input type="hidden" name="targetId" value={target.id} />
          <input type="hidden" name="expectedRevision" value={target.revision} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-neutral-400">
              Revenue (INR)
              <input
                name="revenueInr"
                defaultValue={String(target.revenueTargetPaise / 100)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              Closed-Won count
              <input
                name="closedWonCount"
                type="number"
                defaultValue={target.closedWonCountTarget}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-neutral-400">
            Reason
            <textarea
              name="reason"
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              placeholder="Document why this target is being revised"
            />
          </label>
          <button
            type="submit"
            disabled={revisePending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950"
          >
            Revise target
          </button>
          {reviseState.message ? (
            <p className="text-xs text-neutral-400">{reviseState.message}</p>
          ) : null}
        </form>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {target.status === "open" ? (
            <form action={lockAction}>
              <input type="hidden" name="targetId" value={target.id} />
              <input type="hidden" name="expectedRevision" value={target.revision} />
              <input type="hidden" name="reason" value="Locking target after configuration review for the month." />
              <button
                type="submit"
                disabled={lockPending}
                className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-200"
              >
                Lock
              </button>
            </form>
          ) : (
            <form action={reopenAction}>
              <input type="hidden" name="targetId" value={target.id} />
              <input type="hidden" name="expectedRevision" value={target.revision} />
              <input type="hidden" name="reason" value="Reopening target for approved configuration correction." />
              <button
                type="submit"
                disabled={reopenPending}
                className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-200"
              >
                Reopen
              </button>
            </form>
          )}
          {(lockState.message || reopenState.message) && (
            <p className="text-xs text-neutral-400">
              {lockState.message || reopenState.message}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function CreateTargetForm({
  assignees,
  action,
  pending,
  state,
}: {
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly action: (payload: FormData) => void;
  readonly pending: boolean;
  readonly state: { readonly success: boolean; readonly message: string };
}) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
      <h3 className="text-sm font-semibold text-neutral-100">Create target</h3>
      <form action={action} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            Month (YYYY-MM-01)
            <input
              name="targetMonth"
              placeholder="2026-08-01"
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Scope
            <select
              name="targetScope"
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value="sales_team">Team target</option>
              <option value="executive_personal">Executive personal</option>
            </select>
          </label>
        </div>
        <label className="block text-xs text-neutral-400">
          Executive (personal scope only)
          <select
            name="targetUserId"
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {assignees.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            Revenue (INR)
            <input
              name="revenueInr"
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Closed-Won count
            <input
              name="closedWonCount"
              type="number"
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs text-neutral-400">
          Reason
          <textarea
            name="reason"
            rows={2}
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950"
        >
          Create target
        </button>
        {state.message ? (
          <p className="text-xs text-neutral-400">{state.message}</p>
        ) : null}
      </form>
    </section>
  );
}
