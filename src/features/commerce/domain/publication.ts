/**
 * Commerce product publication readiness (mirrors publish_commerce_product):
 * - Product name trimmed length is between 2 and 200.
 * - Active category exists.
 * - At least one active variant with valid option_values and selling_price_paise >= 0 (integer paise).
 * - If tax_required_for_publish: tax_rate_id is set and the tax rate is active.
 * - At least one active primary media row with a non-empty public_path.
 * Public /shop remains disabled in this phase; readiness only gates catalogue publish RPCs.
 */

export interface CommercePublicationReadinessInput {
  readonly name: string;
  readonly categoryStatus: string | null;
  readonly hasActivePricedVariant: boolean;
  readonly taxRequiredForPublish: boolean;
  readonly hasActiveTaxRate: boolean;
  readonly hasActivePrimaryMedia: boolean;
}

export function isPublicationReady(input: CommercePublicationReadinessInput): boolean {
  const nameOk = input.name.trim().length >= 2 && input.name.trim().length <= 200;
  const categoryOk = input.categoryStatus === "active";
  const taxOk = !input.taxRequiredForPublish || input.hasActiveTaxRate;
  return nameOk && categoryOk && input.hasActivePricedVariant && taxOk && input.hasActivePrimaryMedia;
}
