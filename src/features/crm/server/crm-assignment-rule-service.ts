import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type {
  CreateLeadAssignmentRuleInput,
  LeadAssignmentRuleSummary,
  UpdateLeadAssignmentRuleInput,
} from "../contracts/assignment-rule-contracts.ts";
import {
  validateCreateLeadAssignmentRuleInput,
  validateUpdateLeadAssignmentRuleInput,
} from "../contracts/assignment-rule-contracts.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

interface AssignmentRuleRow {
  readonly id: string;
  readonly source_id: string;
  readonly service_code: string | null;
  readonly locality_normalized: string | null;
  readonly budget_comfort_code: string | null;
  readonly target_user_id: string;
  readonly priority: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly lead_sources?: { display_name: string | null } | null;
  readonly profiles?: { display_name: string | null } | null;
}

function mapAssignmentRule(row: AssignmentRuleRow): LeadAssignmentRuleSummary {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceDisplayName: row.lead_sources?.display_name ?? null,
    serviceCode: row.service_code as LeadAssignmentRuleSummary["serviceCode"],
    localityNormalized: row.locality_normalized,
    budgetComfortCode:
      row.budget_comfort_code as LeadAssignmentRuleSummary["budgetComfortCode"],
    targetUserId: row.target_user_id,
    targetDisplayName: row.profiles?.display_name ?? null,
    priority: row.priority,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertAssignmentRulePermission(context: CrmAccessContext): void {
  if (!context.canManageLeadAssignmentRules) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

async function phase5dClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function fetchLeadAssignmentRulesForCurrentUser(): Promise<
  readonly LeadAssignmentRuleSummary[]
> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertAssignmentRulePermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase
    .from("lead_assignment_rules")
    .select(
      "id, source_id, service_code, locality_normalized, budget_comfort_code, target_user_id, priority, is_active, created_at, updated_at, lead_sources(display_name), profiles:target_user_id(display_name)"
    )
    .order("priority", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data as unknown as AssignmentRuleRow[] | null)?.map(mapAssignmentRule) ?? [];
}

export async function createLeadAssignmentRuleForCurrentUser(
  input: CreateLeadAssignmentRuleInput
): Promise<LeadAssignmentRuleSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertAssignmentRulePermission(context);

  const validationErrors = validateCreateLeadAssignmentRuleInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_INVALID",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("create_lead_assignment_rule", {
    p_source_id: input.sourceId,
    p_target_user_id: input.targetUserId,
    p_priority: input.priority,
    p_service_code: input.serviceCode ?? null,
    p_locality: input.locality ?? null,
    p_budget_comfort_code: input.budgetComfortCode ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rules = await fetchLeadAssignmentRulesForCurrentUser();
  const created = rules.find((rule) => rule.id === (data as { id: string }).id);
  if (!created) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "Assignment rule created but could not be loaded.",
      httpStatus: 500,
    });
  }

  return created;
}

export async function updateLeadAssignmentRuleForCurrentUser(
  input: UpdateLeadAssignmentRuleInput
): Promise<LeadAssignmentRuleSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertAssignmentRulePermission(context);

  const validationErrors = validateUpdateLeadAssignmentRuleInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_INVALID",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("update_lead_assignment_rule", {
    p_rule_id: input.ruleId,
    p_target_user_id: input.targetUserId ?? null,
    p_priority: input.priority ?? null,
    p_service_code: input.serviceCode ?? null,
    p_locality: input.locality ?? null,
    p_budget_comfort_code: input.budgetComfortCode ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rules = await fetchLeadAssignmentRulesForCurrentUser();
  const updated = rules.find((rule) => rule.id === (data as { id: string }).id);
  if (!updated) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "Assignment rule updated but could not be loaded.",
      httpStatus: 500,
    });
  }

  return updated;
}

export async function setLeadAssignmentRuleActiveForCurrentUser(
  ruleId: string,
  isActive: boolean
): Promise<LeadAssignmentRuleSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertAssignmentRulePermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("set_lead_assignment_rule_active", {
    p_rule_id: ruleId,
    p_is_active: isActive,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rules = await fetchLeadAssignmentRulesForCurrentUser();
  const updated = rules.find((rule) => rule.id === (data as { id: string }).id);
  if (!updated) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "Assignment rule updated but could not be loaded.",
      httpStatus: 500,
    });
  }

  return updated;
}
