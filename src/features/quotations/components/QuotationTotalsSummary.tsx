"use client";

import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { QuotationVersionDTO } from "../contracts/types";

interface QuotationTotalsSummaryProps {
  readonly version: QuotationVersionDTO;
}

export function QuotationTotalsSummary({ version }: QuotationTotalsSummaryProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-100 border-b border-neutral-800 pb-3">
        Commercial Summary
      </h3>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between text-neutral-300">
          <span>Subtotal (Line Items)</span>
          <span className="font-mono font-medium">{formatInrFromPaise(version.subtotalPaise)}</span>
        </div>

        <div className="flex justify-between text-neutral-300">
          <span>
            Discount ({version.discountType})
            {version.discountType === "percentage" && ` @ ${version.discountPercentage}%`}
          </span>
          <span className="font-mono text-rose-400 font-medium">
            -{formatInrFromPaise(version.discountTotalPaise)}
          </span>
        </div>

        {/* Sales Achievement Basis */}
        <div className="flex justify-between border-t border-b border-neutral-800/80 py-2.5 my-2 bg-emerald-950/20 px-2 rounded">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-400">Taxable Base</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-900/80 text-emerald-300 rounded">
              Achievement Basis (DEC-0056)
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-400">
            {formatInrFromPaise(version.taxableBasePaise)}
          </span>
        </div>

        <div className="flex justify-between text-neutral-300">
          <span>
            GST / Tax
            {version.taxRatePercentage != null
              ? ` (${version.taxRatePercentage}%)`
              : " (Unconfigured)"}
          </span>
          <span className="font-mono font-medium">
            {version.taxTotalPaise != null
              ? formatInrFromPaise(version.taxTotalPaise)
              : "N/A"}
          </span>
        </div>

        <div className="flex justify-between pt-3 border-t border-neutral-800 text-base font-bold text-neutral-100">
          <span>Grand Total Payable</span>
          <span className="font-mono text-emerald-400">
            {version.grandTotalPaise != null
              ? formatInrFromPaise(version.grandTotalPaise)
              : "Commercially Incomplete"}
          </span>
        </div>
      </div>
    </div>
  );
}
