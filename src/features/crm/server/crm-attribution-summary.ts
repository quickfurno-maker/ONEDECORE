import type { Json } from "@/types/database.generated";

export function formatMarketingTouchSummary(attribution: Json | null): string | null {
  if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
    return null;
  }

  const record = attribution as Record<string, unknown>;
  const parts: string[] = [];

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "referrer"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}: ${value.trim()}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
