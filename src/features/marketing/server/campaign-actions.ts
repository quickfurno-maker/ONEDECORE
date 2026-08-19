"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { campaignErrorFromUnknown, type CampaignActionCode } from "./campaign-errors";
import type { Json } from "@/types/database.generated";

export interface CampaignActionResult<T = void> {
  readonly success: boolean;
  readonly message: string;
  readonly code?: CampaignActionCode;
  readonly data?: T;
}

function newKey(): string {
  return crypto.randomUUID();
}

export async function createCampaignDraftAction(formData: FormData): Promise<CampaignActionResult<{ campaignId: string }>> {
  try {
    const supabase = await createClient();
    const channels = String(formData.get("intendedChannels") ?? "email")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const { data, error } = await supabase.rpc("create_campaign_draft", {
      p_name: String(formData.get("name") ?? "").trim(),
      p_title: String(formData.get("title") ?? "").trim(),
      p_targeting_mode: String(formData.get("targetingMode") ?? "broad_public"),
      p_intended_channels: channels,
      p_destination_reference: String(formData.get("destinationReference") ?? "").trim(),
      p_budget_snapshot: {
        currency: "INR",
        daily_budget_paise: Number(formData.get("dailyBudgetPaise") ?? 0),
        total_budget_paise: formData.get("totalBudgetPaise")
          ? Number(formData.get("totalBudgetPaise"))
          : null,
      },
      p_creative_snapshot: {
        headline: String(formData.get("headline") ?? ""),
        primary_text: String(formData.get("primaryText") ?? ""),
        call_to_action: String(formData.get("callToAction") ?? ""),
        media_references: [],
      },
      p_intended_window_snapshot: {
        start_date: String(formData.get("startDate") ?? ""),
        end_date: String(formData.get("endDate") ?? "") || null,
      },
      p_rule_group: JSON.parse(String(formData.get("ruleGroup") ?? "{}")) as Json,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    const campaignId = String((data as Record<string, unknown>).campaign_id);
    revalidatePath("/admin/campaigns");
    return { success: true, message: "Campaign draft created.", data: { campaignId } };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function saveCampaignDraftAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const channels = String(formData.get("intendedChannels") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const { error } = await supabase.rpc("save_campaign_draft", {
      p_campaign_version_id: String(formData.get("campaignVersionId")),
      p_expected_lock_version: Number(formData.get("lockVersion")),
      p_title: String(formData.get("title") ?? "").trim(),
      p_targeting_mode: String(formData.get("targetingMode") ?? "broad_public"),
      p_intended_channels: channels,
      p_destination_reference: String(formData.get("destinationReference") ?? "").trim(),
      p_budget_snapshot: {
        currency: "INR",
        daily_budget_paise: Number(formData.get("dailyBudgetPaise") ?? 0),
        total_budget_paise: formData.get("totalBudgetPaise")
          ? Number(formData.get("totalBudgetPaise"))
          : null,
      },
      p_creative_snapshot: {
        headline: String(formData.get("headline") ?? ""),
        primary_text: String(formData.get("primaryText") ?? ""),
        call_to_action: String(formData.get("callToAction") ?? ""),
        media_references: [],
      },
      p_intended_window_snapshot: {
        start_date: String(formData.get("startDate") ?? ""),
        end_date: String(formData.get("endDate") ?? "") || null,
      },
      p_rule_group: JSON.parse(String(formData.get("ruleGroup") ?? "{}")) as Json,
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Draft saved." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function requestCampaignApprovalAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_campaign_approval", {
      p_campaign_version_id: String(formData.get("campaignVersionId")),
      p_expected_lock_version: Number(formData.get("lockVersion")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Approval requested." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function decideCampaignVersionAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("decide_campaign_version", {
      p_campaign_version_id: String(formData.get("campaignVersionId")),
      p_decision: String(formData.get("decision")),
      p_reason: String(formData.get("reason") ?? ""),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Decision recorded. Live provider writes remain off." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function createNextCampaignVersionAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_next_campaign_version", {
      p_campaign_id: String(formData.get("campaignId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "New draft version created." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function recordMarketingConsentAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_marketing_consent_event", {
      p_contact_id: String(formData.get("contactId")),
      p_event_type: String(formData.get("eventType")),
      p_channel: String(formData.get("channel")),
      p_copy_version: String(formData.get("copyVersion")),
      p_notice_version: String(formData.get("noticeVersion")),
      p_instruction_source: String(formData.get("instructionSource")),
      p_note: String(formData.get("note") ?? ""),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/crm/leads/${String(formData.get("leadId"))}`);
    return {
      success: true,
      message: "Recorded evidence of the customer instruction. This does not bypass DNC and does not send marketing.",
    };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function createCampaignRunAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_campaign_run", {
      p_campaign_version_id: String(formData.get("campaignVersionId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Mock run scheduled. No live provider write." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function pauseCampaignRunAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("pause_campaign_run", {
      p_campaign_run_id: String(formData.get("campaignRunId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Pause queued. Provider-paused is acknowledged after mock dispatch." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function resumeCampaignRunAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("resume_campaign_run", {
      p_campaign_run_id: String(formData.get("campaignRunId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Resume queued." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function cancelCampaignRunAction(formData: FormData): Promise<CampaignActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_campaign_run", {
      p_campaign_run_id: String(formData.get("campaignRunId")),
      p_idempotency_key: newKey(),
    });
    if (error) throw error;
    revalidatePath(`/admin/campaigns/${String(formData.get("campaignId"))}`);
    return { success: true, message: "Run cancelled." };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}

export async function dispatchMockCampaignExecutionAction(): Promise<CampaignActionResult> {
  try {
    const { getCampaignExecutionMode } = await import("../execution/server/execution-env.ts");
    const mode = getCampaignExecutionMode();
    if (mode === "sandbox" || mode === "live") {
      return {
        success: false,
        message: "Sandbox/live Ads adapters are not implemented in Phase 9C-B.",
        code: "CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED",
      };
    }
    if (mode === "disabled") {
      return { success: true, message: "Execution mode is DISABLED. No dispatch." };
    }
    const { dispatchCampaignRunOperations } = await import("../execution/server/dispatcher.ts");
    const result = await dispatchCampaignRunOperations({ maxBatch: 5, workerId: "admin-manual" });
    return {
      success: true,
      message: `Mock dispatch processed ${result.processed} operation(s). No live provider writes.`,
    };
  } catch (error) {
    const err = campaignErrorFromUnknown(error);
    return { success: false, message: err.message, code: err.code };
  }
}
