# CRM 2A-4 — Implementation Plan (Application Service + Contracts)

> **For agentic workers:** Do **not** execute this plan until the owner explicitly authorizes coding. When authorized, implement **application contracts / adapters / service / actions / tests only** — no React UI, no SQL migration, no managed Supabase apply, no SLA activation, no 2A-5+ surfaces.

**Goal:** Connect the already-live CRM 2A-3 activity RPCs to the Next.js application layer with TypeScript contracts, validation, adapters, server-only service, server actions, stable error mapping, and read enrichment — without changing lead-detail visuals.

**Architecture:** Reuse the existing CRM pattern (`contracts` → `server-only` service → thin RPC adapters → FormData server actions → `CrmError` / action-state). Mutation authority remains the five public 2A-3 RPCs. No second architecture.

**Tech stack:** Next.js server actions, `server-only`, `@/lib/supabase/server` `createClient()`, existing `CrmError` / `crmErrorFromPostgresMessage`, node:test under `src/features/crm/__tests__/`. **No Zod** (not used in CRM).

**Document status:** Implementation complete (local) — **PR authorized; merge / managed apply / production deploy NOT authorized**  
**Plan date:** 2026-08-27  
**Implementation date:** 2026-08-27  
**Specs:** [crm-2.0-roadmap.md](./crm-2.0-roadmap.md), [crm-2a-follow-up-control-plane-design.md](./crm-2a-follow-up-control-plane-design.md), [crm-2a1-implementation-plan.md](./crm-2a1-implementation-plan.md), [crm-2a2-implementation-plan.md](./crm-2a2-implementation-plan.md), [crm-2a3-implementation-plan.md](./crm-2a3-implementation-plan.md)

---

## 0. Implementation evidence (2026-08-27)

| Item | Value |
| :--- | :--- |
| Branch | `crm-2a4-application-service-contracts` |
| Base SHA | `9a9036ecb3550e0aa21964fa2a7af96d9d782598` |
| Owner gate G (managed tip) | **CLOSED** by independent owner review — tip `20260828140000`, pending NONE, five RPCs present |
| Owner gate H (WA picker) | **CLOSED** — no evidence-list helper in 2A-4 |
| Owner gate I (deploy) | **CLOSED** — do not deploy by default after merge |
| Migration | **NONE** |
| `crm-lead-queries.ts` | **Unchanged** |
| New modules | `activity-contracts.ts`, `crm-activity-adapters.ts`, `crm-activity-service.ts`, `crm-activity-actions.ts` |
| Service functions | create / reschedule / transfer / designate / complete `*ForCurrentUser` + `listActivityOutcomeOptionsForCurrentUser` |
| Actions | five FormData actions; revalidate authoritative `result.leadId` |
| Outcome read | direct SELECT `lead_activity_outcome_codes` where `is_active`; order `display_order`, `code` |
| DTO enrichment | additive `CrmLeadDetailFollowUp` + repository select/map (incl. `createdAt`/`updatedAt`) |
| Generated types | local `supabase gen types typescript --local` after `db reset`; surgical restore of nullable Args the CLI omitted (`authorize_commerce_product_media_upload`, `create_landing_publication`, `bind_campaign_run_operation`, `record_landing_exposure`, `verify_live_landing_publication_context`, `save_landing_experiment_draft`) |
| Tests | `crm-activity-*.test.ts` (49) + lifecycle CLOSED_WON mapping update; appended to `test:app` |
| Local validation | targeted 2A-4 PASS; `npm run test:app` PASS; `npm run check` PASS |
| Managed / production / SLA / 2A-5 | untouched |

---

## Global constraints

- App-only slice: **no** `supabase/migrations/*.sql`, **no** managed apply, **no** SLA activation / business-hours config.
- Do **not** change lead-detail / follow-up UI components in 2A-4.
- Preserve legacy follow-up RPCs, actions, and `CrmLeadDetailFollowUp` field compatibility.
- Closed Won must **not** be representable as an activity completion resolution.
- DB remains final authority for ownership, terminal/on_hold, primary, WhatsApp evidence, and outcome catalogue.
- Do not introduce Zod or a generic RPC framework.
- Do not log phone/email/completion notes/WhatsApp bodies.

---

## 1. Protected main SHA

| Item | Value |
| :--- | :--- |
| **Protected `origin/main`** | `9a9036ecb3550e0aa21964fa2a7af96d9d782598` |
| **Verified** | **YES** (`git fetch` + `git rev-parse origin/main`) |
| **Tip commit** | Merge PR #101 — CRM 2A-3 activity RPC workflows |
| **HEAD (audit worktree)** | Same SHA (detached) |
| **Tracked tree** | **Clean** (`git status --porcelain` empty) |
| **Worktree** | `OneDecore-crm-2a4-plan` |

---

## 2. Managed migration tip

| Item | Value |
| :--- | :--- |
| **Project** | `lpurlfmpvriyvpkujvyl` (`ap-south-1`) |
| **Owner-attested tip** | `20260828140000` / `crm_activity_rpc_workflows` |
| **Owner-attested pending** | **NONE** |
| **Independent re-verify this turn** | **CLOSED by owner** (authorization 2026-08-27) — managed ledger tip `20260828140000`, pending NONE |
| **Plan stance** | Implementation proceeded under owner-closed managed gate. |

Production SLA remains intentionally OFF (owner baseline).

---

## 3. Managed 2A-3 RPC verification

### 3.1 Merged SQL (verified YES)

Migration `supabase/migrations/20260828140000_crm_activity_rpc_workflows.sql` defines and grants authenticated execute on:

| Public RPC | Returns | Key args |
| :--- | :--- | :--- |
| `create_lead_activity` | `lead_follow_ups` | `p_lead_id`, `p_activity_type`, `p_title`, `p_due_at`, `p_priority`, `p_owner_id`, `p_is_primary`, `p_duration_minutes`, `p_reminder_at`, `p_quotation_id` |
| `reschedule_lead_activity` | `lead_follow_ups` | `p_activity_id`, `p_due_at`, `p_reminder_at`, `p_clear_reminder` |
| `transfer_activity_ownership` | `lead_follow_ups` | `p_activity_id`, `p_new_owner_id` |
| `designate_primary_next_action` | `lead_follow_ups` | `p_activity_id` |
| `complete_lead_activity` | `lead_follow_ups` | 16 args (see §12) |

### 3.2 Managed DB

| Item | Status |
| :--- | :--- |
| Five RPCs on managed | **YES** — owner independent review closed gate G |
| STOP? | **No** |

---

## 4. Open PR collision audit

| Check | Result |
| :--- | :--- |
| `gh pr list --state open` | **[]** (empty) |
| CRM app service/contracts overlap | **NONE** |
| Proposed filenames present in tree | **ABSENT** (collision-free) |
| Stale remote feature branches | `crm-2a1-activity-foundation`, `crm-2a3-activity-rpc-workflows` exist remotely; **merged**; do not base work on them |

**Collision result:** clear.

---

## 5. Current CRM app architecture inventory

| Area | Actual pattern |
| :--- | :--- |
| Contracts | `src/features/crm/contracts/*` — plain TS validators (`isUuid`, field-error arrays); **no Zod** |
| Adapters | `crm-transition-adapters.ts` — camelCase → `p_*` RPC args, local `CrmRpcClient` overload cast, `crmErrorFromPostgresMessage` |
| Services | `server-only` modules (`crm-lifecycle-service.ts`, `crm-assignment-service.ts`, …) using `getCrmAccessContext` + capability assert + validate + `createClient()` + adapter |
| Actions | `"use server"` FormData actions returning bounded `{ success, message, code?, fieldErrors? }` + `revalidatePath` |
| Errors | `CrmError` + ordered `crmErrorFromPostgresMessage` |
| Auth context | `CrmAccessContext.canManageLeadFollowUps` already probed via `crm.follow_ups.manage` |
| Lead detail reads | `crm-lead-repository.getLeadDetailForCurrentUser` + page-level parallel fetches (`fetchActiveLeadClosureReasons`, assignee directory) |
| Legacy follow-ups | Still use `create_lead_follow_up` / `complete_lead_follow_up` / `cancel_lead_follow_up` via lifecycle service/actions/UI |
| Tests | `node:test` + `server-only` stub; CRM suite listed in `package.json` `test:app` |

**Decision:** Do **not** invent a second architecture. Mirror lifecycle/assignment split with dedicated activity files.

---

## 6. Exact proposed changed files

### Create

| File | Role |
| :--- | :--- |
| `src/features/crm/contracts/activity-contracts.ts` | Unions, input types, normalize/validate, FormData parsers, action-state type |
| `src/features/crm/server/crm-activity-adapters.ts` | Five typed RPC adapters |
| `src/features/crm/server/crm-activity-service.ts` | Auth preflight + validate + call adapters + map results |
| `src/features/crm/server/crm-activity-actions.ts` | Five FormData server actions |
| `src/features/crm/__tests__/crm-activity-contracts.test.ts` | Contract/validation matrix |
| `src/features/crm/__tests__/crm-activity-service.test.ts` | Adapter arg names + service validation/error mapping (mock supabase) |
| `src/features/crm/__tests__/crm-activity-actions.test.ts` | Action parsing / CrmError → state / revalidate paths |

### Modify

| File | Role |
| :--- | :--- |
| `src/features/crm/server/crm-errors.ts` | New `CrmErrorCode` tokens + **ordered** activity mappings (before generic `not found`) |
| `src/features/crm/contracts/lead-detail-dtos.ts` | Backward-compatible enrichment of `CrmLeadDetailFollowUp` + outcome option DTO |
| `src/features/crm/server/crm-lead-repository.ts` | Select/map enriched activity columns |
| `src/features/crm/server/crm-lead-queries.ts` | `fetchActiveActivityOutcomeOptions()` (mirror closure reasons) |
| `package.json` | Include the three new tests in `test:app` |
| `src/types/database.generated.ts` | **Regenerate** (recommended — see §25) |

### Explicitly not created

| Candidate | Decision |
| :--- | :--- |
| `crm-activity-queries.ts` | **Skip** — outcomes live in `crm-lead-queries.ts`; enrichment in repository |
| React components | **Defer to 2A-5** |
| Any `supabase/migrations/*` | **None** |

### Docs (this turn only)

| File | Role |
| :--- | :--- |
| `docs/product/crm-2a4-implementation-plan.md` | This plan |

---

## 7. Exact activity TypeScript unions

```ts
export const CRM_ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "consultation",
  "site_visit",
  "quotation_follow_up",
  "internal_task",
] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export const CRM_ACTIVITY_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type CrmActivityPriority = (typeof CRM_ACTIVITY_PRIORITIES)[number];

export const CRM_ACTIVITY_STATUSES = [
  "open",
  "completed",
  "cancelled",
] as const;
export type CrmActivityStatus = (typeof CRM_ACTIVITY_STATUSES)[number];

export const CRM_ACTIVITY_RESOLUTIONS = [
  "NONE",
  "NEXT_PRIMARY",
  "ON_HOLD",
  "CLOSED_LOST",
] as const;
export type CrmActivityResolution = (typeof CRM_ACTIVITY_RESOLUTIONS)[number];
// CLOSED_WON is intentionally absent from the union.

export const CRM_ACTIVITY_SOURCES = [
  "manual",
  "completion_chain",
  "on_hold_review",
  "sla_auto",
  "import",
] as const;
export type CrmActivitySource = (typeof CRM_ACTIVITY_SOURCES)[number];
```

**Bounds (mirror DB):**

| Field | Rule |
| :--- | :--- |
| title / nextTitle | trim; length 1..120 |
| durationMinutes / nextDurationMinutes | `null` or integer 1..1440 |
| completionNote | omit/null or trim length 1..1000 |
| reminderAt | null or ≤ dueAt |
| reschedule dueAt | required; must be **future** (DB) |
| create dueAt | required non-null ISO (**DB does not require future on create**) |
| onHoldReviewAt | required for ON_HOLD; must be future |
| UUIDs | reuse `isUuid` from `assignment-contracts.ts` (or re-export) |

---

## 8. Exact create input contract

```ts
export interface CreateLeadActivityInput {
  readonly leadId: string;
  readonly activityType: CrmActivityType;
  readonly title: string;
  readonly dueAt: string; // ISO / timestamptz-compatible
  readonly priority?: CrmActivityPriority; // default "normal"
  readonly ownerId?: string | null;
  readonly isPrimary?: boolean; // default false
  readonly durationMinutes?: number | null;
  readonly reminderAt?: string | null;
  readonly quotationId?: string | null;
}
// No `source` field — DB forces manual for this RPC.
```

**Normalize:** trim strings; empty optional UUID → `null`; default priority `normal`; default `isPrimary` false.

**Validate:** field-level errors (`leadId`, `activityType`, `title`, `dueAt`, `priority`, `ownerId`, `durationMinutes`, `reminderAt`, `quotationId`).

---

## 9. Exact reschedule contract

```ts
export type RescheduleReminderMode =
  | { readonly kind: "unchanged" }
  | { readonly kind: "set"; readonly reminderAt: string }
  | { readonly kind: "clear" };

export interface RescheduleLeadActivityInput {
  readonly activityId: string;
  readonly dueAt: string;
  readonly reminder: RescheduleReminderMode;
}
```

**RPC mapping:**

| Mode | `p_reminder_at` | `p_clear_reminder` |
| :--- | :--- | :--- |
| unchanged | `null` | `false` |
| set | ISO string | `false` |
| clear | `null` | `true` |

FormData encoding for 2A-5: `reminderMode=unchanged|set|clear` + optional `reminderAt`.

---

## 10. Exact transfer contract

```ts
export interface TransferActivityOwnershipInput {
  readonly activityId: string;
  readonly newOwnerId: string;
}
```

Do **not** pretend primary transfer is supported. Map `PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT` to user-safe copy (see §22). No assign/reassign implementation in 2A-4.

---

## 11. Exact designate contract

```ts
export interface DesignatePrimaryNextActionInput {
  readonly activityId: string;
}
```

No owner transfer on this action.

---

## 12. Exact discriminated complete contract

```ts
interface CompleteLeadActivityBase {
  readonly activityId: string;
  readonly outcomeCode: string;
  readonly completionNote?: string | null;
  readonly whatsappSendIntentId?: string | null;
}

export type CompleteLeadActivityInput =
  | (CompleteLeadActivityBase & {
      readonly resolution: "NONE";
    })
  | (CompleteLeadActivityBase & {
      readonly resolution: "NEXT_PRIMARY";
      readonly nextActivityType: CrmActivityType;
      readonly nextTitle: string;
      readonly nextDueAt: string;
      readonly nextPriority?: CrmActivityPriority;
      readonly nextDurationMinutes?: number | null;
      readonly nextReminderAt?: string | null;
      readonly nextQuotationId?: string | null;
    })
  | (CompleteLeadActivityBase & {
      readonly resolution: "ON_HOLD";
      readonly onHoldReason: string;
      readonly onHoldReviewAt: string;
    })
  | (CompleteLeadActivityBase & {
      readonly resolution: "CLOSED_LOST";
      readonly closedLostReason: string;
      readonly closureReasonCode?: string | null;
    });
```

**Normalized 16-arg RPC payload:**

| Arg | Mapping |
| :--- | :--- |
| `p_activity_id` | `activityId` |
| `p_outcome_code` | `outcomeCode` |
| `p_completion_note` | note or null |
| `p_resolution` | `"NONE" \| "NEXT_PRIMARY" \| "ON_HOLD" \| "CLOSED_LOST"` |
| `p_next_*` | filled only for `NEXT_PRIMARY`; else null |
| `p_on_hold_*` | filled only for `ON_HOLD`; else null |
| `p_closed_lost_reason` / `p_closure_reason_code` | filled only for `CLOSED_LOST`; else null |
| `p_whatsapp_send_intent_id` | UUID or null |

Reject any FormData `resolution=CLOSED_WON` at parse time as `VALIDATION_FAILED` (never call RPC). If RPC somehow returns `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE`, still map it (defense in depth).

**FormData strategy:** parse `resolution` first; then branch required fields. Do **not** accept a single unvalidated `Record<string, unknown>`.

---

## 13. WhatsApp send-intent contract

### 13.1 App contract

- Complete input may include `whatsappSendIntentId?: string | null`.
- App must **not** accept provider timestamps, provider message IDs, or outbound message IDs.
- DB validates governed chain via `private.validate_crm_whatsapp_send_evidence` using `whatsapp_messages.provider_timestamp`.

### 13.2 Existing WhatsApp surface (audit)

| Fact | Evidence |
| :--- | :--- |
| Send action returns `intentId` | `WhatsappSendActionState.intentId` after `create_whatsapp_service_send_intent` + optional dispatch |
| CRM lead-detail WhatsApp coupling | **None** (`src/features/crm` has no send-intent usage) |
| Intent SELECT RLS | `whatsapp_send_intents_select_scoped` → `private.whatsapp_inbox_can_view_conversation(conversation_id)` |

### 13.3 Gap (document precisely — not a 2A-4 redesign)

**Current CRM lead-detail UI cannot know a governed send-intent UUID.**

Supply paths for **future 2A-5** without CRM WhatsApp redesign:

1. User completes WhatsApp send in `/admin/whatsapp/inbox/...` (action already returns `intentId`); 2A-5 may deep-link / carry that UUID into complete form.
2. If the actor also has WhatsApp inbox view on the lead’s conversation, a later read helper *could* list `dispatch_bound` intents — still RLS-gated by WhatsApp, **no CRM migration**.
3. Do **not** invent a 2A-4 migration or service-role bypass.

**2A-4 scope:** accept/validate UUID on complete contract + map `WHATSAPP_SEND_EVIDENCE_*` errors. Optional evidence-list helper is **deferred** (owner decision §38) to avoid implying CRM can always read intents.

---

## 14. Outcome catalogue read contract

### Schema (2A-1, actual)

`public.lead_activity_outcome_codes`:

- `code`, `display_name`, `activity_types text[]`, `closes_contact_attempt`, `is_active`, `display_order`, `created_at`

### RLS (safe SELECT — no migration)

`lead_activity_outcome_codes_select` grants authenticated SELECT when any of:

- `crm.follow_ups.manage` / `crm.activities.read` / `leads.read_all` / `leads.read_assigned` / `leads.read`

**No new RPC required.**

### DTO

```ts
export interface CrmActivityOutcomeOption {
  readonly code: string;
  readonly displayName: string;
  readonly activityTypes: readonly CrmActivityType[]; // empty => all types
  readonly closesContactAttempt: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number; // maps display_order
}
```

### Query

`fetchActiveActivityOutcomeOptions()` in `crm-lead-queries.ts`:

- `.eq("is_active", true)`
- order `display_order` asc, then `display_name` asc
- map snake → camel

**Included in 2A-4:** YES (mirror `fetchActiveLeadClosureReasons`). Lead-detail page wiring of the prop into a composer is **2A-5**; 2A-4 may optionally start fetching in the page only if it does not change visuals — **recommended:** add the query function now; **defer page prop plumbing to 2A-5** to keep screens unchanged, OR fetch unused in page parallel (wasteful). Prefer: export query for 2A-5; unit-test it; do not change `page.tsx` unless needed for type exports only.

**Plan lock:** implement query + DTO in 2A-4; **do not modify** `src/app/admin/crm/leads/[leadId]/page.tsx` (keeps production screens unchanged).

---

## 15. Enriched activity read DTO

Evolve `CrmLeadDetailFollowUp` **additively**:

```ts
export interface CrmLeadDetailFollowUp {
  // existing (preserve)
  readonly id: string;
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly dueAt: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  // 2A-4 enrichment
  readonly activityType: CrmActivityType | string;
  readonly title: string;
  readonly priority: CrmActivityPriority | string;
  readonly isPrimaryNextAction: boolean;
  readonly durationMinutes: number | null;
  readonly reminderAt: string | null;
  readonly outcomeCode: string | null;
  readonly completionNote: string | null;
  readonly quotationId: string | null;
  readonly source: CrmActivitySource | string;
  readonly updatedAt: string;
}
```

**Compatibility:** current UI only reads legacy fields (`LeadDetailFollowUps.tsx`). Extra fields are unused until 2A-5.

**Repository select expand:**

```text
id, owner_id, due_at, status, outcome, completed_at, cancelled_at,
activity_type, title, priority, is_primary_next_action, duration_minutes,
reminder_at, outcome_code, completion_note, quotation_id, source, updated_at
```

Owners still resolved via existing batch `labelForUser` — **no N+1**.

Optional alias type `CrmLeadActivity = CrmLeadDetailFollowUp` is unnecessary; keep one name.

---

## 16. Service function list

`src/features/crm/server/crm-activity-service.ts` (`server-only`):

| Function | Responsibility |
| :--- | :--- |
| `createLeadActivityForCurrentUser` | preflight + validate + `callCreateLeadActivity` |
| `rescheduleLeadActivityForCurrentUser` | same for reschedule |
| `transferActivityOwnershipForCurrentUser` | same for transfer |
| `designatePrimaryNextActionForCurrentUser` | same for designate |
| `completeLeadActivityForCurrentUser` | same for complete; returns completed row (+ enough `lead_id` for revalidate) |

**Shared preflight:**

1. `getCrmAccessContext()` → else `AUTH_REQUIRED`
2. assert `canManageLeadFollowUps` → else `PERMISSION_DENIED`
3. validate/normalize contracts → else `VALIDATION_FAILED`
4. `createClient()` + adapter
5. map row → bounded activity result DTO (include `leadId` from returned row)

**Must NOT:** UPDATE `lead_follow_ups` directly; mutate SLA clocks; transition status outside RPC; invent WhatsApp success; bypass RPCs.

Owner resolution for create: reuse lifecycle convention — non-broad users force `ownerId = context.userId`; broad users may pass directory owner (DB still authoritative).

---

## 17. Adapter function list

`src/features/crm/server/crm-activity-adapters.ts`:

| Function | RPC |
| :--- | :--- |
| `callCreateLeadActivity` | `create_lead_activity` |
| `callRescheduleLeadActivity` | `reschedule_lead_activity` |
| `callTransferActivityOwnership` | `transfer_activity_ownership` |
| `callDesignatePrimaryNextAction` | `designate_primary_next_action` |
| `callCompleteLeadActivity` | `complete_lead_activity` |

Pattern: local `CrmActivityRpcClient` overload cast (same as transition adapters), assert one-row object, throw `crmErrorFromPostgresMessage(error.message)`.

Tiny shared helper allowed: `assertLeadFollowUpRow(data)`.

Do **not** append these five into the already-large `crm-transition-adapters.ts` (file cohesion).

---

## 18. Server action list

`src/features/crm/server/crm-activity-actions.ts`:

| Action | Service |
| :--- | :--- |
| `createLeadActivityAction` | create |
| `rescheduleLeadActivityAction` | reschedule |
| `transferActivityOwnershipAction` | transfer |
| `designatePrimaryNextActionAction` | designate |
| `completeLeadActivityAction` | complete |

Unused by UI until 2A-5; still exported for consumption.

---

## 19. Action-state types

```ts
export interface ActivityActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: CrmErrorCode | string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly activityId?: string;
  readonly leadId?: string;
}
```

Keep codes as string union of relevant `CrmErrorCode` values (same style as assignment actions).

---

## 20. Field-error strategy

| DB / validation token | Field key(s) |
| :--- | :--- |
| `ACTIVITY_TITLE_INVALID` | `title` |
| `ACTIVITY_TYPE_INVALID` | `activityType` |
| `ACTIVITY_PRIORITY_INVALID` | `priority` |
| `ACTIVITY_DUE_REQUIRED` / `ACTIVITY_DUE_MUST_BE_FUTURE` | `dueAt` (or `nextDueAt` when NEXT_PRIMARY) |
| `ACTIVITY_DURATION_INVALID` | `durationMinutes` / `nextDurationMinutes` |
| `ACTIVITY_REMINDER_INVALID` | `reminderAt` / `nextReminderAt` |
| `ACTIVITY_QUOTATION_MISMATCH` | `quotationId` / `nextQuotationId` |
| `ACTIVITY_OUTCOME_*` | `outcomeCode` |
| `NEXT_PRIMARY_INVALID` / `NEXT_ACTION_REQUIRED` | `resolution` (+ specific next fields when known) |
| `ON_HOLD_REVIEW_REQUIRED` | `onHoldReason` / `onHoldReviewAt` |
| `WHATSAPP_SEND_EVIDENCE_*` | `whatsappSendIntentId` (and general message) |
| `PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT` | `newOwnerId` / general |
| App parse failures | deterministic field keys before RPC |

---

## 21. All DB-token → CrmError mappings

Exact tokens from merged 2A-3 SQL (unique set):

| Postgres token | CrmErrorCode | HTTP | User message |
| :--- | :--- | :--- | :--- |
| `ACTIVITY_NOT_FOUND` | `ACTIVITY_NOT_FOUND` | 404 | Activity not found. |
| `ACTIVITY_NOT_OPEN` | `ACTIVITY_NOT_OPEN` | 422 | Only open activities can be updated. |
| `ACTIVITY_OWNER_NOT_AUTHORIZED` | `ACTIVITY_OWNER_NOT_AUTHORIZED` | 403 | You are not allowed to change this activity. |
| `ACTIVITY_TYPE_INVALID` | `ACTIVITY_TYPE_INVALID` | 422 | Activity type is invalid. |
| `ACTIVITY_TITLE_INVALID` | `ACTIVITY_TITLE_INVALID` | 422 | Activity title must be 1–120 characters. |
| `ACTIVITY_PRIORITY_INVALID` | `ACTIVITY_PRIORITY_INVALID` | 422 | Activity priority is invalid. |
| `ACTIVITY_DUE_REQUIRED` | `ACTIVITY_DUE_REQUIRED` | 422 | Due date and time are required. |
| `ACTIVITY_DUE_MUST_BE_FUTURE` | `ACTIVITY_DUE_MUST_BE_FUTURE` | 422 | Due date and time must be in the future. |
| `ACTIVITY_DURATION_INVALID` | `ACTIVITY_DURATION_INVALID` | 422 | Duration must be between 1 and 1440 minutes. |
| `ACTIVITY_REMINDER_INVALID` | `ACTIVITY_REMINDER_INVALID` | 422 | Reminder must be at or before the due time. |
| `ACTIVITY_QUOTATION_MISMATCH` | `ACTIVITY_QUOTATION_MISMATCH` | 422 | Quotation does not belong to this lead. |
| `ACTIVITY_TERMINAL_REJECTED` | `ACTIVITY_TERMINAL_REJECTED` | 422 | This action is not allowed on a closed lead. |
| `ACTIVITY_OUTCOME_REQUIRED` | `ACTIVITY_OUTCOME_REQUIRED` | 422 | Outcome is required. |
| `ACTIVITY_OUTCOME_INVALID` | `ACTIVITY_OUTCOME_INVALID` | 422 | Outcome is invalid. |
| `ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE` | `ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE` | 422 | Outcome is not allowed for this activity type. |
| `PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT` | `PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT` | 422 | Primary next-action ownership follows lead assignment. |
| `ON_HOLD_PRIMARY_RESERVED` | `ON_HOLD_PRIMARY_RESERVED` | 422 | On-hold primary is reserved for the review task. |
| `ON_HOLD_REVIEW_REQUIRED` | `ON_HOLD_REVIEW_REQUIRED` | 422 | On-hold reason and future review time are required. |
| `NEXT_ACTION_REQUIRED` | `NEXT_ACTION_REQUIRED` | 422 | Choose the next action before completing this activity. |
| `NEXT_PRIMARY_INVALID` | `NEXT_PRIMARY_INVALID` | 422 | Next primary activity details are invalid. |
| `WHATSAPP_SEND_EVIDENCE_REQUIRED` | `WHATSAPP_SEND_EVIDENCE_REQUIRED` | 422 | This WhatsApp activity can only be marked sent after a governed message is sent. |
| `WHATSAPP_SEND_EVIDENCE_INVALID` | `WHATSAPP_SEND_EVIDENCE_INVALID` | 422 | WhatsApp send evidence is invalid for this lead. |
| `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` | `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` | 422 | Closed Won is created only through accepted quotation. |
| `LEAD_NOT_FOUND` (create path) | `LEAD_NOT_FOUND` | 404 | Lead not found |
| `Authentication required` | `AUTH_REQUIRED` | 401 | Authentication required |

**Ordering rule:** match **exact activity tokens first** (includes `activity_not_found`) **before** generic `"not found"` → `LEAD_NOT_FOUND`. Underscore tokens do not currently match space `"not found"`, but explicit ordering is still required for safety and message quality.

Also refine existing `closed_won_requires_quotation_acceptance` branch to the dedicated code/message above (today maps to generic `INVALID_TRANSITION`).

---

## 22. HTTP status / message strategy

| Class | Status |
| :--- | :--- |
| Auth | 401 |
| Permission / owner authorization | 403 |
| Activity / lead missing | 404 |
| Stale assignment conflicts | 409 (existing only; activity RPCs generally not 409) |
| Business / validation | 422 |
| Unexpected | 500 `RPC_FAILED` |

UI sees `CrmError.message` / action `message` only — never raw SQL / schema / function names. `details` may retain original token internally.

---

## 23. Auth / preflight strategy

| Layer | Check |
| :--- | :--- |
| Service | session via `getCrmAccessContext`; `canManageLeadFollowUps` |
| DB | `authorize('crm.follow_ups.manage')`, `crm_can_mutate_lead`, target-owner `crm_user_can_operate_lead`, broad-scope rules, terminal/on_hold |

Do **not** duplicate DB state machine in app. Do **not** expand RBAC schema.

---

## 24. Revalidation strategy

On successful mutation:

- `revalidatePath("/admin/crm/leads")`
- `revalidatePath(\`/admin/crm/leads/${leadId}\`)`

Prefer authoritative `lead_id` from RPC return row. For create, `leadId` is already known from input; still prefer returned row when present.

Do **not** add My Day paths (route does not exist yet).

---

## 25. Generated Supabase type decision

| Fact | Detail |
| :--- | :--- |
| Current `database.generated.ts` | **Stale** — `lead_follow_ups` Row lacks 2A-1 columns; **no** 2A-3 RPC entries (`create_lead_activity` etc. absent) |
| Existing workaround | Transition adapters use local RPC overload cast; some inserts use `as never` |
| 2A-4 decision | **Regenerate** `src/types/database.generated.ts` during implementation from **local** DB after `supabase db reset` (or approved linked **read-only** `gen types`) — **no** `db push` |
| Do **not** | Hand-edit a giant fake schema |
| Fallback | If regen blocked, keep adapter overload cast pattern **and** narrow select casts for new columns — still prefer regen |

No `package.json` gen script today — document exact CLI in implementation checklist:

```bash
npx supabase@2.109.1 gen types typescript --local > src/types/database.generated.ts
```

(Adjust only if repo later adds a canonical script.)

---

## 26. Lead-detail query enrichment decision

| Item | Decision |
| :--- | :--- |
| Enrich `CrmLeadDetailFollowUp` + repository select/map | **YES** |
| `fetchActiveActivityOutcomeOptions` | **YES** (queries module) |
| Wire outcomes into `page.tsx` / composer UI | **NO** (2A-5) |
| My Day queries | **NO** |
| WhatsApp evidence list helper | **DEFER** (see §13 / §38) |

Query count impact for lead detail after enrichment: **same** parallel batch; follow-ups select wider columns only (**+0 queries**). Outcomes fetched only when 2A-5 wires them (**+1** then, once per page).

---

## 27. Backward compatibility plan

| Surface | Plan |
| :--- | :--- |
| `LeadDetailFollowUps` / composer / complete-cancel actions | Unchanged; still legacy RPCs |
| `CrmLeadDetailFollowUp` | Additive fields only |
| Assignment / status / notes | Untouched |
| New activity actions | Present but unused |
| Visual screens | Unchanged |

---

## 28. No-migration proof

| Requirement | Evidence |
| :--- | :--- |
| Five mutation RPCs | Exist in merged 2A-3 SQL |
| Outcome catalogue read | SELECT grant + RLS policy already present |
| Enriched follow-up columns | Exist since 2A-1 |
| WhatsApp evidence | Validated inside DEFINER complete path |
| App needs only contracts/service | Yes |

**DB migration required:** **NO**

If implementation discovers outcome SELECT failing for CRM roles → **STOP** (would be a real DB defect; not quietly migrate in 2A-4).

---

## 29. Unit test matrix — contracts

File: `crm-activity-contracts.test.ts`

- activity / priority / resolution enums; CLOSED_WON not in union / rejected by parser
- title 1..120; duration 1..1440; note ≤1000; reminder ≤ due
- reschedule future due; reminder modes A/B/C
- NEXT_PRIMARY / ON_HOLD / CLOSED_LOST required fields; NONE rejects next/on-hold/closed payloads
- UUID / boolean / integer / ISO parsers; malformed ISO rejected without locale parsing

---

## 30. Service / adapter test matrix

File: `crm-activity-service.test.ts` (mock supabase `rpc`)

- each adapter sends exact `p_*` names (especially complete’s 16)
- no `CLOSED_WON` payload path
- validation fails before RPC
- RPC error tokens map via `crmErrorFromPostgresMessage`
- success row maps `lead_id` / activity fields
- no `.from("lead_follow_ups").update` in activity service/adapter modules (static source assert)

---

## 31. Action test matrix

File: `crm-activity-actions.test.ts`

- malformed FormData → `VALIDATION_FAILED` + deterministic `fieldErrors`
- `CrmError` → action `code` / safe message
- unexpected → `RPC_FAILED`
- success revalidates only `/admin/crm/leads` and `/admin/crm/leads/${leadId}`
- no raw SQL token as user-facing message when mapped

Also extend error-mapping coverage in contracts or service tests for tokens in §21 (critical list from brief).

---

## 32. Performance / query-count

| Operation | Expected queries |
| :--- | :--- |
| Mutation | 1 RPC (+ auth probes already used by context) |
| Lead detail after DTO enrichment | Same Promise.all count as today |
| Outcome catalogue (when wired in 2A-5) | +1 SELECT once per page |
| Owner labels | Existing batch map — no per-activity profile query |

No denormalization.

---

## 33. Logging / PII boundary

CRM server modules currently avoid ad-hoc logging. Keep that:

- Do not log completion notes, WhatsApp bodies, phones, emails, addresses.
- If catching unexpected errors, prefer code + lead/activity UUIDs only where an existing pattern appears.

---

## 34. Implementation checklist (later authorization)

- [ ] Re-link managed project; confirm tip `20260828140000` + pending NONE + five RPCs exist
- [ ] Confirm SLA still inactive (read-only)
- [ ] TDD: write contract tests → implement `activity-contracts.ts`
- [ ] Extend `crm-errors.ts` + mapping tests (token order)
- [ ] Implement adapters → service → actions
- [ ] Enrich DTOs + repository select/map
- [ ] Add `fetchActiveActivityOutcomeOptions`
- [ ] Regenerate `database.generated.ts` (local)
- [ ] Add tests to `package.json` `test:app`
- [ ] `npm run check` + CRM unit tests + Application Quality suite
- [ ] Confirm **no** migration files; **no** UI component diffs; **no** `supabase db push`
- [ ] Do not deploy unless separately authorized

---

## 35. Acceptance criteria

1. Five adapters call the five public RPCs with exact `p_*` args.
2. Discriminated complete union cannot represent CLOSED_WON.
3. All §21 tokens map to stable codes/messages/statuses; activity tokens win over generic not-found.
4. Legacy lead-detail UI still compiles and behaves unchanged.
5. Enriched follow-up DTO includes 2A-1 fields without removing legacy fields.
6. Outcome catalogue query returns active rows only, ordered by `display_order`.
7. Server actions return bounded states; revalidate only CRM lead paths.
8. No SQL migration; no managed mutation; no SLA activation.
9. Tests cover contracts, error mapping, adapters/service, actions.
10. `npm run check` and `test:app` (with new files) pass.

---

## 36. Owner decisions remaining

| # | Topic | Recommendation | Status |
| :--- | :--- | :--- | :--- |
| A | Dedicated `crm-activity-adapters.ts` | **YES** | **Closed from evidence** |
| B | Outcome catalogue query in 2A-4 | **YES** (function only; no page UI wire) | **Closed** |
| C | Enrich lead-detail activity DTO now | **YES** additive | **Closed** |
| D | Server actions in 2A-4 | **YES** | **Closed** |
| E | Zod | **NO** | **Closed** |
| F | Regenerate Supabase types | **YES** from local | **Closed** (regen required for clean typing) |
| G | Managed tip re-verify before coding | **Required gate** | **CLOSED** (owner 2026-08-27) |
| H | WhatsApp evidence picker read helper in 2A-4 | **Defer to 2A-5** (contract field only now) | **CLOSED** — not implemented |
| I | Deploy after 2A-4 merge | **Not assumed**; unused until 2A-5 | **CLOSED** — no default deploy |

---

## 37. STOP conditions — audit result

| Condition | Result |
| :--- | :--- |
| origin/main differs | **NO** — matches |
| managed tip differs | **Unknown independently** — owner-attested match; re-verify before code |
| open PR overlaps | **NO** |
| five RPCs missing in SQL | **NO** |
| RPC signatures differ from plan | **NO** — match merged SQL |
| 2A-4 requires SQL migration | **NO** |
| outcome catalogue unreadable without DB change | **NO** (RLS allows SELECT) |
| architecture conflict | **NO** |
| UI contracts cannot be preserved | **NO** (additive) |
| WhatsApp intent impossible without redesign | **Gap documented**; completable via inbox `intentId` / future deep-link — **not STOP** for contracts |
| Closed Won representable | **Prevented by union** |
| assign/reassign / SLA / payment / M38 required | **NO** |

**Overall:** Plan is safe to finalize for owner review. Implementation must not start until managed re-verify gate (G) passes.

---

## 38. Success messages (stable)

| Action | Message |
| :--- | :--- |
| Create | Activity created. |
| Reschedule | Activity rescheduled. |
| Transfer | Activity owner updated. |
| Designate | Primary next action updated. |
| Complete NONE / NEXT_PRIMARY | Activity completed. |
| Complete ON_HOLD | Activity completed and lead placed on hold. |
| Complete CLOSED_LOST | Activity completed and lead closed lost. |

---

## 39. Deployment boundary

Do not deploy during planning or by default after merge. New actions are unused until 2A-5; deployment is a separate owner decision.

---

## 40. Out of scope (explicit)

Activity composer UI, cards redesign, My Day, Calendar, Pipeline, Overview/Reports/nav, assign/reassign, First Contact auto-task, import First Contact opt-in, SLA settings/activation/business hours, cadence, notifications, AI, payment/commerce, M38, production deploy.

---

## 41. Release-train position

`2A-1` DB foundation → `2A-2` SLA foundation → `2A-3` activity RPCs → **`2A-4` app service + contracts (this plan)** → `2A-5` lead-detail activity UX → …
)
