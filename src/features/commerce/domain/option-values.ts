export const COMMERCE_OPTION_KEYS = ["color", "finish", "size", "upholstery"] as const;
export type CommerceOptionKey = (typeof COMMERCE_OPTION_KEYS)[number];

const OPTION_KEY_SET = new Set<string>(COMMERCE_OPTION_KEYS);

/**
 * Validates variant option_values. Empty object is valid.
 * Keys may only be color, finish, size, or upholstery; values are strings of length 1–64.
 */
export function validateOptionValues(value: unknown): string | null {
  if (value === null || value === undefined) {
    return "option_values must be an object.";
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return "option_values must be a JSON object.";
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!OPTION_KEY_SET.has(key)) {
      return "option_values keys may only be color, finish, size, or upholstery.";
    }
    if (typeof entry !== "string") {
      return `option_values.${key} must be a string.`;
    }
    if (entry.length < 1 || entry.length > 64) {
      return `option_values.${key} must be between 1 and 64 characters.`;
    }
    if (/[\u0000-\u001F\u007F]/.test(entry)) {
      return `option_values.${key} must not contain control characters.`;
    }
  }
  return null;
}

/** Whole-number paise only — commerce money is never a float. */
export function parsePaiseInteger(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw)) return null;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}
