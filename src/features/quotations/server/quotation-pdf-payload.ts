import "server-only";

import type { PDFGeneratorData } from "./quotation-pdf-generator.ts";

/**
 * Assembles the frozen payload a finalized quotation PDF is rendered from.
 *
 * Shared by finalization and by the on-demand Ensure/Retry action so the two
 * cannot drift: a retry must reproduce byte-identical output, which it only
 * can if it reads exactly the same fields in exactly the same order.
 *
 * Everything here is read from the FINALIZED version, so the result is a
 * function of stored state alone — no clock, no request context.
 */

interface ItemRow {
  readonly item_name: string;
  readonly description: string | null;
  readonly specifications: string | null;
  readonly calculation_basis: string | null;
  readonly width_ft: string | number | null;
  readonly height_ft: string | number | null;
  readonly quantity: string | number;
  readonly unit_of_measure: string;
  readonly unit_rate_paise: string | number;
  readonly line_total_paise: string | number;
  readonly display_order: number;
}

interface SectionRow {
  readonly section_name: string;
  readonly subtotal_paise: string | number | null;
  readonly display_order: number;
  readonly quotation_items: readonly ItemRow[] | null;
}

interface ScheduleRow {
  readonly milestone_name: string;
  readonly percentage: string | number | null;
  readonly amount_paise: string | number | null;
}

export type QuotationPdfPayloadClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean }
        ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

function toNumber(value: string | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string | number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * area = width x height, to 3 decimals.
 *
 * Derived rather than read, exactly as the database derives it, so the printed
 * area can never disagree with the printed dimensions beside it.
 */
function deriveAreaSqFt(
  width: number | null,
  height: number | null
): number | null {
  if (width == null || height == null) {
    return null;
  }
  return Math.round(width * height * 1000) / 1000;
}

export async function buildQuotationPdfData(
  client: QuotationPdfPayloadClient,
  params: { readonly quotationId: string; readonly versionId: string }
): Promise<PDFGeneratorData | null> {
  const { data: versionData } = await client
    .from("quotation_versions")
    .select(
      `*, quotations!inner(quotation_number, lead_id), tax_profile:quotation_tax_profiles(display_name, rate_percentage)`
    )
    .eq("id", params.versionId)
    .single();

  if (!versionData) {
    return null;
  }

  const version = versionData as Record<string, unknown> & {
    quotations?: { quotation_number?: string } | null;
    tax_profile?: { display_name?: string } | null;
  };

  const { data: sectionRows } = await client
    .from("quotation_sections")
    .select("*, quotation_items(*)")
    .eq("quotation_version_id", params.versionId)
    .order("display_order", { ascending: true });

  const { data: scheduleRows } = await client
    .from("quotation_payment_schedules")
    .select("*")
    .eq("quotation_version_id", params.versionId)
    .order("milestone_order", { ascending: true });

  const sections = ((sectionRows as SectionRow[] | null) ?? []).map((sec) => {
    const items = [...(sec.quotation_items ?? [])].sort(
      (a, b) => a.display_order - b.display_order
    );

    let areaSubtotal = 0;

    const mapped = items.map((item) => {
      const basis = (item.calculation_basis ?? "quantity") as
        | "area"
        | "quantity"
        | "fixed";
      const width = toOptionalNumber(item.width_ft);
      const height = toOptionalNumber(item.height_ft);
      const area = basis === "area" ? deriveAreaSqFt(width, height) : null;

      if (area != null) {
        areaSubtotal += area;
      }

      return {
        item_name: item.item_name,
        description: item.description || undefined,
        specifications: item.specifications || undefined,
        calculation_basis: basis,
        width_ft: width,
        height_ft: height,
        area_sqft: area,
        quantity: toNumber(item.quantity),
        uom: item.unit_of_measure,
        unit_rate_paise: toNumber(item.unit_rate_paise),
        line_total_paise: toNumber(item.line_total_paise),
      };
    });

    return {
      section_name: sec.section_name,
      section_subtotal_paise: toNumber(sec.subtotal_paise),
      area_subtotal_sqft: Math.round(areaSubtotal * 1000) / 1000,
      items: mapped,
    };
  });

  const payment_schedule = ((scheduleRows as ScheduleRow[] | null) ?? []).map((ms) => ({
    milestone_name: ms.milestone_name,
    percentage: ms.percentage != null ? toNumber(ms.percentage) : undefined,
    amount_paise: toNumber(ms.amount_paise),
  }));

  return {
    quotation_id: params.quotationId,
    quotation_version_id: params.versionId,
    quotation_number: version.quotations?.quotation_number || "OD-Q",
    version_number: Number(version.version_number ?? 0),
    finalized_at: String(version.finalized_at ?? ""),
    client_name: String(version.client_name_snapshot ?? "Valued Client"),
    client_phone: String(version.client_phone_snapshot ?? ""),
    property_details: {},
    sections,
    subtotal_paise: toNumber(version.subtotal_paise as string | number | null),
    discount_paise: toNumber(version.discount_total_paise as string | number | null),
    taxable_base_paise: toNumber(version.taxable_base_paise as string | number | null),
    tax_total_paise: toNumber(version.tax_total_paise as string | number | null),
    grand_total_paise: toNumber(version.grand_total_paise as string | number | null),
    tax_profile_name: version.tax_profile?.display_name || "GST",
    tax_rate_percentage: toNumber(version.tax_rate_percentage as string | number | null),
    payment_schedule,
    inclusions: (version.inclusions as string[] | null) ?? [],
    exclusions: (version.exclusions as string[] | null) ?? [],
    terms_and_conditions: version.terms_and_conditions
      ? [String(version.terms_and_conditions)]
      : [],
  };
}
