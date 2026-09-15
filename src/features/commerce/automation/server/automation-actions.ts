"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispatchCommerceAutomationJobs } from "./automation-dispatcher";

const PATH = "/admin/commerce/automations";

function text(formData: FormData,name: string): string {
  return String(formData.get(name) ?? "").trim();
}
function integer(formData: FormData,name: string,fallback: number): number {
  const value=Number.parseInt(text(formData,name),10);
  return Number.isFinite(value) ? value : fallback;
}
function jsonObject(formData: FormData,name: string): Record<string,unknown> {
  const raw=text(formData,name);
  if (!raw) return {};
  const value=JSON.parse(raw) as unknown;
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("COMMERCE_VALIDATION");
  return value as Record<string,unknown>;
}
async function assertManage(): Promise<void> {
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("authorize",{requested_permission:"commerce.automation.manage"});
  if (error || data!==true) throw new Error("COMMERCE_UNAUTHORIZED");
}
function refresh(): void { revalidatePath(PATH); }
export async function setCommerceAutomationRuntimeEnabledAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_commerce_automation_runtime_enabled" as never,{
    p_enabled:text(formData,"enabled")==="true",
  } as never);
  if (error) throw error;
  refresh();
}

export async function setCommerceAutomationRuleEnabledAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_commerce_automation_rule_enabled" as never,{
    p_rule_id:text(formData,"id"),p_enabled:text(formData,"enabled")==="true",
  } as never);
  if (error) throw error;
  refresh();
}

export async function saveCommerceAutomationRuleAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const id=text(formData,"id");
  const actionKind=text(formData,"actionKind");
  const {error}=await supabase.rpc("upsert_commerce_automation_rule" as never,{
    p_rule_id:id || null,p_code:text(formData,"code"),p_name:text(formData,"name"),
    p_description:text(formData,"description"),p_event_code:text(formData,"eventCode"),
    p_action_kind:actionKind,p_audience:text(formData,"audience"),
    p_template_code:actionKind==="notification" ? text(formData,"templateCode") : null,
    p_task_code:actionKind==="task" ? text(formData,"taskCode") : null,
    p_channel_code:actionKind==="notification" ? text(formData,"channelCode") : null,
    p_delay_seconds:integer(formData,"delaySeconds",0),
    p_max_attempts:integer(formData,"maxAttempts",5),
    p_retry_base_seconds:integer(formData,"retryBaseSeconds",60),
    p_config:jsonObject(formData,"configJson"),
  } as never);
  if (error) throw error;
  refresh();
}

export async function archiveCommerceAutomationRuleAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("archive_commerce_automation_rule" as never,{
    p_rule_id:text(formData,"id"),
  } as never);
  if (error) throw error;
  refresh();
}

export async function updateCommerceAutomationChannelAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("update_commerce_automation_channel" as never,{
    p_channel_code:text(formData,"channelCode"),
    p_test_mode:text(formData,"testMode")==="true",
    p_default_locale:text(formData,"defaultLocale") || "en",
    p_config:jsonObject(formData,"configJson"),
  } as never);
  if (error) throw error;
  refresh();
}
export async function setCommerceAutomationChannelEnabledAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_commerce_automation_channel_enabled" as never,{
    p_channel_code:text(formData,"channelCode"),
    p_enabled:text(formData,"enabled")==="true",
  } as never);
  if (error) throw error;
  refresh();
}

export async function retryCommerceAutomationJobAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("retry_commerce_automation_job" as never,{p_job_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}

export async function cancelCommerceAutomationJobAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("cancel_commerce_automation_job" as never,{p_job_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}

export async function completeCommerceAutomationTaskAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("complete_commerce_automation_task" as never,{p_task_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}
export async function cancelCommerceAutomationTaskAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("cancel_commerce_automation_task" as never,{p_task_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}

export async function cancelCommerceAutomationNotificationAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("cancel_commerce_automation_notification" as never,{p_notification_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}

export async function replayCommerceAutomationEventAction(formData: FormData): Promise<void> {
  await assertManage();
  const supabase=await createClient();
  const {error}=await supabase.rpc("replay_commerce_automation_event" as never,{p_event_id:text(formData,"id")} as never);
  if (error) throw error;
  refresh();
}

export async function runCommerceAutomationWorkerAction(formData: FormData): Promise<void> {
  await assertManage();
  const requested=integer(formData,"maxBatch",20);
  await dispatchCommerceAutomationJobs({maxBatch:Math.max(1,Math.min(requested,100)),workerId:"admin-manual"});
  refresh();
}
