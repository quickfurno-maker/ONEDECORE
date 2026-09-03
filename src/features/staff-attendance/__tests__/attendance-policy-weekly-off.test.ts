/**
 * Legacy weekly-off parsing for attendance policy publishing.
 *
 * Workforce V1 has NO fixed weekly-off weekday, so blank is the normal input and
 * must produce []. The previous parser used Number(""), which is 0, turning a
 * blank field into [0] — a Sunday nobody asked for, and a value outside the
 * column's ISO 1..7 domain. It also filtered invalid tokens silently, so a typo
 * could quietly change the published policy.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { parseLegacyWeeklyOffDays } from "../contracts/workforce-contracts.ts";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/**
 * Strips SQL comments. The migration legitimately DESCRIBES the old rule and
 * the rejected values in prose, so assertions must look at what actually runs.
 */
const executableSql = (relative: string) =>
  read(relative)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const MIGRATION =
  "supabase/migrations/20260903140000_attendance_policy_publish_weekly_off_optional.sql";
const FORM = "src/features/staff-attendance/components/AttendancePolicyForm.tsx";
const ACTIONS = "src/features/staff-attendance/server/attendance-form-actions.ts";

function days(raw: string): readonly number[] {
  const result = parseLegacyWeeklyOffDays(raw);
  assert.equal(result.ok, true, `expected "${raw}" to parse`);
  return result.ok ? result.days : [];
}

function failure(raw: string): string {
  const result = parseLegacyWeeklyOffDays(raw);
  assert.equal(result.ok, false, `expected "${raw}" to be rejected`);
  return result.ok ? "" : result.message;
}

describe("weekly-off parsing — blank is the V1 default", () => {
  test("blank input produces an empty array", () => {
    assert.deepEqual([...days("")], []);
  });

  test("whitespace-only input produces an empty array", () => {
    assert.deepEqual([...days("   ")], []);
    assert.deepEqual([...days("\t")], []);
  });

  test("tabs and newlines count as blank", () => {
    assert.deepEqual([...days("\t\n")], []);
    assert.deepEqual([...days("\n  \t ")], []);
  });

  test("blank NEVER becomes [0]", () => {
    // The exact regression: Number("") === 0.
    // Comma-only values are deliberately NOT in this list: once the field is
    // non-blank they are malformed input, asserted separately below.
    for (const blank of ["", " ", "  ", "\t", "\n", " \t\n "]) {
      const parsed = days(blank);
      assert.equal(parsed.length, 0, `"${blank}" must not yield a weekday`);
      assert.ok(!parsed.includes(0), `"${blank}" must never yield 0`);
    }
  });
});

describe("weekly-off parsing — malformed separators fail closed", () => {
  test("a comma with no weekdays is malformed, not blank", () => {
    // Previously the empty-token filter collapsed these to [] and published a
    // policy the operator never described.
    assert.match(failure(","), /extra comma/i);
    assert.match(failure(" , "), /extra comma/i);
    assert.match(failure(",,"), /extra comma/i);
  });

  test("a trailing comma is rejected", () => {
    assert.match(failure("1,"), /extra comma/i);
    assert.match(failure("6,7,"), /extra comma/i);
  });

  test("a leading comma is rejected", () => {
    assert.match(failure(",1"), /extra comma/i);
    assert.match(failure(",6,7"), /extra comma/i);
  });

  test("a doubled or whitespace-only inner separator is rejected", () => {
    assert.match(failure("1,,2"), /extra comma/i);
    assert.match(failure("1, ,2"), /extra comma/i);
    assert.match(failure("1,\t,2"), /extra comma/i);
  });

  test("malformed separators never yield a partial day list", () => {
    // The danger is silently publishing [1,2] from "1,,2".
    for (const malformed of [",", " , ", "1,", ",1", "1,,2", "1, ,2"]) {
      assert.equal(
        parseLegacyWeeklyOffDays(malformed).ok,
        false,
        `"${malformed}" must be rejected outright`
      );
    }
  });
});

describe("weekly-off parsing — legacy ISO 1..7 remains supported", () => {
  test("single weekday", () => {
    assert.deepEqual([...days("7")], [7]);
    assert.deepEqual([...days("1")], [1]);
  });

  test("multiple weekdays are sorted for the database", () => {
    assert.deepEqual([...days("6,7")], [6, 7]);
    assert.deepEqual([...days("7,6")], [6, 7]);
    assert.deepEqual([...days("3,1,2")], [1, 2, 3]);
  });

  test("surrounding whitespace is tolerated", () => {
    assert.deepEqual([...days(" 6 , 7 ")], [6, 7]);
  });

  test("every ISO weekday is accepted", () => {
    assert.deepEqual([...days("1,2,3,4,5,6,7")], [1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("weekly-off parsing — invalid input is reported, not filtered", () => {
  test("0 is out of range and reported", () => {
    // Previously 0 passed the 0..6 filter and reached the database.
    assert.match(failure("0"), /out of range/i);
  });

  test("8 is out of range and reported", () => {
    assert.match(failure("8"), /out of range/i);
  });

  test("a non-numeric token is reported rather than dropped", () => {
    assert.match(failure("sun"), /not a weekday number/i);
    assert.match(failure("6,sat"), /not a weekday number/i);
    assert.match(failure("1.5"), /not a weekday number/i);
    assert.match(failure("-1"), /not a weekday number/i);
  });

  test("duplicates are reported, matching the database rule", () => {
    assert.match(failure("7,7"), /more than once/i);
  });

  test("one bad token invalidates the whole input", () => {
    // Silent filtering would have published [6] and lost the user's intent.
    assert.equal(parseLegacyWeeklyOffDays("6,9").ok, false);
  });
});

describe("policy publishing — surface contract", () => {
  test("the UI field is optional and labelled with ISO weekdays", () => {
    const form = read(FORM);
    assert.match(form, /Legacy weekly-off days \(optional, 1=Mon … 7=Sun\)/);
    assert.match(form, /Leave blank for Workforce V1\. Weekly Off is selected day-by-day\./);
    // The misleading 0=Sun…6=Sat labelling is gone.
    assert.doesNotMatch(form, /0=Sun/);

    // `required` must not apply to the weekly-off input.
    const field = form.slice(
      form.indexOf('name="weeklyOffDays"'),
      form.indexOf("weeklyOffDays-hint\" className")
    );
    assert.doesNotMatch(field, /\brequired\b/);
  });

  test("the server action uses the strict parser and surfaces errors", () => {
    const actions = read(ACTIONS);
    assert.match(actions, /parseLegacyWeeklyOffDays/);
    assert.match(actions, /if \(!weeklyOff\.ok\)/);
    // The old blank-to-zero parser is gone.
    assert.doesNotMatch(actions, /value >= 0 && value <= 6/);
  });

  test("the migration accepts empty and constrains non-empty to ISO 1..7", () => {
    const sql = executableSql(MIGRATION);
    assert.match(sql, /create or replace function public\.publish_attendance_policy/);
    // Empty is allowed: the length check now gates only the content rules.
    assert.match(sql, /coalesce\(array_length\(p_weekly_off_days, 1\), 0\) > 0/);
    assert.doesNotMatch(sql, /coalesce\(array_length\(p_weekly_off_days, 1\), 0\) < 1/);
    assert.match(sql, /where d < 1 or d > 7/);
    // NULL stays invalid.
    assert.match(sql, /if p_weekly_off_days is null then/);
  });

  test("the migration preserves authorization and never activates", () => {
    const sql = executableSql(MIGRATION);
    assert.match(sql, /public\.authorize\('attendance\.policies\.manage'\)/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /owner to postgres/);
    assert.match(sql, /grant execute on function public\.publish_attendance_policy/);
    // is_current stays false: activation remains a separate act.
    assert.match(sql, /coalesce\(p_location_required, false\), false, p_supersedes_policy_id/);
    assert.doesNotMatch(sql, /set_current_attendance_policy/);
  });

  test("no applied migration is edited", () => {
    // M23, M51 and M52 are applied in managed and must stay byte-identical.
    const sql = executableSql(MIGRATION);
    assert.doesNotMatch(sql, /alter table public\.attendance_policies/);
    assert.doesNotMatch(sql, /drop constraint/);
  });
});
