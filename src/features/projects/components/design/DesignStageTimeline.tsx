"use client";

import {
  DESIGN_MAIN_PATH_STATES,
  type DesignState,
  getDesignStateLabel,
} from "../../contracts/design-states.ts";

export interface DesignStageTimelineCallbacks {
  readonly onSelectStage?: (state: DesignState) => void;
}

export interface DesignStageTimelineProps {
  readonly currentState: DesignState;
  readonly permittedTransitions?: readonly DesignState[];
  readonly callbacks?: DesignStageTimelineCallbacks;
}

export function DesignStageTimeline({
  currentState,
  permittedTransitions = [],
  callbacks,
}: DesignStageTimelineProps) {
  const mainIndex = (DESIGN_MAIN_PATH_STATES as readonly string[]).indexOf(
    currentState
  );

  return (
    <ol
      aria-label="Design stage timeline"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      {DESIGN_MAIN_PATH_STATES.map((state, index) => {
        const isCurrent = state === currentState;
        const isComplete = mainIndex >= 0 && index < mainIndex;
        const isPermitted = permittedTransitions.includes(state);

        return (
          <li
            key={state}
            aria-current={isCurrent ? "step" : undefined}
            className={`rounded-md border px-3 py-2 text-sm ${
              isCurrent
                ? "border-emerald-500 bg-emerald-950/40 text-emerald-100"
                : isComplete
                  ? "border-neutral-700 text-neutral-400"
                  : "border-neutral-800 text-neutral-500"
            }`}
          >
            {callbacks?.onSelectStage && isPermitted && !isCurrent ? (
              <button
                type="button"
                className="text-left"
                onClick={() => callbacks.onSelectStage?.(state)}
              >
                {getDesignStateLabel(state)}
              </button>
            ) : (
              getDesignStateLabel(state)
            )}
            {isPermitted && !isCurrent ? (
              <span className="ml-2 text-xs text-emerald-300">permitted</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
