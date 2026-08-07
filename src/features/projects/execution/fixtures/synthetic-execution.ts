/**
 * Privacy-safe synthetic execution fixtures for tests and UI prebuild.
 */

import { createProjectRef } from "../../contracts/reference.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { ExecutionMainPathState, ExecutionState } from "../contracts/execution-states.ts";
import { buildExecutionHoldRecord } from "../domain/hold-delay-contract.ts";
import type { ExecutionHoldRecord } from "../domain/hold-delay-contract.ts";
import {
  DEFAULT_HANDOVER_CHECKLIST,
  type HandoverAcknowledgementContract,
  type CompletionAcknowledgementContract,
} from "../domain/handover-completion.ts";
import { buildSnagSummary, type SnagItem } from "../domain/snag-contract.ts";
import type { ProjectActorContext } from "../../contracts/permissions.ts";

export interface SyntheticExecutionProject {
  readonly ref: ReturnType<typeof createProjectRef>;
  readonly clientDisplayName: string;
  readonly projectLabel: string;
  readonly executionState: ExecutionState;
  readonly handoverState: "handover_accepted";
  readonly staffing: ProjectStaffingSnapshot;
  readonly holdRecord: ExecutionHoldRecord | null;
  readonly snags: readonly SnagItem[];
}

const BASE_STAFFING: ProjectStaffingSnapshot = {
  primaryProjectManager: {
    staffProfileId: "pm-synth-001",
    displayName: "A. Project Manager",
    role: "primary_project_manager",
    assignedAt: "2026-08-01T10:00:00.000Z",
    assignedByProfileId: "sm-synth-001",
  },
  leadDesigner: {
    staffProfileId: "ld-synth-001",
    displayName: "B. Lead Designer",
    role: "lead_designer",
    assignedAt: "2026-08-01T10:05:00.000Z",
    assignedByProfileId: "sm-synth-001",
  },
  supportingDesigners: [
    {
      staffProfileId: "sd-synth-001",
      displayName: "C. Supporting Designer",
      role: "supporting_designer",
      assignedAt: "2026-08-01T10:10:00.000Z",
      assignedByProfileId: "sm-synth-001",
    },
  ],
};

function baseRef() {
  return createProjectRef({
    projectReference: "OD-P-2026-0099",
    leadReference: "OD-L-2026-0042",
    acceptedQuotationReference: "OD-Q-2026-0007",
    acceptedRevisionNumber: 2,
  });
}

export function buildSyntheticActiveExecutionProject(
  executionState: ExecutionMainPathState = "production"
): SyntheticExecutionProject {
  return {
    ref: baseRef(),
    clientDisplayName: "Synthetic Residence Client",
    projectLabel: "Kitchen & Wardrobe Package",
    executionState,
    handoverState: "handover_accepted",
    staffing: BASE_STAFFING,
    holdRecord: null,
    snags: [],
  };
}

export function buildSyntheticExecutionHoldProject(): SyntheticExecutionProject {
  const enteredFromState: ExecutionMainPathState = "material_finalisation";
  return {
    ...buildSyntheticActiveExecutionProject(enteredFromState),
    executionState: "on_hold",
    holdRecord: buildExecutionHoldRecord({
      holdId: "hold-synth-001",
      reasonCode: "material_delay",
      humanNote: "Awaiting factory confirmation for shutter finish batch.",
      enteredFromState,
      enteredAt: "2026-08-05T12:00:00.000Z",
      enteredByProfileId: "pm-synth-001",
      actorCanUpdateExecution: true,
    }),
  };
}

export function buildSyntheticSnagFixture(): readonly SnagItem[] {
  return [
    {
      snagRef: "snag-synth-001",
      description: "Soft-close hinge alignment on pantry shutter.",
      status: "open",
      evidenceRefs: [],
      createdAt: "2026-08-06T09:00:00.000Z",
      createdByProfileId: "pm-synth-001",
      resolvedAt: null,
      resolvedByProfileId: null,
    },
    {
      snagRef: "snag-synth-002",
      description: "Touch-up required on skirting junction.",
      status: "resolved",
      evidenceRefs: ["ev-snag-002"],
      createdAt: "2026-08-06T09:30:00.000Z",
      createdByProfileId: "pm-synth-001",
      resolvedAt: "2026-08-06T15:00:00.000Z",
      resolvedByProfileId: "pm-synth-001",
    },
  ];
}

export function buildSyntheticSnagResolutionProject(): SyntheticExecutionProject {
  return {
    ...buildSyntheticActiveExecutionProject("snag_resolution"),
    snags: buildSyntheticSnagFixture(),
  };
}

export function buildSyntheticHandoverProject(): SyntheticExecutionProject {
  return {
    ...buildSyntheticActiveExecutionProject("handover"),
    snags: buildSyntheticSnagFixture().map((item) =>
      item.status === "open"
        ? {
            ...item,
            status: "resolved" as const,
            evidenceRefs: ["ev-snag-001"],
            resolvedAt: "2026-08-06T16:00:00.000Z",
            resolvedByProfileId: "pm-synth-001",
          }
        : item
    ),
  };
}

export function buildSyntheticCompletedProject(): SyntheticExecutionProject {
  return {
    ...buildSyntheticActiveExecutionProject("completed"),
    snags: buildSyntheticSnagFixture().map((item) => ({
      ...item,
      status: "resolved" as const,
      evidenceRefs: item.evidenceRefs.length > 0 ? item.evidenceRefs : ["ev-snag-resolved"],
      resolvedAt: "2026-08-06T17:00:00.000Z",
      resolvedByProfileId: "pm-synth-001",
    })),
  };
}

export function buildSyntheticCancelledProject(): SyntheticExecutionProject {
  return {
    ...buildSyntheticActiveExecutionProject("production"),
    executionState: "cancelled",
    holdRecord: null,
    snags: [],
  };
}

export function buildSyntheticHandoverAcknowledgement(): HandoverAcknowledgementContract {
  return {
    acknowledgementRef: "ack-handover-synth-001",
    capturedAt: "2026-08-07T10:00:00.000Z",
    capturedByProfileId: "pm-synth-001",
    note: "Client walkthrough complete — prebuild acknowledgement only.",
    checklist: DEFAULT_HANDOVER_CHECKLIST.map((item) => ({
      ...item,
      completed: item.required,
      evidenceRef: item.required ? `ev-${item.itemId}` : null,
    })),
  };
}

export function buildSyntheticCompletionAcknowledgement(): CompletionAcknowledgementContract {
  const snags = buildSyntheticHandoverProject().snags;
  return {
    acknowledgementRef: "ack-completion-synth-001",
    capturedAt: "2026-08-07T11:00:00.000Z",
    capturedByProfileId: "pm-synth-001",
    note: "Project completion recorded in prebuild adapter.",
    snagSummary: buildSnagSummary(snags),
  };
}

export function buildAssignedPmActor(): ProjectActorContext {
  return {
    profileId: "pm-synth-001",
    role: "project_manager",
    isAssignedPrimaryPm: true,
    isAssignedLeadDesigner: false,
    isAssignedSupportingDesigner: false,
    isOwningSalesExecutive: false,
  };
}

export function buildSalesExecutiveActor(): ProjectActorContext {
  return {
    profileId: "se-synth-001",
    role: "sales_executive",
    isAssignedPrimaryPm: false,
    isAssignedLeadDesigner: false,
    isAssignedSupportingDesigner: false,
    isOwningSalesExecutive: true,
  };
}

export function buildLeadDesignerActor(): ProjectActorContext {
  return {
    profileId: "ld-synth-001",
    role: "designer",
    isAssignedPrimaryPm: false,
    isAssignedLeadDesigner: true,
    isAssignedSupportingDesigner: false,
    isOwningSalesExecutive: false,
  };
}

export function buildOtherPmActor(): ProjectActorContext {
  return {
    profileId: "pm-synth-999",
    role: "project_manager",
    isAssignedPrimaryPm: false,
    isAssignedLeadDesigner: false,
    isAssignedSupportingDesigner: false,
    isOwningSalesExecutive: false,
  };
}
