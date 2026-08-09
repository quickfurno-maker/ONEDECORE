"use client";

import { useActionState } from "react";
import type { LeaveRequestSummary } from "../contracts/dto.ts";
import {
  cancelLeaveRequestAction,
  type LeaveFormActionState,
} from "../server/leave-form-actions.ts";
import { LeaveStatusBadge } from "./LeaveStatusBadge.tsx";

const INITIAL_STATE: LeaveFormActionState = {
  success: false,
  message: "",
};

interface LeaveRequestListProps {
  readonly requests: readonly LeaveRequestSummary[];
}

export function LeaveRequestList({ requests }: LeaveRequestListProps) {
  const [state, formAction, pending] = useActionState(
    cancelLeaveRequestAction,
    INITIAL_STATE
  );

  if (requests.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10 text-sm text-neutral-400">
        You have no leave requests yet.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {state.message ? (
        <p
          role={state.success ? "status" : "alert"}
          className={`text-sm ${state.success ? "text-emerald-300" : "text-red-300"}`}
        >
          {state.message}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-800 text-sm">
          <thead className="bg-neutral-900/80">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-300">Type</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-300">Range</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-300">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-4 py-3 text-neutral-100">{request.typeName}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {request.range}
                  {request.halfDayPart ? ` (${request.halfDayPart.toUpperCase()})` : ""}
                </td>
                <td className="px-4 py-3">
                  <LeaveStatusBadge status={request.status} />
                </td>
                <td className="px-4 py-3">
                  {request.status === "pending" ? (
                    <form action={formAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        name="reason"
                        required
                        placeholder="Cancellation reason"
                        className="min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50"
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-400"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
