import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  CRM_MOBILE_INVALID_JSON_BODY,
  crmMobileAdminFailure,
  readCrmMobileJsonObject,
  readIntegerField,
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import {
  SLA_WEEKDAY_KEYS,
  type SlaWeekdayFormRow,
} from "@/features/crm/contracts/sla-policy-contracts.ts";
import {
  fetchFirstContactSlaPolicyForContext,
  updateFirstContactSlaPolicyForContext,
} from "@/features/crm/server/crm-sla-policy-service.ts";

/**
 * Owner mobile — first-contact SLA policy.
 *
 * ONE POLICY. The canonical service reads and writes exactly
 * `FIRST_CONTACT_SLA_POLICY_CODE`; there is no policy code in the request and
 * no way to name another one. A code parameter here would be an authorisation
 * surface for rows this slice has never governed.
 *
 * WHAT THE CLIENT MAY NOT SEND
 *
 * `effectiveFrom`, `activatedAt` and `updatedBy` are absent from the accepted
 * body and are never forwarded. `public.update_crm_sla_policy` owns them, and
 * that ownership is what makes first activation non-retroactive: the database
 * decides when a policy started applying, so existing SLA clocks cannot be
 * silently rescoped by backdating a save.
 *
 * `update_crm_sla_policy` is also the ONLY write path. Nothing here touches
 * `crm_sla_policies` directly.
 *
 * A PERSISTED NULL STAYS NULL. `DEFAULT_BUSINESS_HOURS_DRAFT` is a form draft
 * for the web panel — Mon–Sat 09:00–19:00 offered as a starting point — and it
 * is deliberately not imported here. Substituting it on read would turn an
 * unconfigured policy into a configured-looking one, and the client would
 * display business hours that no one has saved.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  /*
   * `crm.sla_policy.manage` gates the read too. The policy panel is a Super
   * Admin surface and its configuration is not a general CRM fact.
   */
  if (!auth.context.canManageSlaPolicy) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage the CRM SLA policy."
    );
  }

  try {
    return NextResponse.json(
      await fetchFirstContactSlaPolicyForContext(auth.context, auth.db)
    );
  } catch (error) {
    return crmMobileAdminFailure(error, "sla");
  }
}

/**
 * Reads the seven weekday rows.
 *
 * Every key in `SLA_WEEKDAY_KEYS` is produced, whether or not the client sent
 * it, because `serializeBusinessHoursConfig` iterates that canonical list and
 * omits any day that is not open. A missing day therefore means closed — the
 * same thing the web form's unchecked box means — and closed days are OMITTED
 * from the persisted config rather than written as null, which is what the DB
 * validator requires.
 */
function readWeekdayRows(body: Record<string, unknown>): readonly SlaWeekdayFormRow[] {
  const raw = body.weekdays;
  const sent = new Map<string, Record<string, unknown>>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const row = entry as Record<string, unknown>;
        if (typeof row.day === "string") {
          sent.set(row.day, row);
        }
      }
    }
  }

  return SLA_WEEKDAY_KEYS.map((day) => {
    const row = sent.get(day);

    return {
      day,
      open: row?.open === true,
      start: typeof row?.start === "string" ? row.start.trim() : "",
      end: typeof row?.end === "string" ? row.end.trim() : "",
    };
  });
}

export async function PUT(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canManageSlaPolicy) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage the CRM SLA policy."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  const targetBusinessMinutes = readIntegerField(body, "targetBusinessMinutes");
  const timezone = readStringField(body, "timezone");

  /*
   * A missing target is refused rather than defaulted. The canonical validator
   * bounds it at 1–10080 business minutes, and this route restates neither
   * bound — it only insists the field arrived as the whole number the validator
   * assumes it is comparing.
   */
  if (targetBusinessMinutes === null || timezone === null) {
    return crmMobileError(
      "invalid_request",
      "Provide targetBusinessMinutes and timezone."
    );
  }

  /*
   * The two switches are required booleans. Truthiness would let `"false"`
   * activate the policy, and activation starts an SLA clock on live leads.
   */
  if (
    typeof body.businessHoursEnabled !== "boolean" ||
    typeof body.isActive !== "boolean"
  ) {
    return crmMobileError(
      "invalid_request",
      "businessHoursEnabled and isActive must be true or false."
    );
  }

  try {
    /*
     * The canonical service runs `validateUpdateCrmSlaPolicyInput`, then
     * `serializeBusinessHoursConfig`, then `update_crm_sla_policy`, and returns
     * the row the RPC read back. Every business-hours rule — HH:MM shape, start
     * before end, at least one open day when enabled or active — is asserted
     * there.
     */
    return NextResponse.json(
      await updateFirstContactSlaPolicyForContext(
        auth.context,
        {
          targetBusinessMinutes,
          timezone,
          businessHoursEnabled: body.businessHoursEnabled,
          isActive: body.isActive,
          weekdays: readWeekdayRows(body),
        },
        auth.db
      )
    );
  } catch (error) {
    return crmMobileAdminFailure(error, "sla/update");
  }
}
