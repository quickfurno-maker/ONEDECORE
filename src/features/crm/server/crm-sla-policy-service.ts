import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIRST_CONTACT_SLA_POLICY_CODE,
  mapCrmSlaPolicyRow,
  serializeBusinessHoursConfig,
  validateUpdateCrmSlaPolicyInput,
  type CrmSlaPolicyDto,
  type UpdateCrmSlaPolicyInput,
} from "../contracts/sla-policy-contracts.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

const POLICY_COLUMNS =
  "policy_code, target_business_minutes, timezone, business_hours_enabled, business_hours_config, is_active, effective_from, activated_at, updated_at";

async function slaClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

async function requireSlaManageContext(): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CRM_SLA_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!context.canManageSlaPolicy) {
    throw new CrmError({
      code: "CRM_SLA_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

/**
 * Reads exactly the first-contact policy row under the caller's own session.
 * RLS on `public.crm_sla_policies` remains the final read authority.
 */
export async function fetchFirstContactSlaPolicy(): Promise<CrmSlaPolicyDto> {
  await requireSlaManageContext();

  const supabase = await slaClient();
  const { data, error } = await supabase
    .from("crm_sla_policies")
    .select(POLICY_COLUMNS)
    .eq("policy_code", FIRST_CONTACT_SLA_POLICY_CODE)
    .maybeSingle();

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  if (!data) {
    throw new CrmError({
      code: "CRM_SLA_POLICY_NOT_FOUND",
      message: `SLA policy ${FIRST_CONTACT_SLA_POLICY_CODE} is missing. Seed it before configuring SLA settings.`,
      httpStatus: 404,
    });
  }

  return mapCrmSlaPolicyRow(data as unknown as Parameters<typeof mapCrmSlaPolicyRow>[0]);
}

/**
 * Persists the first-contact policy through the canonical authenticated RPC.
 *
 * `public.update_crm_sla_policy` is the ONLY mutation path: this slice never
 * writes `public.crm_sla_policies` directly, never calls the private impl, and
 * never supplies `effective_from`, `activated_at` or `updated_by` — the DB owns
 * the non-retroactive activation stamp.
 */
export async function updateFirstContactSlaPolicy(
  input: UpdateCrmSlaPolicyInput
): Promise<CrmSlaPolicyDto> {
  await requireSlaManageContext();

  const validationErrors = validateUpdateCrmSlaPolicyInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "CRM_SLA_INVALID",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const businessHoursConfig = serializeBusinessHoursConfig(input.weekdays);

  const supabase = await slaClient();
  const { data, error } = await supabase.rpc("update_crm_sla_policy", {
    p_policy_code: FIRST_CONTACT_SLA_POLICY_CODE,
    p_target_business_minutes: input.targetBusinessMinutes,
    p_timezone: input.timezone.trim(),
    p_business_hours_enabled: input.businessHoursEnabled,
    p_business_hours_config: businessHoursConfig,
    p_clear_business_hours_config: businessHoursConfig === null,
    p_is_active: input.isActive,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  if (!data) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "SLA policy saved but could not be read back.",
      httpStatus: 500,
    });
  }

  return mapCrmSlaPolicyRow(
    data as unknown as Parameters<typeof mapCrmSlaPolicyRow>[0]
  );
}
