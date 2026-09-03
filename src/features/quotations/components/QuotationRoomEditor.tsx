"use client";

import { useMemo, useState } from "react";
import { formatInrFromPaise, parseQuotationInrToPaiseExact } from "../contracts/money";
import {
  AREA_UNIT_OF_MEASURE,
  DEFAULT_CALCULATION_BASIS,
  FIXED_UNIT_OF_MEASURE,
  INTERIOR_QUANTITY_UNITS,
  ONEDECORE_ROOM_PRESETS,
  ONEDECORE_WORK_ITEM_SUGGESTIONS,
  clearIrrelevantBasisFields,
  computeInteriorLine,
  formatAreaSqFt,
  type QuotationCalculationBasis,
} from "../contracts/interior";
import type { QuotationSectionDTO } from "../contracts/types";

/**
 * ONEDECORE room-wise interior quotation editor.
 *
 * This is deliberately NOT a section/quantity/UOM spreadsheet. An estimator
 * works room by room, types a width and a height, and reads back an area and an
 * amount they never type — so Area and Amount are rendered as derived values,
 * not inputs. The preview here uses the same integer arithmetic the server
 * uses, and the server's answer is what gets stored.
 */

interface RawItem {
  readonly key: string;
  readonly id?: string;
  itemName: string;
  basis: QuotationCalculationBasis;
  rawWidthFt: string;
  rawHeightFt: string;
  rawQuantity: string;
  unitOfMeasure: string;
  rawUnitRate: string;
  description: string;
  specifications: string;
  showDetail: boolean;
}

interface RawRoom {
  readonly key: string;
  readonly id?: string;
  roomName: string;
  items: RawItem[];
  expanded: boolean;
}

let keySeed = 0;
const nextKey = () => `k${(keySeed += 1)}`;

function toRawItem(item: QuotationSectionDTO["items"][number]): RawItem {
  const basis = (item.calculationBasis ?? "quantity") as QuotationCalculationBasis;
  return {
    key: nextKey(),
    id: item.id,
    itemName: item.itemName,
    basis,
    rawWidthFt: item.widthFt != null ? String(item.widthFt) : "",
    rawHeightFt: item.heightFt != null ? String(item.heightFt) : "",
    rawQuantity: basis === "quantity" && item.quantity != null ? String(item.quantity) : "",
    unitOfMeasure: item.unitOfMeasure ?? "",
    rawUnitRate: item.unitRatePaise != null ? (item.unitRatePaise / 100).toString() : "",
    description: item.description ?? "",
    specifications: item.specifications ?? "",
    showDetail: Boolean(item.description || item.specifications),
  };
}

function toRawRooms(sections: readonly QuotationSectionDTO[]): RawRoom[] {
  return sections.map((section, index) => ({
    key: nextKey(),
    id: section.id,
    roomName: section.sectionName,
    items: section.items.map(toRawItem),
    expanded: index === 0,
  }));
}

function blankItem(basis: QuotationCalculationBasis = DEFAULT_CALCULATION_BASIS): RawItem {
  const cleared = clearIrrelevantBasisFields(basis);
  return {
    key: nextKey(),
    itemName: "",
    basis,
    rawWidthFt: cleared.rawWidthFt,
    rawHeightFt: cleared.rawHeightFt,
    rawQuantity: cleared.rawQuantity,
    unitOfMeasure: cleared.unitOfMeasure,
    rawUnitRate: "",
    description: "",
    specifications: "",
    showDetail: false,
  };
}

const inputClass =
  "mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const derivedClass =
  "mt-1 block w-full rounded-md border border-dashed border-neutral-700 bg-neutral-900/70 px-2.5 py-1.5 text-sm font-semibold text-amber-200";

const labelClass = "text-[11px] font-medium uppercase tracking-wide text-neutral-400";

interface QuotationRoomEditorProps {
  readonly sections: readonly QuotationSectionDTO[];
  readonly onSaveSections: (sections: readonly QuotationSectionDTO[]) => void;
}

export function QuotationRoomEditor({
  sections,
  onSaveSections,
}: QuotationRoomEditorProps) {
  const [rooms, setRooms] = useState<RawRoom[]>(() => toRawRooms(sections));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync when the canonical server state changes under us.
  const [prevSections, setPrevSections] = useState(sections);
  if (prevSections !== sections) {
    setPrevSections(sections);
    setRooms(toRawRooms(sections));
    setDirty(false);
    setError(null);
  }

  const mutate = (next: RawRoom[]) => {
    setRooms(next);
    setDirty(true);
    setError(null);
  };

  const updateItem = (roomIdx: number, itemIdx: number, patch: Partial<RawItem>) => {
    const next = rooms.map((room, ri) =>
      ri !== roomIdx
        ? room
        : {
            ...room,
            items: room.items.map((item, ii) =>
              ii !== itemIdx ? item : { ...item, ...patch }
            ),
          }
    );
    mutate(next);
  };

  /**
   * Switching basis clears what stopped being meaningful. Leaving a width
   * behind on a quantity item would let an operator believe a measurement is
   * still being billed when it is not — and the database refuses it anyway.
   */
  const changeBasis = (roomIdx: number, itemIdx: number, basis: QuotationCalculationBasis) => {
    updateItem(roomIdx, itemIdx, { basis, ...clearIrrelevantBasisFields(basis) });
  };

  const addRoom = (roomName: string) =>
    mutate([
      ...rooms,
      { key: nextKey(), roomName, items: [blankItem()], expanded: true },
    ]);

  const removeRoom = (roomIdx: number) =>
    mutate(rooms.filter((_, idx) => idx !== roomIdx));

  const moveRoom = (roomIdx: number, delta: number) => {
    const target = roomIdx + delta;
    if (target < 0 || target >= rooms.length) {
      return;
    }
    const next = [...rooms];
    [next[roomIdx], next[target]] = [next[target], next[roomIdx]];
    mutate(next);
  };

  const addItem = (roomIdx: number, basis: QuotationCalculationBasis, label?: string) => {
    const item = blankItem(basis);
    mutate(
      rooms.map((room, idx) =>
        idx !== roomIdx
          ? room
          : { ...room, items: [...room.items, { ...item, itemName: label ?? "" }] }
      )
    );
  };

  const duplicateItem = (roomIdx: number, itemIdx: number) =>
    mutate(
      rooms.map((room, idx) =>
        idx !== roomIdx
          ? room
          : {
              ...room,
              items: [
                ...room.items.slice(0, itemIdx + 1),
                { ...room.items[itemIdx], key: nextKey(), id: undefined },
                ...room.items.slice(itemIdx + 1),
              ],
            }
      )
    );

  const removeItem = (roomIdx: number, itemIdx: number) =>
    mutate(
      rooms.map((room, idx) =>
        idx !== roomIdx
          ? room
          : { ...room, items: room.items.filter((_, ii) => ii !== itemIdx) }
      )
    );

  const moveItem = (roomIdx: number, itemIdx: number, delta: number) => {
    const room = rooms[roomIdx];
    const target = itemIdx + delta;
    if (target < 0 || target >= room.items.length) {
      return;
    }
    const items = [...room.items];
    [items[itemIdx], items[target]] = [items[target], items[itemIdx]];
    mutate(rooms.map((r, idx) => (idx !== roomIdx ? r : { ...r, items })));
  };

  /** Preview only. The server recomputes and its answer is what is stored. */
  const preview = useMemo(() => {
    return rooms.map((room) => {
      let subtotalPaise = 0;
      let areaMilli = BigInt(0);
      const lines = room.items.map((item) => {
        const ratePaise = parseQuotationInrToPaiseExact(item.rawUnitRate.trim());
        if (ratePaise === null) {
          return { ok: false as const, message: "Enter a rate." };
        }
        const line = computeInteriorLine({
          basis: item.basis,
          rawWidthFt: item.rawWidthFt,
          rawHeightFt: item.rawHeightFt,
          rawQuantity: item.rawQuantity,
          unitOfMeasure: item.unitOfMeasure,
          unitRatePaise: ratePaise,
        });
        if (line.ok) {
          subtotalPaise += line.lineTotalPaise;
          if (line.areaMilliSqFt) {
            areaMilli += line.areaMilliSqFt;
          }
        }
        return line;
      });
      return { lines, subtotalPaise, areaMilli };
    });
  }, [rooms]);

  const handleSave = () => {
    const payload: QuotationSectionDTO[] = [];

    for (let ri = 0; ri < rooms.length; ri += 1) {
      const room = rooms[ri];
      const roomName = room.roomName.trim();
      if (!roomName) {
        setError(`Room ${ri + 1} needs a name.`);
        return;
      }
      if (roomName.length > 120) {
        setError(`Room name "${roomName}" is too long.`);
        return;
      }

      const items = [];
      for (let ii = 0; ii < room.items.length; ii += 1) {
        const item = room.items[ii];
        const itemName = item.itemName.trim();
        if (!itemName) {
          setError(`Work item ${ii + 1} in ${roomName} needs a name.`);
          return;
        }

        const ratePaise = parseQuotationInrToPaiseExact(item.rawUnitRate.trim());
        if (ratePaise === null) {
          setError(
            `${itemName} in ${roomName}: enter a ${
              item.basis === "fixed" ? "fixed amount" : "rate"
            } with at most 2 decimals.`
          );
          return;
        }

        const line = computeInteriorLine({
          basis: item.basis,
          rawWidthFt: item.rawWidthFt,
          rawHeightFt: item.rawHeightFt,
          rawQuantity: item.rawQuantity,
          unitOfMeasure: item.unitOfMeasure,
          unitRatePaise: ratePaise,
        });

        if (!line.ok) {
          setError(`${itemName} in ${roomName}: ${line.message}`);
          return;
        }

        items.push({
          id: item.id,
          itemName,
          description: item.description.trim() || null,
          specifications: item.specifications.trim() || null,
          calculationBasis: item.basis,
          widthFt: item.basis === "area" ? item.rawWidthFt.trim() : null,
          heightFt: item.basis === "area" ? item.rawHeightFt.trim() : null,
          // Sent for completeness; the server derives its own and ignores these.
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          unitRatePaise: ratePaise,
          displayOrder: ii,
        });
      }

      payload.push({
        id: room.id,
        sectionName: roomName,
        displayOrder: ri,
        items,
      });
    }

    onSaveSections(payload);
    setDirty(false);
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-200">
            Room-wise Interior Estimate
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Enter width and height in feet. Area and Amount are calculated — the
            server recalculates them on save and its result is what is stored.
          </p>
        </div>
        <button
          type="button"
          disabled={!dirty}
          onClick={handleSave}
          className="rounded-md bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-950 disabled:opacity-50"
        >
          Save rooms
        </button>
      </header>

      {error ? (
        <p role="alert" className="mt-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-5">
        {rooms.map((room, roomIdx) => {
          const roomPreview = preview[roomIdx];
          return (
            <article key={room.key} className="rounded-lg border border-neutral-800 bg-neutral-950/60">
              <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3">
                <div className="flex-1 min-w-[220px]">
                  <label className={labelClass} htmlFor={`room-${room.key}`}>
                    Room / Area
                  </label>
                  <input
                    id={`room-${room.key}`}
                    value={room.roomName}
                    onChange={(e) =>
                      mutate(
                        rooms.map((r, idx) =>
                          idx !== roomIdx ? r : { ...r, roomName: e.target.value }
                        )
                      )
                    }
                    list="onedecore-room-presets"
                    maxLength={120}
                    className={inputClass}
                  />
                </div>
                <div className="text-right">
                  <span className={labelClass}>Room subtotal</span>
                  <p className="mt-1 text-base font-bold text-neutral-100">
                    {formatInrFromPaise(roomPreview.subtotalPaise)}
                  </p>
                  {roomPreview.areaMilli > BigInt(0) ? (
                    <p className="text-[11px] text-neutral-500">
                      Area total {formatAreaSqFt(roomPreview.areaMilli)} sq.ft
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveRoom(roomIdx, -1)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveRoom(roomIdx, 1)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                    ↓
                  </button>
                  <button type="button" onClick={() => removeRoom(roomIdx)} className="rounded border border-red-900 px-2 py-1 text-xs text-red-300">
                    Delete
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                {room.items.map((item, itemIdx) => {
                  const line = roomPreview.lines[itemIdx];
                  const basis = item.basis;
                  return (
                    <div key={item.key} className="rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
                      <div className="grid gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-5">
                          <label className={labelClass} htmlFor={`item-${item.key}`}>
                            Work Item
                          </label>
                          <input
                            id={`item-${item.key}`}
                            value={item.itemName}
                            onChange={(e) => updateItem(roomIdx, itemIdx, { itemName: e.target.value })}
                            list="onedecore-work-items"
                            maxLength={200}
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className={labelClass} htmlFor={`basis-${item.key}`}>
                            Calculation
                          </label>
                          <select
                            id={`basis-${item.key}`}
                            value={basis}
                            onChange={(e) =>
                              changeBasis(roomIdx, itemIdx, e.target.value as QuotationCalculationBasis)
                            }
                            className={inputClass}
                          >
                            <option value="area">Area (W × H)</option>
                            <option value="quantity">Quantity</option>
                            <option value="fixed">Fixed amount</option>
                          </select>
                        </div>
                        <div className="sm:col-span-4 flex items-end justify-end gap-1">
                          <button type="button" onClick={() => moveItem(roomIdx, itemIdx, -1)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                            ↑
                          </button>
                          <button type="button" onClick={() => moveItem(roomIdx, itemIdx, 1)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                            ↓
                          </button>
                          <button type="button" onClick={() => duplicateItem(roomIdx, itemIdx)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                            Duplicate
                          </button>
                          <button type="button" onClick={() => removeItem(roomIdx, itemIdx)} className="rounded border border-red-900 px-2 py-1 text-xs text-red-300">
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-12">
                        {basis === "area" ? (
                          <>
                            <div className="sm:col-span-2">
                              <label className={labelClass} htmlFor={`w-${item.key}`}>
                                Width (ft)
                              </label>
                              <input
                                id={`w-${item.key}`}
                                inputMode="decimal"
                                value={item.rawWidthFt}
                                onChange={(e) => updateItem(roomIdx, itemIdx, { rawWidthFt: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={labelClass} htmlFor={`h-${item.key}`}>
                                Height (ft)
                              </label>
                              <input
                                id={`h-${item.key}`}
                                inputMode="decimal"
                                value={item.rawHeightFt}
                                onChange={(e) => updateItem(roomIdx, itemIdx, { rawHeightFt: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <span className={labelClass}>Area (sq.ft)</span>
                              {/* Derived. The operator must never type this. */}
                              <output className={derivedClass}>
                                {line.ok && line.areaMilliSqFt
                                  ? formatAreaSqFt(line.areaMilliSqFt)
                                  : "—"}
                              </output>
                            </div>
                          </>
                        ) : null}

                        {basis === "quantity" ? (
                          <>
                            <div className="sm:col-span-2">
                              <label className={labelClass} htmlFor={`q-${item.key}`}>
                                Qty
                              </label>
                              <input
                                id={`q-${item.key}`}
                                inputMode="decimal"
                                value={item.rawQuantity}
                                onChange={(e) => updateItem(roomIdx, itemIdx, { rawQuantity: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className={labelClass} htmlFor={`u-${item.key}`}>
                                Unit
                              </label>
                              <select
                                id={`u-${item.key}`}
                                value={item.unitOfMeasure}
                                onChange={(e) => updateItem(roomIdx, itemIdx, { unitOfMeasure: e.target.value })}
                                className={inputClass}
                              >
                                {INTERIOR_QUANTITY_UNITS.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : null}

                        <div className={basis === "fixed" ? "sm:col-span-5" : "sm:col-span-3"}>
                          <label className={labelClass} htmlFor={`r-${item.key}`}>
                            {basis === "area"
                              ? "Rate / sq.ft"
                              : basis === "fixed"
                                ? "Fixed amount"
                                : "Rate / unit"}
                          </label>
                          <input
                            id={`r-${item.key}`}
                            inputMode="decimal"
                            value={item.rawUnitRate}
                            onChange={(e) => updateItem(roomIdx, itemIdx, { rawUnitRate: e.target.value })}
                            className={inputClass}
                          />
                        </div>

                        <div className={basis === "fixed" ? "sm:col-span-7" : "sm:col-span-2"}>
                          <span className={labelClass}>Amount</span>
                          {/* Derived. Never typed, never sent, never trusted. */}
                          <output className={derivedClass}>
                            {line.ok ? formatInrFromPaise(line.lineTotalPaise) : "—"}
                          </output>
                        </div>
                      </div>

                      {!line.ok ? (
                        <p className="mt-2 text-xs text-amber-300">{line.message}</p>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => updateItem(roomIdx, itemIdx, { showDetail: !item.showDetail })}
                        className="mt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400 hover:text-amber-300"
                      >
                        {item.showDetail ? "Hide" : "Add"} description / specification
                      </button>

                      {item.showDetail ? (
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelClass} htmlFor={`d-${item.key}`}>
                              Description
                            </label>
                            <input
                              id={`d-${item.key}`}
                              value={item.description}
                              onChange={(e) => updateItem(roomIdx, itemIdx, { description: e.target.value })}
                              maxLength={2000}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass} htmlFor={`s-${item.key}`}>
                              Specification
                            </label>
                            <input
                              id={`s-${item.key}`}
                              value={item.specifications}
                              onChange={(e) => updateItem(roomIdx, itemIdx, { specifications: e.target.value })}
                              maxLength={2000}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2">
                  {ONEDECORE_WORK_ITEM_SUGGESTIONS.slice(0, 8).map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => addItem(roomIdx, suggestion.basis, suggestion.label)}
                      className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] text-neutral-300 hover:border-amber-400 hover:text-amber-200"
                    >
                      + {suggestion.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(roomIdx, DEFAULT_CALCULATION_BASIS)}
                    className="rounded-full border border-amber-700 px-3 py-1 text-[11px] font-semibold text-amber-200"
                  >
                    + Work Item
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ONEDECORE_ROOM_PRESETS.slice(0, 6).map((room) => (
          <button
            key={room}
            type="button"
            onClick={() => addRoom(room)}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-400 hover:text-amber-200"
          >
            + {room}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addRoom("")}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-100"
        >
          + Add Room
        </button>
      </div>

      {/* Presets are suggestions, so a custom room name is always allowed. */}
      <datalist id="onedecore-room-presets">
        {ONEDECORE_ROOM_PRESETS.map((room) => (
          <option key={room} value={room} />
        ))}
      </datalist>
      <datalist id="onedecore-work-items">
        {ONEDECORE_WORK_ITEM_SUGGESTIONS.map((s) => (
          <option key={s.label} value={s.label} />
        ))}
      </datalist>
    </section>
  );
}

export const QUOTATION_ROOM_EDITOR_UNITS = {
  area: AREA_UNIT_OF_MEASURE,
  fixed: FIXED_UNIT_OF_MEASURE,
};
