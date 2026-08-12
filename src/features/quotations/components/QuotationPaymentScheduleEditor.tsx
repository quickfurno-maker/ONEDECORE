"use client";

import { useState } from "react";
import { formatInrFromPaise, parseQuotationInrToPaiseExact } from "../contracts/money";
import type {
  PaymentScheduleMode,
  QuotationPaymentScheduleMilestoneDTO,
  QuotationVersionDTO,
} from "../contracts/types";
import {
  buildValidatedPaymentSchedulePayload,
  type RawMilestoneState,
} from "../utils/quotation-editor-helpers";

interface QuotationPaymentScheduleEditorProps {
  readonly version: QuotationVersionDTO;
  readonly schedules: readonly QuotationPaymentScheduleMilestoneDTO[];
  readonly onSaveSchedule: (
    mode: PaymentScheduleMode,
    milestones: readonly QuotationPaymentScheduleMilestoneDTO[]
  ) => void;
}

function initRawMilestones(
  schedules: readonly QuotationPaymentScheduleMilestoneDTO[]
): readonly RawMilestoneState[] {
  return schedules.map((m) => ({
    id: m.id,
    milestoneName: m.milestoneName,
    milestoneOrder: m.milestoneOrder,
    rawPercentage: m.percentage != null ? String(m.percentage) : "0",
    rawAmount: m.amountPaise != null ? (m.amountPaise / 100).toString() : "0",
  }));
}

export function QuotationPaymentScheduleEditor({
  version,
  schedules,
  onSaveSchedule,
}: QuotationPaymentScheduleEditorProps) {
  const [mode, setMode] = useState<PaymentScheduleMode>(
    version.paymentScheduleMode || "percentage"
  );
  const [rawMilestones, setRawMilestones] = useState<readonly RawMilestoneState[]>(() =>
    initRawMilestones(schedules)
  );
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync state during render when canonical schedules prop changes
  const [prevSchedules, setPrevSchedules] = useState(schedules);
  if (prevSchedules !== schedules) {
    setPrevSchedules(schedules);
    setRawMilestones(initRawMilestones(schedules));
    setMode(version.paymentScheduleMode || "percentage");
    setDirty(false);
    setValidationError(null);
  }

  const handleModeChange = (newMode: PaymentScheduleMode) => {
    setMode(newMode);
    setDirty(true);
    setValidationError(null);
  };

  const handleAddMilestone = () => {
    setRawMilestones([
      ...rawMilestones,
      {
        milestoneName: `Milestone ${rawMilestones.length + 1}`,
        milestoneOrder: rawMilestones.length,
        rawPercentage: mode === "percentage" ? "0" : "",
        rawAmount: mode === "amount" ? "0" : "",
      },
    ]);
    setDirty(true);
    setValidationError(null);
  };

  const handleRemoveMilestone = (idx: number) => {
    setRawMilestones(rawMilestones.filter((_, i) => i !== idx));
    setDirty(true);
    setValidationError(null);
  };

  const handleChange = (
    idx: number,
    field: keyof RawMilestoneState,
    val: string
  ) => {
    const updated = rawMilestones.map((m, i) => (i === idx ? { ...m, [field]: val } : m));
    setRawMilestones(updated);
    setDirty(true);
    setValidationError(null);
  };

  const handleSave = () => {
    const res = buildValidatedPaymentSchedulePayload(mode, rawMilestones);
    if (!res.success) {
      setValidationError(res.error);
      return;
    }

    setValidationError(null);
    onSaveSchedule(mode, res.data);
    setDirty(false);
  };

  // Safe display calculation for helper UI (ignores invalid inputs gracefully for display)
  const pctSum = rawMilestones.reduce((sum, m) => sum + (Number(m.rawPercentage) || 0), 0);
  const amtSum = rawMilestones.reduce((sum, m) => {
    const paise = parseQuotationInrToPaiseExact(m.rawAmount);
    return sum + (paise || 0);
  }, 0);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-100">Draft Payment Schedule</h3>
          <p className="text-xs text-neutral-400">
            Per OD7A-2, schedule-level mode is strictly percentage OR amount based (no mixing).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="scheduleMode"
                value="percentage"
                checked={mode === "percentage"}
                onChange={() => handleModeChange("percentage")}
              />
              Percentage (%) Mode
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="scheduleMode"
                value="amount"
                checked={mode === "amount"}
                onChange={() => handleModeChange("amount")}
              />
              Amount (₹) Mode
            </label>
          </div>

          <button
            type="button"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
            onClick={handleAddMilestone}
          >
            + Add Milestone
          </button>
          {dirty && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
              onClick={handleSave}
            >
              Save Schedule
            </button>
          )}
        </div>
      </div>

      {validationError && (
        <div className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
          ⚠️ {validationError}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400">
              <th className="pb-2">Milestone Name</th>
              {mode === "percentage" ? (
                <th className="pb-2 w-32">Percentage (%)</th>
              ) : (
                <th className="pb-2 w-36">Amount (₹)</th>
              )}
              <th className="pb-2 w-36">Derived Amount / Status</th>
              <th className="pb-2 w-20 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {rawMilestones.map((m, idx) => {
              const parsedPaise = parseQuotationInrToPaiseExact(m.rawAmount);
              const isAmountInvalid = mode === "amount" && m.rawAmount.trim() !== "" && parsedPaise === null;

              return (
                <tr key={m.id || `ms-${idx}`}>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-neutral-100"
                      value={m.milestoneName}
                      onChange={(e) => handleChange(idx, "milestoneName", e.target.value)}
                    />
                  </td>
                  {mode === "percentage" ? (
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        className="w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-neutral-100"
                        value={m.rawPercentage}
                        onChange={(e) => handleChange(idx, "rawPercentage", e.target.value)}
                      />
                    </td>
                  ) : (
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        className={`w-full rounded border px-2.5 py-1.5 font-mono text-neutral-100 bg-neutral-950 ${
                          isAmountInvalid ? "border-rose-500 focus:border-rose-500" : "border-neutral-800"
                        }`}
                        value={m.rawAmount}
                        onChange={(e) => handleChange(idx, "rawAmount", e.target.value)}
                      />
                    </td>
                  )}
                  <td className="py-2 font-mono text-neutral-400">
                    {mode === "amount"
                      ? parsedPaise !== null
                        ? formatInrFromPaise(parsedPaise)
                        : <span className="text-rose-400 text-[11px]">Invalid format</span>
                      : "Derived on total"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-rose-400 hover:underline"
                      onClick={() => handleRemoveMilestone(idx)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-mono text-neutral-400">
        <div>
          {mode === "percentage" ? (
            <span>
              Total Percentage:{" "}
              <strong
                className={
                  Math.abs(pctSum - 100) < 0.001 ? "text-emerald-400" : "text-amber-400"
                }
              >
                {pctSum.toFixed(2)}%
              </strong>{" "}
              (Must equal exactly 100.00%)
            </span>
          ) : (
            <span>
              Total Schedule Amount:{" "}
              <strong className="text-emerald-400">{formatInrFromPaise(amtSum)}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
