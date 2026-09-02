"use client";

import { useActionState } from "react";
import {
  SALARY_ADDITION_TYPES,
  SALARY_DEDUCTION_TYPES,
  SALARY_LINE_LABELS,
  SALARY_METHOD_LABELS,
  SALARY_PAYMENT_METHODS,
  SALARY_PAYMENT_STATUS_LABELS,
  SALARY_STATUS_LABELS,
  canEditStatement,
  canRecordPayment,
  formatPaise,
  type SalaryStatementDetail,
} from "../contracts/salary-contracts.ts";
import {
  INITIAL_SALARY_FORM_STATE,
  addSalaryLineAction,
  finalizeSalaryStatementAction,
  recordSalaryPaymentAction,
  removeSalaryLineAction,
  reopenSalaryStatementAction,
  type SalaryFormActionState,
} from "../server/salary-form-actions.ts";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

function Feedback({ state }: { readonly state: SalaryFormActionState }) {
  if (!state.message) {
    return null;
  }
  return (
    <p
      role={state.success ? "status" : "alert"}
      className={`text-sm ${state.success ? "text-emerald-300" : "text-red-300"}`}
    >
      {state.message}
    </p>
  );
}

interface SalaryStatementDetailViewProps {
  readonly statement: SalaryStatementDetail;
  /** Super Admin controls render only for a manager. */
  readonly canManage: boolean;
}

export function SalaryStatementDetailView({
  statement,
  canManage,
}: SalaryStatementDetailViewProps) {
  const [lineState, lineAction, linePending] = useActionState(
    addSalaryLineAction,
    INITIAL_SALARY_FORM_STATE
  );
  const [removeState, removeAction] = useActionState(
    removeSalaryLineAction,
    INITIAL_SALARY_FORM_STATE
  );
  const [finalizeState, finalizeAction, finalizePending] = useActionState(
    finalizeSalaryStatementAction,
    INITIAL_SALARY_FORM_STATE
  );
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenSalaryStatementAction,
    INITIAL_SALARY_FORM_STATE
  );
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordSalaryPaymentAction,
    INITIAL_SALARY_FORM_STATE
  );

  const editable = canEditStatement(statement.status);
  const payable = canRecordPayment(statement.status);
  const statementIdField = (
    <input type="hidden" name="statementId" value={statement.salaryStatementId} />
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-100">
            {statement.salaryMonth}
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-300">
              {SALARY_STATUS_LABELS[statement.status]}
            </span>
            <span className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-300">
              {SALARY_PAYMENT_STATUS_LABELS[statement.paymentStatus]}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Base</dt>
            <dd className="mt-1 text-neutral-100">{formatPaise(statement.basePaise)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Additions</dt>
            <dd className="mt-1 text-emerald-300">
              {formatPaise(statement.additionsPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Deductions
            </dt>
            <dd className="mt-1 text-red-300">
              {formatPaise(statement.deductionsPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Net payable
            </dt>
            <dd className="mt-1 text-lg font-semibold text-neutral-100">
              {formatPaise(statement.netPayablePaise)}
            </dd>
          </div>
        </dl>

        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Total paid
            </dt>
            <dd className="mt-1 text-neutral-100">
              {formatPaise(statement.totalPaidPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Balance</dt>
            <dd className="mt-1 text-neutral-100">
              {formatPaise(statement.balancePaise)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-neutral-100">
          Approved attendance snapshot
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Taken from approved days only when the statement was built. Weekly Off is paid,
          and neither absence nor lateness deducts anything on its own.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Full Day 8H", statement.attendance.fullDay8hCount],
            ["Full Day 12H", statement.attendance.fullDay12hCount],
            ["Half Day 4H", statement.attendance.halfDay4hCount],
            ["Weekly Off", statement.attendance.weeklyOffCount],
            ["Absent", statement.attendance.absentCount],
            ["Late days", statement.attendance.lateDayCount],
            ["Approved days", statement.attendance.approvedDayCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
            >
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-neutral-100">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-neutral-100">
          Additions and deductions
        </h3>
        {statement.lines.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No line items.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800">
            {statement.lines.map((line) => (
              <li
                key={line.salaryStatementLineId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-neutral-200">
                  {SALARY_LINE_LABELS[line.lineType]}
                  {line.note ? (
                    <span className="text-neutral-500"> · {line.note}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={
                      line.direction === "addition" ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {line.direction === "addition" ? "+" : "−"}
                    {formatPaise(line.amountPaise)}
                  </span>
                  {canManage && editable ? (
                    <form action={removeAction}>
                      {statementIdField}
                      <input
                        type="hidden"
                        name="lineId"
                        value={line.salaryStatementLineId}
                      />
                      <button
                        type="submit"
                        className="text-xs text-neutral-400 underline hover:text-red-300"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Feedback state={removeState} />

        {canManage && editable ? (
          <form action={lineAction} className="mt-5 grid gap-3 sm:grid-cols-4">
            {statementIdField}
            <label className="text-xs font-medium text-neutral-300 sm:col-span-1">
              Type
              <select name="lineType" required className={inputClass}>
                <optgroup label="Additions">
                  {SALARY_ADDITION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SALARY_LINE_LABELS[type]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Deductions">
                  {SALARY_DEDUCTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SALARY_LINE_LABELS[type]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-300">
              Amount (₹)
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                className={inputClass}
              />
            </label>
            <label className="text-xs font-medium text-neutral-300 sm:col-span-2">
              Note
              <input type="text" name="note" maxLength={500} className={inputClass} />
            </label>
            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={linePending}
                className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
              >
                {linePending ? "Adding…" : "Add line"}
              </button>
            </div>
            <div className="sm:col-span-4">
              <Feedback state={lineState} />
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-neutral-100">Payments</h3>
        {statement.payments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No payments recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800">
            {statement.payments.map((payment) => (
              <li
                key={payment.salaryPaymentId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-neutral-300">
                  {payment.paymentDate} · {SALARY_METHOD_LABELS[payment.method]}
                  {payment.reference ? (
                    <span className="text-neutral-500"> · {payment.reference}</span>
                  ) : null}
                </span>
                <span className="text-neutral-100">{formatPaise(payment.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          payable ? (
            <form action={paymentAction} className="mt-5 grid gap-3 sm:grid-cols-4">
              {statementIdField}
              <label className="text-xs font-medium text-neutral-300">
                Amount (₹)
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-neutral-300">
                Date
                <input type="date" name="paymentDate" required className={inputClass} />
              </label>
              <label className="text-xs font-medium text-neutral-300">
                Method
                <select name="method" required className={inputClass}>
                  {SALARY_PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {SALARY_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-neutral-300">
                Reference
                <input
                  type="text"
                  name="reference"
                  maxLength={120}
                  className={inputClass}
                />
              </label>
              <div className="sm:col-span-4">
                <button
                  type="submit"
                  disabled={paymentPending}
                  className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
                >
                  {paymentPending ? "Recording…" : "Record payment"}
                </button>
              </div>
              <div className="sm:col-span-4">
                <Feedback state={paymentState} />
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-neutral-400">
              Finalize the statement before recording a payment.
            </p>
          )
        ) : null}
      </section>

      {canManage ? (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-neutral-100">Statement control</h3>
          {editable ? (
            <form action={finalizeAction} className="mt-3 space-y-2">
              {statementIdField}
              <input
                type="text"
                name="note"
                maxLength={500}
                placeholder="Finalization note (optional)"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={finalizePending}
                className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
              >
                {finalizePending ? "Finalizing…" : "Finalize statement"}
              </button>
              <Feedback state={finalizeState} />
            </form>
          ) : (
            <form action={reopenAction} className="mt-3 space-y-2">
              {statementIdField}
              <input
                type="text"
                name="reason"
                required
                maxLength={500}
                placeholder="Reason for reopening (required, audited)"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={reopenPending}
                className="min-h-11 rounded-md border border-orange-800 px-4 py-2 text-sm font-semibold text-orange-200 disabled:opacity-60"
              >
                {reopenPending ? "Reopening…" : "Reopen for amendment"}
              </button>
              <p className="text-xs text-neutral-500">
                A finalized statement is never edited silently. Reopening records the
                reason, the actor and the time.
              </p>
              <Feedback state={reopenState} />
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
