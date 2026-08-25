"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  LeadPropertyCode,
  LeadRoomCode,
  LeadServiceCode,
  LeadTimelineCode,
} from "@/features/lead-intake/planner-allowlist";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
} from "@/features/lead-intake/planner-allowlist";
import type { ManualLeadFormInput, ManualLeadDuplicatePreview } from "../contracts/manual-lead-contracts.ts";
import { requireCrmCreateAccess } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  createManualLeadForCurrentUser,
  previewManualLeadDuplicateForCurrentUser,
  resolveManualCreateAssigneePolicy,
} from "./crm-manual-lead-service.ts";

export interface ManualLeadActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly duplicatePreview?: ManualLeadDuplicatePreview;
}

const INITIAL_STATE: ManualLeadActionState = {
  success: false,
  message: "",
};

function parseNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseAssigneeId(
  value: FormDataEntryValue | null,
  mode: "executive_self" | "manager" | "admin"
): string | null {
  if (mode === "executive_self") {
    return null;
  }

  const raw = parseNullableString(value);
  if (raw === null || raw === "unassigned") {
    return null;
  }
  if (raw === "self") {
    return "self";
  }
  return raw;
}

function isAllowed<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value);
}

function parseManualLeadFormInput(
  formData: FormData,
  actorUserId: string,
  assigneeMode: "executive_self" | "manager" | "admin"
): ManualLeadFormInput {
  const serviceCode = String(formData.get("serviceCode") ?? "");
  const propertyCode = String(formData.get("propertyCode") ?? "");
  const timelineCode = String(formData.get("timelineCode") ?? "");
  const budgetRaw = parseNullableString(formData.get("budgetComfortCode"));
  const roomCodes = formData
    .getAll("roomCodes")
    .map((entry) => String(entry))
    .filter((entry) => isAllowed(entry, LEAD_ROOM_CODES));

  let assigneeId = parseAssigneeId(formData.get("assigneeId"), assigneeMode);
  if (assigneeMode === "executive_self") {
    assigneeId = actorUserId;
  } else if (assigneeId === "self") {
    assigneeId = actorUserId;
  }

  return {
    submittedName: String(formData.get("submittedName") ?? ""),
    phone: parseNullableString(formData.get("phone")),
    email: parseNullableString(formData.get("email")),
    serviceCode: isAllowed(serviceCode, LEAD_SERVICE_CODES)
      ? serviceCode
      : ("complete-home-interiors" as LeadServiceCode),
    propertyCode: isAllowed(propertyCode, LEAD_PROPERTY_CODES)
      ? propertyCode
      : ("apartment-2bhk" as LeadPropertyCode),
    timelineCode: isAllowed(timelineCode, LEAD_TIMELINE_CODES)
      ? timelineCode
      : ("within-1-month" as LeadTimelineCode),
    primarySourceId: String(formData.get("primarySourceId") ?? ""),
    locality: parseNullableString(formData.get("locality")),
    budgetComfortCode:
      budgetRaw && isAllowed(budgetRaw, LEAD_BUDGET_COMFORT_CODES)
        ? budgetRaw
        : null,
    roomCodes: roomCodes as LeadRoomCode[],
    message: parseNullableString(formData.get("message")),
    sourceDetail: parseNullableString(formData.get("sourceDetail")),
    assigneeId,
    duplicateOverride: formData.get("duplicateOverride") === "true",
    duplicateOverrideReason: parseNullableString(
      formData.get("duplicateOverrideReason")
    ),
  };
}

export async function previewManualLeadDuplicateAction(
  _previousState: ManualLeadActionState,
  formData: FormData
): Promise<ManualLeadActionState> {
  await requireCrmCreateAccess();

  const serviceCode = String(formData.get("serviceCode") ?? "");
  const propertyCode = String(formData.get("propertyCode") ?? "");

  try {
    const preview = await previewManualLeadDuplicateForCurrentUser({
      phone: parseNullableString(formData.get("phone")),
      email: parseNullableString(formData.get("email")),
      serviceCode: isAllowed(serviceCode, LEAD_SERVICE_CODES)
        ? serviceCode
        : ("complete-home-interiors" as LeadServiceCode),
      propertyCode: isAllowed(propertyCode, LEAD_PROPERTY_CODES)
        ? propertyCode
        : ("apartment-2bhk" as LeadPropertyCode),
      locality: parseNullableString(formData.get("locality")),
    });

    return {
      success: true,
      message: "Duplicate check complete.",
      duplicatePreview: preview,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        success: false,
        message: error.message,
        code: error.code,
      };
    }

    const mapped = crmErrorFromPostgresMessage(
      error instanceof Error ? error.message : "Duplicate preview failed"
    );
    return {
      success: false,
      message: mapped.message,
      code: mapped.code,
    };
  }
}

export async function createManualLeadAction(
  _previousState: ManualLeadActionState,
  formData: FormData
): Promise<ManualLeadActionState> {
  const context = await requireCrmCreateAccess();
  const policy = resolveManualCreateAssigneePolicy(context);

  try {
    const input = parseManualLeadFormInput(
      formData,
      context.userId,
      policy.mode
    );
    const lead = await createManualLeadForCurrentUser(input);

    revalidatePath("/admin/crm/leads");
    redirect(`/admin/crm/leads/${lead.id}`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    if (error instanceof CrmError) {
      return {
        success: false,
        message: error.message,
        code: error.code,
      };
    }

    const mapped = crmErrorFromPostgresMessage(
      error instanceof Error ? error.message : "Manual lead creation failed",
      "LEAD_CREATE_FAILED"
    );
    return {
      success: false,
      message: mapped.message,
      code: mapped.code,
    };
  }
}
