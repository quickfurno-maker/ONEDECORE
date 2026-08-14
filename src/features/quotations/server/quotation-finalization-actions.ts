"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ensureQuotationPdfArtifact } from "./quotation-pdf-generator";

interface ItemRow {
  item_name: string;
  description?: string | null;
  quantity: number | string;
  unit_of_measure: string;
  unit_rate_paise: number | string;
  line_total_paise: number | string;
}

interface SectionRow {
  section_name: string;
  subtotal_paise: number | string;
  quotation_items?: ItemRow[];
}

interface ScheduleRow {
  milestone_name: string;
  percentage?: number | string | null;
  amount_paise: number | string;
}

interface QuotationRelation {
  quotation_number?: string;
  lead_id?: string;
}

interface TaxProfileRelation {
  display_name?: string;
  rate_percentage?: number;
}

export async function setQuotationMaxDiscountAction(maxDiscount: number): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_quotation_max_discount', { p_max_discount: maxDiscount });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export async function adminCreateTaxProfileAction(code: string, displayName: string, rate: number): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_create_quotation_tax_profile', {
    p_code: code,
    p_display_name: displayName,
    p_rate_percentage: rate,
  });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export async function adminUpdateTaxProfileAction(params: {
  taxProfileId: string;
  displayName: string;
  ratePercentage: number;
  isActive: boolean;
}): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_quotation_tax_profile', {
    p_tax_profile_id: params.taxProfileId,
    p_display_name: params.displayName,
    p_rate_percentage: params.ratePercentage,
    p_is_active: params.isActive,
  });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export async function finalizeQuotationDraftAction(params: {
  quotationId: string;
  versionId: string;
  expectedLockVersion: number;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  message?: string;
  finalizedAt?: string;
  grandTotalPaise?: number;
  finalizedContentSha256?: string;
}> {
  const supabase = await createClient();

  // 1. Call server-authoritative finalization RPC
  const { data: finalizeResult, error: finalizeErr } = await supabase.rpc('finalize_quotation_version', {
    p_quotation_id: params.quotationId,
    p_version_id: params.versionId,
    p_expected_lock_version: params.expectedLockVersion,
    p_idempotency_key: params.idempotencyKey || undefined,
  });

  if (finalizeErr || !finalizeResult) {
    return { success: false, message: finalizeErr?.message || 'Finalization failed.' };
  }

  const resultObj = finalizeResult as unknown as {
    success: boolean;
    status: string;
    finalized_content_sha256: string;
  };

  // 2. Fetch finalized data to generate deterministic PDF artifact
  const { data: versionData } = await supabase
    .from('quotation_versions')
    .select(`
      *,
      quotations!inner(quotation_number, lead_id),
      tax_profile:quotation_tax_profiles(display_name, rate_percentage)
    `)
    .eq('id', params.versionId)
    .single();

  if (versionData) {
    const { data: sectionRows } = await supabase
      .from('quotation_sections')
      .select('*, quotation_items(*)')
      .eq('quotation_version_id', params.versionId)
      .order('display_order', { ascending: true });

    const { data: scheduleRows } = await supabase
      .from('quotation_payment_schedules')
      .select('*')
      .eq('quotation_version_id', params.versionId)
      .order('milestone_order', { ascending: true });

    const sections = ((sectionRows as unknown as SectionRow[]) || []).map((sec) => ({
      section_name: sec.section_name,
      section_subtotal_paise: Number(sec.subtotal_paise || 0),
      items: (sec.quotation_items || []).map((item) => ({
        item_name: item.item_name,
        description: item.description || undefined,
        quantity: Number(item.quantity),
        uom: item.unit_of_measure,
        unit_rate_paise: Number(item.unit_rate_paise),
        line_total_paise: Number(item.line_total_paise),
      })),
    }));

    const payment_schedule = ((scheduleRows as unknown as ScheduleRow[]) || []).map((ms) => ({
      milestone_name: ms.milestone_name,
      percentage: ms.percentage ? Number(ms.percentage) : undefined,
      amount_paise: Number(ms.amount_paise || 0),
    }));

    const quotationObj = versionData.quotations as unknown as QuotationRelation | null;
    const taxProfileObj = versionData.tax_profile as unknown as TaxProfileRelation | null;

    try {
      await ensureQuotationPdfArtifact({
        quotation_id: params.quotationId,
        quotation_version_id: params.versionId,
        quotation_number: quotationObj?.quotation_number || 'OD-Q',
        version_number: versionData.version_number,
        finalized_at: versionData.finalized_at || new Date().toISOString(),
        client_name: versionData.client_name_snapshot || 'Valued Client',
        client_phone: versionData.client_phone_snapshot || '',
        property_details: {},
        sections,
        subtotal_paise: Number(versionData.subtotal_paise || 0),
        discount_paise: Number(versionData.discount_total_paise || 0),
        taxable_base_paise: Number(versionData.taxable_base_paise || 0),
        tax_total_paise: Number(versionData.tax_total_paise || 0),
        grand_total_paise: Number(versionData.grand_total_paise || 0),
        tax_profile_name: taxProfileObj?.display_name || 'GST',
        tax_rate_percentage: Number(versionData.tax_rate_percentage || 0),
        payment_schedule,
        inclusions: versionData.inclusions || [],
        exclusions: versionData.exclusions || [],
        terms_and_conditions: versionData.terms_and_conditions ? [versionData.terms_and_conditions] : [],
      });
    } catch (pdfErr) {
      console.warn('PDF artifact generation notice (will retry on demand):', pdfErr);
    }
  }

  return {
    success: true,
    finalizedAt: versionData?.finalized_at || new Date().toISOString(),
    grandTotalPaise: Number(versionData?.grand_total_paise || 0),
    finalizedContentSha256: resultObj.finalized_content_sha256,
  };
}
