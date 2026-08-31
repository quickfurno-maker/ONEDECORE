import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  validateCadenceEnrollmentId,
  validateCadenceStepInputs,
  validateCadenceTemplateInput,
  validateEnrollLeadInCadenceInput,
  type CadenceFieldError,
  type CadenceTemplateInput,
  type CrmCadenceStepInput,
  type EnrollLeadInCadenceInput,
} from "../contracts/cadence-contracts.ts";
import {
  callArchiveCadenceTemplate,
  callCancelLeadCadence,
  callCreateCadenceTemplate,
  callDuplicateCadenceTemplate,
  callEnrollLeadInCadence,
  callPauseLeadCadence,
  callPublishCadenceTemplate,
  callReplaceCadenceTemplateSteps,
  callResumeLeadCadence,
  callUpdateCadenceTemplate,
  type CadenceEnrollmentMutationResult,
  type CadenceTemplateMutationResult,
} from "./crm-cadence-adapters.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError } from "./crm-errors.ts";

/**
 * Template lifecycle requires `crm.cadences.manage` (owner lock D3). The RPC
 * re-checks server-side; this only fails fast with a typed error.
 */
async function requireCadenceManagerContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CADENCE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  if (!context.canManageCadences) {
    throw new CrmError({
      code: "CADENCE_PERMISSION_DENIED",
      message: "You are not allowed to manage cadences.",
      httpStatus: 403,
    });
  }
  return context;
}

/**
 * Enrollment reuses the CRM 2A activity authority (owner lock D4): it only
 * schedules canonical activities on a lead the actor may already mutate.
 */
async function requireCadenceEnrollmentContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CADENCE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  if (!context.canManageLeadFollowUps) {
    throw new CrmError({
      code: "CADENCE_PERMISSION_DENIED",
      message: "You are not allowed to manage cadences on this lead.",
      httpStatus: 403,
    });
  }
  return context;
}

function throwValidation(
  errors: readonly CadenceFieldError[],
  code: "CADENCE_TEMPLATE_INVALID" | "CADENCE_STEP_INVALID" | "VALIDATION_FAILED"
): never {
  throw new CrmError({
    code,
    message: errors[0]?.message ?? "Validation failed",
    httpStatus: 422,
    details: errors.map((entry) => entry.message).join("; "),
  });
}

export async function createCadenceTemplateForCurrentUser(
  input: CadenceTemplateInput
): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const errors = validateCadenceTemplateInput(input);
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  const supabase = await createClient();
  return callCreateCadenceTemplate(supabase, input);
}

export async function updateCadenceTemplateForCurrentUser(input: {
  readonly templateId: string;
  readonly name: string;
  readonly description: string | null;
}): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const errors = validateCadenceTemplateInput({
    name: input.name,
    description: input.description,
  });
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  const supabase = await createClient();
  return callUpdateCadenceTemplate(supabase, input);
}

export async function replaceCadenceTemplateStepsForCurrentUser(input: {
  readonly templateId: string;
  readonly steps: readonly CrmCadenceStepInput[];
}): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const errors = validateCadenceStepInputs(input.steps);
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_STEP_INVALID");
  }

  const supabase = await createClient();
  return callReplaceCadenceTemplateSteps(supabase, input);
}

export async function publishCadenceTemplateForCurrentUser(
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const supabase = await createClient();
  return callPublishCadenceTemplate(supabase, templateId);
}

export async function archiveCadenceTemplateForCurrentUser(
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const supabase = await createClient();
  return callArchiveCadenceTemplate(supabase, templateId);
}

export async function duplicateCadenceTemplateForCurrentUser(input: {
  readonly templateId: string;
  readonly name: string;
}): Promise<CadenceTemplateMutationResult> {
  await requireCadenceManagerContext();
  const errors = validateCadenceTemplateInput({
    name: input.name,
    description: null,
  });
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  const supabase = await createClient();
  return callDuplicateCadenceTemplate(supabase, input);
}

export async function enrollLeadInCadenceForCurrentUser(
  input: EnrollLeadInCadenceInput
): Promise<CadenceEnrollmentMutationResult> {
  await requireCadenceEnrollmentContext();
  const errors = validateEnrollLeadInCadenceInput(input);
  if (errors.length > 0) {
    throwValidation(errors, "VALIDATION_FAILED");
  }

  const supabase = await createClient();
  return callEnrollLeadInCadence(supabase, input);
}

export async function pauseLeadCadenceForCurrentUser(
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  await requireCadenceEnrollmentContext();
  const errors = validateCadenceEnrollmentId(enrollmentId);
  if (errors.length > 0) {
    throwValidation(errors, "VALIDATION_FAILED");
  }

  const supabase = await createClient();
  return callPauseLeadCadence(supabase, enrollmentId);
}

export async function resumeLeadCadenceForCurrentUser(
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  await requireCadenceEnrollmentContext();
  const errors = validateCadenceEnrollmentId(enrollmentId);
  if (errors.length > 0) {
    throwValidation(errors, "VALIDATION_FAILED");
  }

  const supabase = await createClient();
  return callResumeLeadCadence(supabase, enrollmentId);
}

export async function cancelLeadCadenceForCurrentUser(
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  await requireCadenceEnrollmentContext();
  const errors = validateCadenceEnrollmentId(enrollmentId);
  if (errors.length > 0) {
    throwValidation(errors, "VALIDATION_FAILED");
  }

  const supabase = await createClient();
  return callCancelLeadCadence(supabase, enrollmentId);
}
