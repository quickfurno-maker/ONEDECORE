/**
 * ONE SECRET, ONE DOMAIN.
 *
 * THE DEFECT THIS SUITE CLOSES
 *
 * `getLandingLabHmacSecret` used to fall back to `ONEDECORE_LEAD_HASH_SECRET`
 * whenever its own variable was unset — in production as much as locally. Two
 * unrelated domains then shared one key: the value that fingerprints lead
 * phone numbers also signed the publication contexts deciding which campaign a
 * lead is attributed to.
 *
 * That is worse than it looks. Rotating the lead secret would have silently
 * invalidated every landing signature; compromising either would have
 * compromised both; and nothing anywhere would have reported it, because a
 * successful fallback is indistinguishable from correct configuration.
 *
 * Missing now means missing. `resolveTrustedLandingIdentity` already refuses to
 * attribute a lead when the secret is null, so absent configuration fails
 * closed: the enquiry is still accepted, it simply carries no attribution the
 * server cannot prove.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  getLandingLabHmacSecret,
  LANDING_LAB_HMAC_SECRET_ENV,
  LANDING_LAB_HMAC_TEST_SECRET_ENV,
} from "../server/landing-lab-env.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const LEAD_SECRET = "lead-hash-secret-used-for-phone-fingerprints!!";
const LANDING_SECRET = "landing-lab-dedicated-hmac-secret-32chars!!";
const FIXTURE_SECRET = "landing-lab-local-fixture-secret-32chars!!!";

describe("production never borrows the lead secret", () => {
  test("a lead secret alone yields NOTHING in production", () => {
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "production",
        ONEDECORE_LEAD_HASH_SECRET: LEAD_SECRET,
      }),
      null
    );
  });

  test("the dedicated secret is used when present", () => {
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "production",
        [LANDING_LAB_HMAC_SECRET_ENV]: LANDING_SECRET,
        ONEDECORE_LEAD_HASH_SECRET: LEAD_SECRET,
      }),
      LANDING_SECRET
    );
  });

  test("the local fixture secret is ignored in production", () => {
    // A test fixture must never become a production key by accident.
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "production",
        [LANDING_LAB_HMAC_TEST_SECRET_ENV]: FIXTURE_SECRET,
      }),
      null
    );
  });

  test("a short dedicated secret is refused rather than padded", () => {
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "production",
        [LANDING_LAB_HMAC_SECRET_ENV]: "too-short",
      }),
      null
    );
  });
});

describe("outside production the fixture is explicit, not implicit", () => {
  test("the fixture secret is honoured", () => {
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "test",
        [LANDING_LAB_HMAC_TEST_SECRET_ENV]: FIXTURE_SECRET,
      }),
      FIXTURE_SECRET
    );
  });

  test("the lead secret is STILL not borrowed, even locally", () => {
    /*
     * The fallback is gone everywhere, not merely gated by NODE_ENV. A
     * developer whose landing signatures work locally only because the lead
     * secret happened to be set would ship a configuration that fails in
     * production — which is exactly the class of surprise this removes.
     */
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "development",
        ONEDECORE_LEAD_HASH_SECRET: LEAD_SECRET,
      }),
      null
    );
  });

  test("the dedicated secret still wins over the fixture", () => {
    assert.equal(
      getLandingLabHmacSecret({
        NODE_ENV: "development",
        [LANDING_LAB_HMAC_SECRET_ENV]: LANDING_SECRET,
        [LANDING_LAB_HMAC_TEST_SECRET_ENV]: FIXTURE_SECRET,
      }),
      LANDING_SECRET
    );
  });
});

describe("the separation is structural, not incidental", () => {
  const env = read("src/features/landing-lab/server/landing-lab-env.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("no code path reads the lead secret any more", () => {
    assert.doesNotMatch(env, /ONEDECORE_LEAD_HASH_SECRET/);
  });

  test("the two variables are distinct names", () => {
    assert.notEqual(LANDING_LAB_HMAC_SECRET_ENV, "ONEDECORE_LEAD_HASH_SECRET");
    assert.notEqual(LANDING_LAB_HMAC_TEST_SECRET_ENV, LANDING_LAB_HMAC_SECRET_ENV);
  });

  test("no secret value can reach a caller through an error", () => {
    // The resolver returns null; it never throws a value-bearing error.
    assert.doesNotThrow(() =>
      getLandingLabHmacSecret({ ONEDECORE_LEAD_HASH_SECRET: LEAD_SECRET })
    );
  });

  test("a missing secret fails closed at the verification boundary", () => {
    const verify = read("src/features/landing-lab/server/verify-live-publication-context.ts");
    assert.match(verify, /if \(!secret\)/);
    assert.match(verify, /ok: false/);
  });
});
