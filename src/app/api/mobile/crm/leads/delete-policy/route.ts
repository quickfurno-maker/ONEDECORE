import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { crmMobileAdminFailure } from "@/features/crm/server/crm-mobile-admin.ts";
import {
  LEAD_DELETE_CONFIRMATION,
  LEAD_DELETE_REASON_MAX,
  LEAD_DELETE_REASON_MIN,
} from "@/features/crm/contracts/lead-delete-contracts.ts";

/**
 * May this caller delete an enquiry, and what does the form need to ask for?
 *
 * The point of this endpoint is that the phone decides NOTHING about who may
 * delete. It does not read a role, it does not infer from "super admin", and it
 * does not carry the confirmation word or the reason bounds in its own source.
 * It asks, renders the answer, and the destructive control does not exist at
 * all unless `canDelete` is true.
 *
 * A DENIED CALLER GETS 200, NOT 403. This is a capability question, and "no"
 * is a complete and correct answer to it — the app hides the Danger Zone and
 * nothing has gone wrong. Answering 403 would make an ordinary screen load look
 * like a failure and push the client toward retrying a question already
 * answered. The constants returned alongside are harmless either way: the
 * confirmation word is on the canonical web form, and the bounds are in the
 * validator's own error messages.
 *
 * THIS IS A HINT, NEVER A LOCK. `POST .../delete` asserts the permission again,
 * and `delete_lead_tombstone` re-checks the permission AND the `super_admin`
 * role inside the transaction. A client that lied about `canDelete` would get
 * exactly as far as a 403.
 *
 * ROUTE SHADOWING, deliberately. `/api/mobile/crm/leads/[leadId]` matches any
 * single segment under `leads/`, so this path resolves to that route until this
 * file exists — a static segment wins over a dynamic one. The practical
 * consequence is that an anonymous probe of this URL answers 401 whether or not
 * this endpoint is deployed, so it cannot be used to test a deployment.
 * `POST /api/mobile/crm/leads/<id>/delete` is the honest probe: 404 before,
 * 401 after.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  try {
    return NextResponse.json({
      /*
       * The canonical capability, resolved by the same permission probe the
       * browser uses. No role name is consulted here or sent to the client.
       */
      canDelete: auth.context.canDeleteLeads,
      confirmationText: LEAD_DELETE_CONFIRMATION,
      reasonMin: LEAD_DELETE_REASON_MIN,
      reasonMax: LEAD_DELETE_REASON_MAX,
    });
  } catch (error) {
    return crmMobileAdminFailure(error, "leads/delete-policy");
  }
}
