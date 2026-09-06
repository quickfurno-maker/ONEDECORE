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
import { previewManualLeadDuplicateForContext } from "@/features/crm/server/crm-manual-lead-service.ts";

/**
 * Is this enquiry already in the book?
 *
 * ADVISORY, NOT AUTHORITATIVE. The answer here is what the owner is shown
 * before they commit; `create_manual_lead` evaluates duplicates again on the
 * way in, so a stale preview cannot let anything through. The app treats a
 * changed phone, email, service, property or locality as invalidating the
 * preview for exactly that reason.
 *
 * WHAT COMES BACK IS DELIBERATELY THIN. An outcome code, whether creation may
 * proceed, whether an override is possible, and — where the canonical preview
 * chose to return one — the existing lead's id so the owner can open it. No
 * name, no phone, no email, no address: "there is already an enquiry from this
 * person" is what the owner needs, and revealing the other record's contact
 * details is not part of it.
 */

export const dynamic = "force-dynamic";

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

  const serviceCode = readStringField(body, "serviceCode");
  const propertyCode = readStringField(body, "propertyCode");

  if (serviceCode === null || propertyCode === null) {
    return crmMobileError(
      "invalid_request",
      "Provide serviceCode and propertyCode."
    );
  }

  /*
   * Absent, null and empty all mean "not given" for the three optional fields.
   * Anything present that is not a string is refused rather than dropped: a
   * silently discarded phone would widen the duplicate search, not narrow it,
   * and the owner would be told a genuine duplicate is CLEAR.
   */
  const phone = readOptionalText(body, "phone");
  const email = readOptionalText(body, "email");
  const locality = readOptionalText(body, "locality");

  if (phone === false || email === false || locality === false) {
    return crmMobileError(
      "invalid_request",
      "phone, email and locality must be text when provided."
    );
  }

  try {
    /*
     * The canonical service owns the rest: the phone normalisation, the
     * "phone or email is required" rule, the allowlist checks and the
     * duplicate RPC. This route decides none of them.
     */
    const preview = await previewManualLeadDuplicateForContext(
      auth.context,
      {
        phone,
        email,
        serviceCode: serviceCode as never,
        propertyCode: propertyCode as never,
        locality,
      },
      auth.db
    );

    return NextResponse.json({
      outcomeCode: preview.outcomeCode,
      canCreate: preview.canCreate,
      canOverride: preview.canOverride,
      existingLeadId: preview.existingLeadId,
    });
  } catch (error) {
    return crmMobileAdminFailure(error, "leads/manual/duplicate-preview");
  }
}
