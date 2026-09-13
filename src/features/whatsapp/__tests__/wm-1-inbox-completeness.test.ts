/**
 * WM-1 (ADR-0034) — CRM-owned WhatsApp inbox completeness.
 *
 * The database half of WM-1 is proved by pgTAP
 * (supabase/tests/database/64_whatsapp_inbox_staff_state_attention_test.sql):
 * tombstone read policy, reassignment, no existence leak, staff-state RLS,
 * mark-read semantics and every attention formula against real rows.
 *
 * This suite proves the application half: the query contract, the DTO, the
 * browser-open read bridge, route independence, and that nothing here reaches
 * a provider or a service-role client.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildInboxListHref,
  buildInboxListQueryString,
  hasInboxListActiveFilters,
  INBOX_ATTENTION_DEFAULT,
  INBOX_RECENT_WINDOW_DAYS_DEFAULT,
  parseInboxAttentionFilter,
  parseInboxListQuery,
} from "../contracts/inbox-list-query.ts";
import {
  WHATSAPP_INBOX_ATTENTION_FILTERS,
  deriveWhatsappConversationAttention,
} from "../contracts/staff-conversation-state.ts";
import {
  INBOX_CONVERSATION_LIST_PUBLIC_KEYS,
  mapConversationRowToListItem,
  parseInboxConversationListPayload,
  type InboxConversationListRow,
} from "../contracts/conversation-dtos.ts";
import {
  buildInboxConversationHref,
  WHATSAPP_ADMIN_INBOX_BASE_PATH,
} from "../contracts/inbox-surface.ts";
import {
  canUseWhatsappConversation,
  canViewWhatsappConversation,
  type InboxAccessContext,
} from "../server/inbox-access-resolver.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function walk(dir: string, accept: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, accept));
    else if (accept(rel)) out.push(rel);
  }
  return out;
}

const MIGRATION = "supabase/migrations/20260913130000_whatsapp_inbox_staff_state_attention.sql";
const PGTAP = "supabase/tests/database/64_whatsapp_inbox_staff_state_attention_test.sql";
const ATTENTION = "src/features/whatsapp/components/inbox/InboxAttentionFilters.tsx";
const LINK_FILTERS = "src/features/whatsapp/components/inbox/InboxLinkFilters.tsx";
const PAGER = "src/features/whatsapp/components/inbox/InboxListPagination.tsx";
const SEARCH = "src/features/whatsapp/components/inbox/InboxSearchForm.tsx";
const LIST = "src/features/whatsapp/components/inbox/InboxConversationList.tsx";
const PANE = "src/features/whatsapp/components/inbox/InboxListPane.tsx";
const ACK = "src/features/whatsapp/components/inbox/InboxReadAcknowledger.tsx";
const ACTION = "src/features/whatsapp/server/whatsapp-read-state-actions.ts";
const QUERIES = "src/features/whatsapp/server/whatsapp-inbox-queries.ts";
const REPOSITORY = "src/features/whatsapp/server/whatsapp-inbox-repository.ts";
const AUTH = "src/features/whatsapp/server/whatsapp-auth.ts";
const LIST_ROUTE = "src/app/admin/whatsapp/inbox/page.tsx";
const CONV_ROUTE = "src/app/admin/whatsapp/inbox/[conversationId]/page.tsx";

const row = (over: Partial<InboxConversationListRow> = {}): InboxConversationListRow => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customer_e164: "+919111222333",
  display_name_snapshot: "Asha",
  lead_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  contact_id: null,
  link_state: "live",
  linked_lead_name: "Asha Rao",
  last_message_at: "2026-09-13T10:00:00.000Z",
  last_inbound_at: "2026-09-13T10:00:00.000Z",
  last_outbound_at: "2026-09-13T09:00:00.000Z",
  staff_last_read_message_at: null,
  preview_body_text: "Need a quote",
  unread: true,
  needs_reply: true,
  waiting_on_customer: false,
  follow_up_due: false,
  ...over,
});

/* ========================================================================== */
/* Query contract                                                             */
/* ========================================================================== */

describe("WM-1 attention query contract", () => {
  test("attention defaults to all_assigned", () => {
    assert.equal(INBOX_ATTENTION_DEFAULT, "all_assigned");
    assert.equal(parseInboxListQuery({}).attention, "all_assigned");
  });

  test("every locked attention filter parses to itself", () => {
    assert.deepEqual([...WHATSAPP_INBOX_ATTENTION_FILTERS], [
      "all_assigned",
      "unread",
      "needs_reply",
      "waiting_on_customer",
      "follow_up_due",
      "recently_active",
    ]);
    for (const filter of WHATSAPP_INBOX_ATTENTION_FILTERS) {
      assert.equal(parseInboxListQuery({ attention: filter }).attention, filter);
    }
  });

  test("an invalid or repeated attention value falls back instead of erroring", () => {
    for (const bad of ["", "UNREAD", "all", "sla_breach", "unread;drop", "__proto__"]) {
      assert.equal(parseInboxAttentionFilter(bad), "all_assigned", bad);
    }
    assert.equal(parseInboxListQuery({ attention: ["unread", "needs_reply"] }).attention, "all_assigned");
  });

  test("q, link, page and pageSize are preserved alongside attention", () => {
    const query = parseInboxListQuery({
      q: " rhea ",
      link: "linked",
      attention: "needs_reply",
      page: "3",
      pageSize: "10",
    });
    assert.deepEqual(query, {
      q: "rhea",
      linkFilter: "linked",
      attention: "needs_reply",
      page: 3,
      pageSize: 10,
    });
    const qs = buildInboxListQueryString(query);
    assert.equal(qs, "q=rhea&link=linked&attention=needs_reply&page=3&pageSize=10");
    assert.deepEqual(parseInboxListQuery(Object.fromEntries(new URLSearchParams(qs))), query);
  });

  test("the default attention stays out of the URL", () => {
    assert.equal(buildInboxListQueryString(parseInboxListQuery({ attention: "all_assigned" })), "");
  });

  test("a non-default attention counts as an active filter", () => {
    assert.equal(hasInboxListActiveFilters(parseInboxListQuery({})), false);
    assert.equal(hasInboxListActiveFilters(parseInboxListQuery({ attention: "unread" })), true);
  });

  test("changing attention, link or search resets to page 1", () => {
    const query = parseInboxListQuery({ q: "rhea", link: "linked", attention: "unread", page: "4" });
    const base = WHATSAPP_ADMIN_INBOX_BASE_PATH;
    assert.equal(
      buildInboxListHref(base, query, { attention: "needs_reply" }),
      `${base}?q=rhea&link=linked&attention=needs_reply`
    );
    assert.equal(
      buildInboxListHref(base, query, { linkFilter: "all" }),
      `${base}?q=rhea&attention=unread`
    );
    assert.equal(
      buildInboxListHref(base, query, { q: "asha" }),
      `${base}?q=asha&link=linked&attention=unread`
    );
  });

  test("choosing the filter already selected, or paging, keeps the position", () => {
    const query = parseInboxListQuery({ attention: "unread", page: "4" });
    const base = "/somewhere/else/inbox";
    assert.equal(buildInboxListHref(base, query, { attention: "unread" }), `${base}?attention=unread&page=4`);
    assert.equal(buildInboxListHref(base, query, { page: 5 }), `${base}?attention=unread&page=5`);
    assert.equal(buildInboxListHref(base, query), `${base}?attention=unread&page=4`);
  });

  test("the recent window ships as a 7-day parameter, not a SQL constant", () => {
    assert.equal(INBOX_RECENT_WINDOW_DAYS_DEFAULT, 7);
    assert.match(read(QUERIES), /p_recent_window_days: INBOX_RECENT_WINDOW_DAYS_DEFAULT/);
    assert.match(read(MIGRATION), /p_recent_window_days integer default 7/);
    assert.match(read(MIGRATION), /make_interval\(days => p_recent_window_days\)/);
  });
});

/* ========================================================================== */
/* DTO                                                                        */
/* ========================================================================== */

describe("WM-1 list DTO carries only truthful state", () => {
  test("attention flags map one-to-one", () => {
    const item = mapConversationRowToListItem(
      row({ unread: false, needs_reply: false, waiting_on_customer: true, follow_up_due: true })
    );
    assert.equal(item.unread, false);
    assert.equal(item.needsReply, false);
    assert.equal(item.waitingOnCustomer, true);
    assert.equal(item.followUpDue, true);
    assert.equal(item.lastOutboundAt, "2026-09-13T09:00:00.000Z");
    assert.equal(item.staffLastReadMessageAt, null);
  });

  test("only a real true is an attention signal", () => {
    const item = mapConversationRowToListItem(
      row({ unread: "true" as unknown as boolean, needs_reply: null as unknown as boolean })
    );
    assert.equal(item.unread, false);
    assert.equal(item.needsReply, false);
  });

  test("the item exposes exactly the allowlist — no staff ids, no counts", () => {
    const item = mapConversationRowToListItem(row());
    assert.deepEqual(Object.keys(item).sort(), [...INBOX_CONVERSATION_LIST_PUBLIC_KEYS].sort());
    for (const forbidden of ["linkedLeadAssignedTo", "assignedTo", "staffUserId", "unreadCount", "online", "typing", "sla"]) {
      assert.equal(forbidden in item, false, forbidden);
    }
  });

  test("link state is honest, and an unknown linked state reads as read-only history", () => {
    assert.equal(mapConversationRowToListItem(row({ lead_id: null, link_state: "unlinked" })).linkState, "unlinked");
    assert.equal(mapConversationRowToListItem(row({ link_state: "live" })).linkState, "live");
    assert.equal(mapConversationRowToListItem(row({ link_state: "tombstoned" })).linkState, "tombstoned");
    assert.equal(mapConversationRowToListItem(row({ link_state: "surprise" })).linkState, "tombstoned");
  });

  test("the preview comes from the read model and is bounded", () => {
    const item = mapConversationRowToListItem(row({ preview_body_text: "x".repeat(240) }));
    assert.ok((item.previewText ?? "").length <= 120);
  });

  test("the jsonb payload is shape-checked at one boundary", () => {
    const parsed = parseInboxConversationListPayload({ total_count: 3, page: 1, page_size: 25, items: [row()] });
    assert.equal(parsed.totalCount, 3);
    assert.equal(parsed.rows.length, 1);
    assert.deepEqual(parseInboxConversationListPayload({ total_count: 0, items: [] }).rows, []);
    for (const bad of [null, [], {}, { total_count: -1, items: [] }, { total_count: 1.5, items: [] }, { total_count: 1, items: [{}] }]) {
      assert.throws(() => parseInboxConversationListPayload(bad));
    }
  });

  test("the TypeScript mirror agrees with the SQL formulas at the boundaries", () => {
    const at = (h: number) => `2026-09-13T${String(h).padStart(2, "0")}:00:00.000Z`;
    // Equal inbound and outbound: waiting, not needs reply.
    assert.deepEqual(
      deriveWhatsappConversationAttention({ lastInboundAt: at(10), lastOutboundAt: at(10), staffLastReadMessageAt: null }),
      { unread: true, needsReply: false, waitingOnCustomer: true }
    );
    // Watermark equal to latest inbound: read.
    assert.equal(
      deriveWhatsappConversationAttention({ lastInboundAt: at(10), lastOutboundAt: null, staffLastReadMessageAt: at(10) }).unread,
      false
    );
    // No messages at all: no attention.
    assert.deepEqual(
      deriveWhatsappConversationAttention({ lastInboundAt: null, lastOutboundAt: null, staffLastReadMessageAt: null }),
      { unread: false, needsReply: false, waitingOnCustomer: false }
    );
    const sql = read(MIGRATION);
    assert.match(sql, /e\.last_inbound_message_at > e\.staff_last_read_message_at/);
    assert.match(sql, /e\.last_inbound_message_at > e\.last_outbound_at/);
    assert.match(sql, /e\.last_outbound_at >= e\.last_inbound_message_at/);
  });
});

/* ========================================================================== */
/* Premium inbox UI                                                           */
/* ========================================================================== */

describe("WM-1 inbox UI", () => {
  test("the attention strip offers exactly the six queues, labelled compactly", () => {
    const src = read(ATTENTION);
    const labels = [...src.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(labels, ["All", "Unread", "Needs reply", "Waiting", "Follow-up", "Recent"]);
    assert.match(src, /aria-current=\{query\.attention === tab\.id \? "page" : undefined\}/);
    assert.match(src, /buildInboxListHref\(basePath, query, \{ attention: tab\.id \}\)/);
  });

  test("the strip carries no fake counts", () => {
    const src = code(read(ATTENTION));
    assert.doesNotMatch(src, /count|total|\{\s*\d+\s*\}|badge/i);
  });

  test("the strip scrolls sideways on a phone instead of wrapping", () => {
    const css = read("src/features/whatsapp/components/whatsapp-workspace.css");
    assert.match(read(ATTENTION), /className="od-wa__tabs od-wa__tabs--scroll"/);
    assert.match(css, /\.od-wa__tabs--scroll \{[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/);
  });

  test("the unread dot appears only when unread is true, with readable text", () => {
    const list = code(read(LIST));
    assert.match(list, /\{item\.unread === true \? \(\s*<span className="od-wa__unread-dot">\s*<span className="sr-only">Unread<\/span>/);
    assert.doesNotMatch(list, /\{item\.unread\}|unreadCount|unread_count/);
  });

  test("one concise Needs reply cue, and no queue badges repeated on rows", () => {
    const list = code(read(LIST));
    assert.match(list, /\{item\.needsReply \? \(\s*<span className="od-wa__row-cue">Needs reply<\/span>/);
    assert.doesNotMatch(list, /item\.waitingOnCustomer|item\.followUpDue/);
  });

  test("a tombstoned history row says it is read only", () => {
    assert.match(read(LIST), /item\.linkState === "tombstoned"\s*\?\s*"Lead deleted · read only"/);
  });

  test("filters, pages and search preserve the rest of the query", () => {
    assert.match(read(LINK_FILTERS), /buildInboxListHref\(basePath, query, \{ linkFilter: tab\.id \}\)/);
    assert.match(read(PAGER), /buildInboxListHref\(basePath, query, \{ page: pagination\.page - 1 \}\)/);
    assert.match(read(PAGER), /buildInboxListHref\(basePath, query, \{ page: pagination\.page \+ 1 \}\)/);
    const search = read(SEARCH);
    assert.match(search, /<form action=\{basePath\} method="get"/);
    assert.match(search, /name="attention" value=\{query\.attention\}/);
    assert.match(search, /name="link" value=\{query\.linkFilter\}/);
  });

  test("conversation links and back navigation keep q, link, attention and page", () => {
    const query = parseInboxListQuery({ q: "asha", link: "linked", attention: "unread", page: "2" });
    const qs = buildInboxListQueryString(query);
    assert.equal(
      buildInboxConversationHref("/x/inbox", "c1", qs),
      "/x/inbox/c1?q=asha&link=linked&attention=unread&page=2"
    );
    assert.equal(buildInboxConversationHref("/x/inbox", "c1"), "/x/inbox/c1");
    assert.match(read(LIST), /buildInboxConversationHref\(basePath, item\.id, listQueryString\)/);
    assert.match(read(CONV_ROUTE), /const backHref = buildInboxListHref\(WHATSAPP_ADMIN_INBOX_BASE_PATH, listQuery\);/);
  });
});

/* ========================================================================== */
/* Read acknowledgement happens on real browser open only                     */
/* ========================================================================== */

describe("WM-1 read state advances only when the thread actually opens", () => {
  test("the conversation route mounts the client bridge; the list route does not", () => {
    const conv = read(CONV_ROUTE);
    assert.match(conv, /<InboxReadAcknowledger\s+conversationId=\{conversationId\}\s+lastMessageAt=\{detail\.lastMessageAt\}/);
    assert.doesNotMatch(code(read(LIST_ROUTE)), /InboxReadAcknowledger|acknowledge|mark_whatsapp_conversation_read/);
  });

  test("no Server Component render marks read", () => {
    for (const rel of [LIST_ROUTE, CONV_ROUTE]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /mark_whatsapp_conversation_read|markConversationReadForCurrentUser|acknowledgeInboxConversationOpenedForCurrentUser|acknowledgeWhatsappConversationOpenedAction/, rel);
    }
    // And no other route or feature module calls the RPC except the query layer.
    const callers = walk(
      "src",
      (p) => /\.(ts|tsx)$/.test(p) && !p.includes("/__tests__/") && !p.startsWith("src/types/")
    ).filter((p) => code(read(p)).includes("mark_whatsapp_conversation_read"));
    assert.deepEqual(callers, [QUERIES]);
  });

  test("the bridge is a client effect that acknowledges after mount, visible tabs only", () => {
    const src = read(ACK);
    assert.match(src, /^"use client";/);
    assert.match(src, /useEffect\(\(\) => \{/);
    assert.match(src, /acknowledgeWhatsappConversationOpenedAction\(conversationId\)/);
    assert.match(src, /document\.visibilityState === "visible"/);
    assert.match(src, /\[conversationId, lastMessageAt, router\]/);
  });

  test("a failed acknowledgement does not fake a local read", () => {
    const src = code(read(ACK));
    assert.match(src, /if \(result\.ok\) \{\s*router\.refresh\(\);\s*\}/);
    assert.equal((src.match(/router\.refresh\(\)/g) ?? []).length, 1);
    assert.doesNotMatch(src, /useState|useOptimistic|setUnread|unread/i);
  });

  test("the action validates input, reports failure as failure, and is internal", () => {
    const src = read(ACTION);
    assert.match(src, /^"use server";/);
    assert.match(src, /import "server-only";/);
    assert.match(src, /UUID_PATTERN\.test\(conversationId\)/);
    assert.match(src, /catch \{[\s\S]*?return \{ ok: false \};/);
  });

  test("nothing in the read path calls Meta or touches provider status", () => {
    for (const rel of [ACK, ACTION, QUERIES, REPOSITORY]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /graph\.facebook|fetch\(|META_WHATSAPP|provider-adapter|dispatch/i, rel);
    }
    const sql = read(MIGRATION);
    const impl = sql.slice(
      sql.indexOf("create or replace function private.mark_whatsapp_conversation_read_impl"),
      sql.indexOf("create or replace function public.mark_whatsapp_conversation_read(")
    );
    assert.doesNotMatch(impl, /update public\.whatsapp_messages|whatsapp_message_status_events|latest_status|net\.http/i);
  });
});

/* ========================================================================== */
/* Route independence and no broad reads                                      */
/* ========================================================================== */

describe("WM-1 inbox domain is surface-independent", () => {
  const featureSources = walk("src/features/whatsapp", (p) => /\.(ts|tsx)$/.test(p) && !p.includes("/__tests__/"));

  test("feature code never imports from app routes", () => {
    for (const file of featureSources) {
      assert.doesNotMatch(read(file), /from ["'](@\/app\/|\.\.\/\.\.\/\.\.\/app\/)/, file);
    }
  });

  test("inbox components and the query layer do not hardcode the admin inbox path", () => {
    const inboxComponents = walk("src/features/whatsapp/components/inbox", (p) => p.endsWith(".tsx"));
    for (const file of [...inboxComponents, QUERIES, REPOSITORY]) {
      assert.doesNotMatch(code(read(file)), /\/admin\/whatsapp/, file);
    }
    assert.match(read(PANE), /readonly basePath: string;/);
    assert.equal(WHATSAPP_ADMIN_INBOX_BASE_PATH, "/admin/whatsapp/inbox");
  });

  test("the route guard takes its login destination from the surface", () => {
    const auth = read(AUTH);
    assert.match(auth, /export type WhatsappInboxRouteGuard = \{/);
    assert.match(auth, /redirect\(guard\.loginHref\(guard\.currentPath\)\)/);
    assert.match(auth, /export async function resolveWhatsappInboxAccess\(\): Promise<WhatsappInboxAccessResolution>/);
    // The admin wrapper keeps the admin-only return path check.
    assert.match(auth, /getSafeAdminRedirect\(currentPath\)/);
  });

  test("user-facing reads use the caller's cookie session, never a service-role client", () => {
    for (const rel of [QUERIES, REPOSITORY, ACTION]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /createAdminClient|service-role|service_role|SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/, rel);
    }
    assert.match(read(QUERIES), /import \{ createClient \} from "@\/lib\/supabase\/server";/);
  });

  test("no React-side or TypeScript-side assignment filtering feeds the inbox", () => {
    /*
     * `server/inbox-access-resolver.ts` compares assignedTo on purpose: it is
     * the pure mirror of the SQL rule, used by contract tests, and it is not on
     * any read path. Everything that actually builds the inbox is checked.
     */
    const readPath = [
      ...walk("src/features/whatsapp/components", (p) => p.endsWith(".tsx")),
      QUERIES,
      REPOSITORY,
      ACTION,
      LIST_ROUTE,
      CONV_ROUTE,
    ];
    for (const file of readPath) {
      assert.doesNotMatch(code(read(file)), /assigned_?[tT]o|\.filter\([^)]*assign/, file);
    }
    for (const file of featureSources) {
      if (file.endsWith("inbox-access-resolver.ts")) continue;
      assert.doesNotMatch(code(read(file)), /inbox-access-resolver/, `${file} must not filter with the mirror`);
    }
  });

  test("the list is no longer built by fetching every message of every row", () => {
    const src = code(read(QUERIES));
    assert.doesNotMatch(src, /fetchLatestPreviewByConversationIds/);
    assert.match(src, /rpc\("list_whatsapp_inbox_conversations"/);
  });
});

/* ========================================================================== */
/* Scope: no provider, template, marketing or media work                      */
/* ========================================================================== */

describe("WM-1 stays inside its scope", () => {
  test("no new Graph call site", () => {
    const graphCallers = walk("src", (p) => /\.(ts|tsx)$/.test(p) && !p.includes("/__tests__/")).filter((p) =>
      /graph\.facebook\.com/.test(code(read(p)))
    );
    for (const file of graphCallers) {
      assert.doesNotMatch(file, /inbox|read-state|staff-state|attention/i, file);
    }
    const port = code(read("src/features/whatsapp/server/whatsapp-provider-adapter.ts"));
    assert.doesNotMatch(port, /dispatchTemplateMessage|dispatchMediaMessage/);
  });

  test("the migration adds no template, marketing, media or permission work", () => {
    const sql = code(read(MIGRATION)).replace(/^\s*--.*$/gm, "");
    assert.doesNotMatch(sql, /whatsapp_templates|MARKETING|campaign|media|insert into public\.permissions|role_permissions/i);
  });

  test("use/send predicates are not redefined by WM-1", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /create or replace function private\.whatsapp_inbox_can_use_conversation/);
    assert.doesNotMatch(sql, /create or replace function private\.whatsapp_inbox_actor_can_use_conversation/);
  });

  test("one forward-only WM-1 migration, with its pgTAP suite", () => {
    const wm1 = readdirSync(join(root, "supabase/migrations")).filter((n) => /whatsapp_inbox_staff_state/.test(n));
    assert.deepEqual(wm1, ["20260913130000_whatsapp_inbox_staff_state_attention.sql"]);
    assert.match(read(PGTAP), /select plan\(\d+\);/);
  });
});

/* ========================================================================== */
/* Migration shape                                                            */
/* ========================================================================== */

describe("WM-1 migration encodes the locked policy", () => {
  const sql = read(MIGRATION);
  const viewFn = sql.slice(
    sql.indexOf("create or replace function private.whatsapp_inbox_can_view_conversation"),
    sql.indexOf("comment on function private.whatsapp_inbox_can_view_conversation")
  );

  test("the view predicate keeps its security shape", () => {
    assert.match(viewFn, /language sql\s+stable\s+security definer\s+set search_path = ''/);
    assert.match(viewFn, /public\.authorize\('whatsapp\.inbox\.read'\)/);
  });

  test("tombstoned conversations have no assignee branch", () => {
    const tombstoned = viewFn.slice(viewFn.indexOf("-- TOMBSTONED"));
    assert.match(tombstoned, /l\.deleted_at is not null/);
    assert.match(tombstoned, /whatsapp_inbox_has_manage_scope/);
    assert.doesNotMatch(tombstoned, /assigned_to/);
    const live = viewFn.slice(viewFn.indexOf("-- LIVE"), viewFn.indexOf("-- TOMBSTONED"));
    assert.match(live, /l\.id is not null\s+and l\.deleted_at is null/);
    assert.match(live, /l\.assigned_to = \(select auth\.uid\(\)\)/);
  });

  test("staff state is RLS-forced, own-row, and has no browser write grant", () => {
    assert.match(sql, /alter table public\.whatsapp_conversation_staff_state enable row level security;/);
    assert.match(sql, /alter table public\.whatsapp_conversation_staff_state force row level security;/);
    assert.match(sql, /revoke all on table public\.whatsapp_conversation_staff_state from public, anon, authenticated;/);
    assert.match(sql, /grant select on table public\.whatsapp_conversation_staff_state to authenticated;/);
    assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*whatsapp_conversation_staff_state/i);
    assert.match(sql, /staff_user_id = \(select auth\.uid\(\)\)\s+and \(select private\.whatsapp_inbox_can_view_conversation\(conversation_id\)\)/);
  });

  test("no competing owner column is introduced", () => {
    const table = sql.slice(
      sql.indexOf("create table public.whatsapp_conversation_staff_state"),
      sql.indexOf("comment on table public.whatsapp_conversation_staff_state")
    );
    assert.doesNotMatch(table, /assigned_to|owner_id|sales_rep/);
  });

  test("the read model applies the view authority and CRM follow-up truth", () => {
    const list = sql.slice(sql.indexOf("create or replace function public.list_whatsapp_inbox_conversations"));
    assert.match(list, /where \(select private\.whatsapp_inbox_can_view_conversation\(cand\.id\)\)/);
    assert.match(list, /v\.link_state = 'live'\s+and exists \(\s+select 1\s+from public\.lead_follow_ups f/);
    assert.match(list, /f\.status = 'open'\s+and f\.due_at <= now\(\)/);
    assert.match(list, /order by f\.last_message_at desc nulls last, f\.id desc/);
    assert.match(list, /escape '\\'/);
    assert.doesNotMatch(list, /latest_status|status_events/);
  });
});

/* ========================================================================== */
/* Application mirror of the access predicates                                */
/* ========================================================================== */

describe("WM-1 access resolver mirrors the tombstone policy", () => {
  const actor = (id: string, roles: string[], perms: string[]): InboxAccessContext => ({
    actorId: id,
    isActiveStaff: true,
    permissions: new Set(perms),
    roles: new Set(roles),
  });
  const salesA = actor("a", ["sales_executive"], ["whatsapp.inbox.read", "whatsapp.inbox.use"]);
  const legacySales = actor("s", ["sales"], ["whatsapp.inbox.read", "whatsapp.inbox.use"]);
  const manage = (role: string) =>
    actor(role, [role], ["whatsapp.inbox.read", "whatsapp.inbox.use", "whatsapp.inbox.manage"]);

  const tombstoned = { conversationId: "c", leadId: "l", assignedTo: "a", leadDeleted: true };

  test("the former assignee and legacy sales can neither read nor use", () => {
    assert.equal(canViewWhatsappConversation(salesA, tombstoned), false);
    assert.equal(canUseWhatsappConversation(salesA, tombstoned), false);
    assert.equal(canViewWhatsappConversation(legacySales, { ...tombstoned, assignedTo: "s" }), false);
  });

  test("manage scope reads history and cannot use it", () => {
    for (const role of ["super_admin", "sales_manager", "management"]) {
      assert.equal(canViewWhatsappConversation(manage(role), tombstoned), true, role);
      assert.equal(canUseWhatsappConversation(manage(role), tombstoned), false, role);
    }
  });

  test("a live lead behaves exactly as before", () => {
    const live = { ...tombstoned, leadDeleted: false };
    assert.equal(canViewWhatsappConversation(salesA, live), true);
    assert.equal(canUseWhatsappConversation(salesA, live), true);
    assert.equal(canUseWhatsappConversation(manage("sales_manager"), live), true);
  });
});
