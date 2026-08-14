import crypto from 'node:crypto';

export interface CanonicalQuotationPayload {
  quotation_number: string;
  version_number: number;
  property_details: Record<string, unknown>;
  sections: Array<{
    section_name: string;
    section_order: number;
    section_subtotal_paise: number;
    items: Array<{
      item_name: string;
      description?: string;
      quantity: number;
      uom: string;
      unit_rate_paise: number;
      line_total_paise: number;
      item_order: number;
    }>;
  }>;
  subtotal_paise: number;
  discount_mode: string;
  discount_percentage?: number;
  discount_flat_paise?: number;
  discount_paise: number;
  taxable_base_paise: number;
  tax_profile: {
    id: string;
    display_name: string;
    tax_rate_percentage: number;
  };
  tax_total_paise: number;
  grand_total_paise: number;
  payment_schedule: Array<{
    milestone_name: string;
    milestone_order: number;
    percentage?: number;
    amount_paise: number;
  }>;
  inclusions: string[];
  exclusions: string[];
  terms_and_conditions: string[];
}

/**
 * Computes a deterministic SHA-256 hash over the canonical JSON serialization
 * of a frozen quotation version's commercial payload.
 */
export function computeCanonicalQuotationHash(payload: CanonicalQuotationPayload): string {
  const canonicalObject = {
    hn: 'odq-content-v1',
    qn: payload.quotation_number,
    vn: payload.version_number,
    pd: payload.property_details,
    sc: payload.sections.map((s) => ({
      sn: s.section_name,
      so: s.section_order,
      st: s.section_subtotal_paise,
      it: s.items.map((i) => ({
        in: i.item_name,
        ds: i.description || '',
        qt: i.quantity,
        um: i.uom,
        ur: i.unit_rate_paise,
        lt: i.line_total_paise,
        io: i.item_order,
      })),
    })),
    sb: payload.subtotal_paise,
    dm: payload.discount_mode,
    dp: payload.discount_percentage || 0,
    df: payload.discount_flat_paise || 0,
    dc: payload.discount_paise,
    tb: payload.taxable_base_paise,
    tp: {
      id: payload.tax_profile.id,
      dn: payload.tax_profile.display_name,
      tr: payload.tax_profile.tax_rate_percentage,
    },
    tt: payload.tax_total_paise,
    gt: payload.grand_total_paise,
    ps: payload.payment_schedule.map((p) => ({
      mn: p.milestone_name,
      mo: p.milestone_order,
      pc: p.percentage || 0,
      am: p.amount_paise,
    })),
    inc: payload.inclusions,
    exc: payload.exclusions,
    trm: payload.terms_and_conditions,
  };

  const canonicalJson = JSON.stringify(canonicalObject);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}
