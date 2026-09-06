import "server-only";

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
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
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

/**
 * The client an assignment-rule call runs against: the injected one when a
 * caller supplied it, otherwise the cookie-scoped default. Never service-role.
 */
async function phase5dClient(db?: CrmDb): Promise<SupabaseClient> {
  return (await resolveCrmDb(db)) as unknown as SupabaseClient;
}

async function requireAssignmentRuleContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  return context;
}

/*
 * ============================================================================
 * Context/db-safe implementations
 * ============================================================================
 *
 * Every entry point asserts `crm.lead_assignment_rules.manage` — the ONE
 * permission this slice recognises, for reads as well as writes.
 *
 * The canonical order is `priority ASC, id ASC` and it is stated exactly once,
 * in the list read below. It is not a display preference: it is the order the
 * import validator resolves matches in, so a client that re-sorted the list
 * would be showing a precedence that is not the one the server applies. Nothing
 * in this slice — and nothing in the mobile boundary over it — evaluates which
 * rule wins for a given lead; that engine lives in the database.
 *
 * After a write, the row is re-read through the SAME context and the SAME
 * client that performed it. Reloading through a fresh cookie-scoped client
 * would answer a bearer caller's write with a different session's view.
 */

export async function fetchLeadAssignmentRulesForContext(
  context: CrmAccessContext,
  db?: CrmDb
): Promise<readonly LeadAssignmentRuleSummary[]> {
  assertAssignmentRulePermission(context);

  const supabase = await phase5dClient(db);
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

export async function createLeadAssignmentRuleForContext(
  context: CrmAccessContext,
  input: CreateLeadAssignmentRuleInput,
  db?: CrmDb
): Promise<LeadAssignmentRuleSummary> {
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

  const supabase = await phase5dClient(db);
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

  const rules = await fetchLeadAssignmentRulesForContext(context, db);
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

export async function updateLeadAssignmentRuleForContext(
  context: CrmAccessContext,
  input: UpdateLeadAssignmentRuleInput,
  db?: CrmDb
): Promise<LeadAssignmentRuleSummary> {
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

  const supabase = await phase5dClient(db);
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

  const rules = await fetchLeadAssignmentRulesForContext(context, db);
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

export async function setLeadAssignmentRuleActiveForContext(
  context: CrmAccessContext,
  ruleId: string,
  isActive: boolean,
  db?: CrmDb
): Promise<LeadAssignmentRuleSummary> {
  assertAssignmentRulePermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("set_lead_assignment_rule_active", {
    p_rule_id: ruleId,
    p_is_active: isActive,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rules = await fetchLeadAssignmentRulesForContext(context, db);
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


/* ---- browser wrappers: cookie context, cookie client, unchanged ---------- */

export async function fetchLeadAssignmentRulesForCurrentUser(): Promise<
  readonly LeadAssignmentRuleSummary[]
> {
  return fetchLeadAssignmentRulesForContext(await requireAssignmentRuleContext());
}

export async function createLeadAssignmentRuleForCurrentUser(
  input: CreateLeadAssignmentRuleInput
): Promise<LeadAssignmentRuleSummary> {
  return createLeadAssignmentRuleForContext(
    await requireAssignmentRuleContext(),
    input
  );
}

export async function updateLeadAssignmentRuleForCurrentUser(
  input: UpdateLeadAssignmentRuleInput
): Promise<LeadAssignmentRuleSummary> {
  return updateLeadAssignmentRuleForContext(
    await requireAssignmentRuleContext(),
    input
  );
}

export async function setLeadAssignmentRuleActiveForCurrentUser(
  ruleId: string,
  isActive: boolean
): Promise<LeadAssignmentRuleSummary> {
  return setLeadAssignmentRuleActiveForContext(
    await requireAssignmentRuleContext(),
    ruleId,
    isActive
  );
}
