"use client";

import { useActionState } from "react";
import type { TeamLeaveRequestSummary } from "../server/leave-actions.ts";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  type LeaveFormActionState,
} from "../server/leave-form-actions.ts";
import { LeaveStatusBadge } from "./LeaveStatusBadge.tsx";

const INITIAL_STATE: LeaveFormActionState = {
  success: false,
  message: "",
};

interface LeaveApprovalQueueProps {
  readonly requests: readonly TeamLeaveRequestSummary[];
}

function ReviewForm({
  requestId,
  action,
  label,
}: {
  readonly requestId: string;
  readonly action: typeof approveLeaveRequestAction;
  readonly label: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input
        name="note"
        placeholder="Review note (optional)"
        className="w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-400"
      >
        {pending ? "Saving…" : label}
      </button>
      {state.message ? (
        <p className={`text-xs ${state.success ? "text-emerald-300" : "text-red-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function LeaveApprovalQueue({ requests }: LeaveApprovalQueueProps) {
  if (requests.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10 text-sm text-neutral-400">
        No pending leave requests in your approval queue.
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <article
          key={request.id}
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-neutral-50">{request.staffName}</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {request.typeName} · {request.range}
              </p>
              <p className="mt-2 text-sm text-neutral-300">{request.reason}</p>
            </div>
            <LeaveStatusBadge status={request.status} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReviewForm
              requestId={request.id}
              action={approveLeaveRequestAction}
              label="Approve"
            />
            <ReviewForm
              requestId={request.id}
              action={rejectLeaveRequestAction}
              label="Reject"
            />
          </div>
        </article>
      ))}
    </div>
  );
}
