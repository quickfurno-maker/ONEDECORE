"use server";

/**
 * Phase 7A — Commercial Quotation Draft Server Actions
 */

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database.generated";
import { buildSaveRoomsPayload } from "../contracts/save-rooms-payload.ts";
import { createClient } from "@/lib/supabase/server";
import type {
  CreateQuotationDraftResult,
  PaymentScheduleMode,
  QuotationDiscountType,
  QuotationDraftDTO,
  QuotationPaymentScheduleMilestoneDTO,
  QuotationSectionDTO,
} from "../contracts/types";
import { quotationErrorFromPostgresMessage } from "./quotation-errors";
import {
  validateAndFormatPaiseInteger,
  validateAndFormatPercentageString,
} from "./quotation-decimal-utils";

export interface QuotationActionResult<T = void> {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly data?: T;
}

/**
 * Reads canonical current DTO without mutating DB.
 * Used for client state refresh and stale lock recovery.
 */
export async function getQuotationDraftAction(
  quotationId: string
): Promise<QuotationActionResult<QuotationDraftDTO>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_quotation_draft", {
      p_quotation_id: quotationId,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const dto = data as unknown as QuotationDraftDTO;

    return {
      success: true,
      message: "Quotation draft fetched successfully.",
      data: dto,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

/**
 * Creates initial quotation draft or new version under existing root.
 */
export async function createQuotationDraftAction(
  leadId: string,
  title: string,
  idempotencyKey: string
): Promise<QuotationActionResult<CreateQuotationDraftResult>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("create_quotation_draft", {
      p_lead_id: leadId,
      p_title: title,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const result = data as unknown as CreateQuotationDraftResult;

    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/crm`);

    return {
      success: true,
      message: result.idempotentReplay
        ? "Replayed previous draft creation request."
        : "Quotation draft created successfully.",
      data: result,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

/**
 * Updates draft header metadata, discount, or tax profile.
 */
export async function updateQuotationDraftAction(
  quotationId: string,
  expectedLockVersion: number,
  params: {
    readonly title?: string;
    readonly scopeSummary?: string;
    readonly discountType?: QuotationDiscountType;
    readonly discountValuePaise?: number;
    readonly discountPercentage?: number | string;
    readonly taxProfileId?: string;
    readonly clearTaxProfile?: boolean;
    readonly termsAndConditions?: string;
    readonly inclusions?: readonly string[];
    readonly exclusions?: readonly string[];
    readonly idempotencyKey?: string;
  }
): Promise<QuotationActionResult<QuotationDraftDTO>> {
  try {
    const supabase = await createClient();

    const discountPctFormatted =
      params.discountPercentage !== undefined && params.discountPercentage !== null
        ? validateAndFormatPercentageString(params.discountPercentage)
        : undefined;

    const discountValFormatted =
      params.discountValuePaise !== undefined && params.discountValuePaise !== null
        ? validateAndFormatPaiseInteger(params.discountValuePaise, "Discount flat amount")
        : undefined;

    const { data, error } = await supabase.rpc("update_quotation_draft", {
      p_quotation_id: quotationId,
      p_expected_lock_version: expectedLockVersion,
      p_title: params.title,
      p_scope_summary: params.scopeSummary,
      p_discount_type: params.discountType,
      p_discount_value_paise: discountValFormatted,
      p_discount_percentage: discountPctFormatted as unknown as number | undefined,
      p_tax_profile_id: params.taxProfileId,
      p_clear_tax_profile: params.clearTaxProfile ?? false,
      p_terms_and_conditions: params.termsAndConditions,
      p_inclusions: params.inclusions ? [...params.inclusions] : undefined,
      p_exclusions: params.exclusions ? [...params.exclusions] : undefined,
      p_idempotency_key: params.idempotencyKey,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const payload = data as Record<string, unknown>;
    const dto = (payload.dto || payload) as QuotationDraftDTO;

    revalidatePath(`/admin/quotations/${quotationId}/draft`);

    return {
      success: true,
      message: "Quotation draft updated successfully.",
      data: dto,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

/**
 * Saves aggregate sections & line items for draft composition.
 * Preserves exact decimal strings for quantity.
 */
export async function saveQuotationDraftItemsAction(
  quotationId: string,
  expectedLockVersion: number,
  sections: readonly QuotationSectionDTO[],
  idempotencyKey?: string
): Promise<QuotationActionResult<QuotationDraftDTO>> {
  try {
    const supabase = await createClient();

    // Basis-aware payload, built by the extracted (and directly tested)
    // boundary builder. This step used to flatten every item to the old
    // generic shape and drop calculationBasis, widthFt and heightFt.
    // The generated Json type wants a mutable, index-signature shape; the
    // builder returns a precise readonly one. Round-tripping keeps the
    // builder strongly typed without loosening it for the RPC call.
    const sanitizedSections = JSON.parse(
      JSON.stringify(buildSaveRoomsPayload(sections))
    ) as unknown as Json;

    const { data, error } = await supabase.rpc("save_quotation_draft_items", {
      p_quotation_id: quotationId,
      p_expected_lock_version: expectedLockVersion,
      p_sections: sanitizedSections,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const payload = data as Record<string, unknown>;
    const dto = (payload.dto || payload) as QuotationDraftDTO;

    revalidatePath(`/admin/quotations/${quotationId}/draft`);

    return {
      success: true,
      message: "Line items saved successfully.",
      data: dto,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

/**
 * Replaces payment schedule milestones.
 * Preserves exact decimal strings for percentage.
 */
export async function replaceQuotationPaymentScheduleAction(
  quotationId: string,
  expectedLockVersion: number,
  mode: PaymentScheduleMode,
  milestones: readonly QuotationPaymentScheduleMilestoneDTO[],
  idempotencyKey?: string
): Promise<QuotationActionResult<QuotationDraftDTO>> {
  try {
    const supabase = await createClient();

    // Map milestones preserving exact decimal string for percentage
    const sanitizedMilestones = milestones.map((m) => ({
      milestoneName: m.milestoneName,
      percentage:
        mode === "percentage" && m.percentage != null
          ? validateAndFormatPercentageString(m.percentage)
          : null,
      amountPaise:
        mode === "amount" && m.amountPaise != null
          ? validateAndFormatPaiseInteger(m.amountPaise, "Milestone amount")
          : null,
    }));

    const { data, error } = await supabase.rpc("replace_quotation_payment_schedule", {
      p_quotation_id: quotationId,
      p_expected_lock_version: expectedLockVersion,
      p_mode: mode,
      p_milestones: sanitizedMilestones,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const payload = data as Record<string, unknown>;
    const dto = (payload.dto || payload) as QuotationDraftDTO;

    revalidatePath(`/admin/quotations/${quotationId}/draft`);

    return {
      success: true,
      message: "Payment schedule updated successfully.",
      data: dto,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}

/**
 * Archives current quotation draft version and root.
 */
export async function archiveQuotationDraftAction(
  quotationId: string,
  expectedLockVersion: number
): Promise<QuotationActionResult<QuotationDraftDTO>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("archive_quotation_draft", {
      p_quotation_id: quotationId,
      p_expected_lock_version: expectedLockVersion,
    });

    if (error) {
      throw quotationErrorFromPostgresMessage(error);
    }

    const payload = data as Record<string, unknown>;
    const dto = (payload.dto || payload) as QuotationDraftDTO;

    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${quotationId}/draft`);

    return {
      success: true,
      message: "Quotation draft archived successfully.",
      data: dto,
    };
  } catch (error) {
    const err = quotationErrorFromPostgresMessage(error);
    return {
      success: false,
      message: err.message,
      code: err.code,
    };
  }
}
