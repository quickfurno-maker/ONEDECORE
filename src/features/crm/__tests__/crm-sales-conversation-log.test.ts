/**
 * CRM — sales conversation & activity log.
 *
 * The owner wants a lead to carry a trustworthy chronological record: who spoke
 * to the client, when it actually happened, what the outcome was, and what the
 * client said. All of that was already persisted by the governed activity RPCs;
 * this slice makes it legible.
 *
 * These tests therefore guard TWO things:
 *   1. the read interpretation is correct (pure comparator/formatter/label)
 *   2. it stayed a read interpretation — no second store, no schema change,
 *      no privilege change, and no disturbance to the merged mobile contract.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_CLIENT_CONVERSATION_NOTE_HELP,
  CRM_CLIENT_FACING_ACTIVITY_TYPES,
  compareActivityHistoryEntries,
  completionNoteLabelForActivityType,
  formatConversationActivityType,
  formatConversationOutcome,
  formatConversationStatus,
  humanizeCrmUnderscoreCode,
  isClientFacingActivityType,
  resolveActivityActorLabel,
  resolveActivityOccurredAt,
  sortActivityHistory,
} from "../contracts/lead-activity-history.ts";
import {
  CRM_TIMELINE_ACTIVITY_DETAIL_MAX,
  formatTimelineActivityDetail,
} from "../contracts/lead-timeline-contracts.ts";
import {
  CRM_SELF_STAFF_LABEL,
  CRM_UNKNOWN_STAFF_LABEL,
  resolveCrmStaffLabel,
} from "../contracts/crm-staff-label.ts";
import { parseCompleteLeadActivityForm } from "../contracts/activity-contracts.ts";
import type { CrmLeadDetailFollowUp } from "../contracts/lead-detail-dtos.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const HISTORY_CONTRACT = "src/features/crm/contracts/lead-activity-history.ts";
const HISTORY_UI = "src/features/crm/components/activities/OpenActivityRow.tsx";
const COMPLETE_DIALOG =
  "src/features/crm/components/activities/CompleteActivityDialog.tsx";
const REPOSITORY = "src/features/crm/server/crm-lead-repository.ts";
const TIMELINE_CONTRACT = "src/features/crm/contracts/lead-timeline-contracts.ts";
const TIMELINE_QUERIES = "src/features/crm/server/crm-lead-timeline-queries.ts";
const DETAIL_DTOS = "src/features/crm/contracts/lead-detail-dtos.ts";
const STAFF_LABEL = "src/features/crm/contracts/crm-staff-label.ts";

const OWNER_LABEL = "Scheduled Owner";
const ACTOR_LABEL = "Sales Executive A";

function followUp(
  overrides: Partial<CrmLeadDetailFollowUp> = {}
): CrmLeadDetailFollowUp {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerLabel: OWNER_LABEL,
    dueAt: "2026-09-01T04:00:00.000Z",
    status: "completed",
    outcome: "Connected",
    completedAt: "2026-09-05T05:15:00.000Z",
    cancelledAt: null,
    completedByLabel: ACTOR_LABEL,
    cancelledByLabel: null,
    activityType: "call",
    title: "Follow-up call",
    priority: "normal",
    isPrimaryNextAction: false,
    durationMinutes: 15,
    reminderAt: null,
    outcomeCode: "connected",
    completionNote: "Will discuss with family. Call Friday.",
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
/* 1. The completed record renders the business facts                          */
/* ========================================================================== */

describe("the conversation log shows what actually happened", () => {
  test("the card renders type, title, status, outcome, time, actor and note", () => {
    const ui = readSrc(HISTORY_UI);

    // (1) type  (2) title  (3) status  (4) outcome
    assert.match(ui, /formatConversationActivityType\(activity\.activityType\)/);
    assert.match(ui, /\{activity\.title\}/);
    assert.match(ui, /formatConversationStatus\(activity\.status\)/);
    assert.match(ui, /formatConversationOutcome\(activity\)/);

    // (5) ACTUAL occurrence time  (6) ACTUAL actor  (7) the note
    assert.match(ui, /resolveActivityOccurredAt\(activity\)/);
    assert.match(ui, /resolveActivityActorLabel\(activity\)/);
    assert.match(ui, /\{activity\.completionNote\}/);
  });

  test("it is titled as a business log, not a status bucket", () => {
    const ui = readSrc(HISTORY_UI);
    assert.match(ui, /Conversation &amp; activity log/);
    assert.doesNotMatch(ui, /Completed & cancelled/);
  });

  test("a completed call reads as a sales record", () => {
    const activity = followUp();

    assert.equal(formatConversationActivityType(activity.activityType), "Call");
    assert.equal(activity.title, "Follow-up call");
    assert.equal(formatConversationStatus(activity.status), "Completed");
    assert.equal(formatConversationOutcome(activity), "Connected");
    assert.equal(resolveActivityOccurredAt(activity), "2026-09-05T05:15:00.000Z");
    assert.equal(resolveActivityActorLabel(activity), ACTOR_LABEL);
  });

  test("a cancelled activity reports the cancellation time and actor", () => {
    const activity = followUp({
      status: "cancelled",
      completedAt: null,
      completedByLabel: null,
      cancelledAt: "2026-09-04T09:00:00.000Z",
      cancelledByLabel: "Sales Executive B",
      outcome: null,
      outcomeCode: null,
    });

    assert.equal(resolveActivityOccurredAt(activity), "2026-09-04T09:00:00.000Z");
    assert.equal(resolveActivityActorLabel(activity), "Sales Executive B");
    assert.equal(formatConversationStatus(activity.status), "Cancelled");
  });
});

/* ========================================================================== */
/* 2. Actor accuracy — the scheduled owner is not the person who acted         */
/* ========================================================================== */

describe("the actor is the person who acted", () => {
  test("the DTO carries explicit completion and cancellation actors", () => {
    const dtos = readSrc(DETAIL_DTOS);
    assert.match(dtos, /readonly completedByLabel: string \| null;/);
    assert.match(dtos, /readonly cancelledByLabel: string \| null;/);
  });

  test("the repository selects and resolves both actor columns", () => {
    const repo = readSrc(REPOSITORY);
    assert.match(repo, /completed_by/);
    assert.match(repo, /cancelled_by/);
    assert.match(repo, /completedByLabel: labelForUser\(followUp\.completed_by\)/);
    assert.match(repo, /cancelledByLabel: labelForUser\(followUp\.cancelled_by\)/);
  });

  test("ownerLabel is never used as completion evidence", () => {
    // The resolver has no access to ownerLabel at all: a transferred activity
    // has an owner who never made the call.
    const activity = followUp({ completedByLabel: null });
    assert.equal(resolveActivityActorLabel(activity), null);
    assert.notEqual(resolveActivityActorLabel(followUp()), OWNER_LABEL);

    // And the log card does not reach for it either.
    const ui = readSrc(HISTORY_UI);
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));
    assert.doesNotMatch(historyBlock, /ownerLabel/);
  });

  test("a missing actor fails soft instead of inventing one", () => {
    for (const label of [null, "", "   "]) {
      const activity = followUp({ completedByLabel: label });
      assert.equal(resolveActivityActorLabel(activity), null);
    }
  });

  test("an unresolvable actor never renders as a raw UUID", () => {
    const repo = readSrc(REPOSITORY);
    // labelForUser delegates to the shared resolver, which maps an unknown id
    // to a safe label and an absent id to null; it can never return the id.
    assert.match(
      repo,
      /resolveCrmStaffLabel\(userId, context\.userId, assigneeLabels\)/
    );

    const rawUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const activity = followUp({ completedByLabel: "Staff member" });
    assert.equal(resolveActivityActorLabel(activity), "Staff member");
    assert.notEqual(resolveActivityActorLabel(activity), rawUuid);
  });
});

/* ========================================================================== */
/* 2b. Actor labels resolve for scoped callers, not just broad readers         */
/* ========================================================================== */

describe("the caller can always be named", () => {
  const SELF = "5e1f0000-0000-4000-8000-000000000001";
  const OTHER = "0abe0000-0000-4000-8000-000000000002";
  const TEAMMATE = "7ea70000-0000-4000-8000-000000000003";

  /**
   * An assignment-scoped executive gets NO directory rows: the underlying RPC
   * only answers broad readers. This is the exact condition that made a
   * salesperson's own completed call read "· Staff member".
   */
  const SCOPED_DIRECTORY: Readonly<Record<string, string>> = {};

  const BROAD_DIRECTORY: Readonly<Record<string, string>> = {
    [TEAMMATE]: "Sales Executive A",
    [SELF]: "Owner Account",
  };

  test("the caller resolves to \"You\" with an EMPTY directory", () => {
    assert.equal(
      resolveCrmStaffLabel(SELF, SELF, SCOPED_DIRECTORY),
      CRM_SELF_STAFF_LABEL
    );
    assert.equal(resolveCrmStaffLabel(SELF, SELF, SCOPED_DIRECTORY), "You");
  });

  test("a broad reader's teammate still resolves to the directory name", () => {
    assert.equal(
      resolveCrmStaffLabel(TEAMMATE, SELF, BROAD_DIRECTORY),
      "Sales Executive A"
    );
  });

  test("self wins over the directory, so own history reads as \"You\"", () => {
    // SELF is present in the broad directory as "Owner Account", but a person
    // reading their own activity expects "You".
    assert.equal(
      resolveCrmStaffLabel(SELF, SELF, BROAD_DIRECTORY),
      CRM_SELF_STAFF_LABEL
    );
  });

  test("an unnameable other staff member stays anonymous", () => {
    assert.equal(
      resolveCrmStaffLabel(OTHER, SELF, SCOPED_DIRECTORY),
      CRM_UNKNOWN_STAFF_LABEL
    );
    assert.equal(
      resolveCrmStaffLabel(OTHER, SELF, BROAD_DIRECTORY),
      "Staff member"
    );
  });

  test("an absent actor stays null, distinct from anonymous", () => {
    for (const missing of [null, undefined, ""]) {
      assert.equal(resolveCrmStaffLabel(missing, SELF, BROAD_DIRECTORY), null);
    }
  });

  test("no branch can ever return the raw id", () => {
    for (const currentUserId of [SELF, null, undefined]) {
      for (const directory of [SCOPED_DIRECTORY, BROAD_DIRECTORY]) {
        for (const candidate of [SELF, OTHER, TEAMMATE]) {
          const label = resolveCrmStaffLabel(
            candidate,
            currentUserId,
            directory
          );
          assert.notEqual(label, candidate);
          if (label !== null) {
            assert.doesNotMatch(
              label,
              /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,
              `leaked a uuid-shaped label: ${label}`
            );
          }
        }
      }
    }
  });

  test("resolution needs no extra query and no wider permission", () => {
    const repo = readSrc(REPOSITORY);
    // The caller id comes from the access context that was already resolved.
    assert.match(repo, /resolveCrmStaffLabel\(userId, context\.userId/);

    // The directory is still fetched exactly once, still scope-gated by the
    // existing RPC. Nothing new is read to name the caller.
    assert.equal(
      repo.split("fetchCrmAssigneeDirectory(context)").length - 1,
      1,
      "the assignee directory must still be fetched exactly once"
    );
    const resolverModule = readSrc(STAFF_LABEL);
    assert.ok(!resolverModule.includes("supabase"), "the resolver must be pure");
    assert.ok(!resolverModule.includes("await"), "the resolver must be pure");
  });

  test("the unified timeline shares the corrected resolver", () => {
    const repo = readSrc(REPOSITORY);
    // One resolver instance is handed to the timeline, so the log and the
    // timeline can never disagree about who someone is.
    assert.match(
      repo,
      /fetchLeadTimelinePage\(leadId, context, labelForUser\)/
    );

    const timeline = readSrc(TIMELINE_QUERIES);
    assert.match(timeline, /labelForUser\(row\.actor_id\)/);
    // The timeline never builds its own label from an id.
    assert.doesNotMatch(timeline, /actorLabel: row\.actor_id/);
  });
});

/* ========================================================================== */
/* 3. Ordering — newest ACTUAL interaction first                               */
/* ========================================================================== */

describe("history is ordered by what happened, not by what was planned", () => {
  test("newest actual occurrence sorts first, independent of dueAt", () => {
    // The older conversation is the one scheduled LATEST, so a dueAt-driven
    // order would invert these two.
    const older = followUp({
      id: "aaaa1111-1111-4111-8111-111111111111",
      dueAt: "2026-12-31T00:00:00.000Z",
      completedAt: "2026-09-01T05:00:00.000Z",
    });
    const newer = followUp({
      id: "bbbb2222-2222-4222-8222-222222222222",
      dueAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-09-05T05:00:00.000Z",
    });

    const ordered = sortActivityHistory([older, newer]);
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      [newer.id, older.id]
    );
  });

  test("a cancelled row is placed by its cancellation time", () => {
    const completedEarlier = followUp({
      id: "aaaa1111-1111-4111-8111-111111111111",
      completedAt: "2026-09-01T05:00:00.000Z",
    });
    const cancelledLater = followUp({
      id: "bbbb2222-2222-4222-8222-222222222222",
      status: "cancelled",
      completedAt: null,
      completedByLabel: null,
      cancelledAt: "2026-09-09T05:00:00.000Z",
      cancelledByLabel: "Sales Executive B",
    });

    assert.deepEqual(
      sortActivityHistory([completedEarlier, cancelledLater]).map((e) => e.id),
      [cancelledLater.id, completedEarlier.id]
    );
  });

  test("ties break stably on id, never returning 0 for distinct rows", () => {
    const sameInstant = "2026-09-05T05:15:00.000Z";
    const first = followUp({
      id: "aaaa1111-1111-4111-8111-111111111111",
      completedAt: sameInstant,
    });
    const second = followUp({
      id: "bbbb2222-2222-4222-8222-222222222222",
      completedAt: sameInstant,
    });

    assert.ok(compareActivityHistoryEntries(first, second) < 0);
    assert.ok(compareActivityHistoryEntries(second, first) > 0);
    assert.notEqual(compareActivityHistoryEntries(first, second), 0);

    // Stable regardless of input order.
    for (const input of [
      [first, second],
      [second, first],
    ]) {
      assert.deepEqual(
        sortActivityHistory(input).map((entry) => entry.id),
        [first.id, second.id]
      );
    }
  });

  test("legacy rows without stamped times fall back, never to dueAt", () => {
    const legacy = followUp({
      completedAt: null,
      updatedAt: "2026-09-03T05:00:00.000Z",
    });
    assert.equal(resolveActivityOccurredAt(legacy), "2026-09-03T05:00:00.000Z");

    const ancient = followUp({
      completedAt: null,
      updatedAt: null as unknown as string,
      createdAt: "2026-08-30T04:00:00.000Z",
    });
    assert.equal(resolveActivityOccurredAt(ancient), "2026-08-30T04:00:00.000Z");

    // dueAt is never an occurrence source.
    const contract = readSrc(HISTORY_CONTRACT);
    const resolver = contract.slice(
      contract.indexOf("export function resolveActivityOccurredAt"),
      contract.indexOf("export function resolveActivityActorLabel")
    );
    assert.doesNotMatch(resolver, /dueAt/);
  });

  test("an unparseable timestamp sorts last instead of throwing", () => {
    const good = followUp({ id: "aaaa1111-1111-4111-8111-111111111111" });
    const broken = followUp({
      id: "bbbb2222-2222-4222-8222-222222222222",
      completedAt: "not-a-date",
      updatedAt: "not-a-date",
      createdAt: "not-a-date",
    });

    assert.deepEqual(
      sortActivityHistory([broken, good]).map((entry) => entry.id),
      [good.id, broken.id]
    );
  });

  test("the log sorts its own rows rather than trusting the query order", () => {
    // The repository reads follow-ups `due_at asc` for the OPEN queue; the
    // history must not inherit it.
    const ui = readSrc(HISTORY_UI);
    assert.match(ui, /sortActivityHistory\(activities\)/);
    assert.match(readSrc(REPOSITORY), /\.order\("due_at", \{ ascending: true \}\)/);
  });
});

/* ========================================================================== */
/* 4. No raw codes reach the UI                                                */
/* ========================================================================== */

describe("codes are humanized, never shown raw", () => {
  test("underscore codes become readable words", () => {
    assert.equal(humanizeCrmUnderscoreCode("no_answer"), "No Answer");
    assert.equal(formatConversationActivityType("site_visit"), "Site visit");
    assert.equal(
      formatConversationActivityType("quotation_follow_up"),
      "Quotation follow-up"
    );
    assert.equal(formatConversationActivityType("whatsapp"), "WhatsApp");
  });

  test("an unknown activity type still renders readably", () => {
    assert.equal(formatConversationActivityType("video_call"), "Video Call");
    assert.doesNotMatch(formatConversationActivityType("video_call"), /_/);
  });

  test("the outcome prefers stored display text over the machine code", () => {
    assert.equal(
      formatConversationOutcome({ outcome: "Connected", outcomeCode: "no_answer" }),
      "Connected"
    );
    // Falls back to the code ONLY humanized.
    assert.equal(
      formatConversationOutcome({ outcome: null, outcomeCode: "no_answer" }),
      "No Answer"
    );
    assert.equal(
      formatConversationOutcome({ outcome: null, outcomeCode: null }),
      null
    );
  });

  test("the old raw snake_case rendering is gone", () => {
    const ui = readSrc(HISTORY_UI);
    assert.doesNotMatch(ui, /outcomeCode\.replace/);
  });

  test("humanizing tolerates junk without throwing", () => {
    assert.equal(humanizeCrmUnderscoreCode(null), null);
    assert.equal(humanizeCrmUnderscoreCode(""), null);
    assert.equal(humanizeCrmUnderscoreCode("___"), null);
  });
});

/* ========================================================================== */
/* 5. Completion note — wording changes, policy does not                       */
/* ========================================================================== */

describe("the completion note asks the right question", () => {
  test("client-facing types ask what the client said", () => {
    for (const type of CRM_CLIENT_FACING_ACTIVITY_TYPES) {
      assert.ok(isClientFacingActivityType(type), `${type} should be client-facing`);
      assert.match(
        completionNoteLabelForActivityType(type),
        /Client response \/ conversation note/
      );
    }
    assert.match(CRM_CLIENT_CONVERSATION_NOTE_HELP, /What did the client say\?/);
  });

  test("internal_task keeps generic completion-note language", () => {
    assert.equal(isClientFacingActivityType("internal_task"), false);
    assert.equal(
      completionNoteLabelForActivityType("internal_task"),
      "Completion note (optional)"
    );
  });

  test("the dialog uses the shared wording helper, not a hardcoded label", () => {
    const dialog = readSrc(COMPLETE_DIALOG);
    assert.match(
      dialog,
      /completionNoteLabelForActivityType\(activity\.activityType\)/
    );
    assert.match(dialog, /CRM_CLIENT_CONVERSATION_NOTE_HELP/);
    // Helper text is associated with the field for screen readers.
    assert.match(dialog, /aria-describedby=/);
  });

  test("the note remains OPTIONAL — no new requirement was introduced", () => {
    for (const label of [
      completionNoteLabelForActivityType("call"),
      completionNoteLabelForActivityType("internal_task"),
    ]) {
      assert.match(label, /\(optional\)/);
    }

    const dialog = readSrc(COMPLETE_DIALOG);
    const noteField = dialog.slice(
      dialog.indexOf('name="completionNote"'),
      dialog.indexOf('name="completionNote"') + 400
    );
    assert.doesNotMatch(noteField, /\brequired\b/);

    // The parser still accepts a completion with no note at all.
    const parsed = parseCompleteLeadActivityForm({
      activityId: "11111111-1111-4111-8111-111111111111",
      outcomeCode: "no_answer",
      resolution: "NONE",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.completionNote, null);
    }
  });

  test("the note bound is still 1000 characters", () => {
    const dialog = readSrc(COMPLETE_DIALOG);
    assert.match(dialog, /maxLength=\{1000\}/);

    const atLimit = parseCompleteLeadActivityForm({
      activityId: "11111111-1111-4111-8111-111111111111",
      outcomeCode: "no_answer",
      resolution: "NONE",
      completionNote: "x".repeat(1000),
    });
    assert.equal(atLimit.success, true);
    if (atLimit.success) {
      assert.equal(atLimit.input.completionNote?.length, 1000);
    }

    // And one character past it is still rejected by the same rule.
    const overLimit = parseCompleteLeadActivityForm({
      activityId: "11111111-1111-4111-8111-111111111111",
      outcomeCode: "no_answer",
      resolution: "NONE",
      completionNote: "x".repeat(1001),
    });
    assert.equal(overLimit.success, false);
  });
});

/* ========================================================================== */
/* 6. Unified timeline enrichment                                              */
/* ========================================================================== */

describe("the unified timeline uses metadata it already reads", () => {
  test("a completed follow-up shows its outcome and the client's words", () => {
    const detail = formatTimelineActivityDetail(
      "follow_up.completed",
      "Follow-up completed",
      {
        outcomeCode: "connected",
        outcomeDisplay: "Connected",
        note: "Will discuss with family. Call Friday.",
        wasPrimary: true,
        resolution: "NEXT_PRIMARY",
      }
    );

    assert.ok(detail);
    assert.match(detail!, /Connected/);
    assert.match(detail!, /Will discuss with family\. Call Friday\./);
  });

  test("the legacy { outcome } shape still resolves", () => {
    assert.equal(
      formatTimelineActivityDetail("follow_up.completed", "Follow-up completed", {
        outcome: "Connected",
      }),
      "Connected"
    );
  });

  test("a raw outcome code is humanized, never printed raw", () => {
    const detail = formatTimelineActivityDetail(
      "follow_up.completed",
      "Follow-up completed",
      { outcomeCode: "no_answer" }
    );
    assert.equal(detail, "No Answer");
    assert.doesNotMatch(detail!, /no_answer/);
  });

  test("the generic summary is dropped rather than repeated under the title", () => {
    // Title is already "Activity completed"; "Follow-up completed" adds nothing.
    assert.equal(
      formatTimelineActivityDetail("follow_up.completed", "Follow-up completed", {}),
      null
    );
    assert.equal(
      formatTimelineActivityDetail(
        "follow_up.cancelled",
        "Follow-up cancelled",
        { reason: "on_hold_review" }
      ),
      null
    );
  });

  test("non-activity entries keep their existing summary detail", () => {
    assert.equal(
      formatTimelineActivityDetail("note.created", "A note excerpt", null),
      "A note excerpt"
    );
  });

  test("malformed or missing metadata never throws", () => {
    for (const metadata of [
      null,
      undefined,
      "a string",
      42,
      [],
      { note: 12345 },
      { outcomeDisplay: { nested: true } },
      { unexpected: "field" },
    ]) {
      assert.doesNotThrow(() =>
        formatTimelineActivityDetail(
          "follow_up.completed",
          "Follow-up completed",
          metadata
        )
      );
    }

    // A non-string field is ignored rather than stringified into the UI.
    assert.equal(
      formatTimelineActivityDetail("follow_up.completed", null, { note: 12345 }),
      null
    );
  });

  test("the detail line is bounded and single-line", () => {
    const detail = formatTimelineActivityDetail(
      "follow_up.completed",
      "Follow-up completed",
      { outcomeDisplay: "Connected", note: "y".repeat(1000) }
    );
    assert.ok(detail);
    assert.ok(
      detail!.length <= CRM_TIMELINE_ACTIVITY_DETAIL_MAX,
      `detail was ${detail!.length} chars`
    );
    assert.doesNotMatch(detail!, /\n/);

    const multiline = formatTimelineActivityDetail(
      "follow_up.completed",
      null,
      { note: "line one\nline two" }
    );
    assert.doesNotMatch(multiline!, /\n/);
  });

  test("raw metadata JSON is never rendered", () => {
    const queries = readSrc(TIMELINE_QUERIES);
    assert.match(queries, /formatTimelineActivityDetail\(/);
    assert.doesNotMatch(queries, /JSON\.stringify\(row\.metadata\)/);
    assert.doesNotMatch(queries, /detail: row\.metadata/);
  });

  test("enrichment adds no second timeline entry", () => {
    const queries = readSrc(TIMELINE_QUERIES);
    const activityLoop = queries.slice(
      queries.indexOf("for (const row of activityRows)"),
      queries.indexOf("for (const row of noteRows)")
    );
    assert.equal(
      activityLoop.split("entries.push(").length - 1,
      1,
      "the activity loop must push exactly one entry per row"
    );
  });
});

/* ========================================================================== */
/* 7. Containment — it stayed a read interpretation                            */
/* ========================================================================== */

describe("no new persistence, privilege or schema", () => {
  const TOUCHED = [
    HISTORY_CONTRACT,
    STAFF_LABEL,
    HISTORY_UI,
    COMPLETE_DIALOG,
    REPOSITORY,
    TIMELINE_CONTRACT,
    TIMELINE_QUERIES,
    DETAIL_DTOS,
  ];

  test("no competing conversation store was introduced", () => {
    for (const rel of TOUCHED) {
      const src = readSrc(rel);
      for (const forbidden of [
        "conversation_logs",
        "call_logs",
        "sales_notes",
        "conversation_events",
      ]) {
        assert.ok(
          !src.includes(forbidden),
          `${rel} must not introduce ${forbidden}`
        );
      }
    }
  });

  test("the log reads the canonical activity row only", () => {
    // lead_follow_ups via the repository, lead_activities via the timeline.
    assert.match(readSrc(REPOSITORY), /\.from\("lead_follow_ups"\)/);
    assert.match(readSrc(TIMELINE_QUERIES), /\.from\("lead_activities"\)/);
  });

  test("no service-role or RLS bypass anywhere in the slice", () => {
    for (const rel of TOUCHED) {
      const src = readSrc(rel);
      for (const forbidden of [
        "service_role",
        "SERVICE_ROLE",
        "serviceRole",
        "createAdminClient",
        "sb_secret_",
      ]) {
        assert.ok(!src.includes(forbidden), `${rel} must not reference ${forbidden}`);
      }
    }
  });

  test("no migration was added for this slice", () => {
    // The whole point: the columns and metadata already existed.
    const migrations = readdirSync(join(root, "supabase", "migrations"));
    for (const name of migrations) {
      assert.doesNotMatch(
        name,
        /conversation_log|sales_conversation|call_log/,
        `unexpected migration ${name}`
      );
    }

    // And the columns this slice reads are pre-existing schema.
    const foundation = readSrc(
      "supabase/migrations/20260730184426_crm_identity_core_foundation.sql"
    );
    assert.match(foundation, /completed_by uuid references public\.profiles/);
    assert.match(foundation, /cancelled_by uuid references public\.profiles/);
  });

  test("the completion note column keeps its existing 1-1000 constraint", () => {
    const controlPlane = readSrc(
      "supabase/migrations/20260826120000_crm_activity_control_plane_foundation.sql"
    );
    assert.match(
      controlPlane,
      /completion_note is null or length\(trim\(completion_note\)\) between 1 and 1000/
    );
  });
});

/* ========================================================================== */
/* 8. Neighbouring authorities are untouched                                   */
/* ========================================================================== */

describe("adjacent CRM authorities are unchanged", () => {
  test("the merged mobile CRM read contract is untouched", () => {
    // PR #135: the endpoints still delegate to the canonical read models and
    // still carry no derivation of their own.
    const leads = readSrc("src/app/api/mobile/crm/leads/route.ts");
    const pipeline = readSrc("src/app/api/mobile/crm/pipeline/route.ts");

    assert.match(leads, /queryLeadListPage\(auth\.context, query, auth\.db\)/);
    assert.match(pipeline, /fetchCrmPipelineBoard\(/);

    for (const src of [leads, pipeline]) {
      assert.match(src, /resolveCrmMobileAuth\(request\)/);
      assert.match(src, /auth\.kind !== "granted"/);
      assert.ok(!src.includes("service_role"));
    }

    // The bearer client still uses the publishable key, never a secret.
    const bearer = readSrc("src/lib/supabase/bearer.ts");
    assert.match(bearer, /publishableKey/);
    assert.ok(!bearer.includes("createAdminClient"));
  });

  test("Closed Won stays quotation-acceptance exclusive", () => {
    const dialog = readSrc(COMPLETE_DIALOG);
    assert.match(dialog, /Closed Won is not offered for activity completion/);
    assert.ok(
      !dialog.includes("CLOSED_WON"),
      "activity completion must not offer a Closed Won resolution"
    );
  });

  test("completion resolution and next-primary behaviour are unchanged", () => {
    const dialog = readSrc(COMPLETE_DIALOG);
    // The resolution chooser and its options still come from the canonical
    // helper; this slice only changed note wording around them.
    assert.match(dialog, /getCompletionResolutionOptions\(/);
    assert.match(dialog, /getDefaultCompletionResolution\(/);
    assert.match(dialog, /name="resolutionChoice"/);
    assert.match(dialog, /showNextPrimaryFields/);
    assert.match(dialog, /name="nextDueAtLocal"/);
    assert.match(dialog, /completeLeadActivityAction/);
  });

  test("scheduled and completed remain separate concepts", () => {
    const ui = readSrc(HISTORY_UI);
    const openRow = ui.slice(0, ui.indexOf("export function ActivityHistoryList"));
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));

    // The open row is about the plan: due date and owner.
    assert.match(openRow, /activity\.dueAt/);
    assert.match(openRow, /activity\.ownerLabel/);

    // The log is about the record: it uses neither.
    assert.doesNotMatch(historyBlock, /activity\.dueAt/);
    assert.doesNotMatch(historyBlock, /ownerLabel/);
  });
});

/* ========================================================================== */
/* 9. Accessibility and layout safety                                          */
/* ========================================================================== */

describe("the log is readable on a phone", () => {
  test("it is a semantic heading and list", () => {
    const ui = readSrc(HISTORY_UI);
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));
    assert.match(historyBlock, /<h3/);
    assert.match(historyBlock, /<ul/);
    assert.match(historyBlock, /<li/);
  });

  test("long notes and titles wrap instead of overflowing", () => {
    const ui = readSrc(HISTORY_UI);
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));
    assert.match(historyBlock, /break-words/);
    // The salesperson's own line breaks survive.
    assert.match(historyBlock, /whitespace-pre-line/);
    // The header row wraps rather than forcing a horizontal scroll.
    assert.match(historyBlock, /flex-wrap/);
  });

  test("status is carried by text, not colour alone", () => {
    const ui = readSrc(HISTORY_UI);
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));
    assert.match(historyBlock, /formatConversationStatus\(activity\.status\)/);
  });

  test("it uses the existing CRM dark token system", () => {
    const ui = readSrc(HISTORY_UI);
    const historyBlock = ui.slice(ui.indexOf("export function ActivityHistoryList"));
    assert.match(historyBlock, /var\(--crm-/);
    // No hardcoded hex colours smuggled in.
    assert.doesNotMatch(historyBlock, /#[0-9a-fA-F]{6}/);
  });
});
