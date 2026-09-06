import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIRST_CONTACT_SLA_POLICY_CODE,
  mapCrmSlaPolicyRow,
  serializeBusinessHoursConfig,
  validateUpdateCrmSlaPolicyInput,
  type CrmSlaPolicyDto,
  type UpdateCrmSlaPolicyInput,
} from "../contracts/sla-policy-contracts.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

const POLICY_COLUMNS =
  "policy_code, target_business_minutes, timezone, business_hours_enabled, business_hours_config, is_active, effective_from, activated_at, updated_at";

async function slaClient(db?: CrmDb): Promise<SupabaseClient> {
  return (await resolveCrmDb(db)) as unknown as SupabaseClient;
}

/**
 * `crm.sla_policy.manage` gates the READ as well as the write: the policy panel
 * is a Super Admin surface and its current configuration is not a general CRM
 * fact. The assertion takes a context so the browser workspace and the mobile
 * boundary run the identical check.
 */
function assertSlaManagePermission(context: CrmAccessContext): void {
  if (!context.canManageSlaPolicy) {
    throw new CrmError({
      code: "CRM_SLA_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

async function requireSlaManageContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CRM_SLA_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertSlaManagePermission(context);
  return context;
}

/**
 * Reads exactly the first-contact policy row under the caller's own session.
 * RLS on `public.crm_sla_policies` remains the final read authority.
 */
export async function fetchFirstContactSlaPolicyForContext(
  context: CrmAccessContext,
  db?: CrmDb
): Promise<CrmSlaPolicyDto> {
  assertSlaManagePermission(context);

  const supabase = await slaClient(db);
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
export async function updateFirstContactSlaPolicyForContext(
  context: CrmAccessContext,
  input: UpdateCrmSlaPolicyInput,
  db?: CrmDb
): Promise<CrmSlaPolicyDto> {
  assertSlaManagePermission(context);

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

  const supabase = await slaClient(db);
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


/* ---- browser wrappers: cookie context, cookie client, unchanged ---------- */

export async function fetchFirstContactSlaPolicy(): Promise<CrmSlaPolicyDto> {
  return fetchFirstContactSlaPolicyForContext(await requireSlaManageContext());
}

export async function updateFirstContactSlaPolicy(
  input: UpdateCrmSlaPolicyInput
): Promise<CrmSlaPolicyDto> {
  return updateFirstContactSlaPolicyForContext(
    await requireSlaManageContext(),
    input
  );
}
