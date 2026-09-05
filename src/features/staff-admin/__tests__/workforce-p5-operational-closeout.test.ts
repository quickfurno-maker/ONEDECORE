import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * P5 workforce operational closeout.
 *
 * The whole risk in this phase is a repository change being presented as a live
 * activation. These tests hold the line in both directions: the launch
 * catalogue really is seeded, and everything that carries a real person, a real
 * date or real money is really absent.
 */

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The migration WITHOUT its comments.
 *
 * M57 deliberately names what it refuses to do — "no invented CTC", 
 * "`attendance.correct.team` remains absent", "the password is owner-private".
 * Searching the raw text for those words finds the explanation rather than a
 * violation, so every "must not contain" assertion runs against executable SQL.
 */
const executableSql = (rel: string) =>
  read(rel)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const M57 = "supabase/migrations/20260904170000_workforce_p5_launch_catalogue.sql";
const PGTAP = "supabase/tests/database/47_workforce_p5_launch_catalogue_test.sql";
const DOC12 = "docs/12-workforce-v1-attendance-salary.md";
const DOC11 = "docs/11-accelerated-closeout-roadmap.md";
const DEC = "docs/10-decision-register.md";
const AUDIT = "docs/audits/p5-workforce-operational-closeout.md";
const STAFF_PANEL = "src/features/staff-admin/components/StaffDetailPanel.tsx";
const LOGIN_PANEL = "src/features/staff-admin/components/StaffLoginAccessPanel.tsx";
/** The password fields now live here, with the live checklist and status. */
const PASSWORD_SECTION =
  "src/features/staff-admin/components/StaffPasswordSection.tsx";
const LEAVE_ADMIN = "src/features/staff-leave/components/LeaveTypeAdmin.tsx";

/* ========================================================================== */
/* 1. The launch leave catalogue                                               */
/* ========================================================================== */

describe("M57 seeds exactly the owner-approved launch catalogue", () => {
  test("all three codes and names appear verbatim", () => {
    const sql = read(M57);
    for (const [code, name] of [
      ["casual", "Casual Leave"],
      ["sick", "Sick Leave"],
      ["unpaid", "Unpaid Leave"],
    ]) {
      assert.match(sql, new RegExp(`'code', '${code}'`), `missing code ${code}`);
      assert.match(sql, new RegExp(`'display_name', '${name}'`), `missing name ${name}`);
    }
  });

  test("no fourth leave type is smuggled in", () => {
    const sql = read(M57);
    const codes = sql.match(/'code', '([a-z_]+)'/g) ?? [];
    assert.equal(codes.length, 3, "exactly three leave types");
  });

  test("half-day LEAVE is disabled on every launch type", () => {
    const sql = read(M57);
    // One insert, with allows_half_day hard-coded false.
    assert.match(sql, /values \(v_entry->>'code', v_entry->>'display_name', false, true\)/);
    assert.doesNotMatch(sql, /allows_half_day.*true/);
  });

  test("the attendance HALF_DAY_4H category is explicitly left alone", () => {
    const sql = read(M57);
    // The distinction is stated in the migration itself, so a later reader
    // cannot mistake the leave setting for the attendance category.
    assert.match(sql, /HALF_DAY_4H/);
    assert.match(sql, /LEAVE capability only/);
    // In executable SQL the category is named ONLY inside the table comment
    // that records the distinction — never in DDL or DML.
    const code = executableSql(M57);
    // Strip from the first `comment on` to the end: a non-greedy match would
    // stop at a semicolon INSIDE the comment string and leave text behind.
    const outsideComment = code.replace(/comment on [\s\S]*$/, "");
    assert.doesNotMatch(outsideComment, /HALF_DAY_4H|FULL_DAY_8H|FULL_DAY_12H/);
    assert.doesNotMatch(code, /alter table public\.attendance/);
    assert.doesNotMatch(code, /insert into public\.attendance/i);
  });

  test("it is forward-only and edits no applied migration", () => {
    const files = readdirSync(join(root, "supabase/migrations")).filter((n) =>
      n.endsWith(".sql")
    );
    const sorted = [...files].sort();
    assert.equal(
      sorted[sorted.length - 1],
      "20260904170000_workforce_p5_launch_catalogue.sql",
      "M57 must sort last"
    );
    // M55 and M56 are still present and untouched by name.
    assert.ok(files.includes("20260904140000_interior_room_wise_quotation.sql"));
    assert.ok(files.includes("20260904150000_crm_manual_sales_temperature.sql"));
  });

  test("a conflicting pre-existing leave type fails loudly", () => {
    const sql = read(M57);
    assert.match(sql, /WORKFORCE_P5_LEAVE_TYPE_CONFLICT/);
    assert.match(sql, /Refusing to overwrite existing business data/);
    // Never a blind upsert over business configuration.
    assert.doesNotMatch(sql, /on conflict[\s\S]{0,40}do update/i);
  });

  test("an exact re-run is idempotent rather than an error", () => {
    const sql = read(M57);
    assert.match(sql, /Idempotent re-run, nothing to do/);
  });
});

/* ========================================================================== */
/* 2. What M57 must never contain                                              */
/* ========================================================================== */

describe("M57 creates nothing operational", () => {
  // Executable SQL only — the comments name these very things on purpose.
  const sql = executableSql(M57);

  test("no holiday is seeded", () => {
    assert.doesNotMatch(sql, /insert into public\.holidays/i);
  });

  test("no salary, statement or payment value is invented", () => {
    for (const table of ["salary_profiles", "salary_statements", "salary_payments"]) {
      assert.doesNotMatch(sql, new RegExp(`insert into public\\.${table}`, "i"));
      assert.doesNotMatch(sql, new RegExp(`update public\\.${table}`, "i"));
    }
    // No money literal of any kind in executable SQL.
    assert.doesNotMatch(sql, /_paise|amount|ctc|salary_amount/i);
  });

  test("no staff row is created or mutated", () => {
    assert.doesNotMatch(sql, /insert into public\.staff_employment_profiles/i);
    assert.doesNotMatch(sql, /update public\.staff_employment_profiles/i);
    assert.doesNotMatch(sql, /attendance_eligible/);
    // No named person, and specifically not the placeholder the owner banned.
    assert.doesNotMatch(sql, /SM001/);
    assert.doesNotMatch(sql, /kk\s*sharma/i);
    assert.doesNotMatch(sql, /employee_code/);
  });

  test("no attendance data is fabricated", () => {
    for (const table of ["attendance_events", "attendance_days", "attendance_submissions"]) {
      assert.doesNotMatch(sql, new RegExp(`insert into public\\.${table}`, "i"));
    }
  });

  test("no permission is granted or revoked", () => {
    assert.doesNotMatch(sql, /insert into public\.role_permissions/i);
    assert.doesNotMatch(sql, /attendance\.correct\.team/);
  });

  test("the attendance policy is not touched", () => {
    assert.doesNotMatch(sql, /insert into public\.attendance_policies/i);
    assert.doesNotMatch(sql, /update public\.attendance_policies/i);
    assert.doesNotMatch(sql, /weekly_off_days\s*=/);
    assert.doesNotMatch(sql, /location_required\s*=/);
  });

  test("no credential or password material appears", () => {
    assert.doesNotMatch(sql, /password|auth\.users|credential/i);
  });
});

/* ========================================================================== */
/* 3. The database contract proves it too                                      */
/* ========================================================================== */

describe("the pgTAP suite asserts the same boundary", () => {
  const sql = read(PGTAP);

  test("it proves the catalogue shape", () => {
    assert.match(sql, /'Casual Leave'/);
    assert.match(sql, /'Sick Leave'/);
    assert.match(sql, /'Unpaid Leave'/);
    assert.match(sql, /where allows_half_day\),\n  0,/);
  });

  test("it proves the empty tables", () => {
    for (const table of [
      "holidays",
      "salary_profiles",
      "salary_statements",
      "salary_payments",
      "staff_employment_profiles",
      "attendance_events",
      "attendance_days",
      "attendance_submissions",
    ]) {
      assert.match(sql, new RegExp(`from public\\.${table}`), `no assertion for ${table}`);
    }
  });

  test("it proves the sales_manager permission boundary", () => {
    assert.match(sql, /attendance\.correct\.team/);
    assert.match(sql, /attendance\.team\.read/);
    assert.match(sql, /leave\.team\.approve/);
    assert.match(sql, /SUPER ADMIN retains attendance\.correct\.team/);
  });

  test("it proves approved leave stays non-cancellable", () => {
    assert.match(sql, /LEAVE_NOT_CANCELLABLE/);
  });

  test("it proves the weekly-off cap survives", () => {
    assert.match(sql, /workforce_weekly_off_active_count/);
  });

  test("it does not assert managed facts from a repository database", () => {
    // The live attendance policy is operational data; a fresh repo DB has none.
    assert.match(sql, /M57 seeds NO attendance policy/);
    assert.match(sql, /asserting a managed fact from a\n-- repository test/);
  });
});

/* ========================================================================== */
/* 4. Governance records the decisions exactly                                 */
/* ========================================================================== */

describe("the owner decisions are recorded, not implied", () => {
  test("DEC-0099 exists and states every locked value", () => {
    const dec = read(DEC);
    assert.match(dec, /DEC-0099\*\* \| WORKFORCE_P5_OPERATIONAL_LAUNCH_LOCK/);
    assert.match(dec, /Sales Manager attendance is \*\*TRACKED\*\*/);
    assert.match(dec, /may NOT\*\* correct direct-report attendance/);
    assert.match(dec, /`casual` Casual Leave, `sick` Sick Leave, `unpaid` Unpaid Leave/);
    assert.match(dec, /Half-day \*\*LEAVE\*\* capability is \*\*NOT approved at launch\*\*/);
    assert.match(dec, /LEAVE_NOT_CANCELLABLE/);
    assert.match(dec, /holiday calendar starts \*\*EMPTY\*\*/);
    assert.match(dec, /Location capture is \*\*optional\*\*/);
    assert.match(dec, /\*\*No\*\* fixed weekly-off weekday/);
    assert.match(dec, /remain UNSET BY DESIGN/);
    assert.match(dec, /password is \*\*owner-private\*\*/);
  });

  test("docs/12 records the launch decisions and drops the stale PR-C wording", () => {
    const doc = read(DOC12);
    assert.match(doc, /P5 owner launch decisions/);
    assert.match(doc, /Casual Leave/);
    assert.match(doc, /Intentionally EMPTY/);
    assert.doesNotMatch(doc, /In PR C/);
    assert.doesNotMatch(doc, /implemented in PR C/);
    // Schema is stated as already merged AND managed.
    assert.match(doc, /MERGED and APPLIED to managed/);
    assert.match(doc, /PUBLISHED on managed/);
    // Configuration vs operation is spelled out.
    assert.match(doc, /What is configuration and what is operation/);
  });

  test("docs/11 keeps the P1-P9 lock and does not claim E2E is done", () => {
    const doc = read(DOC11);
    assert.match(doc, /P1 ─► P2 ─► P3 ─► P4 ─► P5 ─► P6 ─► P7 ─► P8 ─► P9/);
    // P8 second-last, P9 final — unchanged.
    assert.match(doc, /### P8 —/);
    assert.match(doc, /### P9 —/);
    assert.ok(doc.indexOf("### P8 —") < doc.indexOf("### P9 —"));
    // The remaining gate is stated as owner-only and live.
    assert.match(doc, /Remaining gate is OWNER-ONLY and LIVE/);
    assert.match(
      doc,
      /The E2E is NOT complete and must not be reported as such/
    );
  });

  test("the audit separates readiness from apply, credentials and E2E", () => {
    const audit = read(AUDIT);
    assert.match(audit, /Repository readiness — DONE in this PR/);
    assert.match(audit, /Managed M57 apply — NOT DONE/);
    assert.match(audit, /Owner-only credential issuance — NOT DONE/);
    assert.match(audit, /Production attendance E2E — NOT DONE/);
    assert.match(audit, /No fake evidence/);
    // No PASS is claimed for anything that has not happened.
    assert.match(audit, /records \*\*no PASS\*\* for anything in sections 2–4/);
  });
});

/* ========================================================================== */
/* 5. The operational paths already exist and are preserved                    */
/* ========================================================================== */

describe("the activation paths are UI actions, not migration content", () => {
  test("staff detail still exposes the audited eligibility + policy path", () => {
    const panel = read(STAFF_PANEL);
    assert.match(panel, /name="attendanceEligible"/);
    assert.match(panel, /name="reason"/);
    // The reason is mandatory: an unattributed change to an employment record
    // is exactly what the migration boundary exists to prevent.
    assert.match(panel, /<input name="reason" required/);
    assert.match(panel, /Attendance policy/);

    // And it routes through the canonical audited RPC.
    const actions = read("src/features/staff-admin/server/staff-actions.ts");
    assert.match(actions, /update_staff_employment/);
  });

  test("the credential panel never reveals a STORED password", () => {
    /*
     * The password fields moved into `StaffPasswordSection`, which added a
     * "Show" toggle and a locally generated password — both operating on a
     * value the operator just entered in this form.
     *
     * The invariant that matters is unchanged and is asserted here against the
     * component that now owns the fields: an EXISTING password can never be read
     * back, and nothing from server state is ever placed into a password input.
     */
    const section = read(PASSWORD_SECTION);

    // Never seeded from anywhere: no defaultValue at all, and the only value
    // bound is the component's own local state.
    assert.doesNotMatch(section, /defaultValue=/);
    assert.match(section, /value=\{password\}/);
    assert.match(section, /value=\{confirmation\}/);

    // The server result object is never used to populate a field. `state.*` may
    // only be read for messages and the username.
    assert.doesNotMatch(section, /value=\{state\./);
    assert.doesNotMatch(section, /password=\{state\./);

    // A generated password is produced locally and never sent back or stored.
    assert.match(section, /generateStrongStaffPassword\(\)/);
    const stateShape = read(
      "src/features/staff-admin/contracts/staff-credential-form-state.ts"
    );
    assert.doesNotMatch(stateShape, /readonly password/);

    // And it is cleared once the server accepts, so it is never left on screen.
    assert.match(section, /state\.success[\s\S]{0,160}setPassword\(""\)/);
  });

  test("login uses the staff member's own mobile", () => {
    const panel = read(LOGIN_PANEL);
    assert.match(panel, /loginUsername|LoginUsername/);
  });

  test("the leave admin says the launch catalogue is owner-locked", () => {
    const admin = read(LEAVE_ADMIN);
    assert.match(admin, /P5 launch catalogue/);
    assert.match(admin, /owner-locked/);
    assert.match(admin, /read-only/);
    // It also explains the half-day distinction rather than leaving it implied.
    assert.match(admin, /Half-day leave is not approved at launch/);
    assert.match(admin, /Half Day \(4h\) attendance category/);
    // The stale reference is gone.
    assert.doesNotMatch(admin, /OD-9/);
  });

  test("no leave-type mutation RPC was invented for this MVP", () => {
    const admin = read(LEAVE_ADMIN);
    assert.doesNotMatch(admin, /create_leave_type|update_leave_type|delete_leave_type/);
    assert.doesNotMatch(read(M57), /create or replace function/i);
  });
});
