export type LeadFormMode = "copy-only" | "preview" | "active";

const VALID_MODES = new Set<LeadFormMode>(["copy-only", "preview", "active"]);

/**
 * Reads NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE.
 * Defaults to copy-only when missing or invalid.
 */
export function getLeadFormMode(
  env: Record<string, string | undefined> = process.env
): LeadFormMode {
  const raw = env.NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE?.trim().toLowerCase();
  if (raw && VALID_MODES.has(raw as LeadFormMode)) {
    return raw as LeadFormMode;
  }
  return "copy-only";
}
