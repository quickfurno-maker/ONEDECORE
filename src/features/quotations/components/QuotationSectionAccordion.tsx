"use client";

import { useState } from "react";
import { formatInrFromPaise, parseQuotationInrToPaiseExact } from "../contracts/money";
import type { QuotationSectionDTO } from "../contracts/types";
import {
  buildValidatedSectionPayload,
  type RawLineItemState,
  type RawSectionState,
} from "../utils/quotation-editor-helpers";

interface QuotationSectionAccordionProps {
  readonly sections: readonly QuotationSectionDTO[];
  readonly onSaveSections: (sections: readonly QuotationSectionDTO[]) => void;
}

function initRawSections(
  sections: readonly QuotationSectionDTO[]
): readonly RawSectionState[] {
  return sections.map((s) => ({
    id: s.id,
    sectionName: s.sectionName,
    displayOrder: s.displayOrder,
    items: s.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      description: item.description,
      specifications: item.specifications,
      rawQuantity: item.quantity != null ? String(item.quantity) : "1",
      unitOfMeasure: item.unitOfMeasure,
      rawUnitRate: item.unitRatePaise != null ? (item.unitRatePaise / 100).toString() : "0",
      displayOrder: item.displayOrder,
    })),
  }));
}

export function QuotationSectionAccordion({
  sections,
  onSaveSections,
}: QuotationSectionAccordionProps) {
  const [rawSections, setRawSections] = useState<readonly RawSectionState[]>(() =>
    initRawSections(sections)
  );
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    0: true,
  });
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync state during render when canonical sections prop changes
  const [prevSections, setPrevSections] = useState(sections);
  if (prevSections !== sections) {
    setPrevSections(sections);
    setRawSections(initRawSections(sections));
    setDirty(false);
    setValidationError(null);
  }

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAddSection = () => {
    const newIdx = rawSections.length;
    setRawSections([
      ...rawSections,
      {
        sectionName: `Section ${newIdx + 1}`,
        displayOrder: newIdx,
        items: [],
      },
    ]);
    setExpandedSections((prev) => ({ ...prev, [newIdx]: true }));
    setDirty(true);
    setValidationError(null);
  };

  const handleRemoveSection = (sIdx: number) => {
    setRawSections(rawSections.filter((_, idx) => idx !== sIdx));
    setDirty(true);
    setValidationError(null);
  };

  const handleSectionNameChange = (sIdx: number, name: string) => {
    const updated = rawSections.map((s, idx) =>
      idx === sIdx ? { ...s, sectionName: name } : s
    );
    setRawSections(updated);
    setDirty(true);
    setValidationError(null);
  };

  const handleAddItem = (sIdx: number) => {
    const updated = rawSections.map((s, idx) => {
      if (idx !== sIdx) return s;
      const newItem: RawLineItemState = {
        itemName: `Item ${s.items.length + 1}`,
        rawQuantity: "1",
        unitOfMeasure: "",
        rawUnitRate: "0",
        displayOrder: s.items.length,
      };
      return { ...s, items: [...s.items, newItem] };
    });
    setRawSections(updated);
    setDirty(true);
    setValidationError(null);
  };

  const handleRemoveItem = (sIdx: number, iIdx: number) => {
    const updated = rawSections.map((s, idx) => {
      if (idx !== sIdx) return s;
      return { ...s, items: s.items.filter((_, itemIdx) => itemIdx !== iIdx) };
    });
    setRawSections(updated);
    setDirty(true);
    setValidationError(null);
  };

  const handleItemChange = (
    sIdx: number,
    iIdx: number,
    field: keyof RawLineItemState,
    val: string
  ) => {
    const updated = rawSections.map((s, idx) => {
      if (idx !== sIdx) return s;
      const items = s.items.map((item, itemIdx) =>
        itemIdx === iIdx ? { ...item, [field]: val } : item
      );
      return { ...s, items };
    });
    setRawSections(updated);
    setDirty(true);
    setValidationError(null);
  };

  const handleSave = () => {
    const res = buildValidatedSectionPayload(rawSections);
    if (!res.success) {
      setValidationError(res.error);
      return;
    }

    setValidationError(null);
    onSaveSections(res.data);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-100">
          Quotation Sections & Line Items
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
            onClick={handleAddSection}
          >
            + Add Section
          </button>
          {dirty && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
              onClick={handleSave}
            >
              Save Layout & Items
            </button>
          )}
        </div>
      </div>

      {validationError && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
          ⚠️ {validationError}
        </div>
      )}

      {rawSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-xs text-neutral-500">
          No sections added yet. Click &quot;Add Section&quot; above to start building the draft.
        </div>
      ) : (
        rawSections.map((sec, sIdx) => {
          const isExpanded = expandedSections[sIdx] ?? false;

          // Section subtotal preview calculation
          const secSubtotal = sec.items.reduce((sum, item) => {
            const qtyNum = Number(item.rawQuantity) || 0;
            const ratePaise = parseQuotationInrToPaiseExact(item.rawUnitRate);
            if (ratePaise === null) return sum;
            return sum + Math.round(qtyNum * ratePaise);
          }, 0);

          return (
            <div
              key={sec.id || `sec-${sIdx}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-900/90">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    className="text-xs font-mono text-neutral-400 hover:text-neutral-200"
                    onClick={() => toggleSection(sIdx)}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                  <input
                    type="text"
                    className="rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-sm font-semibold text-neutral-100 focus:border-emerald-500 focus:outline-none"
                    value={sec.sectionName}
                    onChange={(e) => handleSectionNameChange(sIdx, e.target.value)}
                  />
                  <span className="text-xs font-mono text-neutral-400">
                    ({sec.items.length} items — Subtotal: {formatInrFromPaise(secSubtotal)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-neutral-400 hover:text-emerald-400"
                    onClick={() => handleAddItem(sIdx)}
                  >
                    + Add Item
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-400 hover:underline ml-2"
                    onClick={() => handleRemoveSection(sIdx)}
                  >
                    Remove Section
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 overflow-x-auto">
                  {sec.items.length === 0 ? (
                    <div className="py-4 text-center text-xs text-neutral-500 italic">
                      No items in this section. Click &quot;+ Add Item&quot; to add line items.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-400">
                          <th className="pb-2">Item Name</th>
                          <th className="pb-2 w-28">Qty</th>
                          <th className="pb-2 w-24">UOM</th>
                          <th className="pb-2 w-32">Unit Rate (₹)</th>
                          <th className="pb-2 w-32">Line Total</th>
                          <th className="pb-2 w-16 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {sec.items.map((item, iIdx) => {
                          const ratePaise = parseQuotationInrToPaiseExact(item.rawUnitRate);
                          const qtyNum = Number(item.rawQuantity) || 0;
                          const lineTotalPaise =
                            ratePaise !== null ? Math.round(qtyNum * ratePaise) : null;
                          const isRateInvalid = item.rawUnitRate.trim() !== "" && ratePaise === null;

                          return (
                            <tr key={item.id || `item-${sIdx}-${iIdx}`}>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-neutral-100"
                                  value={item.itemName}
                                  onChange={(e) =>
                                    handleItemChange(sIdx, iIdx, "itemName", e.target.value)
                                  }
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-neutral-100"
                                  value={item.rawQuantity}
                                  onChange={(e) =>
                                    handleItemChange(sIdx, iIdx, "rawQuantity", e.target.value)
                                  }
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-neutral-200"
                                  value={item.unitOfMeasure}
                                  placeholder="sqft, rft, nos"
                                  onChange={(e) =>
                                    handleItemChange(sIdx, iIdx, "unitOfMeasure", e.target.value)
                                  }
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  className={`w-full rounded border px-2 py-1 font-mono text-neutral-100 bg-neutral-950 ${
                                    isRateInvalid ? "border-rose-500 focus:border-rose-500" : "border-neutral-800"
                                  }`}
                                  value={item.rawUnitRate}
                                  onChange={(e) =>
                                    handleItemChange(sIdx, iIdx, "rawUnitRate", e.target.value)
                                  }
                                />
                              </td>
                              <td className="py-2 font-mono text-neutral-300">
                                {lineTotalPaise !== null ? (
                                  formatInrFromPaise(lineTotalPaise)
                                ) : (
                                  <span className="text-rose-400 text-[11px]">Invalid rate</span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  className="text-xs text-rose-400 hover:underline"
                                  onClick={() => handleRemoveItem(sIdx, iIdx)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
