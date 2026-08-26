# CRM 2A-3 — Implementation Plan (Activity RPCs + Complete-With-Next)

> **For agentic workers:** Do **not** execute this plan until the owner explicitly authorizes coding. When authorized, implement **database/RPC + pgTAP only** — no application service, no React/UI, no My Day, no assign wiring, no SLA activation, no managed apply until separately authorized.

**Goal:** Add structured activity mutation RPCs (`create` / `reschedule` / `transfer` / `designate` / `complete`) with atomic complete-with-next, On Hold review primary, Closed Lost via existing transition, Call + governed-WhatsApp first-contact attempt marking — while preserving legacy follow-up RPCs and inactive SLA policy.

**Architecture:** Forward-only SQL after CRM 2A-2; lead-scoped `FOR UPDATE` serialization; INVOKER public wrappers → DEFINER private impls; `crm_user_can_operate_lead` for target-owner checks; Closed Won remains quotation-acceptance exclusive.

**Tech stack:** PostgreSQL / Supabase migrations, private SECURITY DEFINER helpers, public SECURITY INVOKER RPC wrappers, existing event/activity summary patterns, pgTAP under `supabase/tests/database/`.

**Document status:** Implementation plan — **coding authorized 2026-08-26; implementation in progress on `crm-2a3-activity-rpc-workflows`**  
**Plan date:** 2026-08-26  
**Owner correction (locked):** WhatsApp first-contact attempt time uses `public.whatsapp_messages.provider_timestamp` (NOT `created_at`).  
**Specs:** [crm-2.0-roadmap.md](./crm-2.0-roadmap.md), [crm-2a-follow-up-control-plane-design.md](./crm-2a-follow-up-control-plane-design.md), [crm-2a1-implementation-plan.md](./crm-2a1-implementation-plan.md), [crm-2a2-implementation-plan.md](./crm-2a2-implementation-plan.md)

---

## 1. Exact baseline SHA

| Item | Value |
| :--- | :--- |
| **Protected `origin/main`** | `a4a5f676a1ce54dbee076841469e8ecac2692caf` |
| **Verified** | **YES** (`git fetch` + `git rev-parse origin/main`) |
| **Tip commit** | Merge PR #100 — CRM 2A-2 business SLA foundation |
| **Open PRs** | **None** (`gh pr list --state open` → empty) |
| **Worktree used for audit** | `OneDecore-crm-2a2-managed-apply` @ `a4a5f67` (detached, clean) |

---

## 2. Managed Supabase tip

| Item | Value |
| :--- | :--- |
| **Project** | `lpurlfmpvriyvpkujvyl` (`ap-south-1`) |
| **Managed tip** | `20260827140000` / `crm_business_sla_foundation` |
| **Verified** | **YES** (`migration list --linked` + `db push --dry-run` → **Remote database is up to date**) |
| **Pending** | **NONE** |
| **Production SLA** | Inactive / unconfigured (locked) |
| **Deferred payment M38** | **Absent** / untouched |

---

## 3. Repository audit findings

### 3.1 Migration inventory

| Fact | Evidence |
| :--- | :--- |
| Migration file count | **41** under `supabase/migrations/` |
| Latest timestamp | `20260827140000_crm_business_sla_foundation.sql` |
| Candidate `20260828140000_…` | **Absent** (free) |
| Conceptual payment M38 | **Absent** |
| Open PR collisions | **None** |

### 3.2 Current 2A-1 / 2A-2 object inventory (actual)

| Object | Role for 2A-3 |
| :--- | :--- |
| `public.lead_follow_ups` | Activity SoT; 2A-1 columns present (`activity_type`, `title`, `priority`, `is_primary_next_action`, `outcome_code`, `completion_note`, `source`, …); free-text `outcome` still used by legacy complete |
| `public.lead_activity_outcome_codes` | Structured outcomes; Call `closes_contact_attempt=true` includes voicemail; `whatsapp_sent` = **false** |
| `public.lead_follow_up_events` | Detailed audit allowlist already includes reschedule/transfer/primary/outcome events |
| `public.crm_sla_clocks` | `first_contact_attempt_at` column exists; **no writer yet** |
| `public.crm_sla_policies` | Seed inactive; must stay inactive in 2A-3 |
| `private.ensure_first_contact_sla_clock` | Exists; Option A snapshot; FOR SHARE on new-clock path |
| `private.mark_first_contact_attempt_if_qualifying` | **ABSENT** (must create in 2A-3) |
| `private.crm_user_can_operate_lead(p_user_id, p_lead_id, p_capability)` | Exists; evaluates **target user**, not `auth.uid()`; **not wired** into legacy create/complete yet |
| `private.transition_lead_status_impl` | `on_hold` requires reason; `closed_lost` requires reason; **`closed_won` hard-blocked** |
| `private.accepted_quotation_close_won_impl` | Exclusive Closed Won path |
| Legacy public RPCs | `create_lead_follow_up(uuid,timestamptz,uuid)`, `complete_lead_follow_up(uuid,text)`, `cancel_lead_follow_up(uuid,text)` — still used by deployed lead UI |

### 3.3 Lock-order precedents

| Path | Lock |
| :--- | :--- |
| `create_lead_follow_up_impl` | **Lead `FOR UPDATE` first**, then auth/auto-primary |
| `complete_lead_follow_up_impl` / `cancel_*` | Follow-up row `FOR UPDATE` only (**no lead lock**) |
| `transition_lead_status_impl` | Lead `FOR UPDATE` |
| `ensure_first_contact_sla_clock` | Existing clock return unlocked; new clock: policy `FOR SHARE` |
| `update_crm_sla_policy_impl` | Policy `FOR UPDATE` then `clock_timestamp()` |

**2A-3 reconciliation:** All new structured mutations that can change primary / status / attempt must take **lead `FOR UPDATE` first**, then activity row(s), then clock only when marking attempt. Completing without lead lock is insufficient for complete-with-next races.

### 3.4 WhatsApp governed-send evidence (actual)

Success chain (no new tables):

1. `whatsapp_send_intents.lifecycle_status = 'dispatch_bound'`
2. `outbound_message_id IS NOT NULL`
3. `conversation_id → whatsapp_conversations.lead_id = activity.lead_id`
4. outbound `whatsapp_messages` row exists for that id
5. provider attempt `status = 'succeeded'` with `provider_message_id` (bind path)

Intent lifecycle does **not** use `sent`/`delivered`/`read`.

**Attempt timestamp (owner-locked correction):** use `whatsapp_messages.provider_timestamp` of the bound outbound message (provider/send event time). Do **not** use `created_at` (local insert time can lag), `send_intent.created_at`, or dispatch-attempt `created_at`.

### 3.5 Application compatibility (deployed)

| Surface | Fact |
| :--- | :--- |
| Lead follow-up UI | Create (due + optional owner); Complete/Cancel **with null free-text outcome** |
| Structured outcome picker | **None** |
| Calls RPCs via | `crm-transition-adapters.ts` → lifecycle service/actions |

**Implication:** 2A-3 must be additive. Legacy create/complete/cancel must keep working unchanged for current UI until 2A-4/2A-5.

### 3.6 Name collision audit

Proposed names `create_lead_activity`, `reschedule_lead_activity`, `transfer_activity_ownership`, `designate_primary_next_action`, `complete_lead_activity`, `mark_first_contact_attempt_if_qualifying`: **ABSENT** in SQL/src (design docs only). **No STOP collision.**

---

## 4. Exact migration timestamp candidate

| Candidate | Value |
| :--- | :--- |
| **Chosen timestamp** | `20260828140000` |
| Rationale | Strictly after `20260827140000`; follows `…140000` convention; collision-free |
| Rejected | Reusing 2A-1/2A-2 filenames; speculative payment timestamps |

---

## 5. Exact proposed migration filename

```text
supabase/migrations/20260828140000_crm_activity_rpc_workflows.sql
```

**pgTAP:** `supabase/tests/database/33_crm_activity_rpc_workflows_test.sql`

---

## 6. Exact RPC list / recommended signatures

Repository style: typed args (not opaque JSONB blobs), public `SECURITY INVOKER` → private `SECURITY DEFINER` impl.

### 6.1 Public wrappers (authenticated)

```text
public.create_lead_activity(
  p_lead_id uuid,
  p_activity_type text,
  p_title text,
  p_due_at timestamptz,
  p_priority text default 'normal',
  p_owner_id uuid default null,
  p_is_primary boolean default false,
  p_duration_minutes integer default null,
  p_reminder_at timestamptz default null,
  p_quotation_id uuid default null
) returns public.lead_follow_ups

public.reschedule_lead_activity(
  p_activity_id uuid,
  p_due_at timestamptz,
  p_reminder_at timestamptz default null,
  p_clear_reminder boolean default false
) returns public.lead_follow_ups

public.transfer_activity_ownership(
  p_activity_id uuid,
  p_new_owner_id uuid
) returns public.lead_follow_ups

public.designate_primary_next_action(
  p_activity_id uuid
) returns public.lead_follow_ups

public.complete_lead_activity(
  p_activity_id uuid,
  p_outcome_code text,
  p_completion_note text default null,
  p_resolution text default null,              -- 'NEXT_PRIMARY' | 'ON_HOLD' | 'CLOSED_LOST' | 'NONE'
  p_next_activity_type text default null,
  p_next_title text default null,
  p_next_due_at timestamptz default null,
  p_next_priority text default null,
  p_next_duration_minutes integer default null,
  p_next_reminder_at timestamptz default null,
  p_next_quotation_id uuid default null,
  p_on_hold_reason text default null,
  p_on_hold_review_at timestamptz default null,
  p_closed_lost_reason text default null,
  p_closure_reason_code text default null,
  p_whatsapp_send_intent_id uuid default null
) returns public.lead_follow_ups
```

**Public create does NOT accept `p_source`.** Forced `source = 'manual'`. Automation sources (`completion_chain`, `on_hold_review`, `sla_auto`, `import`) only via private helpers.

### 6.2 Private helpers (new)

```text
private.create_lead_activity_impl(...)
private.reschedule_lead_activity_impl(...)
private.transfer_activity_ownership_impl(...)
private.designate_primary_next_action_impl(...)
private.complete_lead_activity_impl(...)
private.mark_first_contact_attempt_if_qualifying(
  p_lead_id uuid,
  p_attempt_at timestamptz,
  p_source text,                 -- 'call_outcome' | 'whatsapp_governed_send'
  p_outcome_code text default null,
  p_activity_type text default null,
  p_whatsapp_send_intent_id uuid default null
) returns public.crm_sla_clocks
```

Optional internal helpers (not public): demote-open-primary, emit event, validate outcome for activity type, validate WhatsApp evidence.

### 6.3 Legacy RPCs (unchanged public contracts)

Keep signatures and free-text behavior for one release. Prefer **minimal** shared helpers only if needed for lock-order parity; do **not** force structured `outcome_code` onto legacy complete.

---

## 7. Lock-order design (deterministic)

**Canonical LEAD-SCOPED mutation order for all new 2A-3 RPCs that mutate primary/status/attempt:**

1. Resolve `lead_id` (from args or activity row without lock, then re-validate).
2. `SELECT … FROM public.leads WHERE id = … FOR UPDATE`.
3. Re-check actor auth **after** lead lock (`authorize` + `crm_can_mutate_lead` / view as applicable).
4. Lock target `lead_follow_ups` row(s) `FOR UPDATE` (current activity; current open primary if demoting).
5. If marking first-contact attempt: ensure clock (idempotent; no due rescope), then lock `crm_sla_clocks` `FOR UPDATE` for that lead.
6. Capture **one** operation timestamp: `v_now := clock_timestamp()` **after** locks (matches 2A-2 activation serialization lesson).
7. Mutate + write bounded `lead_follow_up_events` (+ summary `lead_activities` only where listed below).
8. Postcondition checks (≤1 open primary; On Hold / terminal invariants).
9. Commit / return.

**Do not** introduce advisory-lock subsystem.

**Partial unique index** `uq_lead_follow_ups_one_primary_open` remains final integrity backstop.

---

## 8. Create activity semantics

| Rule | Behavior |
| :--- | :--- |
| Auth | Authenticated; `crm.follow_ups.manage`; lead mutable |
| Owner default | `coalesce(p_owner_id, auth.uid())` |
| Executive self-only | If actor lacks broad lead read (`crm_has_broad_lead_read` / `leads.read_all` pattern as today), `owner_id` must equal actor |
| Manager+ delegation | May set another owner **iff** `private.crm_user_can_operate_lead(target, lead_id, 'crm.follow_ups.manage')` |
| Source | Always `'manual'` on public path |
| Validations | activity_type / title / priority / due / duration / reminder≤due / quotation same-lead / lead not terminal for primary |
| Primary create | If `p_is_primary`: under lead lock, demote existing open primary (flag false + `primary_cleared`), insert new primary (`primary_designated` + `created`); never delete old row |
| Secondary create | Insert non-primary; `created` only |
| Summary | `lead_activities` `follow_up.scheduled` (preserve current create behavior) |

### Owner decision A — CLOSED (recommended)

**Explicit delegated PRIMARY owner:** Managers **MAY** create/designate a primary owned by another authorized operator (`crm_user_can_operate_lead`). Automatic First Contact / completion_chain / on_hold_review owners use **lead assignee** unless assignee missing (then fail closed). 2A-7 reassignment still forces primary ownership to new assignee.

Rationale: design already allows `owner_id ≠ assigned_to` with manager delegation; automatic paths remain assignee-centric for accountability.

---

## 9. Reschedule semantics

| Rule | Behavior |
| :--- | :--- |
| Target | Must be `status = 'open'` |
| Allowed fields | `due_at` required; optional reminder via `p_reminder_at` / `p_clear_reminder` |
| Forbidden | owner transfer; primary flag; type; outcome |
| Due rule | **`p_due_at > v_now`** (reject past/equal) — overdue activities remain completable; reschedule = new future commitment |
| Events | `rescheduled` if due changed; `reminder_changed` only if reminder changed |
| No-op | Same due + same reminder → return row, no events |

---

## 10. Ownership-transfer semantics

| Rule | Behavior |
| :--- | :--- |
| Scope | **SECONDARY only** — reject if `is_primary_next_action` (`PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT`) |
| Auth | Actor manage + broad-scope delegation; target must pass `crm_user_can_operate_lead(..., 'crm.follow_ups.manage')` |
| Open only | Completed/cancelled rejected |
| Same owner | Stable no-op |
| Events | `ownership_transferred` |
| Summary | No new noisy `lead_activities` type (detailed event only) |

---

## 11. Primary-designation semantics

| Rule | Behavior |
| :--- | :--- |
| Target | Open activity on lead |
| Terminal leads | Reject |
| On Hold | Target must be `source = 'on_hold_review'` (or reject non-review primary) |
| Active non-terminal | Any open activity eligible |
| Already primary | Stable no-op |
| Switch | Demote old open primary → `primary_cleared`; set target → `primary_designated` |
| No cancel/delete | Designation only |

---

## 12. Structured outcome rules

| Rule | Behavior |
| :--- | :--- |
| New complete RPC | **`p_outcome_code` required** |
| Catalogue | Active code; if `activity_types` non-empty, must include current `activity_type` |
| Completion note | Optional; bounded (reuse 2A-1 length limits) |
| Writes | Set `outcome_code`, `completion_note`; set legacy `outcome` to a **stable display string** derived from catalogue `display_name` (or code) so old UI readers showing `followUp.outcome` remain coherent |
| Legacy complete | Continues free-text `outcome` only; **does not** require `outcome_code`; **does not** mark SLA attempt |
| No global CHECK | Do not add table CHECK forcing `outcome_code` on all completes (would break legacy) |

---

## 13. Primary vs secondary complete semantics

| Case | Required `p_resolution` | Behavior |
| :--- | :--- | :--- |
| Completing **primary** on active non-terminal assigned lead | Exactly one of `NEXT_PRIMARY` \| `ON_HOLD` \| `CLOSED_LOST` | Missing → `NEXT_ACTION_REQUIRED` |
| Completing **secondary** | `NONE` allowed **only if** after completion an open primary still exists **or** lead is already terminal | Else `NEXT_ACTION_REQUIRED` |
| Secondary may also choose | `NEXT_PRIMARY` / `ON_HOLD` / `CLOSED_LOST` | Same atomic paths as primary |
| Already `closed_won` / `closed_lost` | `NONE` (or null treated as NONE) | Complete activity only; **no** status transition; no next primary required |
| Active lead + resolution token `CLOSED_WON` / closed_won | **Reject** `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` | |

### Owner decision C — CLOSED (recommended)

Secondary `NONE` only when a valid open primary remains or lead is already terminal.

---

## 14. NEXT_PRIMARY atomic workflow

Under lead + activity locks, one `v_now`:

1. Validate outcome (+ WhatsApp evidence if needed).
2. Complete current activity (`status=completed`, clear primary flag if was primary, set completed_*).
3. Mark first-contact attempt if qualifying (clock lock).
4. Demote any remaining open primary if current was secondary and resolution replaces it.
5. Insert next primary: `source='completion_chain'`, `is_primary_next_action=true`, owner = **lead.assigned_to** (must be non-null and eligible; else fail).
6. Events: `completed`, `outcome_recorded`, `primary_cleared` (as needed), `created` + `primary_designated` for next.
7. Summary: `follow_up.completed` (+ `follow_up.scheduled` for next).
8. Postcondition: exactly one open primary.

Rollback restores prior primary if next insert fails.

---

## 15. On Hold atomic workflow

**Via `complete_lead_activity` only in 2A-3** (not by rewriting deployed `transition_lead_status` signature).

1. Require `p_on_hold_reason` (existing transition rules) + `p_on_hold_review_at > v_now`.
2. Complete current activity / clear its primary.
3. Demote/clear any other open primary with audit (`primary_cleared`).
4. Create review activity: `activity_type='internal_task'`, `title='On-hold review'`, `source='on_hold_review'`, `is_primary_next_action=true`, `due_at=p_on_hold_review_at`, owner = `leads.assigned_to`.
5. Call `private.transition_lead_status_impl(lead, 'on_hold', p_reason := p_on_hold_reason)`.
6. Postcondition: lead `on_hold`; exactly one open primary with `source='on_hold_review'`.

**Compatibility path:** Existing public `transition_lead_status` → `on_hold` remains available for current UI (reason-only). Strict “review date required on every on_hold entry” is enforced on the **new complete path** now; global transition hardening deferred to when lead UI migrates (2A-5) unless a separate owner auth expands it earlier.

No customer-contact cadence while held. No mass cancel of secondaries unless design later requires (not in 2A-3).

---

## 16. Closed Lost workflow

1. Complete activity with structured outcome.
2. Clear current primary flag if needed; ensure no open primary remains (demote others with audit — **do not mass-delete**; open secondaries may remain).
3. `private.transition_lead_status_impl(..., 'closed_lost', p_reason, p_closure_reason_code)` using existing reason contract.
4. Postcondition: `closed_lost`; **zero open primaries**.

No second status state machine.

---

## 17. Closed Won hard boundary

| Rule | Behavior |
| :--- | :--- |
| No 2A-3 path to manufacture `closed_won` | Resolution token / status arg rejected |
| Exclusive authority | `private.accepted_quotation_close_won_impl` unchanged |
| Already `closed_won` | Allow completing remaining open activities with `NONE`; no status change; no next primary required |
| Error | `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` (reuse existing text/SQLSTATE style) |

---

## 18. Call qualifying-attempt logic

`private.mark_first_contact_attempt_if_qualifying` from complete path when:

| Gate | Rule |
| :--- | :--- |
| Activity type | **Must be `'call'`** (catalogue `closes_contact_attempt` alone is insufficient) |
| Outcome | Active + allowed for type + `closes_contact_attempt = true` (includes voicemail) |
| Clock | `ensure_first_contact_sla_clock(lead)` first — **must not** fill existing NULL `sla_due_at` |
| Timestamp | `v_now` (post-lock `clock_timestamp()` of complete operation) |
| Immutability | Set only if `first_contact_attempt_at IS NULL`; never move later |
| Non-call types | Even if catalogue says closes_contact_attempt, **do not mark** |

Works while SLA policy inactive (supports New Uncontacted). No `breached_at` writer.

---

## 19. WhatsApp governed evidence strategy

### Owner decision B — CLOSED (recommended)

`activity_type='whatsapp'` + `outcome_code='whatsapp_sent'` **requires** `p_whatsapp_send_intent_id` that passes evidence chain. Missing/invalid → reject (`WHATSAPP_SEND_EVIDENCE_REQUIRED` / `WHATSAPP_SEND_EVIDENCE_INVALID`). Do **not** silently complete as non-qualifying while claiming `whatsapp_sent`.

Evidence checks (all required):

- Intent exists; `lifecycle_status = 'dispatch_bound'`
- `outbound_message_id` non-null
- Conversation `lead_id` = activity lead
- Outbound message row exists
- Succeeded provider dispatch attempt bound to intent

**Attempt time (owner-locked):** outbound message `provider_timestamp`. Validate `provider_timestamp >= crm_sla_clocks.clock_started_at` (ensure clock first if absent). If clock already has attempt, leave unchanged.

No new WhatsApp evidence table.

---

## 20. `first_contact_attempt_at` timestamp rule

| Source | Timestamp used |
| :--- | :--- |
| Call qualification | Complete operation `v_now` (`clock_timestamp()` after locks) |
| WhatsApp qualification | Bound outbound `whatsapp_messages.provider_timestamp` (NOT `created_at`) |
| Already set | No-op (immutable) |
| Clock missing | Ensure first (NULL due if inactive/out-of-scope), then mark |
| Policy inactive | Allowed to set attempt; never activate policy / recompute due |

---

## 21. Legacy RPC compatibility

| RPC | 2A-3 plan |
| :--- | :--- |
| `create_lead_follow_up` | Keep; optionally later share lead-lock helpers — **no signature change** |
| `complete_lead_follow_up` | Keep free-text; **no** structured outcome; **no** SLA attempt mark; **no** complete-with-next |
| `cancel_lead_follow_up` | Keep |

Do not add constraints that make legacy complete impossible. New RPCs unused by app until 2A-4/2A-5.

---

## 22. Audit-event matrix

| Operation | `lead_follow_up_events` | `lead_activities` summary |
| :--- | :--- | :--- |
| Create secondary | `created` | `follow_up.scheduled` |
| Create/replace primary | `primary_cleared` (old), `created`, `primary_designated` | `follow_up.scheduled` |
| Reschedule | `rescheduled` (+ `reminder_changed` if needed) | none |
| Transfer | `ownership_transferred` | none |
| Designate | `primary_cleared`, `primary_designated` | none |
| Complete | `completed`, `outcome_recorded`, `primary_cleared` as needed | `follow_up.completed` |
| Next primary | `created`, `primary_designated` | `follow_up.scheduled` |
| On Hold review | as create primary + status.changed via transition | existing status + schedule summaries |
| Cancel (legacy) | unchanged | `follow_up.cancelled` |

No fabricated history. No `follow_up.sla_breached` emissions. No `follow_up.auto_created` (2A-7).

JSON payloads: bounded (`pg_column_size` ≤ existing 2048 pattern).

---

## 23. lead_activities summary strategy

Preserve existing summary types. Add **no** new noisy types in 2A-3. Detailed mutations live in `lead_follow_up_events`.

---

## 24. Error contracts (stable)

Align names to existing style where present; otherwise introduce these public-facing exceptions:

| Code / message key | When |
| :--- | :--- |
| `ACTIVITY_NOT_FOUND` | Missing id |
| `ACTIVITY_NOT_OPEN` | Complete/reschedule/transfer/designate on non-open |
| `LEAD_NOT_FOUND` | Missing lead |
| `ACTIVITY_OWNER_NOT_AUTHORIZED` | Target owner fails `crm_user_can_operate_lead` / actor cannot delegate |
| `PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT` | Transfer of primary |
| `ACTIVITY_OUTCOME_REQUIRED` | Missing outcome_code on new complete |
| `ACTIVITY_OUTCOME_INVALID` | Unknown/inactive code |
| `ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE` | Catalogue type restriction |
| `NEXT_ACTION_REQUIRED` | Primary/secondary complete without valid resolution |
| `NEXT_PRIMARY_INVALID` | Bad next payload |
| `ON_HOLD_REVIEW_REQUIRED` | Missing/past review date |
| `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` | Attempted closed_won path |
| `WHATSAPP_SEND_EVIDENCE_REQUIRED` | whatsapp_sent without intent id |
| `WHATSAPP_SEND_EVIDENCE_INVALID` | Evidence fails chain / wrong lead |
| `ACTIVITY_DUE_MUST_BE_FUTURE` | Reschedule / next due / review not after `v_now` |

Use `errcode` consistently with repo (`P0001`/`22023`/`42501`/`P0002` as appropriate). Do not leak SQLSTATE internals in app copy (2A-4 concern).

---

## 25. Idempotency decision

**No new idempotency ledger in 2A-3.**

Minimum:

- Complete locks row → non-open → deterministic reject
- Designate already-primary → no-op
- Reschedule same values → no-op
- Transfer same owner → no-op
- Unique primary index backstop
- Attempt mark once

**Owner decision — CLOSED:** Do not add request-idempotency keys unless 2A-4 production retry analysis later requires the smallest existing pattern (e.g. intake-style). Not required for DB correctness now.

---

## 26. Metadata-update RPC decision

### Owner decision D — CLOSED (recommended)

**Do NOT** add generic `update_lead_activity` in 2A-3.  
`reschedule` owns due/reminder. Priority/title/duration edits wait until 2A-4/2A-5 prove need. Event types `priority_changed` remain allowlisted for later.

---

## 27. RLS / grants / security

| Object | Rule |
| :--- | :--- |
| Public RPCs | `GRANT EXECUTE` to `authenticated` only; revoke anon/public |
| Private impls | DEFINER, `search_path=''`, schema-qualified; revoke anon/public; grant authenticated only if INVOKER→DEFINER call requires it (match 2A-1) |
| `mark_*` / ensure | Prefer no authenticated execute on mark; only called from DEFINER complete impl |
| Tables | No new direct INSERT/UPDATE/DELETE for clients on follow-ups/events/clocks |
| Authz | Actor: `crm.follow_ups.manage` + lead operate; target owner via `crm_user_can_operate_lead` |

---

## 28. SLA production state (must remain OFF)

2A-3 **MUST NOT**:

- activate `crm_sla_policies`
- seed/configure `business_hours_config`
- set `effective_from` / `activated_at`
- recompute / fill `sla_due_at`
- write `breached_at`

Allowed runtime clock write: **`first_contact_attempt_at` only** via mark helper.

---

## 29. Expected changed files (when coding authorized)

| Path | Action |
| :--- | :--- |
| `supabase/migrations/20260828140000_crm_activity_rpc_workflows.sql` | **Create** |
| `supabase/tests/database/33_crm_activity_rpc_workflows_test.sql` | **Create** |
| `docs/product/crm-2a3-implementation-plan.md` | This plan (evidence updates after impl) |
| Inventory pin tests | **Only if** migration count/latest pins require (41→42) |
| `src/types/database.generated.ts` | Only if repo convention requires |

**Must not change:** React/UI, My Day, assign/reassign, SLA settings, payments/M38, managed apply in the coding turn unless separately authorized.

If app runtime becomes required for DB correctness → **STOP**.

---

## 30. pgTAP matrix (candidate ~90–120 assertions)

**File:** `33_crm_activity_rpc_workflows_test.sql`

Cover areas from authorization §29: schema/RPC existence; create/reschedule/transfer/designate/complete happy + deny paths; primary vs secondary resolution; Call attempt marking (connected/no_answer/busy/callback/voicemail; non-call does not mark; immutability); WhatsApp evidence reject/accept; On Hold; Closed Lost; Closed Won reject; already-won complete; legacy RPC still green; lock-order `pg_get_functiondef` assertions; security grants; SLA policy still inactive after suite; regression of suites 01–32.

**Concurrency:** Prefer lock-order architecture assertions (repo pattern from 31/32). Full two-session harness only if already available and low-cost — do not add infrastructure.

---

## 31. Concurrency / locking tests

| Scenario | Mechanism |
| :--- | :--- |
| Dual primary create/designate | Lead FOR UPDATE + unique index |
| Complete vs designate | Lead + activity locks |
| Double complete | Activity FOR UPDATE → second `ACTIVITY_NOT_OPEN` |
| Reschedule vs complete | Same |
| Attempt immutability | Clock FOR UPDATE + NULL-only set |
| Architecture | `position('for update')` before mutate / `clock_timestamp` after locks |

---

## 32. Local validation plan (when coding authorized)

1. Branch from `origin/main` @ `a4a5f67…`
2. Migration + pgTAP + pin updates only
3. `npx supabase db reset`
4. Full `supabase test db`
5. `supabase db lint --local --level warning`
6. App inventory pin tests if pins change
7. `npm run check` if required by CI
8. **Do not** managed-apply / activate SLA / deploy until separate authorization

---

## 33. Forward-only failure strategy

- Never rewrite applied 2A-1/2A-2 migrations
- Never `migration repair` without owner auth
- If managed apply later fails: capture SQLSTATE + statement; stop; forward-only repair decision
- Partial unique primary index remains last line of defense

---

## 34. Owner decisions

| # | Topic | Status |
| :--- | :--- | :--- |
| **A** | Manager may create/designate primary for another authorized owner | **LOCKED YES** (auto paths use assignee) |
| **B** | `whatsapp_sent` without governed evidence | **LOCKED REJECT** |
| **C** | Secondary complete `NONE` only if primary remains or lead terminal | **LOCKED** |
| **D** | Generic metadata update RPC in 2A-3 | **LOCKED NO** |
| **E** | Idempotency ledger | **LOCKED NO** for 2A-3 |
| **F** | Global `transition_lead_status` on_hold review-date enforcement | **DEFER** — enforce on new complete path now; keep legacy transition compatible until UI migrates |

**No remaining blockers** for authorizing 2A-3 coding after this plan.

---

## 35. Implementation checklist (when authorized)

- [x] Branch from exact main SHA (`crm-2a3-activity-rpc-workflows` @ `a4a5f67`)
- [x] Migration filename collision-free (`20260828140000_crm_activity_rpc_workflows.sql`)
- [x] Private mark helper + five public RPC pairs
- [x] Lead-first lock order + post-lock `clock_timestamp()`
- [x] Complete-with-next / On Hold / Closed Lost / Closed Won boundary
- [x] Call + WhatsApp attempt marking without SLA activation (`provider_timestamp` for WA)
- [x] Legacy RPCs still green (pgTAP coverage)
- [x] pgTAP 33_… green + full suite regression (`plan(103)`, Result: PASS)
- [x] Inventory pins if needed (41→42)
- [x] Plan evidence section updated (`provider_timestamp` correction)
- [x] PR opened — **no merge/apply/deploy/SLA activation** until authorized (PR #101)

---

## 35b. Implementation evidence (CRM 2A-3)

| Item | Value |
| :--- | :--- |
| Branch | `crm-2a3-activity-rpc-workflows` |
| Worktree | `C:\Users\KESHAV SHARMA\Desktop\OneDecore-crm-2a3-activity-rpc-workflows` |
| Base SHA | `a4a5f676a1ce54dbee076841469e8ecac2692caf` |
| Migration | `supabase/migrations/20260828140000_crm_activity_rpc_workflows.sql` |
| pgTAP | `supabase/tests/database/33_crm_activity_rpc_workflows_test.sql` (`plan(103)`, full suite PASS) |
| Public RPCs | `create_lead_activity`, `reschedule_lead_activity`, `transfer_activity_ownership`, `designate_primary_next_action`, `complete_lead_activity` |
| Private helpers | `*_impl` pairs; `clear_open_primary_for_lead`; `validate_crm_whatsapp_send_evidence`; `mark_first_contact_attempt_if_qualifying` |
| Lock order | lead `FOR UPDATE` → re-auth → activity `FOR UPDATE` → (ensure+clock `FOR UPDATE` when marking) → `clock_timestamp()` → mutate |
| WhatsApp attempt | `whatsapp_messages.provider_timestamp` after evidence chain; receipt bound = `crm_sla_clocks.clock_started_at` |
| Call attempt | post-lock `clock_timestamp()` when `activity_type='call'` + `closes_contact_attempt` |
| On Hold | complete → review primary `source=on_hold_review` → `transition_lead_status_impl(..., 'on_hold', ...)` |
| Closed Lost | complete → clear open primaries → `transition_lead_status_impl(..., 'closed_lost', ...)` |
| Closed Won | resolution `CLOSED_WON` → `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE`; exclusive `accepted_quotation_close_won_impl` |
| Legacy | `create/complete/cancel_lead_follow_up` unchanged; legacy complete does not mark SLA |
| Deviations | None material; owner WhatsApp timestamp correction applied (`provider_timestamp` not `created_at`) |

---

## 36. Acceptance criteria

1. Migration applies cleanly after 2A-2 on reset.  
2. New structured RPCs enforce outcome + complete-with-next invariants.  
3. Call outcomes with `closes_contact_attempt` set `first_contact_attempt_at` once; non-call does not.  
4. WhatsApp qualifies only with same-lead `dispatch_bound` evidence; attempt time from outbound message `provider_timestamp` (not `created_at`).  
5. On Hold via complete creates review primary + uses `transition_lead_status_impl`.  
6. Closed Lost uses existing transition; Closed Won impossible via complete.  
7. Legacy create/complete/cancel still succeed.  
8. SLA policy remains inactive; no dues/hours/breached writers.  
9. No UI/app/My Day/assign changes.  
10. Full pgTAP + lint green.

---

## 37. Explicit non-goals (reminder)

Do **not** implement in 2A-3: `crm-activity-service.ts`, server actions, Zod app contracts, lead-detail UX, My Day RPCs/UI, Overview/Reports/nav, assign/reassign, First Contact auto-create, bulk-import opt-in, SLA settings UI, production hours/activation, Calendar, Pipeline, cadences, notifications, AI, commerce/payments, M38, production deploy, breach daemon.

---

## 38. Migration order (inside single forward migration)

1. Preflight comments / collision guards  
2. `private.mark_first_contact_attempt_if_qualifying` (+ evidence validator helper if needed)  
3. create impl + public wrapper  
4. reschedule impl + wrapper  
5. transfer impl + wrapper  
6. designate impl + wrapper  
7. complete-with-next impl + wrapper (calls mark + transition)  
8. Grants/revokes / search_path / ownership  
9. Comments  
10. Postconditions: SLA policy still inactive; no non-null production dues invented; RPC privileges correct  

No data backfill expected.

---

## Revision history

| Date | Change |
| :--- | :--- |
| 2026-08-26 | Initial CRM 2A-3 implementation plan from audit @ `a4a5f67` / managed tip `20260827140000` |
| 2026-08-26 | Owner correction: WhatsApp attempt uses `provider_timestamp` not `created_at`; implementation evidence added |
