"use client";

import {
  EXECUTION_MAIN_PATH_STATES,
  type ExecutionState,
  getExecutionStateLabel,
} from "../../execution/contracts/execution-states.ts";

interface ExecutionStageTimelineProps {
  readonly currentState: ExecutionState;
}

function stageStatus(
  stage: (typeof EXECUTION_MAIN_PATH_STATES)[number],
  currentState: ExecutionState
): "complete" | "current" | "upcoming" | "branch" {
  if (currentState === "on_hold" || currentState === "cancelled") {
    return "branch";
  }
  const currentIndex = EXECUTION_MAIN_PATH_STATES.indexOf(
    currentState as (typeof EXECUTION_MAIN_PATH_STATES)[number]
  );
  const stageIndex = EXECUTION_MAIN_PATH_STATES.indexOf(stage);
  if (stageIndex < currentIndex) return "complete";
  if (stageIndex === currentIndex) return "current";
  return "upcoming";
}

export function ExecutionStageTimeline({ currentState }: ExecutionStageTimelineProps) {
  return (
    <section
      aria-label="Execution stage timeline"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Execution timeline</h2>
      <ol className="mt-4 space-y-3" role="list">
        {EXECUTION_MAIN_PATH_STATES.map((stage) => {
          const status = stageStatus(stage, currentState);
          return (
            <li key={stage} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={[
                  "mt-1 inline-flex h-3 w-3 shrink-0 rounded-full border",
                  status === "complete" ? "border-emerald-400 bg-emerald-500" : "",
                  status === "current" ? "border-sky-400 bg-sky-500" : "",
                  status === "upcoming" ? "border-neutral-600 bg-neutral-800" : "",
                  status === "branch" ? "border-neutral-600 bg-neutral-700" : "",
                ].join(" ")}
              />
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  {getExecutionStateLabel(stage)}
                </p>
                {status === "current" ? (
                  <p className="text-xs text-sky-300" aria-live="polite">
                    Current stage
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {currentState === "on_hold" ? (
        <p className="mt-4 text-sm text-amber-200" role="status">
          Project is on hold — timeline progression is paused.
        </p>
      ) : null}
      {currentState === "cancelled" ? (
        <p className="mt-4 text-sm text-red-200" role="status">
          Project cancelled — timeline is terminal.
        </p>
      ) : null}
    </section>
  );
}
