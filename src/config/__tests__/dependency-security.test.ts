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
  findStaleExceptions,
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
    /** Installed locations, as npm audit reports them in `nodes`. */
    nodes?: readonly string[];
  }>
) {
  const vulnerabilities: Record<string, unknown> = {};
  for (const entry of entries) {
    vulnerabilities[entry.name] = {
      name: entry.name,
      severity: entry.severity,
      isDirect: entry.direct ?? false,
      range: "<1.0.0",
      nodes: entry.nodes ?? [`node_modules/${entry.name}`],
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
    // The INSTALLED path, matched against npm audit's `nodes` — not prose.
    path: "node_modules/left-pad",
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

  test("a complete, in-date exception excuses exactly its own finding", () => {
    const { valid, problems } = validateExceptions(
      [completeException({ advisory: "4242", package: "excused-lib", path: "node_modules/excused-lib" })],
      today
    );
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
    // The second high is untouched: there is no "ignore this package" switch.
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

describe("an exception must match the whole finding, not just its id", () => {
  /*
   * The first version of this guard matched on advisory id alone while the
   * exception file went on asking for a package, a severity and a path that
   * nothing compared — documentation dressed as a control. A decision reviewed
   * for uuid under exceljs would have excused the same advisory arriving
   * through a different package, at a different severity, on a path nobody
   * looked at.
   */
  const today = "2026-09-10";

  /** The finding every case below is trying to excuse. */
  const target = audit([
    { name: "target-lib", severity: "high", id: 5150, nodes: ["node_modules/target-lib"] },
  ]);

  const matching = {
    advisory: "5150",
    package: "target-lib",
    severity: "high",
    path: "node_modules/target-lib",
  };

  function classify(exceptionOverrides: Record<string, string>) {
    const { valid } = validateExceptions(
      [completeException({ ...matching, ...exceptionOverrides })],
      today
    );
    return classifyFindings(collectFindings(target), valid);
  }

  test("the exact identity excuses it", () => {
    const { blocking, excused } = classify({});
    assert.deepEqual(blocking, []);
    assert.equal(excused.length, 1);
  });

  test("the right advisory on the wrong package does not", () => {
    const { blocking, excused } = classify({ package: "other-lib" });
    assert.equal(blocking.length, 1);
    assert.deepEqual(excused, []);
  });

  test("the right advisory at the wrong severity does not", () => {
    // A re-rated advisory is a decision to take again, not one to inherit.
    const { blocking, excused } = classify({ severity: "critical" });
    assert.equal(blocking.length, 1);
    assert.deepEqual(excused, []);
  });

  test("the right advisory on the wrong path does not", () => {
    const { blocking, excused } = classify({ path: "node_modules/elsewhere/node_modules/target-lib" });
    assert.equal(blocking.length, 1);
    assert.deepEqual(excused, []);
  });

  test("severity comparison ignores case and padding", () => {
    // Matching should turn on the decision, not on how someone typed it.
    const { blocking, excused } = classify({ severity: " HIGH " });
    assert.deepEqual(blocking, []);
    assert.equal(excused.length, 1);
  });

  test("a dependency that moves leaves its old exception behind", () => {
    /*
     * The same advisory and package, now installed somewhere else — a hoist
     * changed, or a parent started carrying its own copy. The finding blocks
     * again, which is the point: nobody has looked at the new path.
     */
    const moved = audit([
      {
        name: "target-lib",
        severity: "high",
        id: 5150,
        nodes: ["node_modules/some-parent/node_modules/target-lib"],
      },
    ]);
    const { valid } = validateExceptions([completeException(matching)], today);
    const { blocking, excused } = classifyFindings(collectFindings(moved), valid);
    assert.equal(blocking.length, 1);
    assert.deepEqual(excused, []);
  });

  test("one advisory at two paths needs two exceptions", () => {
    const twice = audit([
      {
        name: "target-lib",
        severity: "high",
        id: 5150,
        nodes: ["node_modules/target-lib", "node_modules/parent/node_modules/target-lib"],
      },
    ]);
    const { valid } = validateExceptions([completeException(matching)], today);
    const { blocking, excused } = classifyFindings(collectFindings(twice), valid);
    assert.equal(excused.length, 1, "the reviewed path is excused");
    assert.equal(blocking.length, 1, "the unreviewed path still blocks");
    assert.equal(blocking[0]?.path, "node_modules/parent/node_modules/target-lib");
  });
});

describe("findings carry their installed location", () => {
  test("each node path becomes its own finding", () => {
    const findings = collectFindings(
      audit([
        {
          name: "dup-lib",
          severity: "high",
          id: 77,
          nodes: ["node_modules/dup-lib", "node_modules/a/node_modules/dup-lib"],
        },
      ])
    );
    assert.deepEqual(
      findings.map((finding) => finding.path),
      ["node_modules/dup-lib", "node_modules/a/node_modules/dup-lib"]
    );
  });

  test("identity carries advisory, package, severity and path", () => {
    const [finding] = collectFindings(audit([{ name: "x-lib", severity: "high", id: 9 }]));
    assert.equal(finding?.id, "9");
    assert.equal(finding?.package, "x-lib");
    assert.equal(finding?.severity, "high");
    assert.equal(finding?.path, "node_modules/x-lib");
  });
});

describe("an exception that matches nothing is stale", () => {
  const today = "2026-09-10";

  test("a fixed advisory leaves a stale exception behind", () => {
    // Not harmless: an exception nothing checks is how a temporary decision
    // becomes permanent.
    const { valid } = validateExceptions([completeException()], today);
    const stale = findStaleExceptions(valid, collectFindings(audit([])));
    assert.equal(stale.length, 1);
    assert.equal(stale[0]?.advisory, "1234");
  });

  test("a clean audit with a non-empty exception file fails", () => {
    const { valid, problems } = validateExceptions([completeException()], today);
    assert.deepEqual(problems, []);
    assert.equal(findStaleExceptions(valid, []).length, 1);
  });

  test("an exception matching a current finding is not stale", () => {
    const { valid } = validateExceptions(
      [completeException({ advisory: "5150", package: "live-lib", path: "node_modules/live-lib" })],
      today
    );
    const findings = collectFindings(
      audit([{ name: "live-lib", severity: "high", id: 5150 }])
    );
    assert.deepEqual(findStaleExceptions(valid, findings), []);
  });

  test("an exception for a moderate finding is not stale", () => {
    // Moderates never block, but an exception written for one still has to
    // correspond to something real.
    const { valid } = validateExceptions(
      [
        completeException({
          advisory: "42",
          package: "meh-lib",
          severity: "moderate",
          path: "node_modules/meh-lib",
        }),
      ],
      today
    );
    const findings = collectFindings(audit([{ name: "meh-lib", severity: "moderate", id: 42 }]));
    assert.deepEqual(findStaleExceptions(valid, findings), []);
  });
});

describe("the exception file cannot contradict itself", () => {
  const today = "2026-09-10";

  test("two exceptions with the same identity fail", () => {
    // Without this the last entry loaded would silently win.
    const { valid, problems } = validateExceptions(
      [completeException(), completeException({ whyNoSafePatch: "a different story" })],
      today
    );
    assert.equal(valid.size, 1);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /DUPLICATE/);
  });

  test("two exceptions disagreeing about severity fail", () => {
    const { problems } = validateExceptions(
      [completeException(), completeException({ severity: "critical" })],
      today
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /CONFLICTING/);
  });

  test("the same advisory at two different paths is allowed", () => {
    // Two locations are two decisions, and both may legitimately be reviewed.
    const { valid, problems } = validateExceptions(
      [
        completeException(),
        completeException({ path: "node_modules/parent/node_modules/left-pad" }),
      ],
      today
    );
    assert.deepEqual(problems, []);
    assert.equal(valid.size, 2);
  });
});

describe("a review date must be a real date", () => {
  const today = "2026-09-10";

  test("non-ISO shapes are refused", () => {
    for (const reviewBy of ["2026-9-9", "tomorrow", "09/09/2026", "2026-09-09T00:00:00Z", ""]) {
      const { valid, problems } = validateExceptions([completeException({ reviewBy })], today);
      assert.equal(valid.size, 0, `accepted ${reviewBy}`);
      assert.equal(problems.length, 1);
      // An empty string fails the required-field check first, which is fine —
      // both refuse it.
      assert.match(problems[0] ?? "", /BAD DATE|INCOMPLETE/);
    }
  });

  test("a date that does not exist is refused", () => {
    // Date would roll this into March rather than complain.
    const { valid, problems } = validateExceptions(
      [completeException({ reviewBy: "2026-02-31" })],
      today
    );
    assert.equal(valid.size, 0);
    assert.match(problems[0] ?? "", /BAD DATE/);
  });

  test("a real date in the future is accepted", () => {
    const { valid, problems } = validateExceptions(
      [completeException({ reviewBy: "2026-02-28" })],
      "2026-01-01"
    );
    assert.deepEqual(problems, []);
    assert.equal(valid.size, 1);
  });
});
