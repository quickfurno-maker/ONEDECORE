/**
 * The production deploy script's safety contract.
 *
 * WHY THIS IS TESTED AT ALL
 *
 * A shell script nobody asserts is a shell script that quietly grows a `sudo`,
 * a `chmod 777`, or a `pm2 start` during an incident at 2am and is never read
 * again. The specific failure this guards is the one that has already happened
 * three times in this repository:
 *
 *   Releases were hand-run over SSH as root. `npm ci` and `npm run build` as
 *   root wrote tens of thousands of root-owned files into `node_modules` and
 *   `.next`, while the app runs as the unix user `onedecore`. That broke
 *   `npm ci` with EACCES on the NEXT deploy, and — much worse — broke ISR
 *   silently: pages served fine and simply stopped revalidating, because
 *   `.next/server/app/index.html` was not writable by the app.
 *
 * Each time it was fixed by remembering to `chown -R` afterwards. These tests
 * exist so the fix does not depend on remembering.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const SCRIPT = "scripts/deploy-production.sh";
const read = () => readFileSync(join(root, SCRIPT), "utf8");

/** Script with comments stripped: this file's subject is what the code DOES. */
const code = () =>
  read()
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

describe("the deploy script refuses to be the problem", () => {
  test("it exists and is executable in git", () => {
    assert.ok(existsSync(join(root, SCRIPT)), `${SCRIPT} must exist`);
    // Not asserted via the filesystem mode: Windows checkouts do not carry it.
    // The shebang is what makes `sudo -u onedecore ./deploy-production.sh` work.
    assert.match(read(), /^#!\/usr\/bin\/env bash/);
  });

  test("it aborts on any error, unset variable, or failed pipe", () => {
    /*
     * Without this a failed `npm ci` falls through to `pm2 restart` and ships
     * a half-installed tree.
     */
    assert.match(code(), /set -Eeuo pipefail/);
  });

  test("it refuses to run as root", () => {
    // The single most important line in the file.
    const source = code();
    assert.match(source, /CURRENT_USER[\s\S]*!=[\s\S]*APP_USER/);
    assert.match(source, /id -u[\s\S]*=[\s\S]*"0"/);
    assert.match(source, /refusing to run as uid 0/);
  });

  test("it never elevates privileges itself", () => {
    /*
     * A `sudo` inside would recreate the defect from within the fix. Elevation
     * is the CALLER's job: `sudo -u onedecore ...` on the way in, never on the
     * way through.
     */
    /*
     * Checked as EXECUTION, not as the word. The refusal message deliberately
     * contains "sudo -u onedecore ..." because that is what the operator who
     * just got rejected needs to read; a test that banned the substring would
     * be pushing the file towards a worse error message.
     */
    const executed = code()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(sudo|su)\b/.test(line));
    assert.deepEqual(executed, [], `the script must not elevate: ${executed.join(" | ")}`);
  });

  test("it never loosens permissions", () => {
    const source = code();
    assert.doesNotMatch(source, /chmod\s+777/);
    assert.doesNotMatch(source, /chmod\s+-R\s+a\+/);
    /*
     * And it does not chown either. A deploy that repairs ownership hides the
     * fact that something is still creating root-owned files; this one FAILS
     * instead, so the cause gets found.
     */
    assert.doesNotMatch(source, /\bchown\b/);
  });

  test("it pins PM2 to the app user's daemon", () => {
    /*
     * `sudo -u` does not reliably carry PM2_HOME, and a PM2 command without it
     * talks to a different daemon — which is how a second copy of the app gets
     * started on the same port.
     */
    const source = code();
    assert.match(source, /EXPECTED_PM2_HOME="\/home\/onedecore\/\.pm2"/);
    assert.match(source, /PM2_HOME[\s\S]*!=[\s\S]*EXPECTED_PM2_HOME/);
  });

  test("it restarts the existing app and never starts a second one", () => {
    const source = code();
    assert.match(source, /pm2 restart/);
    assert.doesNotMatch(source, /pm2 start/, "starting would duplicate the process");
    assert.match(source, /PROCESS_COUNT[\s\S]*!=[\s\S]*"1"/, "it must assert exactly one process");
  });

  test("it deploys an exact reviewed SHA, not whatever main is now", () => {
    /*
     * "Deploy main" becomes unreproducible the moment someone merges during
     * the release window, and the record of what shipped is then a guess.
     */
    const source = code();
    assert.match(source, /TARGET_SHA="\$\{1:-\}"/);
    assert.match(source, /usage: \$0 <merge-sha>/);
    assert.match(source, /merge-base --is-ancestor "\$TARGET_SHA" origin\/main/);
    assert.match(source, /HEAD is \$DEPLOYED_SHA, expected \$TARGET_SHA/);
  });

  test("it fast-forwards and never resets the production tree", () => {
    /*
     * The production env and its dated backups are UNTRACKED and live in the
     * app directory. `git reset --hard` is one flag away from taking them.
     */
    const source = code();
    assert.match(source, /merge --ff-only/);
    assert.doesNotMatch(source, /reset --hard/);
    assert.doesNotMatch(source, /git clean/);
  });

  test("it refuses to deploy over modified tracked files", () => {
    const source = code();
    assert.match(source, /git status --porcelain --untracked-files=no/);
    // Untracked is explicitly tolerated: that is where the env file lives.
    assert.match(source, /--untracked-files=no/);
  });

  test("it fails the deploy on any file not owned by the app user", () => {
    /*
     * THE GATE. Checked before the restart, so a bad build never serves
     * traffic, and again afterwards because a running app writing its first
     * ISR entry is the moment the old defect actually bit.
     */
    const source = code();
    assert.match(source, /assert_owned_by_app_user\(\)/);
    assert.match(source, /find "\$dir" ! -user "\$APP_USER"/);
    assert.match(source, /assert_owned_by_app_user node_modules/);
    assert.equal(
      (source.match(/assert_owned_by_app_user \.next/g) ?? []).length,
      2,
      ".next ownership must be checked before AND after the restart"
    );
  });

  test("it checks the exact file whose unwritability disabled ISR", () => {
    const source = code();
    assert.match(source, /\.next\/server\/app\/index\.html/);
    assert.match(source, /ISR revalidation would fail/);
  });

  test("it fails when the app does not come back healthy", () => {
    const source = code();
    assert.match(source, /api\/health/);
    assert.match(source, /health check never returned 200/);
  });

  test("it prints no secrets", () => {
    /*
     * A deploy log is pasted into chat more often than anyone admits.
     */
    const source = code();
    assert.doesNotMatch(source, /cat .*\.env/);
    assert.doesNotMatch(source, /SERVICE_ROLE|SUPABASE_.*KEY|PASSWORD|SECRET/);
    // It reads the env file's presence, never its contents.
    assert.match(source, /-r "\$ENV_FILE"/);
  });

  test("the runbook names the one supported invocation", () => {
    const source = read();
    assert.match(
      source,
      /sudo -u onedecore -H \/var\/www\/onedecore\/scripts\/deploy-production\.sh <merge-sha>/,
      "the header must document the exact command an operator should run"
    );
  });
});

describe("the script is checked in as a real file", () => {
  test("it is not empty and not a placeholder", () => {
    const stats = statSync(join(root, SCRIPT));
    assert.ok(stats.size > 2000, "a real deploy script, not a stub");
    assert.doesNotMatch(read(), /TODO|FIXME|placeholder/i);
  });
});
