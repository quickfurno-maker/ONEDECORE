/**
 * The HTTP security headers, asserted against the builder that produces them.
 *
 * These call `buildSecurityHeaders` rather than reading `next.config.ts` or
 * curling a running server, because the production policy has to be checkable
 * without a production build. The one thing the builder cannot prove — that
 * Next actually attaches these to responses — was verified separately with a
 * local production server, and is recorded in the Lane 5 audit.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  HSTS_MAX_AGE_SECONDS,
  MANAGED_SUPABASE_ORIGIN,
} from "../http-security.ts";

const production = buildSecurityHeaders({ isProduction: true });
const development = buildSecurityHeaders({ isProduction: false });

function header(headers: readonly { key: string; value: string }[], name: string) {
  return headers.find((entry) => entry.key.toLowerCase() === name.toLowerCase())?.value;
}

/** Directive -> its source list, from the built policy string. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name ?? "", sources];
    })
  );
}

const csp = header(production, "Content-Security-Policy") ?? "";
const parsed = directives(csp);

describe("the four headers that already existed are unchanged", () => {
  // Lane 5 adds; it does not renegotiate what was already agreed.
  const expected: ReadonlyArray<readonly [string, string]> = [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Frame-Options", "DENY"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ];

  for (const [key, value] of expected) {
    test(`${key} is preserved in production`, () => {
      assert.equal(header(production, key), value);
    });
    test(`${key} is preserved in development`, () => {
      assert.equal(header(development, key), value);
    });
  }
});

describe("production adds a CSP and HSTS", () => {
  test("both are present", () => {
    assert.ok(csp.length > 0, "no CSP in production");
    assert.equal(header(production, "Strict-Transport-Security"), "max-age=31536000");
  });

  test("HSTS is one year, without includeSubDomains or preload", () => {
    /*
     * Neither is added deliberately. Subdomains of onedecore.in are not
     * inventoried here, and preload is a submission to a browser-vendor list
     * that is painful to undo — not something to configure in a change that has
     * not been deployed and observed.
     */
    const hsts = header(production, "Strict-Transport-Security") ?? "";
    assert.equal(hsts, `max-age=${HSTS_MAX_AGE_SECONDS}`);
    assert.ok(!/includeSubDomains/i.test(hsts));
    assert.ok(!/preload/i.test(hsts));
  });

  test("the policy is a single header line", () => {
    assert.ok(!csp.includes("\n"), "CSP must not contain newlines");
    assert.ok(!csp.includes("\r"));
  });
});

describe("development ships neither", () => {
  test("no CSP", () => {
    // An enforced policy breaks HMR, and the usual development escape hatch —
    // allowing 'unsafe-eval' — is exactly what must never reach production.
    assert.equal(header(development, "Content-Security-Policy"), undefined);
  });

  test("no HSTS", () => {
    assert.equal(header(development, "Strict-Transport-Security"), undefined);
  });

  test("development adds nothing at all beyond the baseline four", () => {
    assert.equal(development.length, 4);
  });
});

describe("what the production policy must never contain", () => {
  test("no wildcard source", () => {
    for (const [name, sources] of parsed) {
      for (const source of sources) {
        assert.ok(source !== "*", `${name} allows any origin`);
        assert.ok(!source.startsWith("*."), `${name} allows a wildcard subdomain (${source})`);
      }
    }
  });

  test("no unsafe-eval anywhere", () => {
    assert.ok(!csp.includes("unsafe-eval"), "production must never allow eval");
  });

  test("no plaintext or loopback origin", () => {
    /*
     * A production image built with a developer's local env would otherwise
     * ship a policy naming http://127.0.0.1:54321. The builder takes the
     * managed origin from a repository constant precisely so this cannot
     * happen, and this is the assertion that keeps it that way.
     */
    assert.ok(!csp.includes("http://"), "no plaintext origin");
    assert.ok(!/localhost|127\.0\.0\.1/.test(csp), "no loopback origin");
  });

  test("no data: source for scripts", () => {
    assert.ok(!(parsed.get("script-src") ?? []).includes("data:"));
  });

  test("the external origins are exactly Supabase and the two Meta hosts", () => {
    /*
     * This test used to assert there were NO third-party origins at all, and
     * said "if one is ever added, this test is where the decision surfaces".
     * This is that decision, surfaced.
     *
     * Three origins, each named exactly and each for one reason:
     *   - the managed Supabase project, for storage media and the REST API
     *   - connect.facebook.net, which serves fbevents.js and nothing else
     *   - www.facebook.com, where the Pixel posts its beacons
     *
     * No wildcards. `*.facebook.net` would admit every host Meta operates on
     * that domain, now and in future, which is a much larger promise than
     * "this site loads the Pixel". `graph.facebook.com` is deliberately absent:
     * the Conversions API is server-to-server and no browser ever calls it.
     */
    const external = [
      ...new Set(
        [...parsed.values()]
          .flat()
          .filter((source) => source.startsWith("http"))
      ),
    ].sort();
    assert.deepEqual(external, [
      "https://connect.facebook.net",
      "https://lpurlfmpvriyvpkujvyl.supabase.co",
      "https://www.facebook.com",
    ]);
    assert.ok(
      external.every((origin) => !origin.includes("*")),
      "no wildcard origin may enter the policy"
    );
  });
});

describe("what the production policy must contain", () => {
  const expectations: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", "https://connect.facebook.net"]],
    ["script-src-attr", ["'none'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // www.facebook.com is where the Pixel posts an image beacon.
    [
      "img-src",
      ["'self'", "data:", "blob:", MANAGED_SUPABASE_ORIGIN, "https://www.facebook.com"],
    ],
    ["font-src", ["'self'", "data:"]],
    // ...and where it falls back to fetch when an image beacon will not do.
    ["connect-src", ["'self'", MANAGED_SUPABASE_ORIGIN, "https://www.facebook.com"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  for (const [name, sources] of expectations) {
    test(`${name} is exactly ${sources.join(" ")}`, () => {
      assert.deepEqual(parsed.get(name), [...sources]);
    });
  }

  test("exactly one remote script origin, and it is the Meta Pixel", () => {
    /*
     * The `'unsafe-inline'` here is load-bearing for the JSON-LD blocks on the
     * portfolio and product pages, and is the acknowledged limit of a
     * static-compatible policy.
     *
     * What changed is that the policy now admits ONE remote script origin. It
     * is enumerated rather than merely counted so that adding a second — a tag
     * manager, an analytics vendor, a chat widget — fails here and has to be
     * argued for.
     */
    const scriptSources = parsed.get("script-src") ?? [];
    assert.deepEqual(
      scriptSources.filter((source) => source.startsWith("http")),
      ["https://connect.facebook.net"]
    );
  });

  test("the Supabase origin is the exact managed project over https", () => {
    assert.equal(MANAGED_SUPABASE_ORIGIN, "https://lpurlfmpvriyvpkujvyl.supabase.co");
  });
});

describe("the builder is a pure function of its input", () => {
  test("a caller-supplied origin is used verbatim", () => {
    const policy = buildContentSecurityPolicy("https://example.test");
    assert.ok(policy.includes("connect-src 'self' https://example.test"));
  });

  test("the default is the managed project", () => {
    assert.equal(buildContentSecurityPolicy(), buildContentSecurityPolicy(MANAGED_SUPABASE_ORIGIN));
  });

  test("repeated calls agree", () => {
    assert.equal(buildContentSecurityPolicy(), csp);
  });
});
