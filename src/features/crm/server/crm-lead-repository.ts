import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmLeadDetail } from "../contracts/lead-detail-dtos.ts";
import type { CrmLeadListItem } from "../contracts/lead-dtos.ts";
import { resolveOnHoldResumeStage } from "../contracts/lifecycle-contracts.ts";
import { parseManualSalesTemperature } from "../contracts/lead-sales-temperature.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { LEAD_MONTH_ALL_COHORT } from "../contracts/lead-month-cohort.ts";
import type { LeadListQuery } from "../contracts/lead-list-query.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { formatMarketingTouchSummary } from "./crm-attribution-summary.ts";
import { fetchLeadTimelinePage } from "./crm-lead-timeline-queries.ts";
import {
  fetchCrmAssigneeDirectory,
  queryLeadListPage,
  queryRecentLeads,
  CRM_RECENT_LEADS_LIMIT,
  type CrmRecentLead,
  type LeadSegmentationPageResult,
} from "./crm-lead-queries.ts";

/**
 * Returns leads visible to the authenticated user via CRM RLS (`crm_can_view_lead`).
 * Broad-read roles see the full queue; assignment-scoped roles see owned leads only.
 */
export async function getLeadsForCurrentUser(): Promise<CrmLeadListItem[]> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const page = await queryLeadListPage(context, {
    q: null,
    status: null,
    sourceId: null,
    assignment: null,
    assigneeId: null,
    followUpDue: null,
    bucket: null,
    // All-time: this helper backs snapshots and exports, not the month-scoped
    // workspace, so it must not silently inherit a current-month filter.
    month: LEAD_MONTH_ALL_COHORT,
    page: 1,
    pageSize: 50,
  });

  return [...page.items];
}

export async function getLeadListPageForCurrentUser(
  query: LeadListQuery
): Promise<LeadSegmentationPageResult> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  return queryLeadListPage(context, query);
}

/**
 * The newest leads by RECEIPT, for the operations dashboard.
 *
 * Deliberately NOT `getLeadListPageForCurrentUser`: that read model is the
 * conversion queue and ranks by bucket and priority, so a panel titled "Recent
 * Leads" built on it showed the hottest leads rather than the newest.
 */
export async function getRecentLeadsForCurrentUser(
  limit: number = CRM_RECENT_LEADS_LIMIT
): Promise<readonly CrmRecentLead[]> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  return queryRecentLeads(context, limit);
}

export async function getLeadDetailForCurrentUser(
  leadId: string
): Promise<CrmLeadDetail | null> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      `
      id,
      status,
      submitted_name,
      submitted_email,
      service_code,
      property_code,
      timeline_code,
      room_codes,
      budget_comfort_code,
      locality,
      message,
      entry_method,
      landing_path,
      planner_version,
      attribution,
      assigned_to,
      manual_sales_temperature,
      on_hold_reason,
      on_hold_since,
      on_hold_previous_status,
      closed_lost_note,
      closed_lost_reason_id,
      created_at,
      updated_at,
      contact_id,
      primary_source_id,
      lead_sources!leads_primary_source_id_fkey(display_name),
      lead_closure_reasons!fk_leads_closed_lost_reason(display_name)
    `
    )
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    throw crmErrorFromPostgresMessage(leadError.message, "RPC_FAILED");
  }

  if (!lead) {
    return null;
  }

  const assigneeDirectory = await fetchCrmAssigneeDirectory(context);
  const assigneeLabels = Object.fromEntries(
    assigneeDirectory.map((entry) => [entry.userId, entry.displayName])
  );

  const labelForUser = (userId: string | null | undefined): string | null => {
    if (!userId) {
      return null;
    }
    return assigneeLabels[userId] ?? "Staff member";
  };

  const [
    contactResult,
    touchpointsResult,
    assignmentHistoryResult,
    notesResult,
    followUpsResult,
    consentResult,
    slaClockResult,
    timeline,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, display_name, status, contact_channels(id, channel_type, address_normalized, is_primary, status)")
      .eq("id", lead.contact_id)
      .maybeSingle(),
    supabase
      .from("lead_source_touchpoints")
      .select(
        "id, touchpoint_kind, occurred_at, source_detail, campaign_reference, lead_sources(display_name)"
      )
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("lead_assignment_history")
      .select(
        "id, previous_assignee, new_assignee, assignment_method, actor_id, occurred_at, reason"
      )
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("lead_notes")
      .select("id, body, created_at, created_by")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_follow_ups")
      .select(
        "id, owner_id, due_at, status, outcome, completed_at, cancelled_at, activity_type, title, priority, is_primary_next_action, duration_minutes, reminder_at, outcome_code, completion_note, quotation_id, source, cadence_enrollment_id, cadence_step_id, created_at, updated_at"
      )
      .eq("lead_id", leadId)
      .order("due_at", { ascending: true }),
    context.canReadConsents
      ? supabase
          .from("consent_events")
          .select(
            "id, purpose_code, channel, event_type, notice_version, copy_version, occurred_at"
          )
          .eq("lead_id", leadId)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // A clock row exists for every lead regardless of SLA policy activation,
    // so first-contact evidence is available while sla_due_at stays null.
    supabase
      .from("crm_sla_clocks")
      .select("sla_due_at, first_contact_attempt_at, breached_at")
      .eq("lead_id", leadId)
      .maybeSingle(),
    // CRM 2D-1: the unified timeline is assembled from canonical, RLS-scoped
    // audit rows. It replaces the previous lead_activities + lead_events concat,
    // which rendered raw event codes and duplicated every twin write.
    fetchLeadTimelinePage(leadId, context, labelForUser),
  ]);

  for (const result of [
    contactResult,
    touchpointsResult,
    assignmentHistoryResult,
    notesResult,
    followUpsResult,
    consentResult,
    slaClockResult,
  ]) {
    if (result.error) {
      throw crmErrorFromPostgresMessage(result.error.message, "RPC_FAILED");
    }
  }

  return {
    id: lead.id,
    capturedAt: new Date().toISOString(),
    overview: {
      submittedName: lead.submitted_name,
      submittedEmail: lead.submitted_email,
      serviceCode: lead.service_code,
      propertyCode: lead.property_code,
      timelineCode: lead.timeline_code,
      roomCodes: lead.room_codes ?? [],
      budgetComfortCode: lead.budget_comfort_code,
      locality: lead.locality,
      message: lead.message,
      status: lead.status as LeadStageCode,
      manualSalesTemperature: parseManualSalesTemperature(
        lead.manual_sales_temperature
      ),
      entryMethod: lead.entry_method,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    },
    contact: {
      id: lead.contact_id,
      status: contactResult.data?.status ?? "active",
      displayName: contactResult.data?.display_name ?? lead.submitted_name,
      channels: (contactResult.data?.contact_channels ?? []).map((channel) => ({
        id: channel.id,
        channelType: channel.channel_type,
        addressNormalized: channel.address_normalized,
        isPrimary: channel.is_primary,
        status: channel.status,
      })),
    },
    source: {
      primarySourceLabel: lead.lead_sources?.display_name ?? "Unknown source",
      landingPath: lead.landing_path,
      plannerVersion: lead.planner_version,
      attributionSummary: formatMarketingTouchSummary(lead.attribution),
      touchpoints: (touchpointsResult.data ?? []).map((touchpoint) => ({
        id: touchpoint.id,
        sourceLabel: touchpoint.lead_sources?.display_name ?? "Unknown source",
        touchpointKind: touchpoint.touchpoint_kind,
        occurredAt: touchpoint.occurred_at,
        sourceDetail: touchpoint.source_detail,
        campaignReference: touchpoint.campaign_reference,
      })),
    },
    assignment: {
      currentAssigneeLabel: lead.assigned_to
        ? labelForUser(lead.assigned_to) ?? "Assigned staff"
        : "Unassigned",
      currentAssigneeId: lead.assigned_to,
      history: (assignmentHistoryResult.data ?? []).map((entry) => ({
        id: entry.id,
        previousAssigneeLabel: labelForUser(entry.previous_assignee),
        newAssigneeLabel: labelForUser(entry.new_assignee),
        assignmentMethod: entry.assignment_method,
        actorLabel: labelForUser(entry.actor_id) ?? "Staff member",
        occurredAt: entry.occurred_at,
        reason: entry.reason,
      })),
    },
    timeline,
    notes: (notesResult.data ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
      authorLabel: labelForUser(note.created_by) ?? "Staff member",
    })),
    followUps: (followUpsResult.data ?? []).map((followUp) => ({
      id: followUp.id,
      ownerId: followUp.owner_id,
      ownerLabel: labelForUser(followUp.owner_id) ?? "Staff member",
      dueAt: followUp.due_at,
      status: followUp.status,
      outcome: followUp.outcome,
      completedAt: followUp.completed_at,
      cancelledAt: followUp.cancelled_at,
      activityType: followUp.activity_type,
      title: followUp.title,
      priority: followUp.priority,
      isPrimaryNextAction: followUp.is_primary_next_action,
      durationMinutes: followUp.duration_minutes,
      reminderAt: followUp.reminder_at,
      outcomeCode: followUp.outcome_code,
      completionNote: followUp.completion_note,
      quotationId: followUp.quotation_id,
      source: followUp.source,
      cadenceEnrollmentId: followUp.cadence_enrollment_id,
      cadenceStepId: followUp.cadence_step_id,
      createdAt: followUp.created_at,
      updatedAt: followUp.updated_at,
    })),
    consentSummary: (consentResult.data ?? []).map((consent) => ({
      id: consent.id,
      purposeCode: consent.purpose_code,
      channel: consent.channel,
      eventType: consent.event_type,
      noticeVersion: consent.notice_version,
      copyVersion: consent.copy_version,
      occurredAt: consent.occurred_at,
    })),
    statusSummary: {
      onHoldReason: lead.status === "on_hold" ? lead.on_hold_reason : null,
      onHoldSince: lead.status === "on_hold" ? lead.on_hold_since : null,
      onHoldPreviousStatus:
        lead.status === "on_hold"
          ? (lead.on_hold_previous_status as LeadStageCode | null)
          : null,
      resumeTargetStatus:
        lead.status === "on_hold"
          ? resolveOnHoldResumeStage(
              lead.on_hold_previous_status,
              lead.assigned_to
            )
          : null,
      closedLostReasonLabel:
        lead.status === "closed_lost"
          ? lead.lead_closure_reasons?.display_name ?? null
          : null,
      closedLostNote:
        lead.status === "closed_lost" ? lead.closed_lost_note : null,
    },
    slaClock: {
      slaDueAt: slaClockResult.data?.sla_due_at ?? null,
      firstContactAttemptAt:
        slaClockResult.data?.first_contact_attempt_at ?? null,
      breachedAt: slaClockResult.data?.breached_at ?? null,
    },
  };
}
