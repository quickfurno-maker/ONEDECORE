/**
 * Phase 8B — measurement_completed requires a current READY measurement_sheet.
 */

import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";
import type { DesignState } from "../../contracts/design-states.ts";
import type { DesignDeliverableVersion } from "./versioned-deliverables.ts";

export interface MeasurementSheetGateInput {
  readonly targetState: DesignState;
  readonly versions: readonly DesignDeliverableVersion[];
}

export interface MeasurementSheetGateResult {
  readonly ok: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export function hasCurrentReadyMeasurementSheet(
  versions: readonly DesignDeliverableVersion[]
): boolean {
  const measurement = versions.filter(
    (version) => version.kind === "measurement_sheet" && version.isCurrent
  );
  return measurement.length > 0;
}

export function validateMeasurementCompletedGate(
  input: MeasurementSheetGateInput
): MeasurementSheetGateResult {
  if (input.targetState !== "measurement_completed") {
    return { ok: true, error: null };
  }

  if (!hasCurrentReadyMeasurementSheet(input.versions)) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Measurement completed requires a current ready measurement sheet."
      ),
    };
  }

  return { ok: true, error: null };
}
