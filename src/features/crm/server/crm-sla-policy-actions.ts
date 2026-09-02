"use server";

import { revalidatePath } from "next/cache";
import {
  CRM_SLA_SETTINGS_PATH,
  readSlaPolicyForm,
  type SlaPolicyActionState,
} from "../contracts/sla-policy-contracts.ts";
import { requireCrmSlaPolicyAccess } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { updateFirstContactSlaPolicy } from "./crm-sla-policy-service.ts";

function toSlaPolicyActionState(error: unknown): SlaPolicyActionState {
  if (error instanceof CrmError) {
    return { success: false, message: error.message, code: error.code };
  }

  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "SLA policy update failed"
  );
  return { success: false, message: mapped.message, code: mapped.code };
}

/**
 * Saves the first-contact SLA policy under the authenticated Super Admin
 * session. Activation is never inferred client-side: the persisted state is
 * re-rendered from the route after revalidation.
 */
export async function updateCrmSlaPolicyAction(
  _previousState: SlaPolicyActionState,
  formData: FormData
): Promise<SlaPolicyActionState> {
  await requireCrmSlaPolicyAccess();

  const input = readSlaPolicyForm((name) => {
    const value = formData.get(name);
    return value == null ? null : String(value);
  });

  try {
    const policy = await updateFirstContactSlaPolicy(input);

    revalidatePath(CRM_SLA_SETTINGS_PATH);

    return {
      success: true,
      message: policy.isActive
        ? "SLA settings saved. The first-contact policy is active."
        : "SLA settings saved. The first-contact policy remains inactive.",
    };
  } catch (error: unknown) {
    return toSlaPolicyActionState(error);
  }
}
