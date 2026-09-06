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
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import {
  normalizeCadenceStepInputs,
  normalizeCadenceTemplateInput,
} from "@/features/crm/contracts/cadence-contracts.ts";
import {
  archiveCadenceTemplateForContext,
  createCadenceTemplateForContext,
  duplicateCadenceTemplateForContext,
  publishCadenceTemplateForContext,
  replaceCadenceTemplateStepsForContext,
  updateCadenceTemplateForContext,
} from "@/features/crm/server/crm-cadence-service.ts";

/**
 * Owner mobile — cadence TEMPLATE administration.
 *
 * Six actions, one per canonical service call, dispatched on a discriminator in
 * the body. Every one of them normalises with the canonical normaliser and then
 * hands the result to the canonical service, which validates and calls the RPC.
 * This file states no cadence rule: not the 50-step ceiling, not the 2160-hour
 * delay bound, not the reminder-offset bound, not the name length. Those live
 * in `cadence-contracts.ts` and are asserted there once.
 *
 * TEMPLATES ONLY. Enrollment — enroll, pause, resume, cancel — is deliberately
 * absent. It runs on a different permission (`canManageLeadFollowUps`, the
 * activity authority) and against a lead the actor may already mutate, so
 * folding it into an admin surface gated on `canManageCadences` would hand
 * template administrators a lead-level power they were never granted.
 *
 * STEP ORDER IS ARRAY POSITION. The client sends an ordered array and never a
 * `stepOrder`. `normalizeCadenceStepInputs` does not read such a field and
 * `cadenceStepInputsToRpcPayload` does not emit one, so the database orders the
 * steps from the position the caller sent them in. A client-supplied ordinal
 * could disagree with the array it arrived in, and then the cadence that runs
 * is not the one the owner arranged.
 *
 * WhatsApp steps stay internal tasks. Nothing here sends a message, and a
 * cadence step is a canonical CRM Activity scheduled for a human to perform.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  /*
   * Gated here as well as inside every service call. The route gate keeps a
   * refusal a refusal: without it a denied caller would still have had their
   * body parsed and dispatched before the service answered.
   */
  if (!auth.context.canManageCadences) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage cadences."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  const action = readStringField(body, "action");

  /*
   * Every action but `create` names a template, and its shape is checked before
   * the service runs for the same reason the detail route checks it.
   */
  const templateId = readStringField(body, "templateId");
  const needsTemplate = action !== null && action !== "create";

  if (needsTemplate && !isCrmMobileAdminId(templateId)) {
    return crmMobileError("invalid_request", "Unknown cadence template.");
  }

  const target = (templateId ?? "").trim();

  try {
    switch (action) {
      case "create":
        return NextResponse.json(
          await createCadenceTemplateForContext(
            auth.context,
            normalizeCadenceTemplateInput({
              name: body.name,
              description: body.description,
            }),
            auth.db
          )
        );

      case "update": {
        const input = normalizeCadenceTemplateInput({
          name: body.name,
          description: body.description,
        });

        return NextResponse.json(
          await updateCadenceTemplateForContext(
            auth.context,
            {
              templateId: target,
              name: input.name,
              description: input.description,
            },
            auth.db
          )
        );
      }

      case "replace_steps": {
        /*
         * Refused rather than coerced. `normalizeCadenceStepInputs` over a
         * non-array would produce an empty step list, and an empty list is a
         * meaningful cadence edit — it would silently erase the playbook
         * instead of reporting a malformed request.
         */
        if (!Array.isArray(body.steps)) {
          return crmMobileError(
            "invalid_request",
            "Send the cadence steps as an ordered array."
          );
        }

        return NextResponse.json(
          await replaceCadenceTemplateStepsForContext(
            auth.context,
            {
              templateId: target,
              /*
               * Order comes from position in this array. Nothing else.
               *
               * The six accepted fields are named one by one, so a
               * `stepOrder` in the request body is not ignored by convention —
               * it has nowhere to go.
               */
              steps: normalizeCadenceStepInputs(
                (body.steps as readonly unknown[]).map((entry) => {
                  const row = (entry ?? {}) as Record<string, unknown>;

                  return {
                    activityType: row.activityType,
                    title: row.title,
                    priority: row.priority,
                    delayHours: row.delayHours,
                    durationMinutes: row.durationMinutes,
                    reminderOffsetMinutes: row.reminderOffsetMinutes,
                  };
                })
              ),
            },
            auth.db
          )
        );
      }

      case "publish":
        return NextResponse.json(
          await publishCadenceTemplateForContext(auth.context, target, auth.db)
        );

      case "archive":
        return NextResponse.json(
          await archiveCadenceTemplateForContext(auth.context, target, auth.db)
        );

      case "duplicate": {
        const input = normalizeCadenceTemplateInput({
          name: body.name,
          description: null,
        });

        return NextResponse.json(
          await duplicateCadenceTemplateForContext(
            auth.context,
            { templateId: target, name: input.name },
            auth.db
          )
        );
      }

      default:
        return crmMobileError(
          "invalid_request",
          "Unknown cadence action. Use create, update, replace_steps, publish, archive or duplicate."
        );
    }
  } catch (error) {
    return crmMobileAdminFailure(error, "cadences/actions");
  }
}
