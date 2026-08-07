"use client";

import type { QuotationDisplayModel } from "../contracts/display.ts";
import { QuotationRevisionBanner } from "./QuotationRevisionBanner.tsx";
import { QuotationTotalsPanel } from "./QuotationTotalsPanel.tsx";

interface ClientQuotationViewProps {
  readonly model: QuotationDisplayModel;
  readonly termsText: string;
}

export function ClientQuotationView({ model, termsText }: ClientQuotationViewProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-neutral-700 bg-neutral-950 p-6">
      <QuotationRevisionBanner
        revision={model.revision}
        lifecycleState={model.lifecycleState}
        banner={model.stateBanner}
      />
      <header>
        <p className="text-sm text-neutral-400">Prepared for</p>
        <h1 className="text-2xl font-semibold text-neutral-50">{model.clientName}</h1>
        {model.projectLabel ? (
          <p className="mt-1 text-sm text-neutral-300">{model.projectLabel}</p>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label="Client quotation line items">
          <thead>
            <tr className="border-b border-neutral-700 text-left text-neutral-400">
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Qty</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {model.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-neutral-800">
                <td className="py-3 pr-3 text-neutral-100">{item.description}</td>
                <td className="py-3 pr-3 text-neutral-300">
                  {item.quantityLabel} {item.unit}
                </td>
                <td className="py-3 text-right text-neutral-100">{item.subtotalLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <QuotationTotalsPanel model={model} />
      <section aria-label="Quotation terms">
        <h2 className="text-sm font-semibold text-neutral-200">Terms</h2>
        <p className="mt-2 text-sm text-neutral-300">{termsText}</p>
      </section>
    </article>
  );
}
