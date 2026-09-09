/**
 * Fail the build on an unreviewed high or critical advisory in production
 * dependencies.
 *
 * WHY A GUARD RATHER THAN A HABIT
 *
 * `npm audit` is only useful if somebody runs it and reads it. The repository's
 * own documentation carried a stale advisory count for weeks, which is the
 * ordinary fate of a number nothing checks. This turns the number into a gate.
 *
 * WHY PRODUCTION ONLY
 *
 * `--omit=dev` is what ships. A high in ESLint's YAML parser is worth fixing on
 * a normal day, but blocking a release on it teaches people to ignore the guard,
 * and a guard people ignore is worse than none. Development advisories are
 * reported, not enforced.
 *
 * WHY EXCEPTIONS EXIST
 *
 * Sometimes there is no patch. The only honest options are then to state the
 * reasoning and the compensating control, or to pretend the finding is not
 * there. An exception file makes the first option auditable: each entry names
 * the advisory, why no safe patch exists, whether the code is reachable, what
 * bounds it in the meantime, and a date after which the exception expires and
 * the build fails again. Exceptions are per-advisory — there is no "ignore this
 * package" switch.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const EXCEPTIONS_FILE = path.join(repositoryRoot, "security", "dependency-exceptions.json");

import {
  classifyFindings,
  collectFindings,
  validateExceptions,
} from "./lib/dependency-policy.mjs";

/**
 * Locate npm's JavaScript entry point.
 *
 * Not `npm.cmd`: Node refuses to spawn a `.cmd` without a shell (EINVAL), and
 * reaching for `shell: true` to get around that means the command line is
 * re-parsed by cmd.exe on one platform and sh on the other. Running npm's own
 * script through the Node binary already executing takes the same path
 * everywhere.
 */
function resolveNpmCli() {
  // Set by npm itself whenever this runs as an npm script, which is the norm.
  const fromEnvironment = process.env.npm_execpath;
  if (fromEnvironment && fromEnvironment.endsWith(".js") && fs.existsSync(fromEnvironment)) {
    return fromEnvironment;
  }

  // Run directly: npm ships beside the Node binary in both layouts.
  const nodeDirectory = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** Run `npm audit --omit=dev --json` and parse it. */
function readProductionAudit() {
  const npmCli = resolveNpmCli();
  if (!npmCli) {
    return { ok: false, reason: "could not locate the npm CLI to run the audit" };
  }

  const result = spawnSync(
    process.execPath,
    [npmCli, "audit", "--omit=dev", "--json"],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  if (result.error) {
    return { ok: false, reason: `could not run npm audit: ${result.error.message}` };
  }

  /*
   * `npm audit` exits non-zero when it finds anything, so the exit code says
   * nothing useful here — the JSON does. A missing or unparseable body is the
   * real failure, and it fails closed.
   */
  if (!result.stdout) {
    return { ok: false, reason: `npm audit produced no output: ${(result.stderr || "").trim().slice(0, 200)}` };
  }
  try {
    return { ok: true, audit: JSON.parse(result.stdout) };
  } catch {
    return { ok: false, reason: "npm audit output was not valid JSON" };
  }
}

function readExceptions() {
  if (!fs.existsSync(EXCEPTIONS_FILE)) return { entries: [], present: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
    return { entries: Array.isArray(parsed.exceptions) ? parsed.exceptions : [], present: true };
  } catch {
    return { entries: [], present: true, malformed: true };
  }
}

const audit = readProductionAudit();
if (!audit.ok) {
  console.error(`dependency security: ${audit.reason}`);
  process.exit(1);
}

const exceptionState = readExceptions();
if (exceptionState.malformed) {
  console.error(`dependency security: ${path.relative(repositoryRoot, EXCEPTIONS_FILE)} is not valid JSON.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const { valid: reviewedExceptions, problems } = validateExceptions(
  exceptionState.entries,
  today
);

const { blocking, excused, reported } = classifyFindings(
  collectFindings(audit.audit),
  reviewedExceptions
);

const counts = audit.audit.metadata?.vulnerabilities ?? {};
const summary =
  `critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, ` +
  `moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}`;

for (const finding of blocking) {
  problems.push(
    `${finding.severity.toUpperCase().padEnd(12)} ${finding.package} (${finding.range}) — ${finding.id}\n` +
      `             ${finding.title}\n` +
      `             ${finding.url}`
  );
}

if (problems.length > 0) {
  console.error("dependency security: production dependencies have unreviewed findings.");
  console.error("");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("");
  console.error(`  production audit: ${summary}`);
  console.error("");
  console.error("  Fix it with a targeted update, or — only when no safe patch exists —");
  console.error(`  add a reviewed entry to ${path.relative(repositoryRoot, EXCEPTIONS_FILE).replace(/\\/g, "/")}`);
  console.error("  naming the advisory, its reachability and what bounds it meanwhile.");
  process.exit(1);
}

const excusedNote = excused.length > 0 ? `, ${excused.length} reviewed exception(s)` : "";
console.log(
  `dependency security OK: no unreviewed production high/critical (${summary})${excusedNote}`
);

for (const { finding, exception } of excused) {
  console.log(`  reviewed: ${finding.id} ${finding.package} — review by ${exception.reviewBy}`);
}
for (const finding of reported) {
  console.log(`  ${finding.severity}: ${finding.package} ${finding.id} (reported, not blocking)`);
}
