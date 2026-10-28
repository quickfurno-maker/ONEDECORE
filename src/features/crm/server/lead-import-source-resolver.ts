import "server-only";

import type { CrmLeadSourceOption } from "../contracts/lead-detail-dtos.ts";
import type { LeadImportParsedRow } from "../contracts/lead-import-contracts.ts";
import { CrmError } from "./crm-errors.ts";

/** Resolve an Excel source NAME or CODE to its verified ACTIVE CRM source ID.
 * Blank Source uses the selected batch default; never creates sources silently.
 */
function canonical(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function resolveMappedImportSources(
  rows: readonly LeadImportParsedRow[],
  sources: readonly CrmLeadSourceOption[],
  defaultSourceId: string | null
): LeadImportParsedRow[] {
  if (defaultSourceId && !sources.some((source) => source.id === defaultSourceId)) {
    throw new CrmError({
      code: "INACTIVE_SOURCE",
      message: "Choose an active default source before uploading.",
      httpStatus: 422,
    });
  }
  const lookup = new Map<string, Set<string>>();
  for (const source of sources) {
    for (const value of [source.code, source.displayName, source.id]) {
      const key = canonical(value);
      const candidates = lookup.get(key) ?? new Set<string>();
      candidates.add(source.id);
      lookup.set(key, candidates);
    }
  }
  return rows.map((row) => {
    const supplied = row.primarySourceId?.trim() ?? "";
    if (!supplied) {
      if (!defaultSourceId) throw new CrmError({
        code: "INACTIVE_SOURCE",
        message: "Excel row " + (row.rowNumber + 1) + ": choose an active default source.",
        httpStatus: 422,
      });
      return { ...row, primarySourceId: defaultSourceId };
    }
    // Exact stable codes and IDs always win over fuzzy display-name collisions.
    const exact = sources.find((source) =>
      source.code.toLowerCase() === supplied.toLowerCase() || source.id === supplied
    );
    if (exact) return { ...row, primarySourceId: exact.id };
    const candidates = lookup.get(canonical(supplied));
    if (!candidates || candidates.size === 0) {
      throw new CrmError({
        code: "INACTIVE_SOURCE",
        message: "Excel row " + (row.rowNumber + 1) + ": Source '" + supplied +
          "' is not active in CRM. Use Add Source, then upload again.",
        httpStatus: 422,
      });
    }
    if (candidates.size !== 1) {
      throw new CrmError({
        code: "INACTIVE_SOURCE",
        message: "Excel row " + (row.rowNumber + 1) +
          ": Source '" + supplied + "' is ambiguous. Use its exact CRM source code.",
        httpStatus: 422,
      });
    }
    return { ...row, primarySourceId: [...candidates][0] };
  });
}
