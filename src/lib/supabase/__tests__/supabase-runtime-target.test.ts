/**
 * WHERE A PRIVILEGED CLIENT IS ALLOWED TO POINT.
 *
 * THE DEFECT THIS SUITE CLOSES
 *
 * The repository had two service-role factories exporting the same name.
 * `lib/supabase/admin.ts` resolved its URL through the lead-intake environment,
 * which validates the host strictly. `lib/supabase/service-role.ts` — the one
 * quotations, commerce, projects and the campaign dispatcher actually use —
 * accepted any URL that parsed as http or https. It checked the protocol and
 * stopped.
 *
 * A service-role key bypasses RLS entirely. So a mistyped, stale or swapped
 * `NEXT_PUBLIC_SUPABASE_URL` would have sent an unrestricted credential to
 * whatever host was configured, silently, with every row in reach.
 *
 * Target identity is now decided in one place for both clients, and these
 * tests are the reason it cannot drift apart again.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
  ONEDECORE_MANAGED_SUPABASE_HOST,
  resolveSupabaseRuntimeTarget,
  SupabaseRuntimeTargetError,
} from "../runtime-target.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const MANAGED = `https://${ONEDECORE_MANAGED_SUPABASE_HOST}`;
const LOOPBACK = "http://127.0.0.1:54321";

/** Production means: the managed project or nothing. */
const prod = { requireManaged: true } as const;
const dev = { requireManaged: false } as const;

describe("production accepts only the managed ONEDECORE project", () => {
  test("the managed HTTPS project is accepted", () => {
    assert.equal(
      resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: MANAGED }, prod),
      MANAGED
    );
  });

  test("localhost is refused in production", () => {
    /*
     * The exact confusion that produced a week of "my lead went to localhost":
     * in production, loopback is never a valid answer.
     */
    assert.throws(
      () => resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: LOOPBACK }, prod),
      SupabaseRuntimeTargetError
    );
  });

  test("another Supabase project is refused", () => {
    // Sibling projects exist in the same organisation. None of them is this app.
    for (const other of [
      "https://coilipywdvxklewquqvv.supabase.co",
      "https://yqpgcsduqbxulrlzwzap.supabase.co",
      "https://uckafzuochmbvtiodmcl.supabase.co",
    ]) {
      assert.throws(
        () => resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: other }, prod),
        SupabaseRuntimeTargetError,
        other
      );
    }
  });

  test("arbitrary hosts are refused", () => {
    for (const bad of [
      "https://evil.example",
      "https://lpurlfmpvriyvpkujvyl.supabase.co.evil.example",
      "https://attacker.io/lpurlfmpvriyvpkujvyl.supabase.co",
      "http://lpurlfmpvriyvpkujvyl.supabase.co",
    ]) {
      assert.throws(
        () => resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: bad }, prod),
        SupabaseRuntimeTargetError,
        bad
      );
    }
  });

  test("a missing URL fails closed rather than defaulting", () => {
    assert.throws(() => resolveSupabaseRuntimeTarget({}, prod), SupabaseRuntimeTargetError);
    assert.throws(
      () => resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: "   " }, prod),
      SupabaseRuntimeTargetError
    );
  });

  test("NODE_ENV=production turns the rule on without being asked", () => {
    // The default must be the safe one; callers should not have to opt in.
    assert.throws(
      () =>
        resolveSupabaseRuntimeTarget({
          NODE_ENV: "production",
          NEXT_PUBLIC_SUPABASE_URL: LOOPBACK,
        }),
      SupabaseRuntimeTargetError
    );
  });
});

describe("outside production, loopback is allowed but nothing loose is", () => {
  test("a strict loopback stack is accepted", () => {
    assert.equal(
      resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: LOOPBACK }, dev),
      LOOPBACK
    );
  });

  test("the managed project is still accepted", () => {
    assert.equal(
      resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: MANAGED }, dev),
      MANAGED
    );
  });

  test("a remote host is refused even in development", () => {
    assert.throws(
      () =>
        resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: "https://evil.example" }, dev),
      SupabaseRuntimeTargetError
    );
  });

  test("URLs that merely LOOK local are refused", () => {
    /*
     * Every one of these reads as localhost to a hurried human and resolves
     * somewhere else, or smuggles credentials past a naive parser.
     */
    for (const bad of [
      "http://127.0.0.1.evil.example:54321",
      "http://user:pass@127.0.0.1:54321",
      "http://127.0.0.1:54321/?to=elsewhere",
      "http://127.0.0.1:54321/deep/path",
      "http://127.0.0.1",
      "not a url",
    ]) {
      assert.equal(isLoopbackSupabaseUrl(bad), false, bad);
      assert.throws(
        () => resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: bad }, dev),
        SupabaseRuntimeTargetError,
        bad
      );
    }
  });

  test("SUPABASE_URL is honoured as the server-side alias", () => {
    assert.equal(resolveSupabaseRuntimeTarget({ SUPABASE_URL: LOOPBACK }, dev), LOOPBACK);
  });
});

describe("errors name the rule, never the value", () => {
  test("no rejected URL is echoed back in the message", () => {
    const secretish = "https://super-secret-project.supabase.co";
    try {
      resolveSupabaseRuntimeTarget({ NEXT_PUBLIC_SUPABASE_URL: secretish }, prod);
      assert.fail("should have thrown");
    } catch (error) {
      const text = String((error as Error).message);
      assert.doesNotMatch(text, /super-secret-project/);
      assert.match(text, /managed ONEDECORE/);
    }
  });
});

describe("both clients compose the same rule", () => {
  const serviceRole = read("src/lib/supabase/service-role.ts");
  const admin = read("src/lib/supabase/admin.ts");
  const serverEnv = read("src/config/server-env.ts");

  test("the service-role client validates its target", () => {
    assert.match(serviceRole, /resolveSupabaseRuntimeTarget/);
    // The old permissive resolver accepted any http/https URL.
    assert.doesNotMatch(serviceRole, /protocol !== "http:"/);
  });

  test("the service-role client still refuses a publishable key", () => {
    assert.match(serviceRole, /sb_publishable_/);
    assert.match(serviceRole, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  test("the lead-intake client keeps its own extra gates", () => {
    // Legal, consent and trust-proxy checks belong to intake, not to the target.
    assert.match(admin, /getLeadIntakeServerEnv/);
    assert.match(serverEnv, /areLeadPathConsentVersionsEffective/);
    assert.match(serverEnv, /areWebsiteLeadProcessorsReady/);
  });

  test("there is exactly ONE definition of each host predicate", () => {
    /*
     * `server-env.ts` re-exports rather than redeclares. Two copies of a
     * security predicate is how one of them gets relaxed alone.
     */
    const runtime = read("src/lib/supabase/runtime-target.ts");
    assert.match(runtime, /export function isManagedOneDecoreSupabaseUrl/);
    assert.match(runtime, /export function isLoopbackSupabaseUrl/);
    assert.doesNotMatch(serverEnv, /export function isManagedOneDecoreSupabaseUrl/);
    assert.doesNotMatch(serverEnv, /export function isLoopbackSupabaseUrl/);
    assert.match(serverEnv, /from "\.\.\/lib\/supabase\/runtime-target\.ts"/);
  });

  test("the managed host is a constant, not configuration", () => {
    // A check configured by the thing it checks is not a check.
    const runtime = read("src/lib/supabase/runtime-target.ts");
    assert.match(runtime, /ONEDECORE_MANAGED_SUPABASE_HOST = "lpurlfmpvriyvpkujvyl\.supabase\.co"/);
    assert.equal(isManagedOneDecoreSupabaseUrl(MANAGED), true);
  });

  test("the credential-bearing factories stay server-only", () => {
    /*
     * The validator itself is intentionally NOT server-only: it holds no
     * secret, and the browser client resolves its target through the same
     * predicates via `config/env.ts`. What must never reach the browser is a
     * factory that carries the service-role key.
     */
    assert.match(serviceRole, /^import "server-only";/m);
    assert.match(admin, /^import "server-only";/m);
    // The IMPORT, not the word: the file explains in prose why it has none.
    assert.doesNotMatch(
      read("src/lib/supabase/runtime-target.ts"),
      /^import "server-only";/m
    );
  });

  test("the browser/server public env uses the same predicates", () => {
    const publicEnv = read("src/config/env.ts");
    assert.match(publicEnv, /isManagedOneDecoreSupabaseUrl/);
    assert.match(publicEnv, /isLoopbackSupabaseUrl/);
    /*
     * The old rule skipped the managed-host check whenever the hostname was
     * loopback — with no NODE_ENV condition on that half — so production
     * accepted 127.0.0.1.
     */
    assert.doesNotMatch(publicEnv, /hostname === "127\.0\.0\.1"/);
  });
});
