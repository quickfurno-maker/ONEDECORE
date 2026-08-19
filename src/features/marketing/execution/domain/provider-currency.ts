export const CAMPAIGN_PROVIDER_CURRENCY_MISMATCH = "CAMPAIGN_PROVIDER_CURRENCY_MISMATCH";

const CURRENCY = /^[A-Z]{3}$/;

export function normalizeProviderCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!CURRENCY.test(code)) return null;
  return code;
}

export function requireMatchingProviderCurrency(
  accountCurrency: string | null,
  approvedCurrency: string
): { readonly ok: true; readonly currency: string } | { readonly ok: false; readonly code: string } {
  const account = normalizeProviderCurrencyCode(accountCurrency);
  const approved = normalizeProviderCurrencyCode(approvedCurrency);
  if (!account || !approved || account !== approved) {
    return { ok: false, code: CAMPAIGN_PROVIDER_CURRENCY_MISMATCH };
  }
  return { ok: true, currency: account };
}
