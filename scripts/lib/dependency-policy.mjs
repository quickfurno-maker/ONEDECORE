/**
 * The dependency-advisory policy, as pure functions.
 *
 * Kept separate from `verify-dependency-security.mjs` so the suite can hand it
 * a synthetic audit and check what comes back. Testing a guard by grepping its
 * source for the word "critical" passes on code that says the right thing and
 * does the wrong one; this repository has been bitten by exactly that before.
 */

/** Severities that fail the build when nobody has reviewed them. */
export const BLOCKING_SEVERITIES = new Set(["critical", "high"]);

/** Everything an exception must state before it counts as reviewed. */
export const REQUIRED_EXCEPTION_FIELDS = [
  "advisory",
  "package",
  "severity",
  "path",
  "whyNoSafePatch",
  "reachability",
  "compensatingControl",
  "reviewBy",
  "removeWhen",
];

/**
 * Flatten `npm audit --json` into one row per advisory.
 *
 * A string in `via` means "this package is vulnerable because something it
 * depends on is". The advisory itself is recorded against that dependency, so
 * counting it here too would double-report a single finding — which is why
 * `exceljs` shows up in the audit with no advisory of its own.
 */
export function collectFindings(audit) {
  const findings = [];
  for (const [name, entry] of Object.entries(audit?.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via === "string") continue;
      findings.push({
        id: String(via.source ?? via.url ?? "unknown"),
        title: via.title ?? "",
        url: via.url ?? "",
        severity: String(via.severity ?? entry.severity ?? "unknown").toLowerCase(),
        package: name,
        range: via.range ?? entry.range ?? "",
        direct: Boolean(entry.isDirect),
      });
    }
  }
  return findings;
}

/**
 * Check the exception file itself.
 *
 * An exception that omits its reasoning is not a reviewed decision, and one
 * whose review date has passed is a decision nobody has revisited. Both fail,
 * because the alternative is an exception file that quietly becomes permanent.
 *
 * @param today ISO date (YYYY-MM-DD).
 * @returns `{ valid: Map<advisoryId, exception>, problems: string[] }`
 */
export function validateExceptions(exceptions, today) {
  const valid = new Map();
  const problems = [];

  for (const exception of exceptions ?? []) {
    const missing = REQUIRED_EXCEPTION_FIELDS.filter((field) => !exception?.[field]);
    if (missing.length > 0) {
      problems.push(
        `INCOMPLETE   exception for ${exception?.advisory ?? "(unnamed)"} is missing: ${missing.join(", ")}`
      );
      continue;
    }
    if (String(exception.reviewBy) < today) {
      problems.push(
        `EXPIRED      exception for ${exception.advisory} (${exception.package}) lapsed on ${exception.reviewBy}.\n` +
          `             Re-check the advisory and either fix it or set a new review date.`
      );
      continue;
    }
    valid.set(String(exception.advisory), exception);
  }

  return { valid, problems };
}

/**
 * Split findings into what blocks, what is excused, and what is merely
 * reported.
 *
 * Moderate and low findings are reported and never block. A guard that fails a
 * release on every moderate teaches people to bypass it, and a guard people
 * bypass protects nothing.
 */
export function classifyFindings(findings, validExceptions) {
  const blocking = [];
  const excused = [];
  const reported = [];

  for (const finding of findings) {
    if (!BLOCKING_SEVERITIES.has(finding.severity)) {
      reported.push(finding);
      continue;
    }
    const exception = validExceptions.get(finding.id);
    if (exception) {
      excused.push({ finding, exception });
      continue;
    }
    blocking.push(finding);
  }

  return { blocking, excused, reported };
}
