/**
 * Workforce V1 — salary and payment domain contracts.
 *
 * Pure and framework-free so the web admin, the staff view and the future
 * Android staff app share one vocabulary. Authorization, validation and every
 * total are enforced server-side; this module is the shared shape, never a
 * security boundary.
 *
 * All money is integer PAISE. Nothing here rounds, and nothing here derives a
 * deduction from attendance: absence, lateness and Weekly Off move money only
 * through an explicit Super Admin line item.
 */

export const SALARY_STATEMENT_STATUSES = ["draft", "finalized", "reopened"] as const;
export type SalaryStatementStatus = (typeof SALARY_STATEMENT_STATUSES)[number];

export const SALARY_PAYMENT_STATUSES = ["unpaid", "partially_paid", "paid"] as const;
export type SalaryPaymentStatus = (typeof SALARY_PAYMENT_STATUSES)[number];

export const SALARY_PAYMENT_METHODS = ["bank", "upi", "cash", "other"] as const;
export type SalaryPaymentMethod = (typeof SALARY_PAYMENT_METHODS)[number];

export const SALARY_ADDITION_TYPES = [
  "bonus",
  "incentive",
  "overtime",
  "other_addition",
] as const;

export const SALARY_DEDUCTION_TYPES = [
  "advance_recovery",
  "absence_deduction",
  "other_deduction",
] as const;

export const SALARY_LINE_TYPES = [
  ...SALARY_ADDITION_TYPES,
  ...SALARY_DEDUCTION_TYPES,
] as const;

export type SalaryLineType = (typeof SALARY_LINE_TYPES)[number];
export type SalaryLineDirection = "addition" | "deduction";

export const SALARY_LINE_LABELS: Record<SalaryLineType, string> = {
  bonus: "Bonus",
  incentive: "Incentive",
  overtime: "Overtime",
  other_addition: "Other addition",
  advance_recovery: "Advance recovery",
  absence_deduction: "Absence deduction",
  other_deduction: "Other deduction",
};

export const SALARY_STATUS_LABELS: Record<SalaryStatementStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  reopened: "Reopened",
};

export const SALARY_PAYMENT_STATUS_LABELS: Record<SalaryPaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
};

export const SALARY_METHOD_LABELS: Record<SalaryPaymentMethod, string> = {
  bank: "Bank",
  upi: "UPI",
  cash: "Cash",
  other: "Other",
};

export function salaryLineDirection(lineType: SalaryLineType): SalaryLineDirection {
  return (SALARY_ADDITION_TYPES as readonly string[]).includes(lineType)
    ? "addition"
    : "deduction";
}

export function isSalaryLineType(value: string): value is SalaryLineType {
  return (SALARY_LINE_TYPES as readonly string[]).includes(value);
}

export function isSalaryPaymentMethod(value: string): value is SalaryPaymentMethod {
  return (SALARY_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isSalaryStatementStatus(value: string): value is SalaryStatementStatus {
  return (SALARY_STATEMENT_STATUSES as readonly string[]).includes(value);
}

export function isSalaryPaymentStatus(value: string): value is SalaryPaymentStatus {
  return (SALARY_PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Net payable = base + additions − deductions.
 *
 * Mirrors `private.salary_statement_totals`. Attendance never enters this
 * calculation: a Weekly Off, a late arrival and an absent day all contribute
 * zero unless a Super Admin added a line.
 */
export function netPayablePaise(input: {
  readonly basePaise: number;
  readonly additionsPaise: number;
  readonly deductionsPaise: number;
}): number {
  return input.basePaise + input.additionsPaise - input.deductionsPaise;
}

export function balancePaise(netPaise: number, totalPaidPaise: number): number {
  return netPaise - totalPaidPaise;
}

/** Derived settlement state. Never stored as a boolean. */
export function derivePaymentStatus(
  netPaise: number,
  totalPaidPaise: number
): SalaryPaymentStatus {
  if (totalPaidPaise <= 0) {
    return "unpaid";
  }
  if (netPaise > 0 && totalPaidPaise < netPaise) {
    return "partially_paid";
  }
  return "paid";
}

/** A finalized statement is immutable until an audited reopen. */
export function canEditStatement(status: SalaryStatementStatus): boolean {
  return status !== "finalized";
}

/** Money only moves against a statement the owner has finalized. */
export function canRecordPayment(status: SalaryStatementStatus): boolean {
  return status === "finalized";
}

/** Formats integer paise as Indian rupees. */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || !Number.isFinite(paise)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Parses a rupee input into integer paise; returns null when unusable. */
export function rupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export interface SalaryStatementLine {
  readonly salaryStatementLineId: string;
  readonly lineType: SalaryLineType;
  readonly direction: SalaryLineDirection;
  readonly amountPaise: number;
  readonly note: string | null;
}

export interface SalaryPayment {
  readonly salaryPaymentId: string;
  readonly amountPaise: number;
  readonly paymentDate: string;
  readonly method: SalaryPaymentMethod;
  readonly reference: string | null;
  readonly note: string | null;
}

export interface SalaryAttendanceSnapshot {
  readonly absentCount: number;
  readonly weeklyOffCount: number;
  readonly halfDay4hCount: number;
  readonly fullDay8hCount: number;
  readonly fullDay12hCount: number;
  readonly lateDayCount: number;
  readonly creditedMinutes: number;
  readonly approvedDayCount: number;
}

export interface SalaryStatementDetail {
  readonly salaryStatementId: string;
  readonly staffId: string;
  readonly salaryMonth: string;
  readonly salaryProfileId: string;
  readonly status: SalaryStatementStatus;
  readonly finalizedAt: string | null;
  readonly attendance: SalaryAttendanceSnapshot;
  readonly lines: readonly SalaryStatementLine[];
  readonly payments: readonly SalaryPayment[];
  readonly basePaise: number;
  readonly additionsPaise: number;
  readonly deductionsPaise: number;
  readonly netPayablePaise: number;
  readonly totalPaidPaise: number;
  readonly balancePaise: number;
  readonly paymentStatus: SalaryPaymentStatus;
}

export interface SalaryStatementSummary {
  readonly salaryStatementId: string;
  readonly staffId: string;
  readonly employeeName: string;
  readonly salaryMonth: string;
  readonly status: SalaryStatementStatus;
  readonly basePaise: number;
  readonly approvedDayCount: number;
  readonly netPayablePaise: number;
  readonly totalPaidPaise: number;
  readonly balancePaise: number;
  readonly paymentStatus: SalaryPaymentStatus;
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

export function mapSalaryStatementDetail(
  raw: Record<string, unknown>
): SalaryStatementDetail {
  const status = asString(raw.status);
  const paymentStatus = asString(raw.paymentStatus);
  const attendance = (raw.attendance ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(raw.lines) ? raw.lines : [];
  const payments = Array.isArray(raw.payments) ? raw.payments : [];

  return {
    salaryStatementId: asString(raw.salaryStatementId),
    staffId: asString(raw.staffId),
    salaryMonth: asString(raw.salaryMonth),
    salaryProfileId: asString(raw.salaryProfileId),
    status: isSalaryStatementStatus(status) ? status : "draft",
    finalizedAt: asNullableString(raw.finalizedAt),
    attendance: {
      absentCount: asNumber(attendance.absentCount),
      weeklyOffCount: asNumber(attendance.weeklyOffCount),
      halfDay4hCount: asNumber(attendance.halfDay4hCount),
      fullDay8hCount: asNumber(attendance.fullDay8hCount),
      fullDay12hCount: asNumber(attendance.fullDay12hCount),
      lateDayCount: asNumber(attendance.lateDayCount),
      creditedMinutes: asNumber(attendance.creditedMinutes),
      approvedDayCount: asNumber(attendance.approvedDayCount),
    },
    lines: lines
      .map((line) => line as Record<string, unknown>)
      .filter((line) => isSalaryLineType(asString(line.lineType)))
      .map((line) => {
        const lineType = asString(line.lineType) as SalaryLineType;
        return {
          salaryStatementLineId: asString(line.salaryStatementLineId),
          lineType,
          direction: salaryLineDirection(lineType),
          amountPaise: asNumber(line.amountPaise),
          note: asNullableString(line.note),
        };
      }),
    payments: payments
      .map((payment) => payment as Record<string, unknown>)
      .filter((payment) => isSalaryPaymentMethod(asString(payment.method)))
      .map((payment) => ({
        salaryPaymentId: asString(payment.salaryPaymentId),
        amountPaise: asNumber(payment.amountPaise),
        paymentDate: asString(payment.paymentDate),
        method: asString(payment.method) as SalaryPaymentMethod,
        reference: asNullableString(payment.reference),
        note: asNullableString(payment.note),
      })),
    basePaise: asNumber(raw.basePaise),
    additionsPaise: asNumber(raw.additionsPaise),
    deductionsPaise: asNumber(raw.deductionsPaise),
    netPayablePaise: asNumber(raw.netPayablePaise),
    totalPaidPaise: asNumber(raw.totalPaidPaise),
    balancePaise: asNumber(raw.balancePaise),
    paymentStatus: isSalaryPaymentStatus(paymentStatus) ? paymentStatus : "unpaid",
  };
}

export function mapSalaryStatementSummary(
  raw: Record<string, unknown>
): SalaryStatementSummary {
  const status = asString(raw.status);
  const paymentStatus = asString(raw.payment_status);

  return {
    salaryStatementId: asString(raw.salary_statement_id),
    staffId: asString(raw.staff_id),
    employeeName: asString(raw.employee_name),
    salaryMonth: asString(raw.salary_month),
    status: isSalaryStatementStatus(status) ? status : "draft",
    basePaise: asNumber(raw.base_salary_paise),
    approvedDayCount: asNumber(raw.approved_day_count),
    netPayablePaise: asNumber(raw.net_payable_paise),
    totalPaidPaise: asNumber(raw.total_paid_paise),
    balancePaise: asNumber(raw.balance_paise),
    paymentStatus: isSalaryPaymentStatus(paymentStatus) ? paymentStatus : "unpaid",
  };
}

/**
 * Result of one salary form action.
 *
 * Declared here rather than beside the server actions: a "use server"
 * module may only export async functions at runtime, so a plain object
 * exported from one breaks the whole route at request time.
 */
export interface SalaryFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

export const INITIAL_SALARY_FORM_STATE: SalaryFormActionState = {
  success: false,
  message: "",
};
