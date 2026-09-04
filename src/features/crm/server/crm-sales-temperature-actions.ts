"use server";

import { revalidatePath } from "next/cache";
import type { LifecycleActionState } from "../contracts/lifecycle-contracts.ts";
import { parseManualSalesTemperature } from "../contracts/lead-sales-temperature.ts";
import { setLeadSalesTemperatureForCurrentUser } from "./crm-sales-temperature-service.ts";
import { CrmError } from "./crm-errors.ts";

/**
 * Sets or clears a lead's manual sales temperature.
 *
 * Fast on purpose: a salesperson reclassifies leads repeatedly, so this is a
 * single click with no modal and no mandatory reason. The reason stays optional
 * because forcing one on every routine HOT/WARM/COLD change would make the
 * control too slow to use, and an unused mandatory field collects noise rather
 * than governance.
 *
 * `temperature` is HOT | WARM | COLD, or empty/absent to clear the override and
 * return the lead to the system suggestion.
 */
export async function setLeadSalesTemperatureAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) {
    return {
      success: false,
      message: "Lead is required.",
      code: "VALIDATION_FAILED",
    };
  }

  const raw = String(formData.get("temperature") ?? "").trim();
  // An empty value is the explicit "Use system" reset, not a malformed input.
  const temperature = raw.length === 0 ? null : parseManualSalesTemperature(raw);

  if (raw.length > 0 && temperature === null) {
    // LOST / WON / ON_HOLD land here: they are lifecycle outcomes and are not
    // selectable temperatures.
    return {
      success: false,
      message: "Sales temperature must be Hot, Warm or Cold.",
      code: "VALIDATION_FAILED",
    };
  }

  const reasonRaw = String(formData.get("reason") ?? "").trim();

  try {
    await setLeadSalesTemperatureForCurrentUser({
      leadId,
      temperature,
      reason: reasonRaw.length > 0 ? reasonRaw : null,
    });

    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);

    return {
      success: true,
      message:
        temperature === null
          ? "Using the system suggestion."
          : `Sales temperature set to ${temperature}.`,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        success: false,
        message: error.message,
        code: error.code,
      };
    }
    return {
      success: false,
      message: "Sales temperature could not be updated.",
      code: "RPC_FAILED",
    };
  }
}
