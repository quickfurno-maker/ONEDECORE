/**
 * Phase 6C migration-independent — Kriti task type contracts (ADR-0021).
 */

export const KRITI_TASK_TYPES = [
  "conversation_summary",
  "missing_information",
  "objection_suggestions",
  "next_action_suggestions",
  "service_reply_draft",
  "quotation_wording_draft",
  "project_update_draft",
  "design_summary",
  "campaign_copy_draft",
] as const;

export type KritiTaskType = (typeof KRITI_TASK_TYPES)[number];

export function isKritiTaskType(value: string): value is KritiTaskType {
  return (KRITI_TASK_TYPES as readonly string[]).includes(value);
}
