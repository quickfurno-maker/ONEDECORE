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
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import type { SalesTargetScope } from "@/features/crm/contracts/sales-target-contracts.ts";
import {
  createSalesTargetForContext,
  lockSalesTargetForContext,
  reopenSalesTargetForContext,
  reviseSalesTargetForContext,
} from "@/features/crm/server/crm-sales-target-service.ts";

/**
 * Owner mobile — sales target lifecycle.
 *
 * Four actions, each mapping to exactly one canonical RPC:
 * `create_sales_target`, `revise_sales_target`, `lock_sales_target`,
 * `reopen_sales_target`.
 *
 * WHAT THIS FILE DOES NOT DECIDE
 *
 * Not the scopes (`executive_personal`, `sales_team`), not the statuses (`open`,
 * `locked`), not the currency (INR, in paise), not the revenue or count bounds,
 * not the reason length, not the first-of-month rule, and not which executives
 * are eligible for a personal target. Every one of those is in
 * `sales-target-contracts.ts` or in the RPC. This route reads a body and calls
 * a function.
 *
 * WHY THE NUMERIC FIELDS ARE TYPE-CHECKED HERE
 *
 * `validateCreateSalesTargetInput` compares `revenueTargetPaise` against its
 * bounds with `<` and `>`. Those operators coerce, so the string "999999999999"
 * would slip past a bound it plainly exceeds, and `validateSalesTargetReason`
 * would throw a TypeError on a non-string rather than answer a validation
 * message. Requiring the declared types before the canonical validator runs is
 * not a second validation — it is what makes the canonical one sound.
 *
 * `expectedRevision` is required and forwarded EXACTLY. It is the optimistic
 * concurrency token; the RPC compares it and raises
 * `crm_sales_target_revision_mismatch`, which the canonical mapper turns into a
 * 409. Defaulting or coercing it would silently disable the check that keeps
 * two managers from overwriting each other's revision.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  /*
   * WRITES need `crm.sales_targets.manage`, not the read permission the list
   * endpoint accepts. A reader reaching this route is refused here and would be
   * refused again inside the service.
   */
  if (!auth.context.canManageSalesTargets) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage sales targets."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  const action = readStringField(body, "action");

  /*
   * The action is recognised BEFORE anything else is read, so an unknown one is
   * reported as an unknown action rather than as whichever field happened to be
   * checked first.
   */
  if (
    action !== "create" &&
    action !== "revise" &&
    action !== "lock" &&
    action !== "reopen"
  ) {
    return crmMobileError(
      "invalid_request",
      "Unknown target action. Use create, revise, lock or reopen."
    );
  }

  /*
   * All four actions are recorded on the target's event trail, and all four
   * demand a reason for it. The canonical `validateSalesTargetReason` owns the
   * length bounds and calls `.trim()`, so a string is what must arrive.
   */
  const reason = readStringField(body, "reason");

  if (reason === null) {
    return crmMobileError("invalid_request", "A reason is required.");
  }

  try {
    if (action === "create") {
      const targetScope = readStringField(body, "targetScope");
      const targetMonth = readStringField(body, "targetMonth");
      const targetUserId = readStringField(body, "targetUserId");
      const revenueTargetPaise = readIntegerField(body, "revenueTargetPaise");
      const closedWonCountTarget = readIntegerField(
        body,
        "closedWonCountTarget"
      );

      if (
        targetScope === null ||
        targetMonth === null ||
        revenueTargetPaise === null ||
        closedWonCountTarget === null
      ) {
        return crmMobileError(
          "invalid_request",
          "Provide targetScope, targetMonth, revenueTargetPaise and closedWonCountTarget."
        );
      }

      /*
       * A present-but-malformed executive id is refused; an absent one stays
       * null. The canonical validator decides which of those two a given scope
       * requires — `executive_personal` demands one, `sales_team` forbids one —
       * and that rule is not restated here.
       */
      if (targetUserId !== null && !isCrmMobileAdminId(targetUserId)) {
        return crmMobileError("invalid_request", "Unknown executive.");
      }

      return NextResponse.json(
        await createSalesTargetForContext(
          auth.context,
          {
            targetScope: targetScope as SalesTargetScope,
            targetMonth,
            targetUserId: targetUserId === null ? null : targetUserId.trim(),
            revenueTargetPaise,
            closedWonCountTarget,
            reason,
          },
          auth.db
        )
      );
    }

    /*
     * Only revise, lock and reopen reach here, and all three name a target and
     * carry a revision. Both are required before any of them runs.
     */
    const targetId = readStringField(body, "targetId");
    const expectedRevision = readIntegerField(body, "expectedRevision");

    if (!isCrmMobileAdminId(targetId)) {
      return crmMobileError("invalid_request", "Unknown sales target.");
    }

    if (expectedRevision === null) {
      return crmMobileError("invalid_request", "expectedRevision is required.");
    }

    const target = (targetId ?? "").trim();

    switch (action) {
      case "revise": {
        const revenueTargetPaise = readIntegerField(body, "revenueTargetPaise");
        const closedWonCountTarget = readIntegerField(
          body,
          "closedWonCountTarget"
        );

        if (revenueTargetPaise === null || closedWonCountTarget === null) {
          return crmMobileError(
            "invalid_request",
            "Provide revenueTargetPaise and closedWonCountTarget."
          );
        }

        return NextResponse.json(
          await reviseSalesTargetForContext(
            auth.context,
            {
              targetId: target,
              expectedRevision: expectedRevision as number,
              revenueTargetPaise,
              closedWonCountTarget,
              reason,
            },
            auth.db
          )
        );
      }

      case "lock":
        return NextResponse.json(
          await lockSalesTargetForContext(
            auth.context,
            {
              targetId: target,
              expectedRevision: expectedRevision as number,
              reason,
            },
            auth.db
          )
        );

      case "reopen":
        return NextResponse.json(
          await reopenSalesTargetForContext(
            auth.context,
            {
              targetId: target,
              expectedRevision: expectedRevision as number,
              reason,
            },
            auth.db
          )
        );

      default:
        return crmMobileError(
          "invalid_request",
          "Unknown target action. Use create, revise, lock or reopen."
        );
    }
  } catch (error) {
    return crmMobileAdminFailure(error, "targets/actions");
  }
}
