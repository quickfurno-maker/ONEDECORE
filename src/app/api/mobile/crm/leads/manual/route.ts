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
  readOptionalText,
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import { createManualLeadForContext } from "@/features/crm/server/crm-manual-lead-service.ts";

/**
 * Create one enquiry by hand.
 *
 * This route collects a form and hands it to the canonical service. It decides
 * nothing: not whether the phone is valid, not whether the service code exists,
 * not whether this is a duplicate, not who the lead belongs to. Those are the
 * validator's, the allowlist's and `create_manual_lead`'s answers, and the last
 * of those re-evaluates duplicates on the way in — so a preview the app showed
 * a minute ago cannot smuggle anything past it.
 *
 * ASSIGNMENT IS THE DATABASE'S. A sales executive sends `assigneeId: null` and
 * `create_manual_lead_impl` self-assigns them from `auth.uid()`; it refuses a
 * `p_assignee_id` distinct from the actor outright. The client never states an
 * identity, and this route never fills one in.
 *
 * CONSENT IS NOT CREATED HERE. Creating a CRM enquiry is not permission to
 * market to someone. No consent field is read, none is written, and none is
 * inferred from the presence of a phone number — which is exactly the
 * inference that would be easiest to make and worst to be wrong about.
 *
 * WHAT COMES BACK is the new lead's id and nothing else. The app opens the
 * canonical Lead Command Center with it, so there is only ever one rendering of
 * a lead.
 */

export const dynamic = "force-dynamic";

/* Fields whose presence would mean this route had grown an opinion it must not have. */
const FORBIDDEN_FIELDS = [
  "marketingConsent",
  "whatsappConsent",
  "emailMarketingConsent",
  "consent",
  "score",
  "priorityScore",
  "scoreBand",
  "salesBucket",
  "bucket",
  "status",
  "stage",
  "assignmentRuleId",
  "probability",
] as const;

export async function POST(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canCreateLeads) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to create leads."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  /*
   * Refused, not ignored. Silently dropping a `marketingConsent: true` would
   * let a client believe it had recorded consent that was never stored, and
   * silently dropping a `status` would let one believe it had opened a lead in
   * a stage the server never set.
   */
  for (const field of FORBIDDEN_FIELDS) {
    if (field in body) {
      return crmMobileError(
        "invalid_request",
        `${field} is not accepted here. Lead scoring, stage and consent are not set at creation.`
      );
    }
  }

  const submittedName = readStringField(body, "submittedName");
  const serviceCode = readStringField(body, "serviceCode");
  const propertyCode = readStringField(body, "propertyCode");
  const timelineCode = readStringField(body, "timelineCode");
  const primarySourceId = readStringField(body, "primarySourceId");

  if (
    submittedName === null ||
    serviceCode === null ||
    propertyCode === null ||
    timelineCode === null ||
    primarySourceId === null
  ) {
    return crmMobileError(
      "invalid_request",
      "Provide submittedName, serviceCode, propertyCode, timelineCode and primarySourceId."
    );
  }

  const phone = readOptionalText(body, "phone");
  const email = readOptionalText(body, "email");
  const locality = readOptionalText(body, "locality");
  const budgetComfortCode = readOptionalText(body, "budgetComfortCode");
  const message = readOptionalText(body, "message");
  const sourceDetail = readOptionalText(body, "sourceDetail");
  const assigneeId = readOptionalText(body, "assigneeId");
  const duplicateOverrideReason = readOptionalText(
    body,
    "duplicateOverrideReason"
  );

  if (
    phone === false ||
    email === false ||
    locality === false ||
    budgetComfortCode === false ||
    message === false ||
    sourceDetail === false ||
    assigneeId === false ||
    duplicateOverrideReason === false
  ) {
    return crmMobileError(
      "invalid_request",
      "Optional lead fields must be text when provided."
    );
  }

  if (
    body.roomCodes !== undefined &&
    !Array.isArray(body.roomCodes)
  ) {
    return crmMobileError(
      "invalid_request",
      "Send roomCodes as an array."
    );
  }

  const roomCodes = ((body.roomCodes ?? []) as readonly unknown[]).map(
    (entry) => String(entry)
  );

  if (
    body.duplicateOverride !== undefined &&
    typeof body.duplicateOverride !== "boolean"
  ) {
    return crmMobileError(
      "invalid_request",
      "duplicateOverride must be true or false."
    );
  }

  try {
    /*
     * The service asserts the create permission again, resolves the assignee
     * policy, runs the canonical validator, checks the duplicate-override
     * permission, canonicalises the phone and calls the RPC. Every rule that
     * matters lives past this line.
     */
    const lead = await createManualLeadForContext(
      auth.context,
      {
        submittedName,
        phone,
        email,
        serviceCode: serviceCode as never,
        propertyCode: propertyCode as never,
        timelineCode: timelineCode as never,
        primarySourceId,
        locality,
        budgetComfortCode: budgetComfortCode as never,
        roomCodes: roomCodes as never,
        message,
        sourceDetail,
        assigneeId,
        duplicateOverride: body.duplicateOverride === true,
        duplicateOverrideReason,
      },
      auth.db
    );

    return NextResponse.json({ leadId: lead.id });
  } catch (error) {
    return crmMobileAdminFailure(error, "leads/manual/create");
  }
}
