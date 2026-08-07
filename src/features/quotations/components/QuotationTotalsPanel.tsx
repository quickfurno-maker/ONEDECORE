"use client";

import type { QuotationDisplayModel } from "../contracts/display.ts";

interface QuotationTotalsPanelProps {
  readonly model: QuotationDisplayModel;
}

export function QuotationTotalsPanel({ model }: QuotationTotalsPanelProps) {
  return (
    <section
      aria-label="Quotation totals"
      className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4"
    >
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Subtotal</dt>
          <dd className="font-medium text-neutral-50">{model.subtotalLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Discount</dt>
          <dd className="font-medium text-neutral-50">{model.discountLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Taxable base</dt>
          <dd className="font-medium text-neutral-50">{model.taxableBaseLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">GST</dt>
          <dd className="font-medium text-neutral-50">{model.taxLabel}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-neutral-700 pt-2 text-base">
          <dt className="font-semibold text-neutral-100">Grand total</dt>
          <dd className="font-semibold text-amber-300">{model.grandTotalLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
