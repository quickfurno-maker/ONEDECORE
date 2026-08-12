/**
 * Phase 7A — Commercial Quotation Read Queries
 */

import { createClient } from "@/lib/supabase/server";
import type {
  QuotationDraftDTO,
  QuotationTaxProfileDTO,
} from "../contracts/types";
import { quotationErrorFromPostgresMessage } from "./quotation-errors";

export interface ListQuotationItem {
  readonly id: string;
  readonly leadId: string;
  readonly quotationNumber: string;
  readonly status: string;
  readonly currentVersionNumber?: number | null;
  readonly grandTotalPaise?: number | null;
  readonly updatedAt: string;
}

/**
 * Reads canonical QuotationDraftDTO by quotation ID.
 */
export async function getQuotationDraftByQuotationId(
  quotationId: string
): Promise<QuotationDraftDTO> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_quotation_draft", {
    p_quotation_id: quotationId,
  });

  if (error) {
    throw quotationErrorFromPostgresMessage(error);
  }

  return data as unknown as QuotationDraftDTO;
}

/**
 * Reads canonical QuotationDraftDTO by linked lead ID.
 */
export async function getQuotationDraftByLeadId(
  leadId: string
): Promise<QuotationDraftDTO | null> {
  const supabase = await createClient();

  const { data: root, error: rootError } = await supabase
    .from("quotations")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (rootError) {
    throw quotationErrorFromPostgresMessage(rootError);
  }

  if (!root) {
    return null;
  }

  return getQuotationDraftByQuotationId(root.id);
}

/**
 * Lists commercial quotation overview rows accessible to current actor.
 */
export async function listLeadQuotations(): Promise<readonly ListQuotationItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .select(`
      id,
      lead_id,
      quotation_number,
      status,
      updated_at,
      quotation_versions(
        version_number,
        grand_total_paise,
        is_current_draft
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    throw quotationErrorFromPostgresMessage(error);
  }

  if (!data) {
    return [];
  }

  return data.map((q) => {
    const versions = q.quotation_versions || [];
    const current = versions.find((v) => v.is_current_draft) || versions[0];

    return {
      id: q.id,
      leadId: q.lead_id,
      quotationNumber: q.quotation_number,
      status: q.status,
      currentVersionNumber: current?.version_number ?? null,
      grandTotalPaise: current?.grand_total_paise ?? null,
      updatedAt: q.updated_at,
    };
  });
}

/**
 * Lists active tax profiles available for selection.
 */
export async function listActiveTaxProfiles(): Promise<readonly QuotationTaxProfileDTO[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotation_tax_profiles")
    .select("id, code, display_name, rate_percentage, is_active")
    .eq("is_active", true)
    .order("rate_percentage", { ascending: true });

  if (error) {
    throw quotationErrorFromPostgresMessage(error);
  }

  if (!data) {
    return [];
  }

  return data.map((t) => ({
    id: t.id,
    code: t.code,
    displayName: t.display_name,
    ratePercentage: t.rate_percentage,
    isActive: t.is_active,
  }));
}
