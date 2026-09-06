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
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import { CrmError } from "./crm-errors.ts";

/**
 * Template lifecycle requires `crm.cadences.manage` (owner lock D3). The RPC
 * re-checks server-side; this only fails fast with a typed error.
 *
 * The assertion takes a context rather than resolving one, so the browser
 * workspace and the bearer-authenticated mobile boundary run the IDENTICAL
 * permission check. There is one definition of "may manage cadences" and both
 * callers reach it — a second gate written at a transport edge is exactly how
 * two surfaces drift apart.
 */
function assertCadenceManagePermission(context: CrmAccessContext): void {
  if (!context.canManageCadences) {
    throw new CrmError({
      code: "CADENCE_PERMISSION_DENIED",
      message: "You are not allowed to manage cadences.",
      httpStatus: 403,
    });
  }
}

async function requireCadenceManagerContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CADENCE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertCadenceManagePermission(context);
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

/*
 * ============================================================================
 * Template lifecycle — context/db-safe implementations
 * ============================================================================
 *
 * Each `...ForContext` holds the whole rule: assert the permission, run the
 * canonical validator, call the canonical RPC. The `...ForCurrentUser` wrappers
 * below resolve a cookie context and delegate, so the browser workspace keeps
 * its exact previous behaviour while the mobile boundary reaches the same code
 * with a bearer context and a bearer client.
 *
 * No step limit, delay bound or reminder bound is restated here: those live in
 * `validateCadenceStepInputs`, which is the only definition of them.
 */

export async function createCadenceTemplateForContext(
  context: CrmAccessContext,
  input: CadenceTemplateInput,
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  const errors = validateCadenceTemplateInput(input);
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  return callCreateCadenceTemplate(await resolveCrmDb(db), input);
}

export async function updateCadenceTemplateForContext(
  context: CrmAccessContext,
  input: {
    readonly templateId: string;
    readonly name: string;
    readonly description: string | null;
  },
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  const errors = validateCadenceTemplateInput({
    name: input.name,
    description: input.description,
  });
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  return callUpdateCadenceTemplate(await resolveCrmDb(db), input);
}

export async function replaceCadenceTemplateStepsForContext(
  context: CrmAccessContext,
  input: {
    readonly templateId: string;
    readonly steps: readonly CrmCadenceStepInput[];
  },
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  const errors = validateCadenceStepInputs(input.steps);
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_STEP_INVALID");
  }

  return callReplaceCadenceTemplateSteps(await resolveCrmDb(db), input);
}

export async function publishCadenceTemplateForContext(
  context: CrmAccessContext,
  templateId: string,
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  return callPublishCadenceTemplate(await resolveCrmDb(db), templateId);
}

export async function archiveCadenceTemplateForContext(
  context: CrmAccessContext,
  templateId: string,
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  return callArchiveCadenceTemplate(await resolveCrmDb(db), templateId);
}

export async function duplicateCadenceTemplateForContext(
  context: CrmAccessContext,
  input: { readonly templateId: string; readonly name: string },
  db?: CrmDb
): Promise<CadenceTemplateMutationResult> {
  assertCadenceManagePermission(context);
  const errors = validateCadenceTemplateInput({
    name: input.name,
    description: null,
  });
  if (errors.length > 0) {
    throwValidation(errors, "CADENCE_TEMPLATE_INVALID");
  }

  return callDuplicateCadenceTemplate(await resolveCrmDb(db), input);
}

/* ---- browser wrappers: cookie context, cookie client, unchanged ---------- */

export async function createCadenceTemplateForCurrentUser(
  input: CadenceTemplateInput
): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return createCadenceTemplateForContext(context, input);
}

export async function updateCadenceTemplateForCurrentUser(input: {
  readonly templateId: string;
  readonly name: string;
  readonly description: string | null;
}): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return updateCadenceTemplateForContext(context, input);
}

export async function replaceCadenceTemplateStepsForCurrentUser(input: {
  readonly templateId: string;
  readonly steps: readonly CrmCadenceStepInput[];
}): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return replaceCadenceTemplateStepsForContext(context, input);
}

export async function publishCadenceTemplateForCurrentUser(
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return publishCadenceTemplateForContext(context, templateId);
}

export async function archiveCadenceTemplateForCurrentUser(
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return archiveCadenceTemplateForContext(context, templateId);
}

export async function duplicateCadenceTemplateForCurrentUser(input: {
  readonly templateId: string;
  readonly name: string;
}): Promise<CadenceTemplateMutationResult> {
  const context = await requireCadenceManagerContext();
  return duplicateCadenceTemplateForContext(context, input);
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
