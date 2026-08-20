import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { evaluateCommerceMediaUploadAuth } from "../commerce-media-auth.ts";

describe("commerce media auth gate", () => {
  test("false canManage is not allowed", () => {
    assert.equal(evaluateCommerceMediaUploadAuth(false).allowed, false);
  });

  test("createAdminClient is not statically imported", () => {
    const src = readFileSync(join(process.cwd(), "src/features/commerce/server/commerce-media.ts"), "utf8");
    assert.doesNotMatch(src, /^import .*createAdminClient/m);
    assert.match(src, /await import\("@\/lib\/supabase\/service-role"\)/);
  });
});
