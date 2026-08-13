"use server";

import { createClient } from "@/lib/supabase/server";
import { computeCanonicalQuotationHash, type CanonicalQuotationPayload } from "./quotation-canonical-hash";
import { ensureQuotationPdfArtifact } from "./quotation-pdf-generator";

export async function setQuotationMaxDiscountAction(maxDiscount: number): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_quotation_max_discount', { p_max_discount: maxDiscount });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

interface ItemDbRow {
  item_name: string;
  description?: string | null;
  quantity: number | string;
  uom: string;
  unit_rate_paise: number;
  line_total_paise: number;
  item_order: number;
}

interface SectionDbRow {
  section_name: string;
  section_order: number;
  section_subtotal_paise: number;
  quotation_items?: ItemDbRow[];
}

interface PaymentScheduleDbRow {
  milestone_name: string;
  milestone_order: number;
  percentage?: number | string | null;
  amount_paise: number;
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

  // Fetch version details to compute canonical content hash
  const { data: versionData, error: fetchErr } = await supabase
    .from('quotation_versions')
    .select(`
      *,
      quotations!inner(quotation_number, lead_id),
      quotation_tax_profiles!tax_profile_id(id, display_name, tax_rate_percentage),
      quotation_sections(*, quotation_items(*)),
      quotation_payment_schedules(*)
    `)
    .eq('id', params.versionId)
    .single();

  if (fetchErr || !versionData) {
    return { success: false, message: fetchErr?.message || 'Quotation version not found.' };
  }

  const rawSections = (versionData.quotation_sections || []) as unknown as SectionDbRow[];
  const rawSchedules = (versionData.quotation_payment_schedules || []) as unknown as PaymentScheduleDbRow[];

  const joinedVersionData = versionData as unknown as {
    quotations: { quotation_number: string; lead_id: string };
    quotation_tax_profiles: { id: string; display_name: string; tax_rate_percentage: number } | null;
  };

  const termsList = versionData.terms_and_conditions ? [versionData.terms_and_conditions] : [];

  // Build canonical payload
  const canonicalPayload: CanonicalQuotationPayload = {
    quotation_number: joinedVersionData.quotations.quotation_number,
    version_number: versionData.version_number,
    property_details: (versionData.property_address_snapshot as unknown as Record<string, unknown>) || {},
    sections: rawSections.map((sec) => ({
      section_name: sec.section_name,
      section_order: sec.section_order,
      section_subtotal_paise: sec.section_subtotal_paise,
      items: (sec.quotation_items || []).map((item) => ({
        item_name: item.item_name,
        description: item.description || '',
        quantity: Number(item.quantity),
        uom: item.uom,
        unit_rate_paise: item.unit_rate_paise,
        line_total_paise: item.line_total_paise,
        item_order: item.item_order,
      })),
    })),
    subtotal_paise: versionData.subtotal_paise,
    discount_mode: versionData.discount_type || 'none',
    discount_percentage: versionData.discount_percentage ? Number(versionData.discount_percentage) : 0,
    discount_flat_paise: versionData.discount_value_paise || 0,
    discount_paise: versionData.discount_total_paise || 0,
    taxable_base_paise: versionData.taxable_base_paise,
    tax_profile: {
      id: joinedVersionData.quotation_tax_profiles?.id || '',
      display_name: joinedVersionData.quotation_tax_profiles?.display_name || 'GST',
      tax_rate_percentage: joinedVersionData.quotation_tax_profiles?.tax_rate_percentage ? Number(joinedVersionData.quotation_tax_profiles.tax_rate_percentage) : 18,
    },
    tax_total_paise: versionData.tax_total_paise ?? 0,
    grand_total_paise: versionData.grand_total_paise ?? 0,
    payment_schedule: rawSchedules.map((ps) => ({
      milestone_name: ps.milestone_name,
      milestone_order: ps.milestone_order,
      percentage: ps.percentage ? Number(ps.percentage) : 0,
      amount_paise: ps.amount_paise,
    })),
    inclusions: versionData.inclusions || [],
    exclusions: versionData.exclusions || [],
    terms_and_conditions: termsList,
  };

  const canonicalHash = computeCanonicalQuotationHash(canonicalPayload);

  // Call Server-Authoritative Finalization RPC
  const { data: finalizeResult, error: rpcErr } = await supabase.rpc('finalize_quotation_version', {
    p_quotation_id: params.quotationId,
    p_version_id: params.versionId,
    p_expected_lock_version: params.expectedLockVersion,
    p_idempotency_key: params.idempotencyKey || null,
    p_canonical_content_sha256: canonicalHash,
  });

  if (rpcErr || !finalizeResult) {
    return { success: false, message: rpcErr?.message || 'Finalization RPC failed.' };
  }

  const finalObj = finalizeResult as Record<string, unknown>;

  // Trigger PDF Generation Step
  try {
    const { data: leadData } = await supabase
      .from('leads')
      .select('submitted_name, contacts!contact_id(phone_e164)')
      .eq('id', joinedVersionData.quotations.lead_id || '')
      .single();

    const clientPhone = (leadData as unknown as { contacts: { phone_e164: string } })?.contacts?.phone_e164 || '';

    await ensureQuotationPdfArtifact({
      quotation_id: params.quotationId,
      quotation_version_id: params.versionId,
      quotation_number: joinedVersionData.quotations.quotation_number,
      version_number: versionData.version_number,
      finalized_at: typeof finalObj.finalized_at === 'string' ? finalObj.finalized_at : new Date().toISOString(),
      client_name: leadData?.submitted_name || 'Valued Client',
      client_phone: clientPhone,
      property_details: (versionData.property_address_snapshot as unknown as Record<string, unknown>) || {},
      sections: rawSections.map((sec) => ({
        section_name: sec.section_name,
        section_subtotal_paise: sec.section_subtotal_paise,
        items: (sec.quotation_items || []).map((item) => ({
          item_name: item.item_name,
          description: item.description || undefined,
          quantity: Number(item.quantity),
          uom: item.uom,
          unit_rate_paise: item.unit_rate_paise,
          line_total_paise: item.line_total_paise,
        })),
      })),
      subtotal_paise: versionData.subtotal_paise,
      discount_paise: versionData.discount_total_paise || 0,
      taxable_base_paise: versionData.taxable_base_paise,
      tax_total_paise: versionData.tax_total_paise ?? 0,
      grand_total_paise: versionData.grand_total_paise ?? 0,
      tax_profile_name: joinedVersionData.quotation_tax_profiles?.display_name || 'GST',
      tax_rate_percentage: joinedVersionData.quotation_tax_profiles?.tax_rate_percentage ? Number(joinedVersionData.quotation_tax_profiles.tax_rate_percentage) : 18,
      payment_schedule: rawSchedules.map((ps) => ({
        milestone_name: ps.milestone_name,
        percentage: ps.percentage ? Number(ps.percentage) : 0,
        amount_paise: ps.amount_paise,
      })),
      inclusions: versionData.inclusions || [],
      exclusions: versionData.exclusions || [],
      terms_and_conditions: termsList,
    });
  } catch (pdfErr) {
    console.error('PDF generation warning (version remains finalized):', pdfErr);
  }

  return {
    success: true,
    finalizedAt: typeof finalObj.finalized_at === 'string' ? finalObj.finalized_at : undefined,
    grandTotalPaise: typeof finalObj.grand_total_paise === 'number' ? finalObj.grand_total_paise : undefined,
    finalizedContentSha256: typeof finalObj.finalized_content_sha256 === 'string' ? finalObj.finalized_content_sha256 : undefined,
  };
}
