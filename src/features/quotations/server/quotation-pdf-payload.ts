import "server-only";

import type { PDFGeneratorData } from "./quotation-pdf-generator.ts";

/**
 * Assembles the frozen payload a finalized quotation PDF is rendered from.
 *
 * This is the ONE builder. Finalization and the on-demand Ensure/Retry action
 * both use it, so the document produced the instant a quotation is finalized
 * and the one produced by a later retry are byte-identical for identical
 * finalized state. Two assemblies would drift, and a READY artifact is
 * immutable — the first, wrong document would have been permanent.
 *
 * IT FAILS CLOSED. Every read is required. A query error used to become an
 * empty room list or an empty payment schedule, and the caller would happily
 * render and upload that as a READY document showing no work and no milestones.
 * Every failure now throws before anything is rendered or uploaded.
 *
 * IT USES ONLY FROZEN DATA. The tax display name comes from the version's
 * `tax_profile_snapshot`, never from a join on the live tax-profile table —
 * renaming a tax profile must not change what a finalized document says.
 */

export class QuotationPdfPayloadError extends Error {
  constructor(message: string) {
    super(`QUOTATION_PDF_PAYLOAD: ${message}`);
    this.name = "QuotationPdfPayloadError";
  }
}

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

type QueryResult = { data: unknown; error: { message: string } | null };

export type QuotationPdfPayloadClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => PromiseLike<QueryResult>;
        single: () => Promise<QueryResult>;
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
 * area = width x height, to 3 decimals — derived exactly as the database
 * derives it, so the printed area can never disagree with the printed
 * dimensions beside it.
 */
function deriveAreaSqFt(width: number | null, height: number | null): number | null {
  if (width == null || height == null) {
    return null;
  }
  return Math.round(width * height * 1000) / 1000;
}

export async function buildQuotationPdfData(
  client: QuotationPdfPayloadClient,
  params: { readonly quotationId: string; readonly versionId: string }
): Promise<PDFGeneratorData> {
  const { data: versionData, error: versionError } = await client
    .from("quotation_versions")
    .select("*")
    .eq("id", params.versionId)
    .single();

  if (versionError) {
    throw new QuotationPdfPayloadError(
      `finalized version could not be read: ${versionError.message}`
    );
  }
  if (!versionData) {
    throw new QuotationPdfPayloadError("finalized version not found");
  }

  const version = versionData as Record<string, unknown>;

  if (version.status !== "finalized") {
    throw new QuotationPdfPayloadError(
      "only a finalized version has a document to render"
    );
  }

  // IDENTITY. The quotation is taken from the PERSISTED version -> quotation
  // relation, never from the caller's parameter. A caller that pairs a version
  // with someone else's quotation id is refused rather than silently believed.
  const persistedQuotationId = String(version.quotation_id ?? "");
  if (!persistedQuotationId) {
    throw new QuotationPdfPayloadError("version carries no quotation relation");
  }
  if (params.quotationId && params.quotationId !== persistedQuotationId) {
    throw new QuotationPdfPayloadError(
      "quotation id does not belong to this quotation version"
    );
  }

  const finalizedAt = version.finalized_at ? String(version.finalized_at) : "";
  if (!finalizedAt) {
    throw new QuotationPdfPayloadError("finalized version has no finalized_at");
  }

  const { data: quotationData, error: quotationError } = await client
    .from("quotations")
    .select("id, quotation_number, lead_id")
    .eq("id", persistedQuotationId)
    .single();

  if (quotationError) {
    throw new QuotationPdfPayloadError(
      `quotation could not be read: ${quotationError.message}`
    );
  }
  if (!quotationData) {
    throw new QuotationPdfPayloadError("quotation not found");
  }

  const quotation = quotationData as { quotation_number?: string };
  if (!quotation.quotation_number) {
    throw new QuotationPdfPayloadError("quotation has no quotation number");
  }

  const { data: sectionRows, error: sectionsError } = await client
    .from("quotation_sections")
    .select("*, quotation_items(*)")
    .eq("quotation_version_id", params.versionId)
    .order("display_order", { ascending: true });

  if (sectionsError) {
    throw new QuotationPdfPayloadError(
      `rooms could not be read: ${sectionsError.message}`
    );
  }
  if (!Array.isArray(sectionRows)) {
    throw new QuotationPdfPayloadError("rooms could not be read");
  }

  const { data: scheduleRows, error: schedulesError } = await client
    .from("quotation_payment_schedules")
    .select("*")
    .eq("quotation_version_id", params.versionId)
    .order("milestone_order", { ascending: true });

  if (schedulesError) {
    throw new QuotationPdfPayloadError(
      `payment schedule could not be read: ${schedulesError.message}`
    );
  }
  if (!Array.isArray(scheduleRows)) {
    throw new QuotationPdfPayloadError("payment schedule could not be read");
  }

  const sections = (sectionRows as SectionRow[]).map((sec) => {
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

  const payment_schedule = (scheduleRows as ScheduleRow[]).map((ms) => ({
    milestone_name: ms.milestone_name,
    percentage: ms.percentage != null ? toNumber(ms.percentage) : undefined,
    amount_paise: toNumber(ms.amount_paise),
  }));

  // FROZEN tax identity, from the version's own snapshot.
  const taxSnapshot = (version.tax_profile_snapshot ?? null) as {
    display_name?: string;
  } | null;

  const termsRaw = version.terms_and_conditions;

  return {
    quotation_id: persistedQuotationId,
    quotation_version_id: params.versionId,
    quotation_number: String(quotation.quotation_number),
    version_number: Number(version.version_number ?? 0),
    finalized_at: finalizedAt,
    title: version.title ? String(version.title) : undefined,
    scope_summary: version.scope_summary ? String(version.scope_summary) : undefined,
    client_name: String(version.client_name_snapshot ?? "Valued Client"),
    client_phone: String(version.client_phone_snapshot ?? ""),
    client_email: version.client_email_snapshot
      ? String(version.client_email_snapshot)
      : undefined,
    property_address: version.property_address_snapshot
      ? String(version.property_address_snapshot)
      : undefined,
    property_details: {},
    sections,
    subtotal_paise: toNumber(version.subtotal_paise as string | number | null),
    discount_paise: toNumber(version.discount_total_paise as string | number | null),
    taxable_base_paise: toNumber(version.taxable_base_paise as string | number | null),
    tax_total_paise: toNumber(version.tax_total_paise as string | number | null),
    grand_total_paise: toNumber(version.grand_total_paise as string | number | null),
    tax_profile_name: taxSnapshot?.display_name || "Tax",
    tax_rate_percentage: toNumber(version.tax_rate_percentage as string | number | null),
    payment_schedule,
    inclusions: (version.inclusions as string[] | null) ?? [],
    exclusions: (version.exclusions as string[] | null) ?? [],
    terms_and_conditions: Array.isArray(termsRaw)
      ? (termsRaw as string[])
      : termsRaw
        ? [String(termsRaw)]
        : [],
  };
}
