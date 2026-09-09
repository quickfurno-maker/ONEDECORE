/**
 * The dependency-advisory policy, and the csv-parse reachability finding.
 *
 * The policy half runs the real functions the guard composes against synthetic
 * audit payloads, so "a production high fails the build" is demonstrated rather
 * than asserted about the guard's source text.
 *
 * The csv-parse half is a live reachability probe. GHSA-8cw4-87c7-c6xx says
 * prototype replacement is still reachable "via the columns path", and this
 * importer parses attacker-supplied files with `columns: true`. The moderate
 * was classified NOT_REACHABLE under this option set by running it; keeping the
 * probe means a future csv-parse bump, or a change to those options, re-checks
 * the finding instead of inheriting a claim someone made once.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parse as parseCsv } from "csv-parse/sync";

import {
  BLOCKING_SEVERITIES,
  classifyFindings,
  collectFindings,
  REQUIRED_EXCEPTION_FIELDS,
  validateExceptions,
} from "../../../scripts/lib/dependency-policy.mjs";

// ------------------------------------------------------------------ policy ---

/** An `npm audit --json` payload, cut down to the fields the policy reads. */
function audit(
  entries: ReadonlyArray<{
    name: string;
    severity: string;
    id?: number | string;
    direct?: boolean;
    viaPackage?: string;
  }>
) {
  const vulnerabilities: Record<string, unknown> = {};
  for (const entry of entries) {
    vulnerabilities[entry.name] = {
      name: entry.name,
      severity: entry.severity,
      isDirect: entry.direct ?? false,
      range: "<1.0.0",
      via: entry.viaPackage
        ? [entry.viaPackage]
        : [
            {
              source: entry.id ?? 1000,
              title: `${entry.name} advisory`,
              url: `https://github.com/advisories/GHSA-${entry.name}`,
              severity: entry.severity,
              range: "<1.0.0",
            },
          ],
    };
  }
  return { vulnerabilities, metadata: { vulnerabilities: {} } };
}

function completeException(overrides: Record<string, string> = {}) {
  return {
    advisory: "1234",
    package: "left-pad",
    severity: "high",
    path: "app > left-pad",
    whyNoSafePatch: "upstream has published no fixed release",
    reachability: "not reachable: the affected API is never called",
    compensatingControl: "input is bounded at 5 MiB upstream",
    reviewBy: "2099-01-01",
    removeWhen: "left-pad 2.0.0 ships",
    ...overrides,
  };
}

describe("what fails the build", () => {
  const noExceptions = new Map();

  test("a production critical blocks", () => {
    const { blocking } = classifyFindings(
      collectFindings(audit([{ name: "bad-lib", severity: "critical" }])),
      noExceptions
    );
    assert.equal(blocking.length, 1);
    assert.equal(blocking[0]?.package, "bad-lib");
  });

  test("a production high blocks", () => {
    const { blocking } = classifyFindings(
      collectFindings(audit([{ name: "bad-lib", severity: "high" }])),
      noExceptions
    );
    assert.equal(blocking.length, 1);
  });

  test("moderate and low are reported, never blocking", () => {
    /*
     * Deliberate. A guard that fails a release on every moderate gets bypassed,
     * and a guard people bypass protects nothing. Moderates are surfaced in the
     * output and dealt with on their merits.
     */
    const { blocking, reported } = classifyFindings(
      collectFindings(
        audit([
          { name: "meh-lib", severity: "moderate" },
          { name: "minor-lib", severity: "low" },
        ])
      ),
      noExceptions
    );
    assert.deepEqual(blocking, []);
    assert.equal(reported.length, 2);
  });

  test("a clean audit blocks nothing", () => {
    const { blocking, reported } = classifyFindings(collectFindings(audit([])), noExceptions);
    assert.deepEqual(blocking, []);
    assert.deepEqual(reported, []);
  });

  test("both blocking severities are exactly critical and high", () => {
    assert.deepEqual([...BLOCKING_SEVERITIES].sort(), ["critical", "high"]);
  });
});

describe("how a finding is counted", () => {
  test("a package vulnerable only through a dependency is not double-counted", () => {
    /*
     * This is the exceljs/uuid shape: npm lists exceljs as vulnerable with a
     * string `via` naming uuid, while the advisory itself sits on uuid. Counting
     * both would report one finding twice and make the totals lie.
     */
    const findings = collectFindings(
      audit([
        { name: "uuid", severity: "moderate", id: 1119441 },
        { name: "exceljs", severity: "moderate", viaPackage: "uuid" },
      ])
    );
    assert.deepEqual(
      findings.map((finding) => finding.package),
      ["uuid"]
    );
  });

  test("the advisory id is carried through so an exception can name it", () => {
    const findings = collectFindings(audit([{ name: "bad-lib", severity: "high", id: 4242 }]));
    assert.equal(findings[0]?.id, "4242");
  });
});

describe("exceptions are reviewed decisions, not an ignore list", () => {
  const today = "2026-09-09";

  test("a complete, in-date exception excuses exactly its own advisory", () => {
    const { valid, problems } = validateExceptions([completeException({ advisory: "4242" })], today);
    assert.deepEqual(problems, []);

    const { blocking, excused } = classifyFindings(
      collectFindings(
        audit([
          { name: "excused-lib", severity: "high", id: 4242 },
          { name: "other-lib", severity: "high", id: 9999 },
        ])
      ),
      valid
    );
    // The second high is untouched: exceptions are per-advisory, and there is
    // no "ignore this package" switch.
    assert.equal(excused.length, 1);
    assert.equal(blocking.length, 1);
    assert.equal(blocking[0]?.id, "9999");
  });

  test("an exception missing any required field is rejected", () => {
    for (const field of REQUIRED_EXCEPTION_FIELDS) {
      const incomplete = completeException();
      delete (incomplete as Record<string, unknown>)[field];
      const { valid, problems } = validateExceptions([incomplete], today);
      assert.equal(valid.size, 0, `${field} should be required`);
      assert.equal(problems.length, 1);
      assert.match(problems[0] ?? "", new RegExp(`INCOMPLETE[\\s\\S]*${field}`));
    }
  });

  test("an expired exception fails instead of quietly continuing", () => {
    // Without this, an exception file becomes permanent by inattention.
    const { valid, problems } = validateExceptions(
      [completeException({ reviewBy: "2026-09-08" })],
      today
    );
    assert.equal(valid.size, 0);
    assert.match(problems[0] ?? "", /EXPIRED/);
  });

  test("an exception expiring today is still valid", () => {
    const { valid, problems } = validateExceptions(
      [completeException({ reviewBy: today })],
      today
    );
    assert.equal(valid.size, 1);
    assert.deepEqual(problems, []);
  });

  test("no exception file is needed while nothing is excused", () => {
    const { valid, problems } = validateExceptions([], today);
    assert.equal(valid.size, 0);
    assert.deepEqual(problems, []);
  });
});

// ------------------------------------------------------- csv-parse finding ---

describe("csv-parse prototype replacement is not reachable here", () => {
  /** Exactly the options `lead-import-file-parser.ts` passes. */
  const IMPORT_OPTIONS = {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  } as const;

  function parse(text: string) {
    return parseCsv(text, IMPORT_OPTIONS) as Record<string, string>[];
  }

  test("a __proto__ header does not reach Object.prototype", () => {
    const records = parse("__proto__,name\npolluted,alice\n");
    assert.equal(
      Object.prototype.hasOwnProperty.call(Object.prototype, "polluted"),
      false
    );
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    // The column is dropped rather than assigned.
    assert.deepEqual(Object.keys(records[0] ?? {}), ["name"]);
  });

  test("a constructor header is an ordinary key", () => {
    const records = parse("constructor,name\nvalue,alice\n");
    assert.equal(records[0]?.constructor as unknown, "value");
    assert.equal(Object.getPrototypeOf(records[0]), Object.prototype);
  });

  test("dotted proto keys are not expanded into a path", () => {
    // The importer does not enable column grouping, so a dotted header is just
    // a header with dots in it.
    const records = parse("a.__proto__.polluted,name\nyes,alice\n");
    assert.deepEqual(Object.keys(records[0] ?? {}), ["a.__proto__.polluted", "name"]);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });

  test("ordinary import headers still parse", () => {
    const records = parse("submitted_name,phone\nAsha,+919000000001\n");
    assert.deepEqual(records, [{ submitted_name: "Asha", phone: "+919000000001" }]);
  });
});
