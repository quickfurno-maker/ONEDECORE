/**
 * Batched authorization: same answers, fewer round trips.
 *
 * The managed telemetry that motivated this is blunt: 65,586 of 78,938
 * PostgREST requests were `authorize`, and resolving one CRM access context
 * issued twenty-one of them. The risk in fixing that is not performance, it is
 * that a batching layer answers a permission question wrongly — so these tests
 * are mostly about the answers, and only then about the count.
 *
 * The database half of the contract is proved in
 * `supabase/tests/database/59_authorize_many_equivalence_test.sql`, which
 * compares `authorize_many` against `authorize` for a granted user, a suspended
 * profile, an inactive role, revoked app access, a user with no role and an
 * unauthenticated session. This half covers the TypeScript that calls it.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { authorizeMany } from "../authorize-many.ts";
import {
  CRM_ACCESS_CONTEXT_CODES,
  bulkImportPermissionsFrom,
  canAssignLeadsFrom,
  crmPermissionsFrom,
  leadDeletionPermissionsFrom,
  lifecycleMutationPermissionsFrom,
  manualLeadPermissionsFrom,
  salesTargetPermissionsFrom,
  slaPolicyPermissionsFrom,
} from "@/features/crm/server/crm-permissions";

/** A client stand-in that records every call and answers from a grant set. */
function fakeClient(granted: readonly string[] = [], options: { fail?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const grantedSet = new Set(granted);

  const client = {
    calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (options.fail) {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      if (name === "authorize_many") {
        const codes = (args.requested_permissions ?? []) as string[];
        return Promise.resolve({
          data: Object.fromEntries(codes.map((code) => [code, grantedSet.has(code)])),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return client as unknown as Parameters<typeof authorizeMany>[1] & { calls: typeof calls };
}

describe("the answers", () => {
  test("a granted code is true and an ungranted code is false", async () => {
    const db = fakeClient(["leads.read_all"]);
    const answers = await authorizeMany(["leads.read_all", "leads.delete"], db);
    assert.deepEqual(answers, { "leads.read_all": true, "leads.delete": false });
  });

  test("every requested code is present, so a missing key cannot read as a grant", async () => {
    // The RPC answers only what it was asked; a caller reading `answers[code]`
    // for a code the server omitted must see `false`, not `undefined`.
    const db = {
      rpc: () => Promise.resolve({ data: { "leads.read_all": true }, error: null }),
    } as unknown as Parameters<typeof authorizeMany>[1];

    const answers = await authorizeMany(["leads.read_all", "leads.delete"], db);
    assert.equal(answers["leads.read_all"], true);
    assert.equal(answers["leads.delete"], false);
    assert.equal(Object.keys(answers).length, 2);
  });

  test("a non-boolean answer is not a grant", async () => {
    // Only exactly `true` grants. A truthy string, a 1, an object: all deny.
    const db = {
      rpc: () =>
        Promise.resolve({
          data: { a: "true", b: 1, c: {}, d: null, e: true },
          error: null,
        }),
    } as unknown as Parameters<typeof authorizeMany>[1];

    const answers = await authorizeMany(["a", "b", "c", "d", "e"], db);
    assert.deepEqual(answers, { a: false, b: false, c: false, d: false, e: true });
  });

  test("an RPC error denies rather than throwing", async () => {
    /*
     * A transport failure inside a layout must not become an unhandled
     * exception, and must certainly not become a grant. Single `authorize`
     * already behaves this way; the batch matches it.
     */
    const db = fakeClient(["leads.read_all"], { fail: true });
    const answers = await authorizeMany(["leads.read_all", "leads.delete"], db);
    assert.deepEqual(answers, { "leads.read_all": false, "leads.delete": false });
  });

  test("an empty request asks nothing and answers nothing", async () => {
    const db = fakeClient();
    assert.deepEqual(await authorizeMany([], db), {});
    assert.equal(db.calls.length, 0);
  });
});

describe("the round trips", () => {
  test("many codes cost one call", async () => {
    const db = fakeClient([...CRM_ACCESS_CONTEXT_CODES]);
    await authorizeMany(CRM_ACCESS_CONTEXT_CODES, db);

    assert.equal(db.calls.length, 1, "one call for the whole CRM context");
    assert.equal(db.calls[0]?.name, "authorize_many");
    assert.equal(
      (db.calls[0]?.args.requested_permissions as string[]).length,
      CRM_ACCESS_CONTEXT_CODES.length
    );
  });

  test("the CRM context resolves 21 permissions", () => {
    /*
     * The measured number, pinned. It used to be twenty-one ROUND TRIPS; it is
     * now twenty-one permissions in one. If a future edit adds a permission to
     * the context this fails, which is the moment to check it is still one call.
     */
    assert.equal(CRM_ACCESS_CONTEXT_CODES.length, 21);
    assert.equal(new Set(CRM_ACCESS_CONTEXT_CODES).size, 21, "and none is asked twice");
  });

  test("more than fifty codes are split rather than truncated", async () => {
    /*
     * The RPC caps a single call at fifty. Silently dropping the fifty-first
     * would answer `false` for a permission nobody checked — a denial the user
     * cannot explain and a bug nobody would find.
     */
    const codes = Array.from({ length: 120 }, (_unused, index) => `perm.${index}`);
    const db = fakeClient(codes);
    const answers = await authorizeMany(codes, db);

    assert.equal(db.calls.length, 3, "120 codes in batches of 50");
    assert.equal(Object.keys(answers).length, 120);
    assert.ok(Object.values(answers).every((value) => value === true));
  });
});

describe("the mappers are pure and total", () => {
  /*
   * `resolveCrmAccess` now resolves one answer set and hands it to every
   * mapper. That only works if a mapper reads exactly its own codes and treats
   * anything absent as denied.
   */
  const everything = Object.fromEntries(
    CRM_ACCESS_CONTEXT_CODES.map((code) => [code, true])
  );
  const nothing = {};

  test("a full answer set grants what it says", () => {
    assert.deepEqual(crmPermissionsFrom(everything), {
      "leads.read_all": true,
      "leads.read_assigned": true,
      "sources.read": true,
      "crm.activities.read": true,
      "consents.read": true,
    });
    assert.equal(canAssignLeadsFrom(everything), true);
    assert.deepEqual(manualLeadPermissionsFrom(everything), {
      canCreateLeads: true,
      canOverrideLeadDuplicate: true,
      canManageLeadSources: true,
    });
    assert.deepEqual(lifecycleMutationPermissionsFrom(everything), {
      canTransitionLeads: true,
      canManageLeadNotes: true,
      canManageLeadFollowUps: true,
    });
    assert.deepEqual(bulkImportPermissionsFrom(everything), {
      canBulkImportLeads: true,
      canApproveLeadImports: true,
      canManageLeadAssignmentRules: true,
    });
    assert.deepEqual(salesTargetPermissionsFrom(everything), {
      canReadSalesTargets: true,
      canManageSalesTargets: true,
      canReadCrmReporting: true,
    });
    assert.deepEqual(slaPolicyPermissionsFrom(everything), { canManageSlaPolicy: true });
    assert.deepEqual(leadDeletionPermissionsFrom(everything), { canDeleteLeads: true });
  });

  test("an empty answer set grants nothing", () => {
    assert.ok(Object.values(crmPermissionsFrom(nothing)).every((value) => value === false));
    assert.equal(canAssignLeadsFrom(nothing), false);
    assert.ok(Object.values(manualLeadPermissionsFrom(nothing)).every((v) => v === false));
    assert.ok(Object.values(lifecycleMutationPermissionsFrom(nothing)).every((v) => v === false));
    assert.ok(Object.values(bulkImportPermissionsFrom(nothing)).every((v) => v === false));
    assert.ok(Object.values(salesTargetPermissionsFrom(nothing)).every((v) => v === false));
    assert.equal(slaPolicyPermissionsFrom(nothing).canManageSlaPolicy, false);
    assert.equal(leadDeletionPermissionsFrom(nothing).canDeleteLeads, false);
  });

  test("a mapper reads only its own codes", () => {
    // Deleting a lead and transitioning one are different authorities. A single
    // shared answer set must not let one leak into the other.
    const onlyDelete = { "leads.delete": true };
    assert.equal(leadDeletionPermissionsFrom(onlyDelete).canDeleteLeads, true);
    assert.equal(lifecycleMutationPermissionsFrom(onlyDelete).canTransitionLeads, false);
    assert.equal(canAssignLeadsFrom(onlyDelete), false);
    assert.ok(Object.values(crmPermissionsFrom(onlyDelete)).every((value) => value === false));
  });

  test("answers are not shared between identities", async () => {
    /*
     * Nothing is cached anywhere, so two clients standing for two users get
     * two answers. The check exists because the obvious next optimisation —
     * memoising the batch — is exactly where a cross-identity leak would come
     * from.
     */
    const broad = fakeClient(["leads.read_all", "leads.delete"]);
    const narrow = fakeClient(["leads.read_assigned"]);

    const broadAnswers = await authorizeMany(CRM_ACCESS_CONTEXT_CODES, broad);
    const narrowAnswers = await authorizeMany(CRM_ACCESS_CONTEXT_CODES, narrow);

    assert.equal(broadAnswers["leads.read_all"], true);
    assert.equal(narrowAnswers["leads.read_all"], false);
    assert.equal(narrowAnswers["leads.read_assigned"], true);
    assert.equal(broadAnswers["leads.read_assigned"], false);
  });
});
