/**
 * Canonical Lead Detail for the Owner mobile app.
 *
 * The Owner app's Lead Command Center needs the whole lead: identity, contact
 * channels, source, assignment and its history, notes, the activity lifecycle,
 * consent, the SLA clock, the on-hold / closed-lost state and the unified
 * timeline. All of that is already assembled once, for the web lead page.
 *
 * The only real risk in giving a phone the same facts is that it ends up with a
 * SECOND assembly — a second timeline order, a second dedupe, a second idea of
 * who completed a call and when. These tests guard the opposite:
 *
 *   - one lead-detail implementation, reached by both callers
 *   - the caller's own client on both paths; no service role, no widened scope
 *   - a hidden lead and a missing lead answer identically
 *   - the conversation log is composed by the PR #136 helpers, server-side
 *   - Android is left with nothing to derive
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildConversationActivityHistory,
  conversationNoteHeadingForActivityType,
  CRM_CLIENT_FACING_ACTIVITY_TYPES,
} from "../contracts/lead-activity-history.ts";
import { toMobileLeadDetail } from "../contracts/mobile-lead-detail-dtos.ts";
import type {
  CrmLeadDetail,
  CrmLeadDetailFollowUp,
} from "../contracts/lead-detail-dtos.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

/* Comments explain what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

const DETAIL_ROUTE =
  "src/app/api/mobile/crm/leads/[leadId]/detail/route.ts";
const INTELLIGENCE_ROUTE = "src/app/api/mobile/crm/leads/[leadId]/route.ts";
const LEADS_ROUTE = "src/app/api/mobile/crm/leads/route.ts";
const PIPELINE_ROUTE = "src/app/api/mobile/crm/pipeline/route.ts";
const REPOSITORY = "src/features/crm/server/crm-lead-repository.ts";
const MOBILE_AUTH = "src/features/crm/server/crm-mobile-auth.ts";
const MOBILE_DTOS = "src/features/crm/contracts/mobile-lead-detail-dtos.ts";
const HISTORY_CONTRACT = "src/features/crm/contracts/lead-activity-history.ts";
const TIMELINE_QUERIES = "src/features/crm/server/crm-lead-timeline-queries.ts";
const WEB_LEAD_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";
const CRM_DB = "src/features/crm/server/crm-db.ts";

/** The shared assembly, isolated from the wrappers around it. */
function sharedAssembly(): string {
  const body = code(readSrc(REPOSITORY));
  const start = body.indexOf("export async function queryLeadDetail(");

  assert.ok(start >= 0, "queryLeadDetail must exist");

  return body.slice(
    start,
    body.indexOf("export async function getLeadDetailForCurrentUser(")
  );
}

const OWNER_LABEL = "Scheduled Owner";

function followUp(
  overrides: Partial<CrmLeadDetailFollowUp> = {}
): CrmLeadDetailFollowUp {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerLabel: OWNER_LABEL,
    dueAt: "2026-09-01T04:30:00.000Z",
    status: "completed",
    outcome: "Connected",
    completedAt: "2026-09-05T05:15:00.000Z",
    cancelledAt: null,
    completedByLabel: "Sales Executive A",
    cancelledByLabel: null,
    activityType: "call",
    title: "Follow-up call",
    priority: "normal",
    isPrimaryNextAction: false,
    durationMinutes: 15,
    reminderAt: null,
    outcomeCode: "connected",
    completionNote: "Client wants a revised quote by Friday.",
    quotationId: null,
    source: "manual",
    cadenceEnrollmentId: null,
    cadenceStepId: null,
    createdAt: "2026-08-30T04:00:00.000Z",
    updatedAt: "2026-09-05T05:15:00.000Z",
    ...overrides,
  };
}

/* ========================================================================== */
/* 1. Authentication — the same caller, the same scope                         */
/* ========================================================================== */

describe("the endpoint is authenticated and unprivileged", () => {
  test("it reuses the CRM-M1 bearer auth unchanged", () => {
    const route = readSrc(DETAIL_ROUTE);

    assert.match(route, /resolveCrmMobileAuth/);
    assert.match(route, /crmMobileAuthError/);

    /* It supplies the caller; it does not assemble its own access context. */
    assert.ok(
      !code(route).includes("canReadBroad:"),
      "the route must not build its own CrmAccessContext"
    );
  });

  test("a bearer token is required and verified against the auth server", () => {
    const auth = code(readSrc(MOBILE_AUTH));

    /* No token at all is refused before any client is used for a query. */
    assert.match(auth, /readBearerToken\(request\)/);
    assert.match(auth, /if \(!token\) \{\s*return \{ kind: "unauthenticated" \};/);

    /*
     * A forged or expired token is refused too: `getUser` round-trips to the
     * auth server rather than trusting the claims in the token locally.
     */
    assert.match(auth, /await db\.auth\.getUser\(\)/);
    assert.match(
      auth,
      /if \(error \|\| !data\.user\) \{\s*return \{ kind: "unauthenticated" \};/
    );
  });

  test("an unauthenticated or unentitled caller never reaches a query", () => {
    const body = code(readSrc(DETAIL_ROUTE));

    const authAt = body.indexOf("resolveCrmMobileAuth");
    const guardAt = body.indexOf('auth.kind !== "granted"');
    const queryAt = body.indexOf("await queryLeadDetail(");

    assert.ok(authAt >= 0, "must resolve auth");
    assert.ok(guardAt > authAt, "must guard before querying");
    assert.ok(queryAt > guardAt, "must query only after the guard");
  });

  test("a malformed lead id is refused before any query", () => {
    const body = code(readSrc(DETAIL_ROUTE));

    const validateAt = body.indexOf("isCrmLeadIdShape(leadId)");
    const queryAt = body.indexOf("await queryLeadDetail(");

    assert.ok(validateAt >= 0, "must validate the id shape");
    assert.ok(queryAt > validateAt, "a junk id must never reach a query");
    assert.match(body, /invalid_request/);
  });

  test("it exposes GET only", () => {
    const route = readSrc(DETAIL_ROUTE);

    assert.match(route, /export async function GET/);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export async function ${method}\\b`).test(route),
        `must not expose ${method}`
      );
    }
  });

  test("caller RLS is preserved: the read runs on the caller's own client", () => {
    /* The route hands the bearer client straight through. */
    assert.match(readSrc(DETAIL_ROUTE), /auth\.db/);

    const assembly = sharedAssembly();

    /* And the assembly resolves it rather than minting a privileged one. */
    assert.match(assembly, /resolveCrmDb\(db\)/);
    assert.ok(
      !assembly.includes("await createClient()"),
      "the shared assembly must not bypass the client resolver"
    );

    /* The resolver itself only ever produces a caller-scoped client. */
    const db = code(readSrc(CRM_DB));
    assert.match(db, /return db \?\? \(await createClient\(\)\);/);
  });

  test("no service-role or admin path exists anywhere in the slice", () => {
    for (const rel of [
      DETAIL_ROUTE,
      MOBILE_DTOS,
      MOBILE_AUTH,
      REPOSITORY,
      TIMELINE_QUERIES,
      CRM_DB,
    ]) {
      for (const forbidden of [
        "service_role",
        "serviceRole",
        "SERVICE_ROLE",
        "createAdminClient",
        "sb_secret_",
      ]) {
        assert.ok(
          !readSrc(rel).includes(forbidden),
          `${rel} must not reference ${forbidden}`
        );
      }
    }
  });

  test("consent stays behind its own permission", () => {
    /*
     * The mobile path adds no exemption: the consent read is still gated on
     * `context.canReadConsents`, resolved by the same `resolveCrmAccess`.
     */
    assert.match(sharedAssembly(), /context\.canReadConsents/);
  });
});

/* ========================================================================== */
/* 2. No existence oracle                                                      */
/* ========================================================================== */

describe("a hidden lead is indistinguishable from a missing one", () => {
  test("both answer the same single 404", () => {
    const body = code(readSrc(DETAIL_ROUTE));

    assert.match(body, /if \(!detail\)/);
    assert.match(body, /not_found/);

    assert.equal(
      body.split("not_found").length - 1,
      1,
      "there must be exactly one not-found answer"
    );
  });

  test("the shared assembly returns null rather than throwing", () => {
    assert.match(sharedAssembly(), /if \(!lead\) \{\s*return null;/);
  });

  test("404 is part of the shared envelope", () => {
    assert.match(readSrc(MOBILE_AUTH), /not_found:\s*404/);
  });

  test("an error answers a category, never an internal message", () => {
    const body = code(readSrc(DETAIL_ROUTE));

    assert.match(body, /crmMobileError\(\s*"unavailable"/);
    assert.ok(
      !body.includes("error.message"),
      "a Postgres message must never reach the phone"
    );
  });
});

/* ========================================================================== */
/* 3. One assembly, two callers                                                */
/* ========================================================================== */

describe("the mobile and web detail reads are the same read", () => {
  test("the web page and the mobile route reach the same module", () => {
    /* The web page keeps its cookie-scoped entry point, unchanged. */
    assert.match(readSrc(WEB_LEAD_PAGE), /getLeadDetailForCurrentUser/);

    /* Which is a thin wrapper over the shared assembly. */
    const repo = code(readSrc(REPOSITORY));
    assert.match(repo, /return queryLeadDetail\(context, leadId\);/);

    /* And the route calls that same assembly with the bearer caller. */
    assert.match(
      code(readSrc(DETAIL_ROUTE)),
      /await queryLeadDetail\(\s*auth\.context,\s*leadId\.trim\(\),\s*auth\.db\s*\)/
    );
  });

  test("there is exactly one lead-detail assembly", () => {
    const repo = code(readSrc(REPOSITORY));

    assert.equal(
      repo.split("export async function queryLeadDetail(").length - 1,
      1,
      "queryLeadDetail must be declared once"
    );

    /* The route assembles nothing of its own. */
    const route = code(readSrc(DETAIL_ROUTE));
    for (const table of [
      "leads",
      "contacts",
      "lead_notes",
      "lead_follow_ups",
      "lead_activities",
      "lead_source_touchpoints",
      "lead_assignment_history",
      "consent_events",
      "crm_sla_clocks",
    ]) {
      assert.ok(
        !route.includes(`"${table}"`),
        `the route must not read ${table} itself`
      );
    }
  });

  test("the assembly takes a context, an id and an OPTIONAL client", () => {
    assert.match(
      code(readSrc(REPOSITORY)),
      /export async function queryLeadDetail\(\s*context: CrmAccessContext,\s*leadId: string,\s*db\?: CrmDb\s*\)/
    );
  });

  test("the cookie path is unchanged: it still resolves its own caller", () => {
    const repo = code(readSrc(REPOSITORY));
    const wrapper = repo.slice(
      repo.indexOf("export async function getLeadDetailForCurrentUser(")
    );

    assert.match(wrapper, /await getCrmAccessContext\(\)/);
    assert.match(wrapper, /AUTH_REQUIRED/);

    /* It passes no client, so it keeps the cookie-scoped default. */
    assert.ok(
      !/queryLeadDetail\([^)]*,\s*db\s*\)/.test(wrapper),
      "the web wrapper must not inject a client"
    );
  });

  test("the whole canonical model is returned, not a mobile subset", () => {
    const assembly = sharedAssembly();

    for (const field of [
      "overview:",
      "contact:",
      "source:",
      "assignment:",
      "timeline,",
      "notes:",
      "followUps:",
      "consentSummary:",
      "statusSummary:",
      "slaClock:",
    ]) {
      assert.ok(
        assembly.includes(field),
        `the shared assembly must still return ${field}`
      );
    }
  });

  test("the mobile payload extends the canonical DTO rather than replacing it", () => {
    assert.match(
      code(readSrc(MOBILE_DTOS)),
      /export interface CrmMobileLeadDetail extends CrmLeadDetail \{/
    );
    assert.match(
      code(readSrc(MOBILE_DTOS)),
      /\.\.\.detail,/
    );
  });
});

/* ========================================================================== */
/* 4. The unified timeline stays canonical                                     */
/* ========================================================================== */

describe("the timeline comes from the one assembler", () => {
  test("the assembly delegates to the canonical timeline reader", () => {
    assert.match(
      sharedAssembly(),
      /fetchLeadTimelinePage\(leadId, context, labelForUser, db\)/
    );
  });

  test("the timeline reader accepts the caller's client without privilege", () => {
    const queries = code(readSrc(TIMELINE_QUERIES));

    assert.match(
      queries,
      /labelForUser: ActorLabelResolver,\s*db\?: CrmDb/
    );
    assert.match(queries, /const supabase = await resolveCrmDb\(db\);/);
    assert.ok(
      !queries.includes("await createClient()"),
      "the timeline reader must not bypass the client resolver"
    );
  });

  test("no second timeline or event store was introduced", () => {
    for (const rel of [DETAIL_ROUTE, MOBILE_DTOS, HISTORY_CONTRACT]) {
      const src = readSrc(rel);

      for (const forbidden of [
        "lead_events",
        "lead_activities",
        "timeline_entries",
        "conversation_events",
        "conversation_logs",
        "sortTimelineEntries",
        "compareTimelineEntries",
      ]) {
        assert.ok(
          !src.includes(forbidden),
          `${rel} must not introduce or re-derive ${forbidden}`
        );
      }
    }
  });

  test("the mobile payload carries the timeline's truncation truth", () => {
    /*
     * `CrmLeadTimelinePage` already states `truncated`, `entryCount` and
     * `limit`. The mobile DTO spreads the canonical detail, so it cannot drop
     * them and claim a bounded timeline is complete.
     */
    const contracts = readSrc(
      "src/features/crm/contracts/lead-timeline-contracts.ts"
    );

    assert.match(contracts, /readonly truncated: boolean;/);
    assert.match(contracts, /readonly entryCount: number;/);
    assert.match(contracts, /readonly limit: number;/);
  });
});

/* ========================================================================== */
/* 5. PR #136 regression — the conversation log is history, not a plan         */
/* ========================================================================== */

describe("the conversation log is composed server-side by the shared helpers", () => {
  test("the composer uses the canonical helpers, not its own rules", () => {
    const contract = code(readSrc(HISTORY_CONTRACT));
    const composer = contract.slice(
      contract.indexOf("export function buildConversationActivityHistory(")
    );

    for (const helper of [
      "sortActivityHistory(",
      "formatConversationActivityType(",
      "formatConversationStatus(",
      "formatConversationOutcome(",
      "resolveActivityOccurredAt(",
      "resolveActivityActorLabel(",
      "isClientFacingActivityType(",
      "conversationNoteHeadingForActivityType(",
    ]) {
      assert.ok(
        composer.includes(helper),
        `the composer must use ${helper}`
      );
    }

    /* And it re-derives none of them. */
    for (const forbidden of ["Date.parse", ".sort(", "localeCompare"]) {
      assert.ok(
        !composer.includes(forbidden),
        `the composer must not re-implement ${forbidden}`
      );
    }
  });

  test("history is ordered by ACTUAL occurrence, never by dueAt", () => {
    /* Completed later, but scheduled EARLIER — occurrence must win. */
    const scheduledFirst = followUp({
      id: "aaaa1111-1111-4111-8111-111111111111",
      dueAt: "2026-09-01T04:00:00.000Z",
      completedAt: "2026-09-06T10:00:00.000Z",
      updatedAt: "2026-09-06T10:00:00.000Z",
    });
    const scheduledSecond = followUp({
      id: "bbbb2222-2222-4222-8222-222222222222",
      dueAt: "2026-09-02T04:00:00.000Z",
      completedAt: "2026-09-03T10:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    });

    const history = buildConversationActivityHistory([
      scheduledSecond,
      scheduledFirst,
    ]);

    assert.deepEqual(
      history.map((entry) => entry.id),
      [scheduledFirst.id, scheduledSecond.id]
    );

    /* The dueAt order would have been the exact opposite. */
    assert.notDeepEqual(
      history.map((entry) => entry.id),
      [scheduledSecond.id, scheduledFirst.id]
    );
  });

  test("the occurrence instant is the completion time, not the due time", () => {
    const [entry] = buildConversationActivityHistory([followUp()]);

    assert.equal(entry.occurredAt, "2026-09-05T05:15:00.000Z");
    assert.notEqual(entry.occurredAt, "2026-09-01T04:30:00.000Z");
  });

  test("a cancelled activity is dated and attributed by its cancellation", () => {
    const [entry] = buildConversationActivityHistory([
      followUp({
        status: "cancelled",
        completedAt: null,
        completedByLabel: null,
        cancelledAt: "2026-09-04T09:00:00.000Z",
        cancelledByLabel: "Sales Executive B",
      }),
    ]);

    assert.equal(entry.occurredAt, "2026-09-04T09:00:00.000Z");
    assert.equal(entry.actorLabel, "Sales Executive B");
    assert.equal(entry.statusLabel, "Cancelled");
  });

  test("the actor is the person who acted, never the scheduled owner", () => {
    const [entry] = buildConversationActivityHistory([followUp()]);

    assert.equal(entry.actorLabel, "Sales Executive A");
    assert.notEqual(entry.actorLabel, OWNER_LABEL);

    /* An unknown actor is omitted rather than filled in with the owner. */
    const [legacy] = buildConversationActivityHistory([
      followUp({ completedByLabel: null }),
    ]);

    assert.equal(legacy.actorLabel, null);
    assert.notEqual(legacy.actorLabel, OWNER_LABEL);
  });

  test("the outcome is human text, never a raw code", () => {
    const [display] = buildConversationActivityHistory([followUp()]);
    assert.equal(display.outcome, "Connected");

    const [coded] = buildConversationActivityHistory([
      followUp({ outcome: null, outcomeCode: "no_answer" }),
    ]);
    assert.equal(coded.outcome, "No Answer");
    assert.doesNotMatch(coded.outcome ?? "", /_/);

    const [none] = buildConversationActivityHistory([
      followUp({ outcome: null, outcomeCode: null }),
    ]);
    assert.equal(none.outcome, null);
  });

  test("the activity type is labelled, never a raw code", () => {
    const [entry] = buildConversationActivityHistory([
      followUp({ activityType: "site_visit" }),
    ]);

    assert.equal(entry.activityTypeLabel, "Site visit");
    /* The raw code is still carried, for branching only. */
    assert.equal(entry.activityType, "site_visit");
  });

  test("client-facing types label the note as the client's response", () => {
    for (const activityType of CRM_CLIENT_FACING_ACTIVITY_TYPES) {
      const [entry] = buildConversationActivityHistory([
        followUp({ activityType }),
      ]);

      assert.equal(entry.isClientFacing, true);
      assert.equal(entry.noteHeading, "Client response");
    }
  });

  test("internal_task keeps generic completion-note wording", () => {
    const [entry] = buildConversationActivityHistory([
      followUp({ activityType: "internal_task" }),
    ]);

    assert.equal(entry.isClientFacing, false);
    assert.equal(entry.noteHeading, "Completion note");
  });

  test("the note stays optional and is carried verbatim", () => {
    const [withNote] = buildConversationActivityHistory([followUp()]);
    assert.equal(
      withNote.completionNote,
      "Client wants a revised quote by Friday."
    );

    const [without] = buildConversationActivityHistory([
      followUp({ completionNote: null }),
    ]);
    assert.equal(without.completionNote, null);
  });

  test("open activities are a plan and stay out of the history", () => {
    const history = buildConversationActivityHistory([
      followUp({
        id: "cccc3333-3333-4333-8333-333333333333",
        status: "open",
        outcome: null,
        completedAt: null,
        completedByLabel: null,
      }),
      followUp(),
    ]);

    assert.equal(history.length, 1);
    assert.equal(history[0].id, "11111111-1111-4111-8111-111111111111");
  });

  test("the web log card and the mobile log share one wording authority", () => {
    const ui = readSrc(
      "src/features/crm/components/activities/OpenActivityRow.tsx"
    );

    assert.match(ui, /conversationNoteHeadingForActivityType\(/);
    assert.equal(
      conversationNoteHeadingForActivityType("call"),
      "Client response"
    );
    assert.equal(
      conversationNoteHeadingForActivityType("internal_task"),
      "Completion note"
    );
  });
});

/* ========================================================================== */
/* 6. The payload leaves Android nothing to derive                             */
/* ========================================================================== */

describe("the phone formats dates and nothing else", () => {
  const detail = {
    id: "dddd4444-4444-4444-8444-444444444444",
    capturedAt: "2026-09-06T00:00:00.000Z",
    overview: {} as CrmLeadDetail["overview"],
    contact: {} as CrmLeadDetail["contact"],
    source: {} as CrmLeadDetail["source"],
    assignment: {} as CrmLeadDetail["assignment"],
    timeline: { entries: [], truncated: false, entryCount: 0, limit: 120 },
    notes: [],
    followUps: [
      followUp({ id: "eeee5555-5555-4555-8555-555555555555", status: "open" }),
      followUp(),
    ],
    consentSummary: [],
    statusSummary: {} as CrmLeadDetail["statusSummary"],
    slaClock: { slaDueAt: null, firstContactAttemptAt: null, breachedAt: null },
  } satisfies CrmLeadDetail;

  test("the mobile payload adds the ordered log beside the untouched plan", () => {
    const payload = toMobileLeadDetail(detail);

    /* The raw follow-ups are carried through unchanged — still the plan. */
    assert.deepEqual(payload.followUps, detail.followUps);

    /* And the interpreted history is finished activities only. */
    assert.equal(payload.conversationHistory.length, 1);
    assert.equal(
      payload.conversationHistory[0].id,
      "11111111-1111-4111-8111-111111111111"
    );
  });

  test("every canonical field survives the wrapper", () => {
    const payload = toMobileLeadDetail(detail);

    for (const key of Object.keys(detail) as (keyof CrmLeadDetail)[]) {
      assert.ok(key in payload, `the wrapper dropped ${String(key)}`);
    }
  });

  test("each history entry arrives fully interpreted", () => {
    const [entry] = toMobileLeadDetail(detail).conversationHistory;

    for (const [field, value] of Object.entries({
      activityTypeLabel: entry.activityTypeLabel,
      statusLabel: entry.statusLabel,
      outcome: entry.outcome,
      occurredAt: entry.occurredAt,
      actorLabel: entry.actorLabel,
      noteHeading: entry.noteHeading,
    })) {
      assert.ok(value, `${field} must be resolved server-side`);
    }
  });
});

/* ========================================================================== */
/* 7. The adjacent mobile endpoints are untouched                              */
/* ========================================================================== */

describe("CRM-M1 and the intelligence read are unchanged", () => {
  test("Smart Leads still runs the cohort read", () => {
    const route = readSrc(LEADS_ROUTE);

    assert.match(route, /parseLeadListQuery/);
    assert.match(route, /queryLeadListPage\(auth\.context, query, auth\.db\)/);
  });

  test("the pipeline endpoint is untouched", () => {
    const route = readSrc(PIPELINE_ROUTE);

    assert.match(route, /resolveCrmMobileAuth/);
    assert.ok(
      !route.includes("queryLeadDetail"),
      "the pipeline route must not reach the detail assembly"
    );
  });

  test("the per-lead intelligence read still answers separately", () => {
    const route = readSrc(INTELLIGENCE_ROUTE);

    assert.match(route, /queryLeadIntelligence/);
    assert.ok(
      !route.includes("queryLeadDetail"),
      "the two per-lead reads stay separate endpoints"
    );

    /* And the detail route does not absorb the intelligence derivation. */
    const detail = code(readSrc(DETAIL_ROUTE));
    for (const forbidden of [
      "queryLeadIntelligence",
      "deriveLeadScore",
      "resolveEffectiveSalesBucket",
      "enrichLeadRow",
      "fetchLeadScoreBatch",
    ]) {
      assert.ok(
        !detail.includes(forbidden),
        `the detail route must not perform ${forbidden}`
      );
    }
  });

  test("the detail endpoint sits under the lead it describes", () => {
    /* A cold deep link needs a lead id and a bearer token. Nothing else. */
    const route = code(readSrc(DETAIL_ROUTE));

    assert.match(route, /await params/);

    for (const forbidden of [
      "searchParams",
      "month",
      "bucket",
      "pageSize",
      "assigneeId",
      "followUpDue",
    ]) {
      assert.ok(
        !route.includes(forbidden),
        `the route must not require ${forbidden}`
      );
    }
  });
});
