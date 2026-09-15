import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AutomationSettingsRow {
  readonly scope: string;
  readonly runtime_enabled: boolean;
  readonly updated_at: string;
}

export interface AutomationChannelRow {
  readonly channel_code: string;
  readonly display_name: string;
  readonly transport_kind: string;
  readonly enabled: boolean;
  readonly adapter_status: string;
  readonly test_mode: boolean;
  readonly default_locale: string;
  readonly config: Record<string, unknown>;
  readonly updated_at: string;
}

export interface AutomationRuleRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly event_code: string;
  readonly action_kind: string;
  readonly audience: string | null;
  readonly template_code: string | null;
  readonly task_code: string | null;
  readonly channel_code: string | null;
  readonly delay_seconds: number;
  readonly enabled: boolean;
  readonly max_attempts: number;
  readonly retry_base_seconds: number;
  readonly config: Record<string, unknown>;
  readonly archived_at: string | null;
  readonly updated_at: string;
}

export interface AutomationJobRow {
  readonly id: string;
  readonly event_id: string;
  readonly rule_id: string;
  readonly status: string;
  readonly scheduled_for: string;
  readonly attempt_count: number;
  readonly max_attempts: number;
  readonly action_kind_snapshot: string;
  readonly audience_snapshot: string | null;
  readonly template_code_snapshot: string | null;
  readonly task_code_snapshot: string | null;
  readonly channel_code_snapshot: string | null;
  readonly last_error_code: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}
export interface AutomationEventRow {
  readonly id: string;
  readonly event_code: string;
  readonly source_kind: string;
  readonly source_id: string;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: string;
}

export interface AutomationOutboxRow {
  readonly id: string;
  readonly audience: string;
  readonly template_code: string;
  readonly channel_code: string;
  readonly source_kind: string;
  readonly source_id: string;
  readonly status: string;
  readonly created_at: string;
}

export interface AutomationTaskRow {
  readonly id: string;
  readonly task_code: string;
  readonly source_kind: string;
  readonly source_id: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly due_at: string | null;
  readonly created_at: string;
}
export interface AutomationAuditRow {
  readonly id: string;
  readonly action_code: string;
  readonly entity_kind: string;
  readonly entity_id: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

export interface CommerceAutomationDashboard {
  readonly settings: AutomationSettingsRow | null;
  readonly channels: readonly AutomationChannelRow[];
  readonly rules: readonly AutomationRuleRow[];
  readonly jobs: readonly AutomationJobRow[];
  readonly events: readonly AutomationEventRow[];
  readonly outbox: readonly AutomationOutboxRow[];
  readonly tasks: readonly AutomationTaskRow[];
  readonly audit: readonly AutomationAuditRow[];
}

export async function canManageCommerceAutomation(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: "commerce.automation.manage",
  });
  return !error && data === true;
}

export async function loadCommerceAutomationDashboard(): Promise<CommerceAutomationDashboard> {
  const supabase = await createClient();
  const [settingsRes,channelsRes,rulesRes,jobsRes,eventsRes,outboxRes,tasksRes,auditRes] = await Promise.all([
    supabase.from("commerce_automation_settings" as never).select("scope,runtime_enabled,updated_at").eq("scope","commerce").maybeSingle(),
    supabase.from("commerce_automation_channels" as never).select("channel_code,display_name,transport_kind,enabled,adapter_status,test_mode,default_locale,config,updated_at").order("channel_code"),
    supabase.from("commerce_automation_rules" as never).select("id,code,name,description,event_code,action_kind,audience,template_code,task_code,channel_code,delay_seconds,enabled,max_attempts,retry_base_seconds,config,archived_at,updated_at").is("archived_at",null).order("name"),
    supabase.from("commerce_automation_jobs" as never).select("id,event_id,rule_id,status,scheduled_for,attempt_count,max_attempts,action_kind_snapshot,audience_snapshot,template_code_snapshot,task_code_snapshot,channel_code_snapshot,last_error_code,created_at,updated_at").order("created_at",{ascending:false}).limit(150),
    supabase.from("commerce_automation_events" as never).select("id,event_code,source_kind,source_id,payload,occurred_at").order("occurred_at",{ascending:false}).limit(100),
    supabase.from("commerce_automation_notification_outbox" as never).select("id,audience,template_code,channel_code,source_kind,source_id,status,created_at").order("created_at",{ascending:false}).limit(100),
    supabase.from("commerce_automation_tasks" as never).select("id,task_code,source_kind,source_id,title,detail,status,due_at,created_at").order("created_at",{ascending:false}).limit(100),
    supabase.from("commerce_automation_audit" as never).select("id,action_code,entity_kind,entity_id,metadata,created_at").order("created_at",{ascending:false}).limit(100),
  ]);
  const error = settingsRes.error ?? channelsRes.error ?? rulesRes.error ?? jobsRes.error ?? eventsRes.error ?? outboxRes.error ?? tasksRes.error ?? auditRes.error;
  if (error) throw error;

  return {
    settings: (settingsRes.data ?? null) as unknown as AutomationSettingsRow | null,
    channels: (channelsRes.data ?? []) as unknown as AutomationChannelRow[],
    rules: (rulesRes.data ?? []) as unknown as AutomationRuleRow[],
    jobs: (jobsRes.data ?? []) as unknown as AutomationJobRow[],
    events: (eventsRes.data ?? []) as unknown as AutomationEventRow[],
    outbox: (outboxRes.data ?? []) as unknown as AutomationOutboxRow[],
    tasks: (tasksRes.data ?? []) as unknown as AutomationTaskRow[],
    audit: (auditRes.data ?? []) as unknown as AutomationAuditRow[],
  };
}
