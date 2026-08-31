import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  CrmActivityPriority,
  CrmActivityType,
} from "../contracts/activity-contracts.ts";
import type {
  CrmCadenceEnrollmentStatus,
  CrmCadenceStep,
  CrmCadenceStopReason,
  CrmCadenceTemplateDetail,
  CrmCadenceTemplateStatus,
  CrmCadenceTemplateSummary,
  CrmLeadCadenceState,
} from "../contracts/cadence-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

/** Bounded read model: the cadence catalogue is an admin list, not a dashboard. */
export const CRM_CADENCE_TEMPLATE_FETCH_LIMIT = 100;
const CADENCE_HISTORY_LIMIT = 20;

interface StepRow {
  readonly id: string;
  readonly step_order: number;
  readonly delay_hours: number;
  readonly activity_type: string;
  readonly title: string;
  readonly priority: string;
  readonly duration_minutes: number | null;
  readonly reminder_offset_minutes: number | null;
}

function mapStep(row: StepRow): CrmCadenceStep {
  return {
    id: row.id,
    stepOrder: row.step_order,
    delayHours: row.delay_hours,
    activityType: row.activity_type as CrmActivityType,
    title: row.title,
    priority: row.priority as CrmActivityPriority,
    durationMinutes: row.duration_minutes,
    reminderOffsetMinutes: row.reminder_offset_minutes,
  };
}

/**
 * Lists cadence templates with a light usage count. RLS scopes visibility; the
 * caller must still hold `crm.cadences.manage` to mutate anything.
 */
export async function fetchCadenceTemplates(): Promise<
  readonly CrmCadenceTemplateSummary[]
> {
  const supabase = await createClient();

  const [templatesResult, stepsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("crm_cadence_templates")
      .select("id, name, description, status, updated_at")
      .order("status", { ascending: true })
      .order("name", { ascending: true })
      .limit(CRM_CADENCE_TEMPLATE_FETCH_LIMIT),
    supabase.from("crm_cadence_steps").select("template_id"),
    supabase
      .from("crm_lead_cadence_enrollments")
      .select("template_id, status")
      .in("status", ["active", "paused"]),
  ]);

  for (const result of [templatesResult, stepsResult, enrollmentsResult]) {
    if (result.error) {
      throw crmErrorFromPostgresMessage(result.error.message, "RPC_FAILED");
    }
  }

  const stepCounts = new Map<string, number>();
  for (const row of stepsResult.data ?? []) {
    stepCounts.set(row.template_id, (stepCounts.get(row.template_id) ?? 0) + 1);
  }

  const enrollmentCounts = new Map<string, number>();
  for (const row of enrollmentsResult.data ?? []) {
    enrollmentCounts.set(
      row.template_id,
      (enrollmentCounts.get(row.template_id) ?? 0) + 1
    );
  }

  return (templatesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as CrmCadenceTemplateStatus,
    stepCount: stepCounts.get(row.id) ?? 0,
    activeEnrollmentCount: enrollmentCounts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  }));
}

export async function fetchCadenceTemplateDetail(
  templateId: string
): Promise<CrmCadenceTemplateDetail | null> {
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("crm_cadence_templates")
    .select("id, name, description, status, updated_at, published_at, archived_at")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
  if (!template) {
    return null;
  }

  const [stepsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("crm_cadence_steps")
      .select(
        "id, step_order, delay_hours, activity_type, title, priority, duration_minutes, reminder_offset_minutes"
      )
      .eq("template_id", templateId)
      .order("step_order", { ascending: true }),
    supabase
      .from("crm_lead_cadence_enrollments")
      .select("id")
      .eq("template_id", templateId)
      .in("status", ["active", "paused"]),
  ]);

  for (const result of [stepsResult, enrollmentsResult]) {
    if (result.error) {
      throw crmErrorFromPostgresMessage(result.error.message, "RPC_FAILED");
    }
  }

  const steps = (stepsResult.data ?? []).map((row) => mapStep(row as StepRow));

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    status: template.status as CrmCadenceTemplateStatus,
    stepCount: steps.length,
    activeEnrollmentCount: (enrollmentsResult.data ?? []).length,
    updatedAt: template.updated_at,
    publishedAt: template.published_at,
    archivedAt: template.archived_at,
    steps,
  };
}

/** Published templates available for manual enrollment on lead detail. */
export async function fetchEnrollableCadenceTemplates(): Promise<
  readonly CrmCadenceTemplateSummary[]
> {
  const templates = await fetchCadenceTemplates();
  return templates.filter(
    (template) => template.status === "published" && template.stepCount > 0
  );
}

/**
 * Current (or most recent) cadence state for one lead. RLS already restricts the
 * enrollment rows, so this never widens lead visibility.
 */
export async function fetchLeadCadenceState(
  leadId: string
): Promise<CrmLeadCadenceState | null> {
  const supabase = await createClient();

  const { data: enrollment, error } = await supabase
    .from("crm_lead_cadence_enrollments")
    .select(
      "id, template_id, status, current_step_order, stop_reason, enrolled_at"
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
  if (!enrollment) {
    return null;
  }

  const [templateResult, stepsResult, eventsResult] = await Promise.all([
    supabase
      .from("crm_cadence_templates")
      .select("name")
      .eq("id", enrollment.template_id)
      .maybeSingle(),
    supabase
      .from("crm_cadence_steps")
      .select("step_order, title, delay_hours")
      .eq("template_id", enrollment.template_id)
      .order("step_order", { ascending: true }),
    supabase
      .from("crm_cadence_enrollment_events")
      .select("id, event_type, reason_code, created_at")
      .eq("enrollment_id", enrollment.id)
      .order("created_at", { ascending: false })
      .limit(CADENCE_HISTORY_LIMIT),
  ]);

  for (const result of [templateResult, stepsResult, eventsResult]) {
    if (result.error) {
      throw crmErrorFromPostgresMessage(result.error.message, "RPC_FAILED");
    }
  }

  const steps = stepsResult.data ?? [];
  const current = enrollment.current_step_order;
  const currentStep =
    current == null
      ? null
      : steps.find((step) => step.step_order === current) ?? null;
  const upcomingStep =
    steps.find((step) => step.step_order > (current ?? 0)) ?? null;

  return {
    enrollmentId: enrollment.id,
    templateId: enrollment.template_id,
    templateName: templateResult.data?.name ?? "Cadence",
    status: enrollment.status as CrmCadenceEnrollmentStatus,
    stopReason: enrollment.stop_reason as CrmCadenceStopReason | null,
    currentStepOrder: current,
    totalSteps: steps.length,
    currentStepTitle: currentStep?.title ?? null,
    upcomingStepTitle: upcomingStep?.title ?? null,
    upcomingStepDelayHours: upcomingStep?.delay_hours ?? null,
    enrolledAt: enrollment.enrolled_at,
    history: (eventsResult.data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      reasonCode: row.reason_code,
      createdAt: row.created_at,
    })),
  };
}
