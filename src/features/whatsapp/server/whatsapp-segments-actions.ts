"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  describeWhatsappControlPlaneRpcError,
  isUuid,
  WHATSAPP_ADMIN_SEGMENTS_PATH,
  type WhatsappControlPlaneActionState,
} from "../contracts/control-plane.ts";
import {
  buildWhatsappSegmentSubmission,
  readWhatsappSegmentRuleDrafts,
  ruleGroupToJson,
} from "../contracts/segment-rules.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";

/*
 * Create or edit ONE segment. The rule group is rebuilt from allowlisted form
 * fields (never accepted as caller JSON), validated here, and validated again
 * by `private.whatsapp_segment_rule_group_valid` inside the RPC.
 */

export async function saveWhatsappSegmentAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const segmentRaw = String(formData.get("segmentId") ?? "").trim();
  if (segmentRaw !== "" && !isUuid(segmentRaw)) {
    return { success: false, code: "VALIDATION", message: "Unknown segment." };
  }

  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.segments.manage"]) {
    return { success: false, code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp segments." };
  }

  const draft = buildWhatsappSegmentSubmission({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    active: formData.get("active") === "on",
    rules: readWhatsappSegmentRuleDrafts(formData),
  });
  if (!draft.ok) return { success: false, code: "VALIDATION", field: draft.field, message: draft.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_whatsapp_segment", {
    p_segment_id: segmentRaw === "" ? null : segmentRaw,
    p_name: draft.submission.name,
    // The RPC stores nullif(trim(description), ''), so an empty string is "none".
    p_description: draft.submission.description,
    p_rule_group: ruleGroupToJson(draft.submission.ruleGroup),
    p_active: draft.submission.active,
  });
  if (error) return { success: false, ...describeWhatsappControlPlaneRpcError(error, "segment") };

  const savedId = (data as { segment_id?: unknown } | null)?.segment_id;
  if (!isUuid(savedId)) return { success: false, code: "RPC_FAILED", message: "The segment could not be saved." };

  revalidatePath(WHATSAPP_ADMIN_SEGMENTS_PATH);
  redirect(`${WHATSAPP_ADMIN_SEGMENTS_PATH}?segment=${savedId}&saved=1`);
}
