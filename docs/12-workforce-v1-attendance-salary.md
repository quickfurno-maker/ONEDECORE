# 12 — WORKFORCE V1: ATTENDANCE, SALARY & PAYMENT LOCK

**Document Status:** Owner-Locked Business Rules
**Owner lock date:** 2026-09-02
**Governing decision:** **DEC-0098** — `WORKFORCE_V1_ATTENDANCE_SALARY_LOCK`
**Baseline at lock:** protected `main` `204669b29bcbb30bfe06c7e67270cc3ad4355c97`
**Execution authority:** [docs/11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md). Workforce operational activation is sequenced as **P5**.

This document records the owner-locked workforce rules. It **extends** the Phase 6D foundation (M23/M24) and does not replace it; Phase 6D evidence remains valid and is preserved.

---

## 1. Weekly Off

- **There is NO fixed weekly-off weekday.** No recurring Sunday, Saturday, second-Saturday or any other calendar rule may be hard-coded or generated.
- Weekly Off is chosen **day-by-day**, and **staff may submit it themselves** as their daily attendance.
- **Cap: 4 Weekly Off days per employee per calendar month**, keyed on `attendance_date` in **Asia/Kolkata**.
  - The cap counts **ACTIVE** days: pending **plus** approved.
  - A **rejected** or **correction-returned** Weekly Off **frees a slot**.
  - A staff member cannot hold a 5th active Weekly Off in a month.
- **Super Admin approval is still required** before a Weekly Off becomes final. Super Admin **must not** approve a fifth — the cap is a **hard limit**, enforced on the approval path too, **including historical correction**.
- **No automatic Weekly Off generation.**

> **Schema note.** Phase 6D's `attendance_policies.weekly_off_days` required **at least one** recurring weekly-off weekday. That contradicted this lock, so migration `20260902160000` relaxes the constraint to allow an **empty** array. The column is retained for history but is **not consulted** by V1.

## 2. Daily attendance categories

| Category | Credited hours |
| :--- | :--- |
| `ABSENT` | 0 |
| `WEEKLY_OFF` | 0 credited (see §9 — **paid**, no automatic deduction) |
| `HALF_DAY_4H` | 4 |
| `FULL_DAY_8H` | 8 |
| `FULL_DAY_12H` | 12 |

- Final attendance is **never inferred from elapsed wall-clock time**.
- **Raw timestamps are stored separately from credited attendance**: `attendance_events` (raw, server-timestamped) → `attendance_days` (derived facts) → `attendance_submissions` (submission, approval, **final credited category**).
- **Staff may not submit `ABSENT`.** Only a Super Admin can mark absence.

## 3. Work timing

- Official start **09:00**; grace **15 minutes**.
- **Up to and including 09:15 = on time. 09:16 onward = late.**
- `late_minutes` is measured **from the official start** (09:16 → **16**; 10:00 → **60**), computed deterministically in **Asia/Kolkata**.
- 8-hour pattern ≈ 09:00–18:00; 12-hour pattern ≈ 09:00–21:00.
- **Lateness never automatically downgrades attendance.** It is evidence for the Super Admin.

## 4. Staff authority

**Staff can:** Check In, Check Out, see raw In/Out times, elapsed duration and late status; submit one of Weekly Off / 4H / 8H / 12H; request a correction; view own daily and monthly attendance; view own salary statements and payment history.

**Staff cannot:** mark themselves Absent; edit server-recorded timestamps; approve their own attendance; alter approved attendance, salary or payments; touch another employee's data.

Check In / Check Out are **server-timestamped**. A client-reported time is retained as evidence only (`attendance_events.client_reported_at`) and is never authoritative.

## 5. Lifecycle

```
NOT_STARTED → CHECKED_IN → CHECKED_OUT → SUBMITTED → PENDING_APPROVAL
                                                        ├─ APPROVED
                                                        ├─ REJECTED
                                                        └─ CORRECTION_REQUIRED
```

**Only `APPROVED` attendance is final, official and payroll-valid.**

**Super Admin is the only role** that may approve, reject, return for correction, set or change the final category, correct In/Out times, mark Absent, or correct history. Authority is the `attendance.approve` permission, granted to `super_admin` only.

**Managers** keep **read-only** team attendance visibility (`attendance.team.read`) and **must not approve** in V1.

## 6. Missing attendance

A day that closes without a valid submission is surfaced as **UNRESOLVED / MISSING_ATTENDANCE**. It is **never auto-marked Absent**. Only a Super Admin decision turns it into a final category.

## 7. Approval inbox

Each row shows employee, date, In/Out time, elapsed duration, submitted category, final category, late minutes / on-time, exception flags and approval state.

**Exception flags:** `LATE`, `MISSING_CHECK_IN`, `MISSING_CHECK_OUT`, `VERY_SHORT_ATTENDANCE`, `WEEKLY_OFF_QUOTA_ISSUE`, `UNAPPROVED`, `MANUALLY_EDITED`, `MISSING_ATTENDANCE`.

**Actions:** Approve · Edit + Approve · Reject · Send for Correction · Approve Selected.

**Bulk approval never bypasses validation or the Weekly Off quota.** Rows carrying a flag that needs a human decision are excluded from bulk selection, and the server re-validates every row individually.

## 8. Auditability

Every meaningful mutation preserves **previous value, new value, changed by, changed at** and a reason where relevant, in the append-only `attendance_submission_events`. **Approved historical attendance is never silently overwritten.**

## 9. Salary *(model locked; implemented in PR C)*

- Salary is decided and controlled by **Super Admin**.
- **Effective-dated versioned salary profile**: employee, monthly base salary, `effective_from`, `effective_to` (or open-ended current version), `set_by`, `created_at`.
- **Salary history is never overwritten.** A revision creates a **new effective version**.
- **V1 basis is monthly salary only.** No tax/TDS/PF/ESI/CTC engine, no statutory filing, no automatic deduction policy.
- **Attendance and payroll stay separate**: attendance records facts and approval; salary **consumes** approved attendance; **payroll never mutates attendance**.
- **`WEEKLY_OFF` is a paid day.** It appears in the statement summary and carries **no automatic deduction**. `ABSENT` likewise produces a deduction **only** as an explicit admin line item — V1 invents no deduction formula.

### Monthly salary statement

Employee, salary month, salary profile version used, base salary, approved-attendance summary (Absent / Weekly Off / 4H / 8H / 12H / late-day counts), additions, deductions, net payable, status.

Additions and deductions are **admin-controlled line items**: bonus, incentive, overtime, advance recovery, absence deduction, other addition, other deduction.

Super Admin reviews and **finalizes**. Once finalized, historical integrity is preserved; correction uses a **controlled amendment/reopen workflow with audit evidence**, never a silent overwrite.

## 10. Payment ledger *(model locked; implemented in PR C)*

Salary **payable** and **payment** are separate. State is **derived**: `unpaid` / `partially paid` / `paid` — never a single `salary_paid` boolean.

Multiple payments may be recorded against one statement. Each payment records employee, statement/month, amount paid, payment date, method (**bank / UPI / cash / other**), optional reference, optional note, `recorded_by`, `created_at`. Totals paid and balance remaining are computed.

Staff may **view** their own statements and payment history and **cannot mutate** them.

## 11. Android readiness

The future Android staff app is a **first-class** requirement. Attendance logic must never depend on browser-only state; authorization and validation live in server/RPC/domain contracts shared by both clients.

Shared domain vocabulary lives in `src/features/staff-attendance/contracts/workforce-contracts.ts` — pure, framework-free, with no React/Next/DOM dependency.

The Android flow must support: Check In, Check Out, daily submission, Weekly Off submission (4/month cap), correction request, own attendance history, own salary statements, own payment history.

**The Android app is not built in this task.**

## 12. Explicitly out of scope for V1

Tax engine · statutory payroll compliance · PF/ESI · payslip tax calculations · biometric attendance · GPS/geofencing · face recognition · complex shift rosters · automatic salary penalties · fixed weekly-off schedules.

---

## 13. Implementation status

| Piece | Status |
| :--- | :--- |
| Staff create form value preservation | **MERGED** (PR #123) |
| Attendance lifecycle migration `20260902160000` | **MERGED** (PR #124) — repository only, **not applied to managed** |
| Attendance lifecycle pgTAP (59 assertions) | **MERGED** (PR #124) |
| Workforce domain contracts + server actions | **MERGED** (PR #124) |
| Admin approval inbox UI / staff submission UI | **MERGED** (PR #125) |
| Salary profile, statement, payment ledger | **In PR C** — migration `20260902170000`, repository only |
| Managed migration apply | **Pending owner authorization + backup/PITR gate** |
| Production deployment | **Pending** |

---

## 14. Related documents

- [11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md) — current execution authority
- [10 — Decision Register](10-decision-register.md) — **DEC-0098**
- [00 — Project Truth](00-project-truth.md)
- [ADR-0023: Staff attendance architecture](ADR/ADR-0023-staff-attendance-leave-architecture.md)
- [Phase 6D architecture freeze](audits/phase-6d-staff-attendance-leave-architecture-freeze.md)
