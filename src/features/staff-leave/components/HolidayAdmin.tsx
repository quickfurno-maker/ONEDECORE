"use client";

import { useActionState } from "react";
import type { HolidaySummary } from "../contracts/dto.ts";
import {
  archiveHolidayAction,
  createHolidayAction,
  type LeaveFormActionState,
} from "../server/leave-form-actions.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const INITIAL_STATE: LeaveFormActionState = {
  success: false,
  message: "",
};

interface HolidayAdminProps {
  readonly holidays: readonly HolidaySummary[];
}

export function HolidayAdmin({ holidays }: HolidayAdminProps) {
  const [createState, createAction, createPending] = useActionState(
    createHolidayAction,
    INITIAL_STATE
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveHolidayAction,
    INITIAL_STATE
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold text-neutral-50">Active holidays</h2>
        {holidays.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No active holidays configured.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {holidays.map((holiday) => (
              <li
                key={holiday.id}
                className="flex flex-col gap-3 rounded-md border border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-neutral-100">{holiday.name}</p>
                  <p className="text-sm text-neutral-500">{holiday.holidayDate}</p>
                </div>
                <form action={archiveAction}>
                  <input type="hidden" name="holidayId" value={holiday.id} />
                  <button
                    type="submit"
                    disabled={archivePending}
                    className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-400"
                  >
                    Archive
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {archiveState.message ? (
          <p className="mt-3 text-sm text-emerald-300">{archiveState.message}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold text-neutral-50">Add holiday</h2>
        <form action={createAction} className="mt-4 space-y-4">
          {createState.message ? (
            <div
              role={createState.success ? "status" : "alert"}
              className={`rounded-md border px-4 py-3 text-sm ${
                createState.success
                  ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-100"
                  : "border-red-900/60 bg-red-950/30 text-red-100"
              }`}
            >
              {createState.message}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-neutral-200">Date</label>
              <input name="holidayDate" type="date" required className={fieldClassName} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Name</label>
              <input name="name" required className={fieldClassName} />
            </div>
          </div>
          <button
            type="submit"
            disabled={createPending}
            className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
          >
            {createPending ? "Creating…" : "Create holiday"}
          </button>
        </form>
      </section>
    </div>
  );
}
