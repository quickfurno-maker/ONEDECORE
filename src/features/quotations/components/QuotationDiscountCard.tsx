"use client";

import { useState } from "react";
import type { QuotationDiscountType, QuotationVersionDTO } from "../contracts/types";
import {
  validateFlatDiscountInput,
  validatePercentageDiscountInput,
} from "../utils/quotation-editor-helpers";

interface QuotationDiscountCardProps {
  readonly version: QuotationVersionDTO;
  readonly onUpdateDiscount: (
    discountType: QuotationDiscountType,
    discountValuePaise: number,
    discountPercentage: number | string
  ) => void;
}

export function QuotationDiscountCard({
  version,
  onUpdateDiscount,
}: QuotationDiscountCardProps) {
  const [discountType, setDiscountType] = useState<QuotationDiscountType>(
    version.discountType || "none"
  );
  const [rawFlatDiscount, setRawFlatDiscount] = useState<string>(() =>
    version.discountValuePaise != null ? (version.discountValuePaise / 100).toString() : "0"
  );
  const [rawPercentageDiscount, setRawPercentageDiscount] = useState<string>(() =>
    version.discountPercentage != null ? String(version.discountPercentage) : "0"
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync state during render when canonical version prop changes
  const [prevVersionKey, setPrevVersionKey] = useState<string>(
    `${version.discountType}-${version.discountValuePaise}-${version.discountPercentage}`
  );
  const currentVersionKey = `${version.discountType}-${version.discountValuePaise}-${version.discountPercentage}`;

  if (prevVersionKey !== currentVersionKey) {
    setPrevVersionKey(currentVersionKey);
    setDiscountType(version.discountType || "none");
    setRawFlatDiscount(
      version.discountValuePaise != null ? (version.discountValuePaise / 100).toString() : "0"
    );
    setRawPercentageDiscount(
      version.discountPercentage != null ? String(version.discountPercentage) : "0"
    );
    setValidationError(null);
  }

  const handleTypeChange = (newType: QuotationDiscountType) => {
    setDiscountType(newType);
    setValidationError(null);

    if (newType === "none") {
      onUpdateDiscount("none", 0, 0);
    }
  };

  const handleApplyDiscount = () => {
    if (discountType === "none") {
      setValidationError(null);
      onUpdateDiscount("none", 0, 0);
      return;
    }

    if (discountType === "flat") {
      const res = validateFlatDiscountInput(rawFlatDiscount);
      if (!res.success) {
        setValidationError(res.error);
        return;
      }
      setValidationError(null);
      onUpdateDiscount("flat", res.data, 0);
      return;
    }

    if (discountType === "percentage") {
      const res = validatePercentageDiscountInput(rawPercentageDiscount);
      if (!res.success) {
        setValidationError(res.error);
        return;
      }
      setValidationError(null);
      onUpdateDiscount("percentage", 0, res.data);
      return;
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <h3 className="text-base font-semibold text-neutral-100">
          Quotation-Level Discount
        </h3>
        {discountType !== "none" && (
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
            onClick={handleApplyDiscount}
          >
            Apply Discount
          </button>
        )}
      </div>

      {validationError && (
        <div className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
          ⚠️ {validationError}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-neutral-300">Discount Type</label>
          <select
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={discountType}
            onChange={(e) => handleTypeChange(e.target.value as QuotationDiscountType)}
          >
            <option value="none">None (0%)</option>
            <option value="flat">Flat Amount (INR)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>

        {discountType === "flat" && (
          <div>
            <label className="block text-xs font-medium text-neutral-300">Flat Discount (INR ₹)</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
              value={rawFlatDiscount}
              onChange={(e) => {
                setRawFlatDiscount(e.target.value);
                setValidationError(null);
              }}
            />
          </div>
        )}

        {discountType === "percentage" && (
          <div>
            <label className="block text-xs font-medium text-neutral-300">Discount Percentage (%)</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
              value={rawPercentageDiscount}
              onChange={(e) => {
                setRawPercentageDiscount(e.target.value);
                setValidationError(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
