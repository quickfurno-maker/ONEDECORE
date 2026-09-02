/**
 * Workforce V1 — salary and payment ledger contract tests.
 *
 * Database enforcement is proven in
 * supabase/tests/database/41_workforce_salary_payment_ledger_test.sql. These
 * pin the shared contract layer that the web UI and the future Android staff
 * app both consume, plus the money rules the owner locked.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  SALARY_ADDITION_TYPES,
  SALARY_DEDUCTION_TYPES,
  SALARY_LINE_TYPES,
  SALARY_PAYMENT_METHODS,
  SALARY_PAYMENT_STATUSES,
  SALARY_STATEMENT_STATUSES,
  balancePaise,
  canEditStatement,
  canRecordPayment,
  derivePaymentStatus,
  formatPaise,
  isSalaryLineType,
  isSalaryPaymentMethod,
  mapSalaryStatementDetail,
  mapSalaryStatementSummary,
  netPayablePaise,
  rupeesToPaise,
  salaryLineDirection,
} from "../contracts/salary-contracts.ts";
import {
  SALARY_ERROR_CODES,
  salaryErrorFromPostgresMessage,
} from "../contracts/salary-errors.ts";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");
const MIGRATION =
  "supabase/migrations/20260902170000_workforce_salary_payment_ledger.sql";

describe("Workforce salary — money rules", () => {
  test("net payable is base plus additions minus deductions", () => {
    assert.equal(
      netPayablePaise({ basePaise: 6000000, additionsPaise: 100000, deductionsPaise: 50000 }),
      6050000
    );
    assert.equal(
      netPayablePaise({ basePaise: 5000000, additionsPaise: 0, deductionsPaise: 0 }),
      5000000
    );
  });

  test("attendance never moves money on its own", () => {
    // A month full of absence, lateness and weekly offs with no admin line item
    // still pays the full base.
    assert.equal(
      netPayablePaise({ basePaise: 5000000, additionsPaise: 0, deductionsPaise: 0 }),
      5000000
    );

    // The database agrees: the totals function must not read attendance counts.
    const sql = read(MIGRATION);
    const totals = sql.slice(
      sql.indexOf("function private.salary_statement_totals"),
      sql.indexOf("-- D. Salary profile RPCs")
    );
    assert.doesNotMatch(totals, /absent_count/);
    assert.doesNotMatch(totals, /late_day_count/);
    assert.doesNotMatch(totals, /weekly_off_count/);
  });

  test("balance is net minus paid", () => {
    assert.equal(balancePaise(6050000, 2000000), 4050000);
    assert.equal(balancePaise(6050000, 6050000), 0);
  });

  test("payment status is derived, never a boolean", () => {
    assert.equal(derivePaymentStatus(6050000, 0), "unpaid");
    assert.equal(derivePaymentStatus(6050000, 1), "partially_paid");
    assert.equal(derivePaymentStatus(6050000, 6049999), "partially_paid");
    assert.equal(derivePaymentStatus(6050000, 6050000), "paid");
    assert.equal(derivePaymentStatus(6050000, 7000000), "paid");
    assert.deepEqual([...SALARY_PAYMENT_STATUSES], ["unpaid", "partially_paid", "paid"]);
  });
});

describe("Workforce salary — line items", () => {
  test("exactly the locked addition and deduction types exist", () => {
    assert.deepEqual(
      [...SALARY_ADDITION_TYPES],
      ["bonus", "incentive", "overtime", "other_addition"]
    );
    assert.deepEqual(
      [...SALARY_DEDUCTION_TYPES],
      ["advance_recovery", "absence_deduction", "other_deduction"]
    );
    assert.equal(SALARY_LINE_TYPES.length, 7);
  });

  test("direction is implied by type and never contradicts it", () => {
    for (const type of SALARY_ADDITION_TYPES) {
      assert.equal(salaryLineDirection(type), "addition");
    }
    for (const type of SALARY_DEDUCTION_TYPES) {
      assert.equal(salaryLineDirection(type), "deduction");
    }
  });

  test("unknown line types are rejected", () => {
    assert.equal(isSalaryLineType("bonus"), true);
    assert.equal(isSalaryLineType("tax"), false);
    assert.equal(isSalaryLineType("pf"), false);
    assert.equal(isSalaryLineType("esi"), false);
  });
});

describe("Workforce salary — lifecycle", () => {
  test("a finalized statement is not editable but is payable", () => {
    assert.equal(canEditStatement("draft"), true);
    assert.equal(canEditStatement("reopened"), true);
    assert.equal(canEditStatement("finalized"), false);

    assert.equal(canRecordPayment("draft"), false);
    assert.equal(canRecordPayment("reopened"), false);
    assert.equal(canRecordPayment("finalized"), true);
  });

  test("the locked statuses exist", () => {
    assert.deepEqual([...SALARY_STATEMENT_STATUSES], ["draft", "finalized", "reopened"]);
  });
});

describe("Workforce salary — payments", () => {
  test("exactly the four locked methods exist", () => {
    assert.deepEqual([...SALARY_PAYMENT_METHODS], ["bank", "upi", "cash", "other"]);
    assert.equal(isSalaryPaymentMethod("upi"), true);
    assert.equal(isSalaryPaymentMethod("crypto"), false);
  });
});

describe("Workforce salary — money parsing and formatting", () => {
  test("rupees convert to integer paise", () => {
    assert.equal(rupeesToPaise("50000"), 5000000);
    assert.equal(rupeesToPaise("1234.56"), 123456);
    assert.equal(rupeesToPaise("0.01"), 1);
    assert.equal(rupeesToPaise(""), null);
    assert.equal(rupeesToPaise("abc"), null);
    assert.equal(rupeesToPaise("-5"), null);
  });

  test("paise format as rupees and unknown stays an em dash", () => {
    assert.match(formatPaise(5000000), /50,000/);
    assert.equal(formatPaise(null), "—");
    assert.equal(formatPaise(undefined), "—");
  });
});

describe("Workforce salary — mapping", () => {
  test("statement detail maps defensively", () => {
    const detail = mapSalaryStatementDetail({
      salaryStatementId: "st1",
      staffId: "s1",
      salaryMonth: "2026-07-01",
      salaryProfileId: "sp1",
      status: "finalized",
      finalizedAt: "2026-08-01T00:00:00Z",
      attendance: { fullDay8hCount: 20, weeklyOffCount: 4, lateDayCount: 2 },
      lines: [
        { salaryStatementLineId: "l1", lineType: "bonus", amountPaise: 100000, note: null },
        { salaryStatementLineId: "l2", lineType: "not_a_type", amountPaise: 1, note: null },
      ],
      payments: [
        {
          salaryPaymentId: "p1",
          amountPaise: 2000000,
          paymentDate: "2026-08-02",
          method: "upi",
          reference: "R1",
          note: null,
        },
        { salaryPaymentId: "p2", amountPaise: 1, paymentDate: "x", method: "crypto" },
      ],
      basePaise: 6000000,
      additionsPaise: 100000,
      deductionsPaise: 50000,
      netPayablePaise: 6050000,
      totalPaidPaise: 2000000,
      balancePaise: 4050000,
      paymentStatus: "partially_paid",
    });

    assert.equal(detail.status, "finalized");
    assert.equal(detail.paymentStatus, "partially_paid");
    assert.equal(detail.attendance.fullDay8hCount, 20);
    assert.equal(detail.attendance.weeklyOffCount, 4);
    // Unknown line types and payment methods are dropped, not rendered.
    assert.equal(detail.lines.length, 1);
    assert.equal(detail.lines[0]?.direction, "addition");
    assert.equal(detail.payments.length, 1);
    assert.equal(detail.payments[0]?.method, "upi");
  });

  test("an unknown status degrades to a safe default", () => {
    const detail = mapSalaryStatementDetail({ status: "wat", paymentStatus: "wat" });
    assert.equal(detail.status, "draft");
    assert.equal(detail.paymentStatus, "unpaid");
  });

  test("summary rows map from snake_case", () => {
    const summary = mapSalaryStatementSummary({
      salary_statement_id: "st1",
      staff_id: "s1",
      employee_name: "Test Employee",
      salary_month: "2026-07-01",
      status: "finalized",
      base_salary_paise: 6000000,
      approved_day_count: 24,
      net_payable_paise: 6050000,
      total_paid_paise: 2000000,
      balance_paise: 4050000,
      payment_status: "partially_paid",
    });

    assert.equal(summary.employeeName, "Test Employee");
    assert.equal(summary.balancePaise, 4050000);
    assert.equal(summary.paymentStatus, "partially_paid");
  });
});

describe("Workforce salary — errors", () => {
  test("database tokens map to client codes", () => {
    for (const code of SALARY_ERROR_CODES) {
      if (code === "SALARY_RPC_FAILED") {
        continue;
      }
      assert.equal(
        salaryErrorFromPostgresMessage(`ERROR: ${code}`).code,
        code,
        `${code} must round-trip`
      );
    }
  });

  test("unmapped failures degrade and permission denials are explicit", () => {
    assert.equal(salaryErrorFromPostgresMessage("boom").code, "SALARY_RPC_FAILED");
    assert.equal(
      salaryErrorFromPostgresMessage("42501: permission denied").code,
      "SALARY_PERMISSION_DENIED"
    );
  });
});

describe("Workforce salary — migration and surface contract", () => {
  const sql = read(MIGRATION);

  test("no statutory or tax engine is introduced", () => {
    // Strip SQL comments first: the migration header legitimately NAMES the
    // excluded concepts while stating they are out of scope. What matters is
    // that no executable statement references them.
    const executable = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join(" ");

    for (const forbidden of [
      /\btds\b/i,
      /\bpf_/i,
      /\besic?\b/i,
      /\bctc\b/i,
      /income_tax/i,
    ]) {
      assert.doesNotMatch(executable, forbidden);
    }
  });

  test("salary history is append-only in shape", () => {
    assert.match(sql, /effective_from date not null/);
    assert.match(sql, /effective_to date/);
    // Only one open-ended version per employee.
    assert.match(sql, /uq_salary_profiles_open_version/);
    assert.match(sql, /where effective_to is null/);
  });

  test("payment ledger supports multiple payments and all four methods", () => {
    assert.match(sql, /create table public\.salary_payments/);
    assert.match(sql, /'bank', 'upi', 'cash', 'other'/);
    // Never a single boolean.
    assert.doesNotMatch(sql, /salary_paid boolean/);
  });

  test("payroll reads attendance but never writes it", () => {
    const payroll = sql.slice(sql.indexOf("-- E. Statement RPCs"));
    assert.match(payroll, /from public\.attendance_submissions/);
    assert.doesNotMatch(payroll, /update public\.attendance_submissions/);
    assert.doesNotMatch(payroll, /insert into public\.attendance_submissions/);
    assert.doesNotMatch(payroll, /delete from public\.attendance_submissions/);
    assert.doesNotMatch(payroll, /update public\.attendance_days/);
    assert.doesNotMatch(payroll, /insert into public\.attendance_events/);
  });

  test("statements snapshot approved attendance only", () => {
    assert.match(sql, /lifecycle_state = 'APPROVED'/);
  });

  test("all salary tables are RLS and FORCE RLS with writes revoked", () => {
    assert.match(sql, /alter table public\.salary_profiles force row level security/);
    assert.match(sql, /alter table public\.salary_payments force row level security/);
    assert.match(sql, /revoke insert, update, delete on table/);
  });

  test("salary.manage is Super Admin only and salary.self is broad", () => {
    assert.match(sql, /where r\.code = 'super_admin'[\s\S]{0,200}salary\.manage/);
    assert.match(sql, /'sales_manager', 'sales_executive', 'project_manager', 'designer'/);
  });

  test("routes exist for the list and detail surfaces", () => {
    assert.ok(existsSync(join(root, "src/app/admin/salary/page.tsx")));
    assert.ok(existsSync(join(root, "src/app/admin/salary/[id]/page.tsx")));
  });

  test("staff surface is read-only", () => {
    const detail = read(
      "src/features/staff-salary/components/SalaryStatementDetailView.tsx"
    );
    // Every mutating control is behind canManage.
    assert.match(detail, /canManage && editable/);
    assert.match(detail, /canManage \? \(/);
    const list = read("src/features/staff-salary/components/SalaryStatementList.tsx");
    assert.doesNotMatch(list, /<form/);
  });
});
