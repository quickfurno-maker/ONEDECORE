"use client";

import { useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { QuotationLineItemDTO, QuotationSectionDTO } from "../contracts/types";

interface QuotationSectionAccordionProps {
  readonly sections: readonly QuotationSectionDTO[];
  readonly onSaveSections: (sections: readonly QuotationSectionDTO[]) => void;
}

export function QuotationSectionAccordion({
  sections,
  onSaveSections,
}: QuotationSectionAccordionProps) {
  const [localSections, setLocalSections] = useState<readonly QuotationSectionDTO[]>(sections);
  const [editing, setEditing] = useState(false);

  const handleAddSection = () => {
    const newSec: QuotationSectionDTO = {
      sectionName: `Section ${localSections.length + 1}`,
      displayOrder: localSections.length,
      subtotalPaise: 0,
      items: [],
    };
    setLocalSections([...localSections, newSec]);
    setEditing(true);
  };

  const handleRemoveSection = (secIndex: number) => {
    const updated = localSections.filter((_, idx) => idx !== secIndex);
    setLocalSections(updated);
    setEditing(true);
  };

  const handleSectionNameChange = (secIndex: number, name: string) => {
    const updated = localSections.map((sec, idx) =>
      idx === secIndex ? { ...sec, sectionName: name } : sec
    );
    setLocalSections(updated);
    setEditing(true);
  };

  const handleAddItem = (secIndex: number) => {
    const newItem: QuotationLineItemDTO = {
      itemName: "New Line Item",
      description: "",
      specifications: "",
      quantity: 1,
      unitOfMeasure: "nos",
      unitRatePaise: 100000,
    };

    const updated = localSections.map((sec, idx) => {
      if (idx !== secIndex) return sec;
      return {
        ...sec,
        items: [...sec.items, newItem],
      };
    });
    setLocalSections(updated);
    setEditing(true);
  };

  const handleRemoveItem = (secIndex: number, itemIndex: number) => {
    const updated = localSections.map((sec, idx) => {
      if (idx !== secIndex) return sec;
      return {
        ...sec,
        items: sec.items.filter((_, iIdx) => iIdx !== itemIndex),
      };
    });
    setLocalSections(updated);
    setEditing(true);
  };

  const handleItemChange = (
    secIndex: number,
    itemIndex: number,
    field: keyof QuotationLineItemDTO,
    val: unknown
  ) => {
    const updated = localSections.map((sec, idx) => {
      if (idx !== secIndex) return sec;
      const updatedItems = sec.items.map((item, iIdx) => {
        if (iIdx !== itemIndex) return item;
        return { ...item, [field]: val };
      });
      return { ...sec, items: updatedItems };
    });
    setLocalSections(updated);
    setEditing(true);
  };

  const handleSave = () => {
    onSaveSections(localSections);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-100">Room / Section Layout & Items</h3>
          <p className="text-xs text-neutral-400">
            Organize proposal into room sections (e.g. Living Room, Master Bedroom, Kitchen) with line items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
            onClick={handleAddSection}
          >
            + Add Section
          </button>
          {editing && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
              onClick={handleSave}
            >
              Save Line Items
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {localSections.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No sections added yet. Click &quot;+ Add Section&quot; to begin building proposal line items.
          </div>
        ) : (
          localSections.map((sec, sIdx) => (
            <div key={sec.id || `sec-${sIdx}`} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    className="rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-sm font-semibold text-neutral-100 focus:border-emerald-500 focus:outline-none"
                    value={sec.sectionName}
                    onChange={(e) => handleSectionNameChange(sIdx, e.target.value)}
                  />
                  {sec.subtotalPaise != null && sec.subtotalPaise > 0 && (
                    <span className="text-xs font-mono font-medium text-emerald-400">
                      Subtotal: {formatInrFromPaise(sec.subtotalPaise)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={() => handleAddItem(sIdx)}
                  >
                    + Add Item
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-400 hover:underline"
                    onClick={() => handleRemoveSection(sIdx)}
                  >
                    Remove Section
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400">
                      <th className="pb-2">Item Name</th>
                      <th className="pb-2">Description / Specs</th>
                      <th className="pb-2 w-20">Qty</th>
                      <th className="pb-2 w-24">UOM</th>
                      <th className="pb-2 w-28">Rate (₹)</th>
                      <th className="pb-2 w-28 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {sec.items.map((item, iIdx) => (
                      <tr key={item.id || `item-${sIdx}-${iIdx}`}>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-100"
                            value={item.itemName}
                            onChange={(e) => handleItemChange(sIdx, iIdx, "itemName", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-400"
                            value={item.description || ""}
                            placeholder="Details / specs..."
                            onChange={(e) => handleItemChange(sIdx, iIdx, "description", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-neutral-100"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(sIdx, iIdx, "quantity", parseFloat(e.target.value) || 1)
                            }
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200"
                            value={item.unitOfMeasure}
                            placeholder="sqft, rft, nos"
                            onChange={(e) => handleItemChange(sIdx, iIdx, "unitOfMeasure", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-neutral-100"
                            value={item.unitRatePaise / 100}
                            onChange={(e) =>
                              handleItemChange(
                                sIdx,
                                iIdx,
                                "unitRatePaise",
                                Math.round((parseFloat(e.target.value) || 0) * 100)
                              )
                            }
                          />
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
