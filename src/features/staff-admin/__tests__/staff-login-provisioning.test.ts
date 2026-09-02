/**
 * Login-identity provisioning — real delivery and retry safety.
 *
 * Verified against Mailpit on GoTrue v2.193.1: createUser produced 0 messages,
 * admin generate_link produced 0, POST /auth/v1/recover produced 1 ("Reset your
 * password"). Also verified that a duplicate create with the same id fails
 * 422 email_exists, which is why a retry must look the identity up first.
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
  StaffIdentityConflictError,
  type AuthorizedRequest,
} from "../server/staff-login-provisioning.ts";

const STAFF_ID = "55555555-5555-4555-8555-555555555555";
const EMAIL = "new.hire@onedecore.in";

interface Call {
  readonly path: string;
  readonly method: string;
  readonly body?: Record<string, unknown>;
}

interface FakeOptions {
  /** Identity already present in Auth, i.e. a partial activation to retry. */
  readonly existing?: { id: string; email: string | null } | null;
  readonly recoverOk?: boolean;
  readonly createReturnsId?: string;
}

function fakeAuth(calls: Call[], options: FakeOptions = {}): AuthorizedRequest {
  return async (path, init) => {
    calls.push({ path, method: init.method, body: init.body });

    if (init.method === "GET" && path.startsWith(AUTH_ADMIN_USERS_PATH)) {
      if (options.existing) {
        return {
          ok: true,
          status: 200,
          json: async () => options.existing,
          text: async () => "",
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => '{"error_code":"user_not_found"}',
      };
    }

    if (path === AUTH_ADMIN_USERS_PATH) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: options.createReturnsId ?? STAFF_ID }),
        text: async () => "",
      };
    }

    const ok = options.recoverOk ?? true;
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => ({}),
      text: async () => (ok ? "" : "smtp unavailable"),
    };
  };
}

const input = { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" };

describe("activation — first attempt", () => {
  test("no identity: creates with the exact employment id, then sends", async () => {
    const calls: Call[] = [];
    const result = await provisionLoginIdentityViaRest(input, {
      authorizedRequest: fakeAuth(calls),
    });

    assert.equal(calls[0]?.method, "GET", "must look up before deciding");
    assert.equal(calls[1]?.path, AUTH_ADMIN_USERS_PATH);
    assert.equal(calls[1]?.body?.id, STAFF_ID);
    assert.equal(calls[2]?.path, AUTH_RECOVER_PATH);
    assert.equal(result.identityCreated, true);
    assert.equal(result.deliveryInvoked, true);
    assert.ok(!calls.some((c) => c.path.includes(AUTH_GENERATE_LINK_PATH)));
  });

  test("create succeeds but the email fails: the call fails loudly", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(input, {
        authorizedRequest: fakeAuth(calls, { recoverOk: false }),
      }),
      /set-password email could not be sent/
    );
    // The identity WAS created, which is exactly the partial state a retry
    // must then be able to recover from.
    assert.ok(calls.some((c) => c.method === "POST" && c.path === AUTH_ADMIN_USERS_PATH));
  });
});

describe("activation — retry after partial activation", () => {
  const existing = { id: STAFF_ID, email: EMAIL };

  test("retry does NOT call admin user creation again", async () => {
    const calls: Call[] = [];
    await provisionLoginIdentityViaRest(input, {
      authorizedRequest: fakeAuth(calls, { existing }),
    });

    const creates = calls.filter(
      (c) => c.method === "POST" && c.path === AUTH_ADMIN_USERS_PATH
    );
    assert.equal(creates.length, 0, "recreating fails 422 email_exists");
  });

  test("retry still invokes the delivery endpoint", async () => {
    const calls: Call[] = [];
    const result = await provisionLoginIdentityViaRest(input, {
      authorizedRequest: fakeAuth(calls, { existing }),
    });

    assert.ok(calls.some((c) => c.path === AUTH_RECOVER_PATH && c.method === "POST"));
    assert.equal(result.deliveryInvoked, true);
  });

  test("retry succeeds and reports a resend rather than a creation", async () => {
    const calls: Call[] = [];
    const result = await provisionLoginIdentityViaRest(input, {
      authorizedRequest: fakeAuth(calls, { existing }),
    });

    assert.equal(result.identityCreated, false);
    assert.equal(result.userId, STAFF_ID);
    assert.equal(result.email, EMAIL);
  });

  test("case differences in the stored address are not a conflict", async () => {
    const calls: Call[] = [];
    const result = await provisionLoginIdentityViaRest(input, {
      authorizedRequest: fakeAuth(calls, {
        existing: { id: STAFF_ID, email: "New.Hire@OneDecore.IN" },
      }),
    });
    assert.equal(result.identityCreated, false);
  });
});

describe("activation — identity conflicts fail closed", () => {
  test("existing identity under a different email is refused", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(input, {
        authorizedRequest: fakeAuth(calls, {
          existing: { id: STAFF_ID, email: "someone.else@onedecore.in" },
        }),
      }),
      StaffIdentityConflictError
    );
    // Nothing is created and nothing is emailed on a conflict.
    assert.ok(!calls.some((c) => c.method === "POST"));
  });

  test("an identity with a mismatched id is refused", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(input, {
        authorizedRequest: fakeAuth(calls, {
          existing: { id: "99999999-9999-4999-8999-999999999999", email: EMAIL },
        }),
      }),
      StaffIdentityConflictError
    );
  });

  test("a create that returns the wrong id is refused", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(input, {
        authorizedRequest: fakeAuth(calls, {
          createReturnsId: "99999999-9999-4999-8999-999999999999",
        }),
      }),
      StaffIdentityConflictError
    );
    assert.ok(!calls.some((c) => c.path === AUTH_RECOVER_PATH));
  });

  test("a failed lookup that is not 404 aborts rather than guessing", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      provisionLoginIdentityViaRest(input, {
        authorizedRequest: async (path, init) => {
          calls.push({ path, method: init.method, body: init.body });
          return {
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => "auth unavailable",
          };
        },
      }),
      /Auth identity lookup failed/
    );
    assert.equal(calls.length, 1, "must not proceed after an unknown lookup failure");
  });
});

describe("activation — delivery and credential containment", () => {
  test("delivery targets the supplied address and never a placeholder", async () => {
    const calls: Call[] = [];
    await provisionLoginIdentityViaRest(
      { ...input, email: "  New.Hire@OneDecore.IN " },
      { authorizedRequest: fakeAuth(calls) }
    );

    const recover = calls.find((c) => c.path === AUTH_RECOVER_PATH);
    assert.equal(recover?.body?.email, EMAIL);
    for (const call of calls) {
      const serialised = JSON.stringify(call.body ?? {});
      assert.doesNotMatch(serialised, /@example\./);
      assert.doesNotMatch(serialised, /noreply/i);
      assert.doesNotMatch(serialised, /placeholder/i);
    }
  });

  test("the module never names a credential", () => {
    const rest = readFileSync(
      join(process.cwd(), "src/features/staff-admin/server/staff-login-provisioning.ts"),
      "utf8"
    );
    assert.doesNotMatch(rest, /serviceRoleKey/);
    assert.doesNotMatch(rest, /createAdminClient/);
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

  test("a mismatched returned id is rejected by the caller guard too", async () => {
    const { runStaffLoginProvision } = await import("../contracts/staff-invite.ts");
    await assert.rejects(
      runStaffLoginProvision(
        { staffId: STAFF_ID, email: EMAIL, displayName: "New Hire" },
        async () => ({ userId: "99999999-9999-4999-8999-999999999999", email: EMAIL })
      ),
      /did not honour the requested user id/
    );
  });
});
