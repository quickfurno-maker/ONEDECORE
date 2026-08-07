/**
 * Phase 8 — cross-phase workspace shell contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

describe("Phase 8 delivery workspace shell", () => {
  test("composes sections without routes or mutations", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/ProjectDeliveryWorkspaceShell.tsx"),
      "utf8"
    );
    assert.match(src, /handoverSection/);
    assert.match(src, /designSection/);
    assert.match(src, /executionSection/);
    assert.match(src, /enabled = false/);
    assert.match(src, /aria-live/);
    assert.doesNotMatch(src, /supabase/i);
    assert.doesNotMatch(src, /closed_won/i);
  });

  test("no project admin routes activated", () => {
    assert.equal(
      (() => {
        try {
          readFileSync(join(root, "src/app/admin/projects/page.tsx"), "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});
