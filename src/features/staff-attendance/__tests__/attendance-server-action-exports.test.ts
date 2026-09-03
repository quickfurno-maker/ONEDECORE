/**
 * Guard: a "use server" module may export ONLY async functions at runtime.
 *
 * Production defect this locks out — /admin/attendance-policies died with:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * `attendance-form-actions.ts` carried `export { ATTENDANCE_LOCATION_CATEGORIES }`.
 * The constant is a runtime array, so Next.js rejected the whole server-action
 * module and every page importing it 500'd.
 *
 * Two things make this worth a repo-wide guard rather than a one-file assertion:
 * `npm run build` did NOT fail on it — the error only appears when the route is
 * requested — and the same defect existed in five other modules. A guard scoped
 * to the one reported file would have let the next one reach production too.
 *
 * Type-only exports (`export type`, `export interface`) are erased before the
 * runtime ever sees them and remain allowed.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const posix = (value: string) => value.split(sep).join("/");

const ACTIONS = "src/features/staff-attendance/server/attendance-form-actions.ts";
const DTO = "src/features/staff-attendance/contracts/dto.ts";
const PANEL = "src/features/staff-attendance/components/AttendanceTodayPanel.tsx";

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** True when the module's first meaningful line is the "use server" directive. */
function isServerActionModule(source: string): boolean {
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
      continue;
    }
    return /^["']use server["'];?$/.test(line);
  }
  return false;
}

/**
 * Export statements that survive compilation as runtime values. Anything that is
 * not an async function or a type-only export is a value Next.js will reject.
 */
function runtimeValueExports(source: string): readonly string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        /^export\b/.test(line) &&
        !/^export\s+async\s+function\b/.test(line) &&
        !/^export\s+type\b/.test(line) &&
        !/^export\s+interface\b/.test(line)
    );
}

const SERVER_ACTION_MODULES = sourceFiles("src")
  .filter((rel) => isServerActionModule(read(rel)))
  .map(posix);

describe("attendance-form-actions no longer breaks the server-action contract", () => {
  test("the module still declares \"use server\"", () => {
    // The fix must not have been achieved by dropping the directive.
    assert.ok(isServerActionModule(read(ACTIONS)));
  });

  test("it does not re-export ATTENDANCE_LOCATION_CATEGORIES", () => {
    // The exact line that took /admin/attendance-policies down.
    const source = read(ACTIONS);
    assert.doesNotMatch(source, /export\s*\{\s*ATTENDANCE_LOCATION_CATEGORIES\s*\}/);
    assert.equal(source.includes("ATTENDANCE_LOCATION_CATEGORIES"), false);
  });

  test("it exports no runtime value at all", () => {
    assert.deepEqual([...runtimeValueExports(read(ACTIONS))], []);
  });

  test("the action state type is still exported for components", () => {
    // Type-only exports are erased, so they are safe and must not be collateral.
    assert.match(read(ACTIONS), /export interface AttendanceFormActionState/);
  });
});

describe("the constant keeps its real home in contracts", () => {
  test("dto.ts still owns ATTENDANCE_LOCATION_CATEGORIES", () => {
    assert.match(read(DTO), /export const ATTENDANCE_LOCATION_CATEGORIES = \[/);
  });

  test("the consuming component imports it straight from dto.ts", () => {
    // The architecture the fix preserves rather than replaces.
    const panel = read(PANEL);
    assert.match(
      panel,
      /import \{\s*ATTENDANCE_LOCATION_CATEGORIES,[\s\S]*?\} from "\.\.\/contracts\/dto\.ts";/
    );
    assert.doesNotMatch(
      panel,
      /import \{[^}]*ATTENDANCE_LOCATION_CATEGORIES[^}]*\} from "\.\.\/server\//
    );
  });
});

describe("no \"use server\" module anywhere exports a runtime value", () => {
  test("the scan actually found the server-action modules", () => {
    // A silently empty scan would make every assertion below vacuous.
    assert.ok(
      SERVER_ACTION_MODULES.length >= 30,
      `expected the repo's server-action modules, found ${SERVER_ACTION_MODULES.length}`
    );
    assert.ok(SERVER_ACTION_MODULES.includes(ACTIONS));
  });

  test("every server-action module exports only async functions and types", () => {
    const offenders = SERVER_ACTION_MODULES.flatMap((rel) =>
      runtimeValueExports(read(rel)).map((line) => `${rel}: ${line}`)
    );

    assert.deepEqual(
      offenders,
      [],
      `"use server" modules may only export async functions:\n${offenders.join("\n")}`
    );
  });
});
