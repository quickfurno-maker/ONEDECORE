/**
 * The environment scanner, exercised against real files rather than described.
 *
 * WHY THIS FILE EXISTS SEPARATELY
 *
 * `env-contract.test.ts` asserts properties of the registry, and several of its
 * checks read the scanner's SOURCE to confirm a rule is present. That is worth
 * having and it is not proof: source-text assertions pass on code that says the
 * right thing and does the wrong one, which is exactly what happened here.
 *
 * THE BUG THESE TESTS WERE WRITTEN FOR
 *
 * The scanner reports environment reads whose names fall outside the known
 * namespaces, so a filter that is too narrow gets noticed instead of silently
 * dropping a real key. That net worked for direct reads and had a hole for
 * helper reads: the helper path checked the namespace BEFORE recording, so
 *
 *     read(env, "NEW_PROVIDER_SECRET")
 *
 * vanished without trace — while the identical key read as
 * `process.env.NEW_PROVIDER_SECRET` was reported. Helper reads were already one
 * original source of contract drift, which is what made the hole worth closing
 * rather than documenting.
 *
 * The fix is not "record everything a function called `read` is passed". That
 * would report `read(config, "META_AUTH")` and the guard would be noise within
 * a week. Env-backing is established from the SHAPE of the call — a helper
 * handed the env object, or one of this repository's key-only readers — and
 * only then does classification happen.
 *
 * Every case below writes a temporary fixture to the OS temp directory. No
 * repository file is touched.
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

import {
  scanEnvKeys,
  readEnvExampleEntries,
} from "../../../scripts/lib/env-key-scanner.mjs";
import {
  findCredentialShapedValues,
  findDuplicateKeys,
  findNonBlankSecrets,
} from "../../../scripts/lib/env-example-rules.mjs";

const workspaces: string[] = [];

after(() => {
  for (const dir of workspaces) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A throwaway project: `src/` plus any extra files the case needs. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "onedecore-env-scan-"));
  workspaces.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const full = join(root, relative);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  return root;
}

/** Scan a fixture the way the verifier scans the repository. */
function scan(root: string, extraFiles: readonly string[] = []) {
  const { keys, unknownNamespace } = scanEnvKeys({
    roots: [join(root, "src")],
    files: extraFiles.map((file) => join(root, file)),
  });
  return {
    keys: new Set<string>([...keys.keys()]),
    unknown: new Set<string>([...unknownNamespace.keys()]),
  };
}

describe("direct environment reads", () => {
  test("a known key is recorded", () => {
    const root = fixture({
      "src/a.ts": `export const v = process.env.ONEDECORE_TEST_KEY;\n`,
    });
    assert.ok(scan(root).keys.has("ONEDECORE_TEST_KEY"));
  });

  test("bracket access and the env identifier are both recognised", () => {
    const root = fixture({
      "src/a.ts":
        `declare const env: Record<string, string | undefined>;\n` +
        `export const a = process.env["ONEDECORE_BRACKET_KEY"];\n` +
        `export const b = env.ONEDECORE_IDENT_KEY;\n` +
        `export const c = env["ONEDECORE_IDENT_BRACKET"];\n`,
    });
    const { keys } = scan(root);
    for (const key of [
      "ONEDECORE_BRACKET_KEY",
      "ONEDECORE_IDENT_KEY",
      "ONEDECORE_IDENT_BRACKET",
    ]) {
      assert.ok(keys.has(key), key);
    }
  });

  test("an unfamiliar key is reported rather than dropped", () => {
    const root = fixture({
      "src/a.ts": `export const v = process.env.DIRECT_UNKNOWN_SECRET;\n`,
    });
    const { keys, unknown } = scan(root);
    assert.ok(unknown.has("DIRECT_UNKNOWN_SECRET"));
    assert.ok(!keys.has("DIRECT_UNKNOWN_SECRET"));
  });

  test("constant indirection resolves", () => {
    const root = fixture({
      "src/a.ts":
        `declare const env: Record<string, string | undefined>;\n` +
        `const MODE_ENV = "ONEDECORE_CONSTANT_KEY";\n` +
        `export const v = env[MODE_ENV];\n`,
    });
    assert.ok(scan(root).keys.has("ONEDECORE_CONSTANT_KEY"));
  });
});

describe("helper reads — the gap this suite closed", () => {
  test("a known key read through a helper is recorded", () => {
    const root = fixture({
      "src/a.ts":
        `declare function read(env: unknown, key: string): string | undefined;\n` +
        `declare const env: Record<string, string | undefined>;\n` +
        `export const v = read(env, "ONEDECORE_HELPER_KEY");\n`,
    });
    assert.ok(scan(root).keys.has("ONEDECORE_HELPER_KEY"));
  });

  test("an UNFAMILIAR key read through a helper is reported, not dropped", () => {
    /*
     * THE REGRESSION. Before the fix this key disappeared entirely: the helper
     * path filtered by namespace before recording, so the unknown-namespace net
     * never saw it. The identical key read directly was reported, which is the
     * kind of inconsistency that makes a guard untrustworthy.
     */
    const root = fixture({
      "src/a.ts":
        `declare function read(env: unknown, key: string): string | undefined;\n` +
        `declare const env: Record<string, string | undefined>;\n` +
        `export const v = read(env, "HELPER_UNKNOWN_SECRET");\n`,
    });
    const { keys, unknown } = scan(root);
    assert.ok(
      unknown.has("HELPER_UNKNOWN_SECRET"),
      "a helper read of an unfamiliar key must surface"
    );
    assert.ok(!keys.has("HELPER_UNKNOWN_SECRET"));
  });

  test("readOptional and readRequired behave the same way", () => {
    const root = fixture({
      "src/a.ts":
        `declare function readOptional(env: unknown, key: string): string | undefined;\n` +
        `declare function readRequired(env: unknown, key: string): string;\n` +
        `declare const env: Record<string, string | undefined>;\n` +
        `export const a = readOptional(env, "OPTIONAL_UNKNOWN_KEY");\n` +
        `export const b = readRequired(env, "REQUIRED_UNKNOWN_KEY");\n`,
    });
    const { unknown } = scan(root);
    assert.ok(unknown.has("OPTIONAL_UNKNOWN_KEY"));
    assert.ok(unknown.has("REQUIRED_UNKNOWN_KEY"));
  });

  test("a key-only repository helper counts without an env argument", () => {
    // `getEnvVar` reads process.env internally; its signature is a known fact
    // about this codebase rather than an inference from its name.
    const root = fixture({
      "src/a.ts":
        `declare function getEnvVar(key: string): string;\n` +
        `export const v = getEnvVar("ONEDECORE_KEY_ONLY_HELPER");\n`,
    });
    assert.ok(scan(root).keys.has("ONEDECORE_KEY_ONLY_HELPER"));
  });
});

describe("what must NOT become an environment variable", () => {
  test("a generic read on something that is not the env is ignored", () => {
    /*
     * The reason the fix is semantic rather than "record every argument of any
     * function called read". `config` is not the environment, and reporting
     * this would make the unknown-namespace net noise instead of signal.
     */
    const root = fixture({
      "src/a.ts":
        `declare function read(source: unknown, key: string): string | undefined;\n` +
        `declare const config: Record<string, string>;\n` +
        `export const v = read(config, "META_AUTH");\n`,
    });
    const { keys, unknown } = scan(root);
    assert.ok(!keys.has("META_AUTH"));
    assert.ok(!unknown.has("META_AUTH"));
  });

  test("error-code constants are not environment variables", () => {
    const root = fixture({
      "src/a.ts":
        `export const CODE = "GOOGLE_ADS_TIMEOUT_UNKNOWN";\n` +
        `export type Code = "KRITI_RATE_LIMITED" | "META_TRANSIENT";\n`,
    });
    const { keys, unknown } = scan(root);
    for (const code of [
      "GOOGLE_ADS_TIMEOUT_UNKNOWN",
      "KRITI_RATE_LIMITED",
      "META_TRANSIENT",
    ]) {
      assert.ok(!keys.has(code), code);
      assert.ok(!unknown.has(code), code);
    }
  });

  test("a camelCase property on an object named env is not a variable", () => {
    // `env` is also an ordinary name for a resolved config object.
    const root = fixture({
      "src/a.ts":
        `declare const env: { hashSecret: string; trustProxy: boolean };\n` +
        `export const a = env.hashSecret;\n` +
        `export const b = env.trustProxy;\n`,
    });
    const { keys, unknown } = scan(root);
    assert.equal(keys.size, 0);
    assert.equal(unknown.size, 0);
  });

  test("test files are excluded from the contract", () => {
    const root = fixture({
      "src/a.ts": `export const ok = true;\n`,
      "src/__tests__/a.test.ts": `export const v = process.env.ONEDECORE_ONLY_IN_TESTS;\n`,
    });
    assert.ok(!scan(root).keys.has("ONEDECORE_ONLY_IN_TESTS"));
  });
});

describe("build and runtime config outside src/", () => {
  test("next.config.ts is scanned when listed", () => {
    /*
     * `src/` is not the whole runtime. next.config.ts executes during the build
     * and can read anything, so a src-only scan leaves the contract complete
     * and wrong.
     */
    const root = fixture({
      "src/a.ts": `export const ok = true;\n`,
      "next.config.ts": `export default { env: process.env.ONEDECORE_BUILD_FLAG };\n`,
    });
    assert.ok(scan(root, ["next.config.ts"]).keys.has("ONEDECORE_BUILD_FLAG"));
  });

  test("an unfamiliar key in build config surfaces too", () => {
    const root = fixture({
      "src/a.ts": `export const ok = true;\n`,
      "next.config.ts": `export default { env: process.env.BUILD_UNKNOWN_SECRET };\n`,
    });
    assert.ok(scan(root, ["next.config.ts"]).unknown.has("BUILD_UNKNOWN_SECRET"));
  });

  test("listed files that do not exist are simply skipped", () => {
    // middleware.ts and instrumentation.ts are listed for the day they appear.
    const root = fixture({ "src/a.ts": `export const ok = true;\n` });
    assert.doesNotThrow(() =>
      scan(root, ["middleware.ts", "instrumentation.ts", "next.config.ts"])
    );
  });
});

describe("the default scan set, exercised rather than described", () => {
  /*
   * The cases above pass explicit roots and files. These call `scanEnvKeys()`
   * exactly as the verifier does — no arguments — from inside a fixture, which
   * is the only way to prove DEFAULT_ROOTS and DEFAULT_FILES actually reach the
   * walker. Asserting that "next.config.ts" appears in the scanner's source
   * would pass on a build that lists the file and never opens it.
   */
  function scanDefaults(files: Record<string, string>) {
    const root = fixture(files);
    const previous = process.cwd();
    try {
      process.chdir(root);
      const { keys, unknownNamespace } = scanEnvKeys();
      return {
        keys: new Set<string>([...keys.keys()]),
        unknown: new Set<string>([...unknownNamespace.keys()]),
      };
    } finally {
      process.chdir(previous);
    }
  }

  test("src/ is scanned by default", () => {
    const { keys } = scanDefaults({
      "src/a.ts": `export const v = process.env.ONEDECORE_DEFAULT_ROOT;
`,
    });
    assert.ok(keys.has("ONEDECORE_DEFAULT_ROOT"));
  });

  test("build and runtime config is scanned by default too", () => {
    // Each of these executes outside src/ and can read anything; a src-only
    // scan would leave the contract complete and wrong.
    const { keys } = scanDefaults({
      "src/a.ts": `export const ok = true;
`,
      "next.config.ts": `export default { a: process.env.ONEDECORE_FROM_NEXT_CONFIG };
`,
      "middleware.ts": `export const b = process.env.ONEDECORE_FROM_MIDDLEWARE;
`,
      "src/instrumentation.ts": `export const c = process.env.ONEDECORE_FROM_INSTRUMENTATION;
`,
      "instrumentation-client.ts": `export const d = process.env.ONEDECORE_FROM_CLIENT_INSTRUMENTATION;
`,
    });
    for (const key of [
      "ONEDECORE_FROM_NEXT_CONFIG",
      "ONEDECORE_FROM_MIDDLEWARE",
      "ONEDECORE_FROM_INSTRUMENTATION",
      "ONEDECORE_FROM_CLIENT_INSTRUMENTATION",
    ]) {
      assert.ok(keys.has(key), key);
    }
  });

  test("tooling stays out of the contract", () => {
    /*
     * scripts/ and tests read whatever they need for tooling and QA. Folding
     * them in would turn the contract into a list of everything anyone ever
     * touched, and the guard into noise.
     */
    const { keys, unknown } = scanDefaults({
      "src/a.ts": `export const ok = true;
`,
      "scripts/tool.ts": `export const v = process.env.ONEDECORE_TOOLING_ONLY;
`,
      "src/__tests__/a.test.ts": `export const v = process.env.ONEDECORE_TEST_ONLY;
`,
    });
    assert.ok(!keys.has("ONEDECORE_TOOLING_ONLY"));
    assert.ok(!unknown.has("ONEDECORE_TOOLING_ONLY"));
    assert.ok(!keys.has("ONEDECORE_TEST_ONLY"));
  });
});

describe("the .env.example parser", () => {
  function parse(contents: string) {
    const root = fixture({ "src/a.ts": "export const ok = true;\n", ".env.example": contents });
    return readEnvExampleEntries(join(root, ".env.example"));
  }

  test("values are returned, not just names", () => {
    const entries = parse("ONEDECORE_A=false\nONEDECORE_B=\n");
    assert.deepEqual(
      entries.map((e) => [e.key, e.value]),
      [
        ["ONEDECORE_A", "false"],
        ["ONEDECORE_B", ""],
      ]
    );
  });

  test('a quoted empty value counts as blank', () => {
    // Otherwise `KEY=""` is a two-character string that sails past an
    // emptiness check while looking blank to a reader.
    const entries = parse('ONEDECORE_LEAD_HASH_SECRET=""\n');
    assert.equal(entries[0]!.value, "");
  });

  test("a quoted non-empty secret is still non-empty", () => {
    const entries = parse('ONEDECORE_LEAD_HASH_SECRET="hunter2"\n');
    assert.equal(entries[0]!.value, "hunter2");
  });

  test("duplicates are preserved in order so they can be reported", () => {
    // A Set would deduplicate the very thing that needs reporting: dotenv keeps
    // the last assignment, so the file documents one value and provisions
    // another.
    const entries = parse("ONEDECORE_TRUST_PROXY=false\nONEDECORE_TRUST_PROXY=true\n");
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((e) => e.value), ["false", "true"]);
  });

  test("commented lines are not active assignments", () => {
    const entries = parse("# ONEDECORE_COMMENTED=value\nONEDECORE_ACTIVE=\n");
    assert.deepEqual(entries.map((e) => e.key), ["ONEDECORE_ACTIVE"]);
  });
});

describe("the .env.example rules, run against fixtures", () => {
  /*
   * These are the rules the verifier composes. Testing them here means the
   * suite never has to edit this repository's real `.env.example` to find out
   * what they do — which is how they were checked before, once, by hand.
   */
  function parse(contents: string) {
    const root = fixture({
      "src/a.ts": "export const ok = true;\n",
      ".env.example": contents,
    });
    return readEnvExampleEntries(join(root, ".env.example"));
  }

  /** The two registry facts these rules need. Nothing else is consulted. */
  const registry = new Map<string, { sensitivity: string }>([
    ["ONEDECORE_LEAD_HASH_SECRET", { sensitivity: "secret" }],
    ["ONEDECORE_TRUST_PROXY", { sensitivity: "config" }],
    ["NEXT_PUBLIC_APP_URL", { sensitivity: "public" }],
  ]);

  test("a registered secret with a value is reported", () => {
    const entries = parse("ONEDECORE_LEAD_HASH_SECRET=hunter2\n");
    assert.deepEqual(findNonBlankSecrets(entries, registry), [
      "ONEDECORE_LEAD_HASH_SECRET",
    ]);
  });

  test("a plausible-looking placeholder is still a value", () => {
    // The point of the registry rule: it does not care what the value looks
    // like, only that a secret has one.
    for (const value of ["placeholder", "<put-secret-here>", "changeme", "test123"]) {
      const entries = parse(`ONEDECORE_LEAD_HASH_SECRET=${value}\n`);
      assert.deepEqual(
        findNonBlankSecrets(entries, registry),
        ["ONEDECORE_LEAD_HASH_SECRET"],
        value
      );
    }
  });

  test("a blank secret passes", () => {
    const entries = parse("ONEDECORE_LEAD_HASH_SECRET=\n");
    assert.deepEqual(findNonBlankSecrets(entries, registry), []);
  });

  test("a quoted empty secret counts as blank", () => {
    const entries = parse('ONEDECORE_LEAD_HASH_SECRET=""\n');
    assert.deepEqual(findNonBlankSecrets(entries, registry), []);
  });

  test("a quoted non-empty secret does not slip through", () => {
    const entries = parse('ONEDECORE_LEAD_HASH_SECRET="hunter2"\n');
    assert.deepEqual(findNonBlankSecrets(entries, registry), [
      "ONEDECORE_LEAD_HASH_SECRET",
    ]);
  });

  test("non-secret keys may hold their documented defaults", () => {
    const entries = parse(
      "ONEDECORE_TRUST_PROXY=false\nNEXT_PUBLIC_APP_URL=https://onedecore.in\n"
    );
    assert.deepEqual(findNonBlankSecrets(entries, registry), []);
  });

  test("a duplicate active key is reported", () => {
    const entries = parse(
      "ONEDECORE_TRUST_PROXY=false\nONEDECORE_TRUST_PROXY=true\n"
    );
    assert.deepEqual(findDuplicateKeys(entries), ["ONEDECORE_TRUST_PROXY"]);
  });

  test("distinct keys are not duplicates", () => {
    const entries = parse("ONEDECORE_TRUST_PROXY=false\nNEXT_PUBLIC_APP_URL=\n");
    assert.deepEqual(findDuplicateKeys(entries), []);
  });

  test("credential shapes are caught even on unregistered keys", () => {
    // Defence in depth: a token parked on a key the registry does not know is
    // a secret.
    const entries = parse(
      "SOME_UNREGISTERED_KEY=gsk_abcdefghijklmnopqrstuvwxyz\n"
    );
    assert.deepEqual(findCredentialShapedValues(entries), ["SOME_UNREGISTERED_KEY"]);
  });

  test("ordinary defaults are not mistaken for credentials", () => {
    const entries = parse(
      "ONEDECORE_TRUST_PROXY=false\nONEDECORE_KRITI_MODE=disabled\nNEXT_PUBLIC_APP_URL=\n"
    );
    assert.deepEqual(findCredentialShapedValues(entries), []);
  });
});
