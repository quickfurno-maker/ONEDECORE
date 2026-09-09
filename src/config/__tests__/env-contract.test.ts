/**
 * The environment contract, and the invariants that make it worth trusting.
 *
 * `scripts/verify-env-contract.mjs` compares three lists — source, registry,
 * `.env.example` — and fails CI when they disagree. This suite asserts the
 * properties of the registry itself: that a secret cannot be public, that the
 * fail-closed gates are still classified as gates, and that the cryptographic
 * domains stay separate.
 *
 * The split matters. The script catches drift; these catch a registry that is
 * internally consistent and wrong — a secret marked public, an activation gate
 * quietly reclassified as required, a domain's secret allowed to double as
 * another's.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  ONEDECORE_ENV_CONTRACT,
  ONEDECORE_ENV_KEYS,
  findEnvKeyContract,
  type EnvKeyContract,
} from "../env-contract.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const byName = new Map<string, EnvKeyContract>(
  ONEDECORE_ENV_CONTRACT.map((entry) => [entry.name, entry])
);

describe("the registry is internally coherent", () => {
  test("every key is declared exactly once", () => {
    assert.equal(byName.size, ONEDECORE_ENV_CONTRACT.length);
    assert.equal(ONEDECORE_ENV_KEYS.length, ONEDECORE_ENV_CONTRACT.length);
  });

  test("every entry carries a purpose worth reading", () => {
    for (const entry of ONEDECORE_ENV_CONTRACT) {
      assert.ok(
        entry.purpose.length > 20,
        `${entry.name} needs a purpose that says what happens without it`
      );
    }
  });

  test("lookup finds a known key and refuses an unknown one", () => {
    assert.equal(findEnvKeyContract("SUPABASE_SERVICE_ROLE_KEY")?.sensitivity, "secret");
    assert.equal(findEnvKeyContract("NOT_A_REAL_KEY"), undefined);
  });
});

describe("A. no secret is reachable from a browser", () => {
  test("no secret is public-scoped", () => {
    for (const entry of ONEDECORE_ENV_CONTRACT) {
      if (entry.sensitivity !== "secret") continue;
      assert.equal(
        entry.scope,
        "server",
        `${entry.name} is a secret and must be server-scoped`
      );
    }
  });

  test("no NEXT_PUBLIC_ key is a secret", () => {
    /*
     * Next.js inlines this prefix into client JavaScript at build time. A
     * secret behind it is not leaked eventually — it is published, to every
     * visitor, in the bundle.
     */
    for (const entry of ONEDECORE_ENV_CONTRACT) {
      if (!entry.name.startsWith("NEXT_PUBLIC_")) continue;
      assert.notEqual(entry.sensitivity, "secret", entry.name);
      assert.equal(entry.scope, "public", entry.name);
    }
  });

  test("the removed browser lead-form flag has not returned", () => {
    // A NEXT_PUBLIC_ flag could not know the running server's state, and a real
    // enquiry was lost to the disagreement.
    assert.equal(findEnvKeyContract("NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE"), undefined);
    assert.doesNotMatch(read(".env.example"), /^NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=/m);
  });
});

describe("B. deferred capabilities are still gates, and still closed", () => {
  const gated = [
    "ONEDECORE_SHOP_PUBLIC_ENABLED",
    "ONEDECORE_LANDING_LAB_PUBLIC_ENABLED",
    "ONEDECORE_WHATSAPP_WEBHOOK_MODE",
    "ONEDECORE_WHATSAPP_OUTBOUND_MODE",
    "ONEDECORE_CAMPAIGN_EXECUTION_MODE",
    "ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED",
    "ONEDECORE_KRITI_MODE",
    "ONEDECORE_LEAD_INTAKE_MODE",
  ];

  test("each remains classified as activation-gated", () => {
    /*
     * Reclassifying one of these to `required` would be how a deferred
     * capability quietly becomes something an operator is told to switch on.
     */
    for (const name of gated) {
      assert.equal(
        byName.get(name)?.lifecycle,
        "activation-gated",
        `${name} must stay an activation gate`
      );
    }
  });

  test(".env.example ships them OFF", () => {
    const example = read(".env.example");
    for (const [key, off] of [
      ["ONEDECORE_SHOP_PUBLIC_ENABLED", "false"],
      ["ONEDECORE_LANDING_LAB_PUBLIC_ENABLED", "false"],
      ["ONEDECORE_WHATSAPP_WEBHOOK_MODE", "disabled"],
      ["ONEDECORE_WHATSAPP_OUTBOUND_MODE", "disabled"],
      ["ONEDECORE_CAMPAIGN_EXECUTION_MODE", "disabled"],
      ["ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED", "false"],
      ["ONEDECORE_PROVIDER_DATA_SHARING_ENABLED", "false"],
      ["ONEDECORE_KRITI_MODE", "disabled"],
      ["ONEDECORE_LEAD_INTAKE_MODE", "disabled"],
      ["ONEDECORE_TRUST_PROXY", "false"],
    ] as const) {
      assert.match(
        example,
        new RegExp(`^${key}=${off}$`, "m"),
        `${key} must default to ${off} in the template`
      );
    }
  });

  test("local-test-only keys are commented, never active", () => {
    const example = read(".env.example");
    for (const entry of ONEDECORE_ENV_CONTRACT) {
      if (entry.lifecycle !== "local-test-only") continue;
      assert.equal(entry.inEnvExample, false, entry.name);
      assert.doesNotMatch(example, new RegExp(`^${entry.name}=`, "m"), entry.name);
    }
  });
});

describe("C. cryptographic domains stay separate", () => {
  test("each domain has its own registered secret", () => {
    for (const name of [
      "ONEDECORE_LEAD_HASH_SECRET",
      "ONEDECORE_LANDING_LAB_HMAC_SECRET",
      "ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET",
      "ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET",
      "QUOTATION_CAPABILITY_SECRET",
    ]) {
      const entry = byName.get(name);
      assert.equal(entry?.sensitivity, "secret", name);
      assert.equal(entry?.scope, "server", name);
    }
    // Four distinct subsystems, so no two share an owner by construction.
    const subsystems = new Set(
      ["ONEDECORE_LEAD_HASH_SECRET", "ONEDECORE_LANDING_LAB_HMAC_SECRET",
       "ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET", "QUOTATION_CAPABILITY_SECRET"]
        .map((n) => byName.get(n)?.subsystem)
    );
    assert.equal(subsystems.size, 4);
  });

  test("Landing Lab still does not borrow the lead secret", () => {
    const landing = read("src/features/landing-lab/server/landing-lab-env.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(landing, /ONEDECORE_LEAD_HASH_SECRET/);
  });
});

describe("D. the canonical Supabase target rule is untouched", () => {
  const runtime = read("src/lib/supabase/runtime-target.ts");

  test("production still demands the managed project", () => {
    assert.match(runtime, /ONEDECORE_MANAGED_SUPABASE_HOST = "lpurlfmpvriyvpkujvyl\.supabase\.co"/);
    assert.match(runtime, /requireManaged/);
  });

  test("both Supabase URL keys are registered as the same kind of thing", () => {
    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
      assert.equal(byName.get(name)?.sensitivity, "public", name);
    }
  });
});

describe("E. errors name rules, never values", () => {
  test("the registry holds no value-shaped strings", () => {
    /*
     * Metadata only. A default that looked like a credential would be a
     * credential committed to git.
     */
    const source = read("src/config/env-contract.ts");
    assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /sb_secret_|sbp_|EAA[A-Za-z0-9]{20}/);
  });

  test("the target validator reports the rule and not the rejected URL", () => {
    assert.match(runtimeError(), /managed ONEDECORE/);
  });

  function runtimeError(): string {
    const runtime = read("src/lib/supabase/runtime-target.ts");
    const at = runtime.indexOf("Production requires");
    return runtime.slice(at, at + 120);
  }
});
