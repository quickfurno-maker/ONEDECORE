/**
 * Login-identity provisioning — real email delivery.
 *
 * `admin.generateLink()` mints a link and delivers nothing. Verified against
 * Mailpit on GoTrue v2.193.1: createUser produced 0 messages, generateLink
 * produced 0, and POST /auth/v1/recover produced 1 ("Reset your password").
 * These tests pin that the implementation calls the DELIVERY endpoint, with the
 * exact employment UUID preserved.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  AUTH_ADMIN_USERS_PATH,
  AUTH_GENERATE_LINK_PATH,
  AUTH_RECOVER_PATH,
  provisionLoginIdentityViaRest,
} from "../server/staff-login-provisioning.ts";

const STAFF_ID = "55555555-5555-4555-8555-555555555555";
const EMAIL = "new.hire@onedecore.in";

interface Call {
  readonly url: string;
  readonly body: Record<string, unknown>;
}

function fakeFetch(
  calls: Call[],
  overrides: { readonly recoverOk?: boolean; readonly returnedId?: string } = {}
) {
  return async (path: string, body: Record<string, unknown>) => {
    calls.push({ url: path, body });

    if (path.includes(AUTH_ADMIN_USERS_PATH)) {
      return {
        ok: true,
        json: async () => ({ id: overrides.returnedId ?? STAFF_ID }),
        text: async () => "",
      };
    }

    const ok = overrides.recoverOk ?? true;
    return {
      ok,
      json: async () => ({}),
      text: async () => (ok ? "" : "smtp unavailable"),
    };
  };
}

const deps = (authorizedFetch: ReturnType<typeof fakeFetch>) => ({ authorizedFetch });

describe("login provisioning — actual email delivery", () => {
  test("the delivery endpoint is invoked, not merely link generation", async () => {
    const calls: Call[] = [];
    const result = await provisionLoginIdentityViaRest(
      { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
      deps(fakeFetch(calls))
    );

    const paths = calls.map((call) => call.url);
    assert.ok(
      paths.some((p) => p.includes(AUTH_RECOVER_PATH)),
      "the delivery endpoint must be called"
    );
    assert.ok(
      !paths.some((p) => p.includes(AUTH_GENERATE_LINK_PATH)),
      "generate_link delivers nothing and must not be used as the send step"
    );
    assert.equal(result.deliveryInvoked, true);
  });

  test("the login identity reuses the exact employment UUID", async () => {
    const calls: Call[] = [];
    await provisionLoginIdentityViaRest(
      { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
      deps(fakeFetch(calls))
    );

    const create = calls.find((call) => call.url.includes(AUTH_ADMIN_USERS_PATH));
    assert.ok(create, "admin users endpoint must be called");
    assert.equal(create?.body.id, STAFF_ID);
    assert.equal(create?.body.email, EMAIL);
  });

  test("delivery is addressed to the supplied email and never a placeholder", async () => {
    const calls: Call[] = [];
    await provisionLoginIdentityViaRest(
      { staffId: STAFF_ID, email: "  New.Hire@OneDecore.IN ", displayName: "New Hire" },
      deps(fakeFetch(calls))
    );

    const recover = calls.find((call) => call.url.includes(AUTH_RECOVER_PATH));
    assert.equal(recover?.body.email, EMAIL);
    for (const call of calls) {
      const serialised = JSON.stringify(call.body);
      assert.doesNotMatch(serialised, /@example\./);
      assert.doesNotMatch(serialised, /noreply/i);
      assert.doesNotMatch(serialised, /placeholder/i);
    }
  });

  test("a failed send is a failure, never a silent success", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(
        { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
        deps(fakeFetch(calls, { recoverOk: false }))
      ),
      /set-password email could not be sent/
    );
  });

  test("the identity is created before the email is sent", async () => {
    const calls: Call[] = [];
    await provisionLoginIdentityViaRest(
      { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
      deps(fakeFetch(calls))
    );
    assert.ok(calls[0]?.url.includes(AUTH_ADMIN_USERS_PATH));
    assert.ok(calls[1]?.url.includes(AUTH_RECOVER_PATH));
  });

  test("a mismatched returned id is rejected by the caller guard", async () => {
    const { runStaffLoginProvision } = await import("../contracts/staff-invite.ts");
    await assert.rejects(
      runStaffLoginProvision(
        { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
        async () => ({ userId: "99999999-9999-4999-8999-999999999999", email: EMAIL })
      ),
      /did not honour the requested user id/
    );
  });

  test("the adapter no longer treats generateLink as delivery", () => {
    const adapter = readFileSync(
      join(process.cwd(), "src/features/staff-admin/server/staff-invite-adapter.ts"),
      "utf8"
    );
    const executable = adapter
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(" ");
    assert.doesNotMatch(executable, /generateLink/);
    assert.match(executable, /provisionLoginIdentityViaRest/);
  });
});
