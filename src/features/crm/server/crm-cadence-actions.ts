"use server";

import { revalidatePath } from "next/cache";
import {
  cadenceFieldErrorsToRecord,
  normalizeCadenceStepInputs,
  normalizeCadenceTemplateInput,
  validateCadenceStepInputs,
  type CadenceActionState,
  type CrmCadenceStepInput,
} from "../contracts/cadence-contracts.ts";
import {
  archiveCadenceTemplateForCurrentUser,
  cancelLeadCadenceForCurrentUser,
  createCadenceTemplateForCurrentUser,
  duplicateCadenceTemplateForCurrentUser,
  enrollLeadInCadenceForCurrentUser,
  pauseLeadCadenceForCurrentUser,
  publishCadenceTemplateForCurrentUser,
  replaceCadenceTemplateStepsForCurrentUser,
  resumeLeadCadenceForCurrentUser,
  updateCadenceTemplateForCurrentUser,
} from "./crm-cadence-service.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

function revalidateCadencePaths(templateId?: string): void {
  revalidatePath("/admin/crm/cadences");
  if (templateId) {
    revalidatePath(`/admin/crm/cadences/${templateId}`);
  }
}

function revalidateLeadPaths(leadId: string): void {
  revalidatePath("/admin/crm/leads");
  revalidatePath(`/admin/crm/leads/${leadId}`);
  revalidatePath("/admin/crm/my-day");
}

function toCadenceActionState(error: unknown): CadenceActionState {
  if (error instanceof CrmError) {
    return { success: false, message: error.message, code: error.code };
  }
  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "Cadence operation failed"
  );
  return { success: false, message: mapped.message, code: mapped.code };
}

/**
 * Reads the ordered step editor rows. Order is positional: `steps[i]` becomes
 * step i+1, so no client-supplied ordinal ever reaches the database.
 */
function parseStepRows(formData: FormData): readonly CrmCadenceStepInput[] {
  const activityTypes = formData.getAll("stepActivityType");
  const titles = formData.getAll("stepTitle");
  const priorities = formData.getAll("stepPriority");
  const delays = formData.getAll("stepDelayHours");
  const durations = formData.getAll("stepDurationMinutes");
  const reminders = formData.getAll("stepReminderOffsetMinutes");

  return normalizeCadenceStepInputs(
    activityTypes.map((activityType, index) => ({
      activityType,
      title: titles[index],
      priority: priorities[index],
      delayHours: delays[index],
      durationMinutes: durations[index],
      reminderOffsetMinutes: reminders[index],
    }))
  );
}

export async function createCadenceTemplateAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const input = normalizeCadenceTemplateInput({
      name: formData.get("name"),
      description: formData.get("description"),
    });
    const result = await createCadenceTemplateForCurrentUser(input);

    const steps = parseStepRows(formData);
    if (steps.length > 0) {
      const stepErrors = validateCadenceStepInputs(steps);
      if (stepErrors.length > 0) {
        return {
          success: false,
          message: stepErrors[0]?.message ?? "Cadence steps are invalid.",
          code: "CADENCE_STEP_INVALID",
          fieldErrors: cadenceFieldErrorsToRecord(stepErrors),
          templateId: result.id,
        };
      }
      await replaceCadenceTemplateStepsForCurrentUser({
        templateId: result.id,
        steps,
      });
    }

    revalidateCadencePaths(result.id);
    return {
      success: true,
      message: "Cadence draft created.",
      templateId: result.id,
    };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function saveCadenceDraftAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const templateId = String(formData.get("templateId") ?? "").trim();
    const input = normalizeCadenceTemplateInput({
      name: formData.get("name"),
      description: formData.get("description"),
    });

    await updateCadenceTemplateForCurrentUser({
      templateId,
      name: input.name,
      description: input.description,
    });

    const steps = parseStepRows(formData);
    const stepErrors = validateCadenceStepInputs(steps);
    if (stepErrors.length > 0) {
      return {
        success: false,
        message: stepErrors[0]?.message ?? "Cadence steps are invalid.",
        code: "CADENCE_STEP_INVALID",
        fieldErrors: cadenceFieldErrorsToRecord(stepErrors),
        templateId,
      };
    }

    await replaceCadenceTemplateStepsForCurrentUser({ templateId, steps });

    revalidateCadencePaths(templateId);
    return { success: true, message: "Cadence draft saved.", templateId };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function publishCadenceTemplateAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const templateId = String(formData.get("templateId") ?? "").trim();
    await publishCadenceTemplateForCurrentUser(templateId);
    revalidateCadencePaths(templateId);
    return { success: true, message: "Cadence published.", templateId };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function archiveCadenceTemplateAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const templateId = String(formData.get("templateId") ?? "").trim();
    await archiveCadenceTemplateForCurrentUser(templateId);
    revalidateCadencePaths(templateId);
    return { success: true, message: "Cadence archived.", templateId };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function duplicateCadenceTemplateAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const templateId = String(formData.get("templateId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const result = await duplicateCadenceTemplateForCurrentUser({
      templateId,
      name,
    });
    revalidateCadencePaths(result.id);
    return {
      success: true,
      message: "Draft copy created.",
      templateId: result.id,
    };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function enrollLeadInCadenceAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const result = await enrollLeadInCadenceForCurrentUser({
      leadId: String(formData.get("leadId") ?? "").trim(),
      templateId: String(formData.get("templateId") ?? "").trim(),
    });
    revalidateLeadPaths(result.leadId);
    return { success: true, message: "Lead enrolled in cadence." };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function pauseLeadCadenceAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const result = await pauseLeadCadenceForCurrentUser(
      String(formData.get("enrollmentId") ?? "").trim()
    );
    revalidateLeadPaths(result.leadId);
    return { success: true, message: "Cadence paused." };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function resumeLeadCadenceAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const result = await resumeLeadCadenceForCurrentUser(
      String(formData.get("enrollmentId") ?? "").trim()
    );
    revalidateLeadPaths(result.leadId);
    return { success: true, message: "Cadence resumed." };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}

export async function cancelLeadCadenceAction(
  _previousState: CadenceActionState,
  formData: FormData
): Promise<CadenceActionState> {
  try {
    const result = await cancelLeadCadenceForCurrentUser(
      String(formData.get("enrollmentId") ?? "").trim()
    );
    revalidateLeadPaths(result.leadId);
    return {
      success: true,
      message: "Cadence cancelled. The current activity stays open.",
    };
  } catch (error: unknown) {
    return toCadenceActionState(error);
  }
}
