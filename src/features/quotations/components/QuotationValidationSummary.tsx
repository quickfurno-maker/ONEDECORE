"use client";

import type { QuotationValidationResult } from "../contracts/validation.ts";

interface QuotationValidationSummaryProps {
  readonly validation: QuotationValidationResult;
}

export function QuotationValidationSummary({
  validation,
}: QuotationValidationSummaryProps) {
  if (validation.ok) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-red-800/60 bg-red-950/40 p-4"
      role="alert"
      aria-live="polite"
    >
      <h3 className="text-sm font-semibold text-red-200">Fix quotation issues</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-100">
        {validation.errors.map((error) => (
          <li key={`${error.code}-${error.field ?? "global"}`}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}
