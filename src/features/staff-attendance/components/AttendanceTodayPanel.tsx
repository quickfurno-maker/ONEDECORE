"use client";

import { useActionState, useMemo } from "react";
import {
  ATTENDANCE_LOCATION_CATEGORIES,
  type AttendanceToday,
} from "../contracts/dto.ts";
import {
  checkInAction,
  checkOutAction,
  type AttendanceFormActionState,
} from "../server/attendance-form-actions.ts";
import { AttendanceTodayCard } from "./AttendanceTodayCard.tsx";

const INITIAL_STATE: AttendanceFormActionState = {
  success: false,
  message: "",
};

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

interface AttendanceTodayPanelProps {
  readonly today: AttendanceToday;
  readonly showLocationSelector?: boolean;
}

function AttendanceMutationForm({
  action,
  label,
  pendingLabel,
  showLocationSelector,
}: {
  readonly action: typeof checkInAction;
  readonly label: string;
  readonly pendingLabel: string;
  readonly showLocationSelector: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {showLocationSelector ? (
        <select name="locationCategory" className={fieldClassName} aria-label="Location category">
          <option value="">Location (optional)</option>
          {ATTENDANCE_LOCATION_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60 sm:w-auto"
      >
        {pending ? pendingLabel : label}
      </button>
      {state.message ? (
        <p
          role={state.success ? "status" : "alert"}
          className={`text-xs ${state.success ? "text-emerald-300" : "text-red-300"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AttendanceTodayPanel({
  today,
  showLocationSelector = false,
}: AttendanceTodayPanelProps) {
  return (
    <AttendanceTodayCard
      today={today}
      showLocationSelector={showLocationSelector}
      checkInAction={
        <AttendanceMutationForm
          action={checkInAction}
          label="Check in"
          pendingLabel="Checking in…"
          showLocationSelector={showLocationSelector}
        />
      }
      checkOutAction={
        <AttendanceMutationForm
          action={checkOutAction}
          label="Check out"
          pendingLabel="Checking out…"
          showLocationSelector={showLocationSelector}
        />
      }
    />
  );
}
