"use client";

import { useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type {
  PaymentScheduleMode,
  QuotationPaymentScheduleMilestoneDTO,
  QuotationVersionDTO,
} from "../contracts/types";

interface QuotationPaymentScheduleEditorProps {
  readonly version: QuotationVersionDTO;
  readonly schedules: readonly QuotationPaymentScheduleMilestoneDTO[];
  readonly onSaveSchedule: (
    mode: PaymentScheduleMode,
    milestones: readonly QuotationPaymentScheduleMilestoneDTO[]
  ) => void;
}

export function parseInrToPaise(inrStr: string): number {
  const trimmed = inrStr.trim();
  if (!trimmed || isNaN(Number(trimmed))) return 0;
  const parts = trimmed.split(".");
  const rupees = parseInt(parts[0] || "0", 10);
  const decimals = (parts[1] || "").padEnd(2, "0").slice(0, 2);
  const paise = parseInt(decimals || "0", 10);
  const sign = rupees < 0 || trimmed.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(rupees) * 100 + paise);
}

export function QuotationPaymentScheduleEditor({
  version,
  schedules,
  onSaveSchedule,
}: QuotationPaymentScheduleEditorProps) {
  const [mode, setMode] = useState<PaymentScheduleMode>(
    version.paymentScheduleMode || "percentage"
  );
  // Default to empty schedule if no schedules provided (no 10/40/40/10 defaults)
  const [milestones, setMilestones] = useState<readonly QuotationPaymentScheduleMilestoneDTO[]>(
    schedules.length > 0 ? schedules : []
  );
  const [dirty, setDirty] = useState(false);

  const handleModeChange = (newMode: PaymentScheduleMode) => {
    setMode(newMode);
    // Clear inactive representation on mode switch
    setMilestones(
      milestones.map((m) => ({
        ...m,
        percentage: newMode === "percentage" ? (m.percentage ?? "0") : null,
        amountPaise: newMode === "amount" ? (m.amountPaise ?? 0) : null,
      }))
    );
    setDirty(true);
  };

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        milestoneName: `Milestone ${milestones.length + 1}`,
        milestoneOrder: milestones.length,
        percentage: mode === "percentage" ? "0" : null,
        amountPaise: mode === "amount" ? 0 : null,
      },
    ]);
    setDirty(true);
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleChange = (
    idx: number,
    field: keyof QuotationPaymentScheduleMilestoneDTO,
    val: unknown
  ) => {
    const updated = milestones.map((m, i) => (i === idx ? { ...m, [field]: val } : m));
    setMilestones(updated);
    setDirty(true);
  };

  const handleSave = () => {
    onSaveSchedule(mode, milestones);
    setDirty(false);
  };

  const pctSum = milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);
  const amtSum = milestones.reduce((sum, m) => sum + (m.amountPaise || 0), 0);

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
            {milestones.map((m, idx) => (
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
                      value={m.percentage != null ? String(m.percentage) : ""}
                      onChange={(e) => handleChange(idx, "percentage", e.target.value)}
                    />
                  </td>
                ) : (
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-neutral-100"
                      value={m.amountPaise != null ? ((m.amountPaise || 0) / 100).toString() : ""}
                      onChange={(e) =>
                        handleChange(idx, "amountPaise", parseInrToPaise(e.target.value))
                      }
                    />
                  </td>
                )}
                <td className="py-2 font-mono text-neutral-400">
                  {m.amountPaise != null
                    ? formatInrFromPaise(m.amountPaise)
                    : mode === "percentage"
                    ? "Derived on total"
                    : "Explicit amount"}
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
            ))}
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
