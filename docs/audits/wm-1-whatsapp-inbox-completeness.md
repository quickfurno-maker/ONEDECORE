# WM-1 — CRM-Owned WhatsApp Inbox Completeness (Implementation Audit)

- **Architecture:** [ADR-0034](../ADR/ADR-0034-complete-whatsapp-marketing-control-plane-and-crm-owned-conversation-access.md) · master plan [whatsapp-marketing-control-plane.md](../product/whatsapp-marketing-control-plane.md)
- **Branch:** `feat/whatsapp-marketing-wm1` · **Baseline:** `origin/main` `7487e18f1cb83b02c0057a4fc4799436147c8419` (PR #187, WM-0)
- **Migration:** `supabase/migrations/20260913130000_whatsapp_inbox_staff_state_attention.sql` (one, forward-only)
- **Database proof:** `supabase/tests/database/64_whatsapp_inbox_staff_state_attention_test.sql` (126 assertions)
- **Application proof:** `npm run test:wm-1` (`src/features/whatsapp/__tests__/wm-1-inbox-completeness.test.ts`, 48 tests)
- **Production:** unchanged. Nothing was applied to a managed database, no environment variable changed, nothing deployed.

---

## 1. Tombstoned-lead read repair

**Defect.** `20260906180000_crm_super_admin_lead_tombstone.sql` hardened `private.whatsapp_inbox_can_use_conversation` and `private.whatsapp_inbox_actor_can_use_conversation`, but not `private.whatsapp_inbox_can_view_conversation`. The former assignee of a deleted enquiry could still `SELECT` the conversation and every message.

**Repair.** The view predicate is redefined (still `language sql stable security definer set search_path = ''`, still gated by `authorize('whatsapp.inbox.read')`) with three explicit shapes:

| Shape | Condition | Who may read |
| --- | --- | --- |
| Unlinked | `c.lead_id is null` | manage scope only |
| Live | lead resolves, `deleted_at is null` | manage scope, or the **current** `leads.assigned_to` |
| Tombstoned | lead resolves, `deleted_at is not null` | manage scope only — historical read; no assignee branch |

A non-null `lead_id` whose lead cannot be resolved matches no branch and fails closed; it is not treated as unlinked.

Manage scope is unchanged M19: `whatsapp.inbox.manage` plus `super_admin`, `sales_manager` or legacy `management`. No permission or role grant was added.

**Use/send is untouched.** Neither use predicate is redefined; both still refuse a tombstoned conversation to every actor, manage scope included. The existing `whatsapp_conversations`, `whatsapp_messages` and `whatsapp_send_intents` SELECT policies call the view predicate and inherit the repair without being edited.

**Mutation check.** The pgTAP suite was run with the pre-WM-1 predicate substituted inside a rolled-back transaction: 8 assertions fail (former assignee SELECT on conversation and messages, the predicate itself, the access check, mark-read, and read-model/RLS agreement). With the WM-1 predicate all 126 pass.

## 2. Reassignment and no existence leak (proved in pgTAP)

- Sales Executive A reads and uses the assigned conversation; Sales Executive B cannot read, use or discover it through the read model; Sales Manager reads and uses.
- `public.assign_lead` (the canonical CRM RPC) moves the lead to B. With no WhatsApp row touched, A immediately loses conversation, messages, read and use; B immediately gains the full history; manage scope is unaffected. `lead_id`, `updated_at` and the message count of the conversation are byte-identical before and after.
- After reassignment A cannot read even A's own old read cursor (it stays on disk).
- Refused and nonexistent conversations produce identical answers: `mark_whatsapp_conversation_read` raises `P0002 whatsapp_conversation_not_found` for both, and the read model returns `total_count = 0` for both.

## 3. Staff read state

`public.whatsapp_conversation_staff_state` — ONEDECORE-internal; not Meta read status.

| Column | Type | Notes |
| --- | --- | --- |
| `conversation_id` | uuid not null | FK `whatsapp_conversations` **on delete restrict** (conversations are evidence) |
| `staff_user_id` | uuid not null | FK `profiles` **on delete cascade** (personal UI state, not evidence) |
| `last_read_message_id` | uuid null | FK `whatsapp_messages` **on delete restrict** |
| `last_read_message_at` | timestamptz null | copied from the message's `provider_timestamp` |
| `last_opened_at` | timestamptz null | informational |
| `created_at`, `updated_at` | timestamptz not null | |

PK `(conversation_id, staff_user_id)`; CHECK that the cursor id and timestamp are both null or both set.

Guard trigger `private.whatsapp_conversation_staff_state_guard` (applies to every writer, service role and owner included): identity columns immutable; cursor message must belong to the same conversation; the watermark timestamp is always replaced by the message's own; the watermark never moves backwards and is never cleared.

**RLS / grants.** RLS enabled **and forced**. `revoke all … from public, anon, authenticated`; `grant select … to authenticated` only. Policy `whatsapp_conversation_staff_state_select_own`: `staff_user_id = auth.uid()` **and** the actor can currently view the conversation. A manager does not see a salesperson's cursor. There is no INSERT/UPDATE/DELETE grant.

## 4. Mark read

`public.mark_whatsapp_conversation_read(p_conversation_id uuid) returns jsonb` — `SECURITY INVOKER`, `search_path = ''`, over `private.mark_whatsapp_conversation_read_impl` (`SECURITY DEFINER`, `search_path = ''`). EXECUTE: `authenticated` only.

1. Requires `auth.uid()` (else `28000`).
2. Requires the actor can **view** the conversation (else `P0002`, same as missing).
3. Staff id is `auth.uid()`; no caller-supplied id exists.
4. Latest message found server-side: `order by provider_timestamp desc, id desc limit 1`.
5. Upsert of the actor's own row; `last_opened_at` advances; the watermark advances only to a strictly later timestamp.
6. Idempotent and monotonic; never calls Meta; never writes `whatsapp_messages` or status events.
7. Returns `{conversation_id, last_read_message_at, last_opened_at}`.

Tombstoned: a salesperson is refused; a manage-scope historical reader may keep their own cursor.

## 5. Attention read model

`public.list_whatsapp_inbox_conversations(p_attention, p_link_filter, p_search, p_page, p_page_size, p_recent_window_days default 7, p_conversation_id default null) returns jsonb` — `SECURITY DEFINER`, `search_path = ''`, explicit `auth.uid()` and `authorize('whatsapp.inbox.read')` checks, validated inputs, EXECUTE `authenticated` only.

Order of work, all in SQL: a narrowing written from the same rules → `private.whatsapp_inbox_can_view_conversation` on every candidate (the authority; the narrowing can only remove rows) → search (display name / E.164, escaped `ILIKE … escape '\'`) → link filter → evidence → attention flags → attention filter → `order by last_message_at desc nulls last, id desc` → bounded **offset** paging (not keyset). Returns `{total_count, page, page_size, items}`, so a page past the end still reports the true total.

| Filter | Formula |
| --- | --- |
| `all_assigned` | everything the actor can view (salesperson: live assigned chats; manage scope: live + unlinked + tombstoned history) |
| `unread` | latest inbound exists AND (no own watermark OR latest inbound `provider_timestamp` > own `last_read_message_at`) |
| `needs_reply` | latest inbound exists AND (no latest outbound OR latest inbound > latest outbound) |
| `waiting_on_customer` | latest outbound exists AND (no latest inbound OR latest outbound >= latest inbound) |
| `follow_up_due` | link state is live AND an `lead_follow_ups` row with `status = 'open'` and `due_at <= now()` exists — CRM truth only; tombstoned history never qualifies |
| `recently_active` | `last_message_at >= now() - p_recent_window_days` (UI default 7; a parameter so a later settings phase needs no schema change) |

Lead name crosses only when `private.crm_can_view_lead_by_id` allows it, so a tombstoned lead's name is withheld. No provider read status is read.

`p_conversation_id` lets the thread header read its row from the same model and scope.

## 6. Indexes and performance

Inspected: `idx_whatsapp_messages_conversation_timestamp (conversation_id, provider_timestamp desc)`, `idx_lead_follow_ups_lead_due (lead_id, due_at)`, the staff-state PK. Added one: `idx_whatsapp_messages_conversation_direction_timestamp (conversation_id, direction, provider_timestamp desc)` for latest inbound/outbound — not a duplicate (pgTAP `60_index_redundancy_contract_test` passes).

Local measurement, rolled back, 2,000 conversations / 40,000 messages / 400 leads:

| Actor | Call | Time |
| --- | --- | --- |
| Sales Executive (200 in scope) | `all_assigned`, `unread` | ~52–67 ms |
| Sales Manager (2,000 in scope) | `all_assigned`, `needs_reply` p3 | ~500 ms |
| Sales Manager | pre-WM-1 shape: RLS `count(*)` alone | ~405 ms |

Plans: latest-inbound lateral is an Index Only Scan on the new index; latest-preview lateral uses the existing conversation/timestamp index. The manage-scope cost is dominated by the per-row view predicate the existing RLS path already paid — see §10.

## 7. Application

- `inbox-list-query.ts`: `attention` (`all_assigned` default, invalid → default), preserved with `q`, `link`, `page`, `pageSize`; `buildInboxListHref` resets to page 1 when search, link or attention changes.
- `conversation-dtos.ts`: list item adds `lastOutboundAt`, `linkState`, `staffLastReadMessageAt`, `unread`, `needsReply`, `waitingOnCustomer`, `followUpDue`; **removes** `linkedLeadAssignedTo` (a staff UUID nothing rendered). The jsonb payload is shape-checked in `parseInboxConversationListPayload`.
- `whatsapp-inbox-queries.ts`: list and header via the RPC with the cookie client; the old per-page fetch of every message for previews is gone.
- `whatsapp-read-state-actions.ts` (Server Action) + `InboxReadAcknowledger` (client effect): read state advances only after the thread mounts in a visible tab; never from a Server Component render or prefetch; the list is refreshed only when the server confirms; a failure changes nothing locally.

## 8. UI

Premium inbox visual system kept. Added a compact attention strip — All · Unread · Needs reply · Waiting · Follow-up · Recent — with no counts, scrolling horizontally on narrow screens. Rows show a small unread dot (with screen-reader text) only when `unread` is true and one "Needs reply" cue; Waiting/Follow-up/Recent stay queues. Manage-scope history rows read "Lead deleted · read only". Conversation links and back navigation preserve `q`, `link`, `attention`, `page`, `pageSize`.

## 9. Route independence

- `contracts/inbox-surface.ts`: `WHATSAPP_ADMIN_INBOX_BASE_PATH`, `buildInboxConversationHref`.
- `InboxListPane`, `InboxConversationList`, `InboxAttentionFilters`, `InboxLinkFilters`, `InboxListPagination`, `InboxSearchForm` take a `basePath`; no inbox component hardcodes `/admin/whatsapp`.
- `whatsapp-auth.ts`: `requireWhatsappInboxReadAccess(guard)` takes a `WhatsappInboxRouteGuard` (current path + login destination); `ADMIN_WHATSAPP_INBOX_ROUTE_GUARD` preserves the existing `/admin` behaviour, including `getSafeAdminRedirect`.
- Repository/queries resolve the current actor and let the database decide scope; no service-role client, no React-side assignment filtering.
- No `/sales/...` route was created.

## 10. Tests run

| Command | Result |
| --- | --- |
| `npm run db:reset` | applied all 73 migrations |
| `npm run db:lint` | pass; warnings are pre-existing, none in WM-1 functions |
| `npm run db:test` | 64 files, 3,756 tests, PASS |
| `npm run verify:db-types` | generated types match local schema |
| `npm run test:wm-0` / `test:wm-1` / `test:whatsapp-inbox-ui` / `test:phase-6b-integrated` | 69 / 48 / 83 / 48, all pass |
| `npm run test:app` | 4,746 tests, 0 failures |
| `npm run typecheck` / `lint` | pass / 0 errors (26 pre-existing warnings, none in WhatsApp files) |
| `npm run build` / `check` | pass (verify:tests, verify:env, verify:dependencies, lint, typecheck, production build) |
| Local PostgREST smoke (supabase-js as a local Super Admin) | unread → mark → only that conversation leaves Unread; own state row only; missing id `P0002`; direct insert `42501` |

Existing tests updated to WM-1 truth: the premium-inbox "no unread badge" test now requires the database-backed boolean dot and still forbids counts; the 6B-B2 DTO test uses the new row shape; the Kriti fixture carries the new DTO fields; the identity test's public table count is 122; five migration-ledger pins name the new migration.

## 11. Limitations and debt

1. **Manage-scope list cost** scales with conversations in scope because the view predicate (with `authorize` and role lookups) is evaluated per row — the same cost the pre-WM-1 RLS list paid. A later phase can resolve manage scope once per request inside the predicate path.
2. **Equal-second timestamps.** Meta timestamps have one-second resolution. An inbound message carrying exactly the same `provider_timestamp` as the reader's watermark is treated as read (`>` per the locked formula).
3. **Message paging** in the thread still shares the `page` query parameter with the list and pages oldest-first (pre-existing); "Older messages" drops list filters.
4. **Restore** is covered at predicate level only; no governed lead-restore RPC exists to exercise end to end.
5. Unread is per staff member and is not transferred on reassignment: a new owner starts with inbound history unread, by design (§7 of the plan).

## 12. WM-2 boundary

WM-1 added no Meta Graph call, no `dispatchTemplateMessage`, no template sync/creation, no MARKETING consent UI, no contacts/segments/campaigns, no bulk sends, no automations/Flows/CTWA, no media. WM-2 (template registry sync, snapshots, Studio, 1:1 template insertion) builds on this read model and the unchanged ownership rule.
