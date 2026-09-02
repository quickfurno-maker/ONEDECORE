import Link from "next/link";
import {
  SALARY_PAYMENT_STATUS_LABELS,
  SALARY_STATUS_LABELS,
  formatPaise,
  type SalaryPaymentStatus,
  type SalaryStatementSummary,
} from "../contracts/salary-contracts.ts";

const PAYMENT_STATUS_STYLES: Record<SalaryPaymentStatus, string> = {
  unpaid: "border-red-900/60 bg-red-950/60 text-red-200",
  partially_paid: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  paid: "border-emerald-900/60 bg-emerald-950/60 text-emerald-200",
};

interface SalaryStatementListProps {
  readonly statements: readonly SalaryStatementSummary[];
  /** Managers see the employee column; staff see only their own rows. */
  readonly showEmployee: boolean;
}

export function SalaryStatementList({
  statements,
  showEmployee,
}: SalaryStatementListProps) {
  if (statements.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-400">
        No salary statements yet.
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="bg-neutral-900/80">
          <tr className="text-[11px] uppercase tracking-wide text-neutral-500">
            {showEmployee ? <th scope="col" className="p-3">Employee</th> : null}
            <th scope="col" className="p-3">Month</th>
            <th scope="col" className="p-3">Approved days</th>
            <th scope="col" className="p-3">Net payable</th>
            <th scope="col" className="p-3">Paid</th>
            <th scope="col" className="p-3">Balance</th>
            <th scope="col" className="p-3">Payment</th>
            <th scope="col" className="p-3">Status</th>
            <th scope="col" className="p-3">Open</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((statement) => (
            <tr key={statement.salaryStatementId} className="border-t border-neutral-800">
              {showEmployee ? (
                <td className="p-3 text-neutral-100">{statement.employeeName}</td>
              ) : null}
              <td className="p-3 text-neutral-300">{statement.salaryMonth}</td>
              <td className="p-3 text-neutral-300">{statement.approvedDayCount}</td>
              <td className="p-3 text-neutral-100">
                {formatPaise(statement.netPayablePaise)}
              </td>
              <td className="p-3 text-neutral-300">
                {formatPaise(statement.totalPaidPaise)}
              </td>
              <td className="p-3 text-neutral-300">
                {formatPaise(statement.balancePaise)}
              </td>
              <td className="p-3">
                <span
                  className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PAYMENT_STATUS_STYLES[statement.paymentStatus]}`}
                >
                  {SALARY_PAYMENT_STATUS_LABELS[statement.paymentStatus]}
                </span>
              </td>
              <td className="p-3 text-neutral-300">
                {SALARY_STATUS_LABELS[statement.status]}
              </td>
              <td className="p-3">
                <Link
                  href={`/admin/salary/${statement.salaryStatementId}`}
                  className="text-sm font-medium text-amber-300 hover:text-amber-200"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
