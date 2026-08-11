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

export function QuotationPaymentScheduleEditor({
  version,
  schedules,
  onSaveSchedule,
}: QuotationPaymentScheduleEditorProps) {
  const [mode, setMode] = useState<PaymentScheduleMode>(
    version.paymentScheduleMode || "percentage"
  );
  const [milestones, setMilestones] = useState<readonly QuotationPaymentScheduleMilestoneDTO[]>(
    schedules.length > 0
      ? schedules
      : [
          { milestoneName: "Advance Booking", milestoneOrder: 0, percentage: 10.0 },
          { milestoneName: "Design Approval", milestoneOrder: 1, percentage: 40.0 },
          { milestoneName: "Material Delivery", milestoneOrder: 2, percentage: 40.0 },
          { milestoneName: "Handover", milestoneOrder: 3, percentage: 10.0 },
        ]
  );
  const [dirty, setDirty] = useState(false);

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        milestoneName: `Milestone ${milestones.length + 1}`,
        milestoneOrder: milestones.length,
        percentage: mode === "percentage" ? 0 : null,
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

  const pctSum = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
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
                onChange={() => {
                  setMode("percentage");
                  setDirty(true);
                }}
              />
              Percentage (%) Mode
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="scheduleMode"
                value="amount"
                checked={mode === "amount"}
                onChange={() => {
                  setMode("amount");
                  setDirty(true);
                }}
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
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-neutral-100"
                      value={m.percentage ?? 0}
                      onChange={(e) =>
                        handleChange(idx, "percentage", parseFloat(e.target.value) || 0)
                      }
                    />
                  </td>
                ) : (
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-neutral-100"
                      value={(m.amountPaise || 0) / 100}
                      onChange={(e) =>
                        handleChange(
                          idx,
                          "amountPaise",
                          Math.round((parseFloat(e.target.value) || 0) * 100)
                        )
                      }
                    />
                  </td>
                )}
                <td className="py-2 font-mono text-neutral-400">
                  {m.amountPaise != null
                    ? formatInrFromPaise(m.amountPaise)
                    : version.grandTotalPaise == null
                    ? "(Grand total pending)"
                    : "—"}
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

      <div className="mt-4 flex items-center justify-between border-t border-neutral-800/80 pt-3 text-xs">
        <div>
          {mode === "percentage" ? (
            <span
              className={`font-semibold ${
                Math.abs(pctSum - 100) < 0.01 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              Total Percentage: {pctSum.toFixed(2)}%{" "}
              {Math.abs(pctSum - 100) < 0.01 ? "(100% Reconciled)" : "(Must equal 100.00%)"}
            </span>
          ) : (
            <span
              className={`font-semibold ${
                version.grandTotalPaise != null && amtSum === version.grandTotalPaise
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              Total Amount: {formatInrFromPaise(amtSum)}{" "}
              {version.grandTotalPaise != null && amtSum === version.grandTotalPaise
                ? "(Reconciled with Grand Total)"
                : version.grandTotalPaise != null
                ? `(Grand Total: ${formatInrFromPaise(version.grandTotalPaise)})`
                : "(Grand Total Pending)"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
