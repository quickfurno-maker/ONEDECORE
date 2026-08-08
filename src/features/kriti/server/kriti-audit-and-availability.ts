import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KritiAuditEvent, KritiAuditSink } from "../contracts/audit.ts";
import type { KritiProviderMode } from "../contracts/provider.ts";
import type { KritiTaskType } from "../contracts/task-types.ts";

export interface SupabaseKritiAuditSinkOptions {
  readonly supabase: SupabaseClient;
  readonly providerMode: KritiProviderMode;
  readonly providerCode?: string | null;
  readonly modelName?: string | null;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly contextProvenance?: Record<string, unknown>;
}

export function createSupabaseKritiAuditSink(
  options: SupabaseKritiAuditSinkOptions
): KritiAuditSink {
  let runStarted = false;

  return {
    async record(event: KritiAuditEvent): Promise<void> {
      const { supabase } = options;

      if (event.eventType === "kriti.request") {
        const { error } = await supabase.rpc("start_kriti_run", {
          p_run_id: event.requestId,
          p_task_type: event.taskType,
          p_target_type: options.targetType ?? null,
          p_target_id: options.targetId ?? null,
          p_provider_mode: options.providerMode,
          p_provider_code: options.providerCode ?? null,
          p_model_name: options.modelName ?? null,
          p_context_digest: event.contextHash,
          p_context_provenance: options.contextProvenance ?? {},
        });
        if (error) {
          throw new Error(`[Kriti audit] start_kriti_run failed: ${error.message}`);
        }
        runStarted = true;
        return;
      }

      if (!runStarted) {
        throw new Error("[Kriti audit] append before run start");
      }

      if (event.eventType === "kriti.suggestion") {
        const { error } = await supabase.rpc("append_kriti_audit_event", {
          p_run_id: event.requestId,
          p_event_type: event.eventType,
          p_details: {
            schema_name: event.schemaName,
            result_hash: event.resultHash,
            task_type: event.taskType,
          },
          p_run_status: "succeeded",
        });
        if (error) {
          throw new Error(`[Kriti audit] suggestion append failed: ${error.message}`);
        }
        return;
      }

      if (event.eventType === "kriti.request_failed") {
        const { error } = await supabase.rpc("append_kriti_audit_event", {
          p_run_id: event.requestId,
          p_event_type: event.eventType,
          p_details: { task_type: options.targetType },
          p_error_code: event.code,
          p_run_status: "failed",
        });
        if (error) {
          throw new Error(`[Kriti audit] failure append failed: ${error.message}`);
        }
        return;
      }

      if (event.eventType === "kriti.human_use") {
        const { error } = await supabase.rpc("append_kriti_audit_event", {
          p_run_id: event.requestId,
          p_event_type: event.eventType,
          p_details: { action: event.action },
        });
        if (error) {
          throw new Error(`[Kriti audit] human_use append failed: ${error.message}`);
        }
        return;
      }

      if (event.eventType === "kriti.dismiss") {
        const { error } = await supabase.rpc("append_kriti_audit_event", {
          p_run_id: event.requestId,
          p_event_type: event.eventType,
          p_details: {},
        });
        if (error) {
          throw new Error(`[Kriti audit] dismiss append failed: ${error.message}`);
        }
        return;
      }

      if (event.eventType === "kriti.retry") {
        const { error } = await supabase.rpc("append_kriti_audit_event", {
          p_run_id: event.requestId,
          p_event_type: event.eventType,
          p_details: {},
        });
        if (error) {
          throw new Error(`[Kriti audit] retry append failed: ${error.message}`);
        }
      }
    },
  };
}

export type KritiTaskAvailability =
  | "available"
  | "unavailable_dependency"
  | "unauthorized"
  | "disabled";

export interface KritiTaskAvailabilityEntry {
  readonly taskType: KritiTaskType;
  readonly status: KritiTaskAvailability;
  readonly reason?: string;
}

const INBOX_ACTIVATABLE_TASKS = [
  "conversation_summary",
  "missing_information",
  "objection_suggestions",
  "next_action_suggestions",
  "service_reply_draft",
] as const satisfies readonly KritiTaskType[];

const FUTURE_DEPENDENCY_TASKS = [
  "quotation_wording_draft",
  "project_update_draft",
  "design_summary",
  "campaign_copy_draft",
] as const satisfies readonly KritiTaskType[];

export function resolveInboxKritiTaskAvailability(
  canRead: boolean,
  providerDisabled: boolean
): KritiTaskAvailabilityEntry[] {
  const inboxEntries = INBOX_ACTIVATABLE_TASKS.map((taskType) => {
    if (providerDisabled) {
      return { taskType, status: "disabled" as const, reason: "Kriti provider disabled" };
    }
    if (!canRead) {
      return {
        taskType,
        status: "unauthorized" as const,
        reason: "Conversation outside authorized scope",
      };
    }
    return { taskType, status: "available" as const };
  });

  const futureEntries = FUTURE_DEPENDENCY_TASKS.map((taskType) => ({
    taskType,
    status: "unavailable_dependency" as const,
    reason: "Formal domain persistence not yet available",
  }));

  return [...inboxEntries, ...futureEntries];
}
