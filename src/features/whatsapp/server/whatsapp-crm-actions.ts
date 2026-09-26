"use server";

import { revalidatePath } from "next/cache";
import {
  LEAD_SERVICE_CODES,
  type LeadServiceCode,
} from "@/features/lead-intake/planner-allowlist";
import {
  previewManualLeadDuplicateForContext,
  resolveManualCreateAssigneePolicy,
} from "@/features/crm/server/crm-manual-lead-service.ts";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth.ts";
import type {
  WhatsappCrmResolutionActionState,
} from "../contracts/crm-integration.ts";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import {
  canCurrentUserAccessConversation,
  fetchConversationListItemById,
} from "./whatsapp-inbox-queries.ts";
import {
  createCrmLeadFromWhatsappConversationForCurrentUser,
  linkWhatsappConversationToCrmLeadForCurrentUser,
  searchWhatsappCrmLeadCandidatesForCurrentUser,
} from "./whatsapp-crm-integration.ts";

function textValue(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function nullableText(value: FormDataEntryValue | null): string | null {
  const valueText = textValue(value);
  return valueText.length > 0 ? valueText : null;
}

function isServiceCode(value: string): value is LeadServiceCode {
  return (LEAD_SERVICE_CODES as readonly string[]).includes(value);
}

async function assertConversationManager(conversationId: string) {
  const whatsapp = await getWhatsappInboxAccessContext();
  if (!whatsapp?.canManage) {
    throw new Error("CRM_WHATSAPP_MANAGE_REQUIRED");
  }

  if (!(await canCurrentUserAccessConversation(conversationId, "manage"))) {
    throw new Error("CRM_WHATSAPP_MANAGE_REQUIRED");
  }

  const conversation = await fetchConversationListItemById(conversationId);
  if (!conversation) {
    throw new Error("CRM_WHATSAPP_CONVERSATION_NOT_FOUND");
  }

  return { whatsapp, conversation };
}

function humanMessage(error: unknown): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  if (raw.includes("CRM_WHATSAPP_LINK_REASON_REQUIRED")) {
    return {
      code: "LINK_REASON_REQUIRED",
      message:
        "This WhatsApp number does not match the CRM contact. Add a short reason before linking.",
    };
  }
  if (raw.includes("CRM_WHATSAPP_ALREADY_LINKED")) {
    return {
      code: "ALREADY_LINKED",
      message:
        "This conversation was linked by another action. Refresh before making another CRM change.",
    };
  }
  if (
    raw.includes("CRM_WHATSAPP_MANAGE_REQUIRED") ||
    raw.includes("CRM_WHATSAPP_CRM_READ_REQUIRED") ||
    raw.includes("42501")
  ) {
    return {
      code: "ACCESS_DENIED",
      message: "You do not have permission to resolve this conversation.",
    };
  }
  if (
    raw.includes("CRM_WHATSAPP_CONVERSATION_NOT_FOUND") ||
    raw.includes("CRM_WHATSAPP_LEAD_NOT_FOUND") ||
    raw.includes("P0002")
  ) {
    return {
      code: "NOT_FOUND",
      message: "The conversation or CRM lead is no longer available.",
    };
  }

  return {
    code: "CRM_WHATSAPP_FAILED",
    message: "CRM linking could not be completed. Refresh and try again.",
  };
}

function revalidateConversation(conversationId: string, leadId?: string): void {
  revalidatePath("/admin/whatsapp/inbox");
  revalidatePath(`/admin/whatsapp/inbox/${conversationId}`);
  revalidatePath("/admin/crm/leads");
  if (leadId) {
    revalidatePath(`/admin/crm/leads/${leadId}`);
  }
}

export async function searchWhatsappCrmLeadCandidatesAction(
  _previousState: WhatsappCrmResolutionActionState,
  formData: FormData
): Promise<WhatsappCrmResolutionActionState> {
  const conversationId = textValue(formData.get("conversationId"));
  const query = nullableText(formData.get("query"));

  try {
    const { conversation } = await assertConversationManager(conversationId);
    if (conversation.leadId) {
      return {
        success: false,
        code: "ALREADY_LINKED",
        message: "This conversation is already linked to a CRM lead.",
      };
    }

    const candidates = await searchWhatsappCrmLeadCandidatesForCurrentUser({
      conversationE164: conversation.customerE164,
      query,
    });

    return {
      success: true,
      message:
        candidates.length > 0
          ? "CRM candidates loaded."
          : query
            ? "No visible CRM leads matched that search."
            : "No CRM lead currently matches this WhatsApp number.",
      candidates,
    };
  } catch (error: unknown) {
    const mapped = humanMessage(error);
    return { success: false, ...mapped };
  }
}

export async function linkWhatsappConversationToExistingLeadAction(
  _previousState: WhatsappCrmResolutionActionState,
  formData: FormData
): Promise<WhatsappCrmResolutionActionState> {
  const conversationId = textValue(formData.get("conversationId"));
  const leadId = textValue(formData.get("leadId"));
  const reason = nullableText(formData.get("reason"));

  try {
    const { conversation } = await assertConversationManager(conversationId);
    if (conversation.leadId && conversation.leadId !== leadId) {
      throw new Error("CRM_WHATSAPP_ALREADY_LINKED");
    }

    const result = await linkWhatsappConversationToCrmLeadForCurrentUser({
      conversationId,
      leadId,
      reason,
      method: "manual_existing",
    });

    revalidateConversation(conversationId, result.leadId);
    return {
      success: true,
      message: result.phoneMatch
        ? "Conversation linked to the matching CRM lead."
        : "Conversation linked with your manual-resolution reason.",
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    const mapped = humanMessage(error);
    return { success: false, ...mapped };
  }
}

export async function createCrmLeadFromWhatsappConversationAction(
  _previousState: WhatsappCrmResolutionActionState,
  formData: FormData
): Promise<WhatsappCrmResolutionActionState> {
  const conversationId = textValue(formData.get("conversationId"));
  const submittedName = textValue(formData.get("submittedName"));
  const serviceRaw = textValue(formData.get("serviceCode"));
  const assigneeRaw = textValue(formData.get("assigneeId"));

  try {
    const { whatsapp, conversation } = await assertConversationManager(
      conversationId
    );

    if (conversation.leadId) {
      return {
        success: false,
        code: "ALREADY_LINKED",
        message: "This conversation is already linked to a CRM lead.",
        leadId: conversation.leadId,
      };
    }

    const crm = await getCrmAccessContext();
    if (!crm?.canReadBroad || !crm.canCreateLeads) {
      throw new Error("CRM_WHATSAPP_CRM_READ_REQUIRED");
    }

    const policy = resolveManualCreateAssigneePolicy(crm);
    let assigneeId: string | null = null;
    if (assigneeRaw && assigneeRaw !== "unassigned") {
      assigneeId =
        assigneeRaw === "self" && policy.mode === "manager"
          ? whatsapp.userId
          : assigneeRaw;
    }

    const serviceCode = isServiceCode(serviceRaw)
      ? serviceRaw
      : "not-specified";

    const duplicate = await previewManualLeadDuplicateForContext(crm, {
      phone: conversation.customerE164,
      email: null,
      serviceCode,
      propertyCode: "not-specified",
      locality: null,
    });

    if (
      duplicate.outcomeCode === "ACTIVE_DUPLICATE" ||
      duplicate.outcomeCode === "RECENT_SIMILAR" ||
      duplicate.outcomeCode === "CONTACT_IDENTITY_CONFLICT"
    ) {
      return {
        success: false,
        code: duplicate.outcomeCode,
        message:
          duplicate.outcomeCode === "ACTIVE_DUPLICATE"
            ? "An active CRM lead already uses this number. Link that lead instead of creating another."
            : duplicate.outcomeCode === "RECENT_SIMILAR"
              ? "A recent similar CRM enquiry exists. Resolve or link it from CRM before creating another lead here."
              : "This phone identity is ambiguous in CRM. Resolve the contact identity before creating a lead.",
        leadId: duplicate.existingLeadId ?? undefined,
        requiresExistingLeadResolution: true,
      };
    }

    const created = await createCrmLeadFromWhatsappConversationForCurrentUser({
      conversationId,
      submittedName:
        submittedName.length >= 2
          ? submittedName
          : conversation.displayNameSnapshot?.trim() || "WhatsApp Enquiry",
      serviceCode,
      assigneeId,
    });

    revalidateConversation(conversationId, created.leadId);
    return {
      success: true,
      message: "CRM lead created from this WhatsApp conversation and linked.",
      leadId: created.leadId,
    };
  } catch (error: unknown) {
    const mapped = humanMessage(error);
    return { success: false, ...mapped };
  }
}
