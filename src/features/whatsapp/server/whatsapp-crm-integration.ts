import "server-only";

import type { CrmAccessContext } from "@/features/crm/contracts/crm-access.ts";
import type { CrmAssigneeDirectoryEntry } from "@/features/crm/contracts/lead-detail-dtos.ts";
import type { ManualCreateAssigneePolicy } from "@/features/crm/contracts/manual-lead-contracts.ts";
import { resolveEffectiveSalesBucket } from "@/features/crm/contracts/lead-sales-bucket.ts";
import { parseManualSalesTemperature } from "@/features/crm/contracts/lead-sales-temperature.ts";
import type { LeadStageCode } from "@/features/crm/contracts/lead-stages.ts";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth.ts";
import { resolveCrmDb, type CrmDb } from "@/features/crm/server/crm-db.ts";
import {
  fetchManualCreateAssigneeDirectoryForContext,
  resolveManualCreateAssigneePolicy,
} from "@/features/crm/server/crm-manual-lead-service.ts";
import { createClient } from "@/lib/supabase/server";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import { fetchConversationListItemById } from "./whatsapp-inbox-queries.ts";
import type {
  WhatsappCrmLeadCandidate,
  WhatsappCrmLinkResult,
} from "../contracts/crm-integration.ts";
import { whatsappInboxErrorFromPostgresMessage } from "./whatsapp-inbox-errors.ts";

interface CandidateLeadRow {
  readonly id: string;
  readonly status: string;
  readonly submitted_name: string;
  readonly service_code: string;
  readonly locality: string | null;
  readonly assigned_to: string | null;
  readonly manual_sales_temperature: string | null;
  readonly contact_id: string;
  readonly created_at: string;
}

export interface WhatsappCrmCreateOptions {
  readonly crmContext: CrmAccessContext;
  readonly canCreateLead: boolean;
  readonly assigneePolicy: ManualCreateAssigneePolicy | null;
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
}

function humanise(code: string): string {
  const words = code.trim().replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function mapCandidate(
  row: CandidateLeadRow,
  phoneContactIds: ReadonlySet<string>,
  ownerLabels: ReadonlyMap<string, string>
): WhatsappCrmLeadCandidate {
  const status = row.status as LeadStageCode;
  const manual = parseManualSalesTemperature(row.manual_sales_temperature);
  const salesBucket = resolveEffectiveSalesBucket(status, "COLD", manual).bucket;

  return {
    leadId: row.id,
    name: row.submitted_name,
    status: humanise(row.status),
    service: humanise(row.service_code),
    locality: row.locality,
    ownerLabel: row.assigned_to
      ? ownerLabels.get(row.assigned_to) ?? "Assigned"
      : "Unassigned",
    salesBucket,
    phoneMatch: phoneContactIds.has(row.contact_id),
    createdAt: row.created_at,
  };
}

async function fetchCandidateRows(
  context: CrmAccessContext,
  conversationE164: string,
  query: string | null,
  db?: CrmDb
): Promise<readonly WhatsappCrmLeadCandidate[]> {
  if (!context.canReadBroad) {
    return [];
  }

  const supabase = await resolveCrmDb(db);

  const { data: channelRows, error: channelError } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("address_normalized", conversationE164)
    .in("channel_type", ["phone", "whatsapp"])
    .eq("status", "active")
    .limit(20);

  if (channelError) {
    throw whatsappInboxErrorFromPostgresMessage(channelError.message, "RPC_FAILED");
  }

  const phoneContactIds = new Set(
    (channelRows ?? []).map((row) => row.contact_id)
  );

  const selected =
    "id, status, submitted_name, service_code, locality, assigned_to, manual_sales_temperature, contact_id, created_at";
  const rows: CandidateLeadRow[] = [];

  if (phoneContactIds.size > 0) {
    const { data, error } = await supabase
      .from("leads")
      .select(selected)
      .in("contact_id", [...phoneContactIds])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }
    rows.push(...((data ?? []) as unknown as CandidateLeadRow[]));
  }

  const normalizedQuery = query?.trim() ?? "";
  if (normalizedQuery.length >= 2) {
    const pattern = `%${escapeIlikePattern(normalizedQuery)}%`;
    for (const column of ["submitted_name", "locality"] as const) {
      const { data, error } = await supabase
        .from("leads")
        .select(selected)
        .ilike(column, pattern)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) {
        throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
      }
      rows.push(...((data ?? []) as unknown as CandidateLeadRow[]));
    }
  }

  const deduped = new Map<string, CandidateLeadRow>();
  for (const row of rows) {
    if (!deduped.has(row.id)) {
      deduped.set(row.id, row);
    }
  }

  const assignees = await fetchManualCreateAssigneeDirectoryForContext(
    context,
    db
  );
  const ownerLabels = new Map(
    assignees.map((entry) => [entry.userId, entry.displayName] as const)
  );

  return [...deduped.values()]
    .map((row) => mapCandidate(row, phoneContactIds, ownerLabels))
    .sort((left, right) => {
      if (left.phoneMatch !== right.phoneMatch) {
        return left.phoneMatch ? -1 : 1;
      }
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
    .slice(0, 8);
}

export async function searchWhatsappCrmLeadCandidatesForCurrentUser(input: {
  readonly conversationE164: string;
  readonly query: string | null;
}): Promise<readonly WhatsappCrmLeadCandidate[]> {
  const context = await getCrmAccessContext();
  if (!context || !context.canReadBroad) {
    return [];
  }
  return fetchCandidateRows(
    context,
    input.conversationE164,
    input.query
  );
}

export async function getWhatsappCrmCreateOptionsForCurrentUser(): Promise<WhatsappCrmCreateOptions | null> {
  const context = await getCrmAccessContext();
  if (!context || !context.canReadBroad) {
    return null;
  }

  if (!context.canCreateLeads) {
    return {
      crmContext: context,
      canCreateLead: false,
      assigneePolicy: null,
      assignees: [],
    };
  }

  return {
    crmContext: context,
    canCreateLead: true,
    assigneePolicy: resolveManualCreateAssigneePolicy(context),
    assignees: await fetchManualCreateAssigneeDirectoryForContext(context),
  };
}

export async function linkWhatsappConversationToCrmLeadForCurrentUser(input: {
  readonly conversationId: string;
  readonly leadId: string;
  readonly reason: string | null;
  readonly method: "manual_existing" | "created_lead";
}): Promise<WhatsappCrmLinkResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "link_whatsapp_conversation_to_crm_lead",
    {
      p_conversation_id: input.conversationId,
      p_lead_id: input.leadId,
      p_reason: input.reason,
      p_method: input.method,
    }
  );

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const row = data?.[0];
  if (!row || (row.outcome_code !== "linked" && row.outcome_code !== "already_linked")) {
    throw whatsappInboxErrorFromPostgresMessage(
      "CRM_WHATSAPP_LINK_RESULT_INVALID",
      "RPC_FAILED"
    );
  }

  return {
    outcomeCode: row.outcome_code,
    leadId: row.lead_id,
    contactId: row.contact_id,
    phoneMatch: row.phone_match,
  };
}


export async function createCrmLeadFromWhatsappConversationForCurrentUser(input: {
  readonly conversationId: string;
  readonly submittedName: string;
  readonly serviceCode: string;
  readonly assigneeId: string | null;
}): Promise<{ readonly leadId: string; readonly contactId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_crm_lead_from_whatsapp_conversation",
    {
      p_conversation_id: input.conversationId,
      p_submitted_name: input.submittedName,
      p_service_code: input.serviceCode,
      p_assignee_id: input.assigneeId,
    }
  );

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const row = data?.[0];
  if (!row || row.outcome_code !== "created_and_linked") {
    throw whatsappInboxErrorFromPostgresMessage(
      "CRM_WHATSAPP_CREATE_LINK_RESULT_INVALID",
      "RPC_FAILED"
    );
  }

  return {
    leadId: row.lead_id,
    contactId: row.contact_id,
  };
}


export interface WhatsappLeadConversationSummary {
  readonly conversationId: string;
  readonly customerE164: string;
  readonly displayName: string | null;
  readonly lastMessageAt: string | null;
  readonly unread: boolean;
  readonly needsReply: boolean;
  readonly waitingOnCustomer: boolean;
  readonly followUpDue: boolean;
}

export async function getWhatsappConversationForLeadCurrentUser(
  leadId: string
): Promise<WhatsappLeadConversationSummary | null> {
  const whatsapp = await getWhatsappInboxAccessContext();
  if (!whatsapp?.canRead) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("lead_id", leadId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  const item = await fetchConversationListItemById(data.id);
  if (!item || item.leadId !== leadId || item.linkState !== "live") {
    return null;
  }

  return {
    conversationId: item.id,
    customerE164: item.customerE164,
    displayName: item.displayNameSnapshot,
    lastMessageAt: item.lastMessageAt,
    unread: item.unread,
    needsReply: item.needsReply,
    waitingOnCustomer: item.waitingOnCustomer,
    followUpDue: item.followUpDue,
  };
}
