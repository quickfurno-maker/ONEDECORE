"use client";

import type { QuotationLineItemDraft } from "../contracts/line-item.ts";
import { assertMoneyPaise, assertQuantityMilli } from "../contracts/index.ts";

const fieldClassName =
  "mt-1 block w-full min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

interface QuotationLineItemsEditorProps {
  readonly items: readonly QuotationLineItemDraft[];
  readonly readOnly: boolean;
  readonly onChange: (items: readonly QuotationLineItemDraft[]) => void;
}

function updateItem(
  items: readonly QuotationLineItemDraft[],
  id: string,
  patch: Partial<QuotationLineItemDraft>
): QuotationLineItemDraft[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function QuotationLineItemsEditor({
  items,
  readOnly,
  onChange,
}: QuotationLineItemsEditorProps) {
  return (
    <div className="space-y-4">
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm" aria-label="Quotation line items">
          <thead>
            <tr className="border-b border-neutral-700 text-left text-neutral-400">
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Unit</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Unit price (paise)</th>
              {!readOnly ? <th className="px-2 py-2"><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-800 align-top">
                <td className="px-2 py-2">
                  {readOnly ? (
                    item.description
                  ) : (
                    <input
                      aria-label={`Description for line ${item.sortOrder}`}
                      className={fieldClassName}
                      value={item.description}
                      onChange={(event) =>
                        onChange(updateItem(items, item.id, { description: event.target.value }))
                      }
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  {readOnly ? (
                    item.unit
                  ) : (
                    <input
                      aria-label={`Unit for line ${item.sortOrder}`}
                      className={fieldClassName}
                      value={item.unit}
                      onChange={(event) =>
                        onChange(updateItem(items, item.id, { unit: event.target.value }))
                      }
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  {readOnly ? (
                    item.quantityMilli / 1000
                  ) : (
                    <input
                      aria-label={`Quantity milli for line ${item.sortOrder}`}
                      className={fieldClassName}
                      inputMode="numeric"
                      value={String(item.quantityMilli)}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (Number.isNaN(parsed)) return;
                        onChange(
                          updateItem(items, item.id, {
                            quantityMilli: assertQuantityMilli(parsed),
                          })
                        );
                      }}
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  {readOnly ? (
                    item.unitPricePaise
                  ) : (
                    <input
                      aria-label={`Unit price paise for line ${item.sortOrder}`}
                      className={fieldClassName}
                      inputMode="numeric"
                      value={String(item.unitPricePaise)}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (Number.isNaN(parsed)) return;
                        onChange(
                          updateItem(items, item.id, {
                            unitPricePaise: assertMoneyPaise(parsed),
                          })
                        );
                      }}
                    />
                  )}
                </td>
                {!readOnly ? (
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="rounded-md border border-neutral-600 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800"
                      onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-neutral-700 bg-neutral-950/70 p-3"
            aria-label={`Line item ${item.sortOrder}`}
          >
            <p className="font-medium text-neutral-100">{item.description}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {item.unit} · qty {item.quantityMilli / 1000} · {item.unitPricePaise} paise
            </p>
          </article>
        ))}
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
          onClick={() =>
            onChange([
              ...items,
              {
                id: `line-${items.length + 1}`,
                description: "New scope item",
                unit: "each",
                quantityMilli: assertQuantityMilli(1000),
                unitPricePaise: assertMoneyPaise(0),
                sortOrder: items.length + 1,
              },
            ])
          }
        >
          Add line item
        </button>
      ) : null}
    </div>
  );
}
