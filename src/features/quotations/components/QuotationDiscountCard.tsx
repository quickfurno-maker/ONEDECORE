"use client";

import type { QuotationDiscountType, QuotationVersionDTO } from "../contracts/types";
import { parseInrToPaise } from "@/features/crm/contracts/sales-target-contracts";

interface QuotationDiscountCardProps {
  readonly version: QuotationVersionDTO;
  readonly onUpdateDiscount: (
    discountType: QuotationDiscountType,
    discountValuePaise: number,
    discountPercentage: number
  ) => void;
}

export function QuotationDiscountCard({
  version,
  onUpdateDiscount,
}: QuotationDiscountCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-100 border-b border-neutral-800 pb-3">
        Quotation-Level Discount
      </h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-neutral-300">Discount Type</label>
          <select
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={version.discountType}
            onChange={(e) => {
              const type = e.target.value as QuotationDiscountType;
              onUpdateDiscount(type, 0, 0);
            }}
          >
            <option value="none">None (0%)</option>
            <option value="flat">Flat Amount (INR)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>

        {version.discountType === "flat" && (
          <div>
            <label className="block text-xs font-medium text-neutral-300">Flat Discount (INR ₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
              value={version.discountValuePaise / 100}
              onChange={(e) => {
                const paise = parseInrToPaise(e.target.value) ?? 0;
                onUpdateDiscount("flat", paise, 0);
              }}
            />
          </div>
        )}

        {version.discountType === "percentage" && (
          <div>
            <label className="block text-xs font-medium text-neutral-300">Discount Percentage (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
              value={version.discountPercentage}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                onUpdateDiscount("percentage", 0, pct);
              }}
            />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Note: Per DEC-0056 & ADR-0022, V1 direct sales executive authority applies. No manager override path or approval workflow exists. Hard discount validation bounds are evaluated on server during Phase 7B finalization.
      </p>
    </div>
  );
}
