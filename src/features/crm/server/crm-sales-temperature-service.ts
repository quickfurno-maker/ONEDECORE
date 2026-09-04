import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  manualSalesTemperatureValue,
  type CrmManualSalesTemperature,
} from "../contracts/lead-sales-temperature.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { getCrmAccessContext } from "./crm-auth.ts";

/**
 * Sets or clears a lead's manual sales temperature.
 *
 * Thin by design. The DATABASE is the authority: `set_lead_sales_temperature`
 * checks `auth.uid()`, the `leads.transition` permission, per-lead mutate scope,
 * and refuses while a lifecycle override is in effect. Re-implementing any of
 * that here would create a second set of rules to drift.
 *
 * Runs under the CALLER'S session — no service-role client anywhere in this
 * path — so an assignment-scoped executive cannot reclassify a lead they cannot
 * already mutate.
 */
export async function setLeadSalesTemperatureForCurrentUser(input: {
  readonly leadId: string;
  readonly temperature: CrmManualSalesTemperature | null;
  readonly reason?: string | null;
}): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lead_sales_temperature", {
    p_lead_id: input.leadId,
    // null clears the override and returns the lead to the system suggestion.
    p_temperature: manualSalesTemperatureValue(input.temperature) as string,
    ...(input.reason ? { p_reason: input.reason } : {}),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
}
