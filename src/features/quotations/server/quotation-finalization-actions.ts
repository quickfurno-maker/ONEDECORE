"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";






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

  // 2. Render the deterministic PDF from the ONE shared frozen payload builder.
  //
  // This used to assemble its own inline payload, which omitted
  // calculation_basis, width_ft, height_ft, area_sqft and specifications. The
  // PDF created immediately after finalization therefore lost every AREA
  // dimension and printed FIXED rows as generic quantity lines — and because a
  // READY artifact is immutable, that wrong document would have been permanent.
  const { buildQuotationPdfData } = await import("./quotation-pdf-payload");
  const { ensureQuotationPdfArtifact } = await import("./quotation-pdf-generator");

  let finalizedAt: string | null = null;
  let grandTotalPaise = 0;

  try {
    const pdfData = await buildQuotationPdfData(
      supabase as unknown as Parameters<typeof buildQuotationPdfData>[0],
      { quotationId: params.quotationId, versionId: params.versionId }
    );
    finalizedAt = pdfData.finalized_at;
    grandTotalPaise = pdfData.grand_total_paise;
    await ensureQuotationPdfArtifact(pdfData);
  } catch (pdfErr) {
    // The quotation IS finalized; only the artifact is missing. Reversing a
    // correct commercial record because a render failed would be far worse, and
    // the finalized view exposes an authorized retry.
    console.warn(
      "Quotation PDF artifact not generated at finalization; retry is available:",
      pdfErr instanceof Error ? pdfErr.message : pdfErr
    );
  }

  return {
    success: true,
    finalizedAt: finalizedAt || new Date().toISOString(),
    grandTotalPaise,
    finalizedContentSha256: resultObj.finalized_content_sha256,
  };
}
