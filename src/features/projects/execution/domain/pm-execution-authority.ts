/**
 * PM execution authority — pure capability checks (ADR-0019/0020).
 */

import {
  resolveProjectPermissionCapabilities,
  type ProjectActorContext,
} from "../../contracts/permissions.ts";
import { isHandoverExecutionEligible } from "../../contracts/lifecycle.ts";
import type { ProjectHandoverState } from "../../contracts/lifecycle.ts";
import {
  assertExecutionTransition,
  type ExecutionTransitionRequest,
  type ExecutionTransitionResult,
} from "./execution-state-machine.ts";

export type ExecutionWorkspaceAccess = "none" | "high_level" | "full";

export interface PmExecutionAuthorityContext {
  readonly actor: ProjectActorContext;
  readonly handoverState: ProjectHandoverState;
  readonly designCompleted?: boolean;
}

export function resolveExecutionWorkspaceAccess(
  context: PmExecutionAuthorityContext
): ExecutionWorkspaceAccess {
  const actor = context.actor;
  if (
    actor.role === "super_admin" ||
    actor.role === "sales_manager" ||
    (actor.role === "project_manager" && actor.isAssignedPrimaryPm)
  ) {
    return "full";
  }
  if (
    (actor.role === "sales_executive" && actor.isOwningSalesExecutive) ||
    (actor.role === "designer" &&
      (actor.isAssignedLeadDesigner || actor.isAssignedSupportingDesigner))
  ) {
    return "high_level";
  }
  return "none";
}

export function canActorUpdateExecutionStages(
  context: PmExecutionAuthorityContext
): boolean {
  if (!isHandoverExecutionEligible(context.handoverState)) {
    return false;
  }
  if (context.designCompleted === false) {
    return false;
  }
  return resolveProjectPermissionCapabilities(context.actor).canUpdateExecutionStages;
}

export function canActorRequestExecutionTransition(
  context: PmExecutionAuthorityContext,
  request: ExecutionTransitionRequest
): ExecutionTransitionResult {
  if (!canActorUpdateExecutionStages(context)) {
    return {
      allowed: false,
      error: {
        code: "PROJECT_UNAUTHORIZED",
        message: "Actor is not authorized to update execution stages.",
      },
    };
  }

  return assertExecutionTransition(request);
}

export function deniesPmExecutionControlForSalesExecutive(
  context: PmExecutionAuthorityContext
): boolean {
  return (
    context.actor.role === "sales_executive" &&
    !resolveProjectPermissionCapabilities(context.actor).canUpdateExecutionStages
  );
}

export function deniesPmExecutionControlForDesigner(
  context: PmExecutionAuthorityContext
): boolean {
  return (
    context.actor.role === "designer" &&
    !resolveProjectPermissionCapabilities(context.actor).canUpdateExecutionStages
  );
}

export function deniesUnassignedProjectManager(
  context: PmExecutionAuthorityContext
): boolean {
  return (
    context.actor.role === "project_manager" &&
    !context.actor.isAssignedPrimaryPm
  );
}
