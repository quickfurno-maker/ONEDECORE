import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  CRM_MOBILE_INVALID_JSON_BODY,
  crmMobileAdminFailure,
  isCrmMobileAdminId,
  readCrmMobileJsonObject,
  readIntegerField,
  readOptionalText,
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import type {
  LeadBudgetComfortCode,
  LeadServiceCode,
} from "@/features/lead-intake/planner-allowlist";
import {
  createLeadAssignmentRuleForContext,
  setLeadAssignmentRuleActiveForContext,
  updateLeadAssignmentRuleForContext,
} from "@/features/crm/server/crm-assignment-rule-service.ts";

/**
 * Owner mobile — assignment rule administration.
 *
 * Three actions, each mapping to exactly one canonical RPC:
 * `create_lead_assignment_rule`, `update_lead_assignment_rule`,
 * `set_lead_assignment_rule_active`.
 *
 * The canonical services validate with
 * `validateCreateLeadAssignmentRuleInput` / `validateUpdateLeadAssignmentRuleInput`,
 * and those validators own the allowed service codes, the allowed budget codes,
 * the locality length and the positive-integer priority. None of that is
 * restated here.
 *
 * UNKNOWN CODES ARE REFUSED, NOT DROPPED. An unrecognised `serviceCode` reaches
 * the canonical validator as-is and comes back as a 400. Coercing it to `null`
 * instead would not narrow the rule, it would WIDEN it — a rule intended for
 * one service silently becoming a rule for every service, quietly rerouting
 * leads on the next import.
 *
 * After every write the rule is re-read through the SAME context and the SAME
 * bearer client that performed it, inside the canonical service. A reload
 * through a fresh cookie-scoped client would answer a mobile write with a
 * session that has no rows.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canManageLeadAssignmentRules) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage lead assignment rules."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  const action = readStringField(body, "action");

  const serviceCode = readOptionalText(body, "serviceCode");
  const locality = readOptionalText(body, "locality");
  const budgetComfortCode = readOptionalText(body, "budgetComfortCode");

  if (
    serviceCode === false ||
    locality === false ||
    budgetComfortCode === false
  ) {
    return crmMobileError(
      "invalid_request",
      "serviceCode, locality and budgetComfortCode must be text when present."
    );
  }

  try {
    switch (action) {
      case "create": {
        const sourceId = readStringField(body, "sourceId");
        const targetUserId = readStringField(body, "targetUserId");
        const priority = readIntegerField(body, "priority");

        /*
         * Passed through as given. The canonical validator decides whether the
         * source, the assignee and the priority are acceptable, and answers with
         * its own field message when they are not.
         */
        return NextResponse.json(
          await createLeadAssignmentRuleForContext(
            auth.context,
            {
              sourceId: sourceId ?? "",
              targetUserId: targetUserId ?? "",
              priority: priority ?? Number.NaN,
              serviceCode: serviceCode as LeadServiceCode | null,
              locality,
              budgetComfortCode:
                budgetComfortCode as LeadBudgetComfortCode | null,
            },
            auth.db
          )
        );
      }

      case "update": {
        const ruleId = readStringField(body, "ruleId");
        const targetUserId = readOptionalText(body, "targetUserId");
        const priorityRaw = body.priority;

        if (targetUserId === false) {
          return crmMobileError(
            "invalid_request",
            "targetUserId must be text when present."
          );
        }

        /*
         * `update` treats every field as optional — absent means "leave as is",
         * and the RPC coalesces a null argument to the stored value. A present
         * priority must still be a real integer: passing a string would reach a
         * validator whose `Number.isInteger` check it fails only by accident.
         */
        const priority =
          priorityRaw === undefined || priorityRaw === null
            ? null
            : readIntegerField(body, "priority");

        if (priorityRaw !== undefined && priorityRaw !== null && priority === null) {
          return crmMobileError(
            "invalid_request",
            "Priority must be a whole number."
          );
        }

        return NextResponse.json(
          await updateLeadAssignmentRuleForContext(
            auth.context,
            {
              ruleId: ruleId ?? "",
              targetUserId,
              priority,
              serviceCode: serviceCode as LeadServiceCode | null,
              locality,
              budgetComfortCode:
                budgetComfortCode as LeadBudgetComfortCode | null,
            },
            auth.db
          )
        );
      }

      case "set_active": {
        const ruleId = readStringField(body, "ruleId");
        const isActive = body.isActive;

        if (!isCrmMobileAdminId(ruleId)) {
          return crmMobileError("invalid_request", "Unknown assignment rule.");
        }

        /*
         * The flag is required to be an actual boolean. Truthiness would make
         * `"false"` activate a rule, and an activated rule starts routing leads
         * on the next import.
         */
        if (typeof isActive !== "boolean") {
          return crmMobileError(
            "invalid_request",
            "isActive must be true or false."
          );
        }

        return NextResponse.json(
          await setLeadAssignmentRuleActiveForContext(
            auth.context,
            (ruleId ?? "").trim(),
            isActive,
            auth.db
          )
        );
      }

      default:
        return crmMobileError(
          "invalid_request",
          "Unknown assignment rule action. Use create, update or set_active."
        );
    }
  } catch (error) {
    return crmMobileAdminFailure(error, "assignment-rules/actions");
  }
}
