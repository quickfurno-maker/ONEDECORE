# CRM 2A-1 — Implementation Plan (Database Foundation Only)

> **For agentic workers:** Do **not** execute this plan until the owner explicitly authorizes coding. When authorized, use task-by-task execution with pgTAP first. REQUIRED process: fail closed on any STOP condition in §16.

**Goal:** Evolve `public.lead_follow_ups` into structured Activities with primary-next-action uniqueness, outcome catalogue, append-only `lead_follow_up_events`, owner-aware private auth helper, indexes, and pgTAP — without breaking existing create/complete/cancel RPCs.

**Architecture:** Forward-only SQL migration after latest repo migration; defaults + minimal private RPC updates for compatibility; no parallel task table; no SLA/My Day/workflow slices.

**Tech stack:** PostgreSQL / Supabase migrations, private SECURITY DEFINER helpers, `private.forbid_append_only_mutation`, pgTAP under `supabase/tests/database/`.

**Document status:** Implementation plan — **IMPLEMENTED locally (coding authorized 2026-08-26); managed apply / merge / production deploy NOT authorized**  
**Plan date:** 2026-08-26  
**Specs:** [crm-2.0-roadmap.md](./crm-2.0-roadmap.md), [crm-2a-follow-up-control-plane-design.md](./crm-2a-follow-up-control-plane-design.md)

---

## Implementation evidence (2026-08-26)

| Item | Evidence |
| :--- | :--- |
| Branch / worktree | `crm-2a1-activity-foundation` @ `C:\Users\KESHAV SHARMA\Desktop\OneDecore-crm-2a1-activity-foundation` |
| Baseline | `origin/main` @ `c21a22b11b5672e5e24fda0ad981d896991076f8` (verified; no unexpected drift) |
| Migration | `supabase/migrations/20260826120000_crm_activity_control_plane_foundation.sql` |
| pgTAP | `supabase/tests/database/31_crm_activity_control_plane_foundation_test.sql` (69 assertions) |
| Compatibility | Strategy A — `private.create/complete/cancel_lead_follow_up_impl` updated; no primary-clearing trigger |
| Auth helper | `private.crm_user_can_operate_lead(uuid, uuid, text)` — target-user; not wired to `assign_lead` |
| Quotation | `quotation_id` FK → `quotations(id)` + `private.trg_lead_follow_ups_quotation_same_lead` |
| Indexes | `uq_lead_follow_ups_one_primary_open`; `idx_lead_follow_ups_owner_primary_open_due`; events lead/follow_up created indexes; retained prior follow-up indexes |
| Local validation | `npx supabase db reset` OK; full pgTAP **PASS** (31/31 files); `db lint --local --level warning` OK (pre-existing unrelated warnings only) |
| Types | `database.generated.ts` **not** regenerated (no app/UI consumers in this slice) |
| Companion test | `01_identity_rbac_test.sql` public table inventory **101 → 103**; app inventory pins updated to migration count **40** / latest `20260826120000_…` (payment M38 still fail-closed) |
| Managed Supabase | **Not touched** |
| Deferred payment M38 | **Untouched** |

**Deviations from plan file list:** only the required identity table-count bump in `01_identity_rbac_test.sql`. No UI/RPC/SLA/payment expansion.

---

## 1. Exact baseline SHA

| Item | Value |
| :--- | :--- |
| **Protected `origin/main`** | `c21a22b11b5672e5e24fda0ad981d896991076f8` |
| **Verified** | **YES** (`git fetch` + `git rev-parse origin/main`) |
| **Tip commit** | Merge PR #98 — CRM 2.0 roadmap + CRM 2A design |
| **Open PRs (CRM/migration)** | **None** (`gh pr list --state open` → empty) |

### Worktree note (audit environment)

| Item | Value |
| :--- | :--- |
| Local branch during audit | `docs/crm-2-product-spec` @ `4a6ea219…` (merged tip already on main) |
| Tracked product-doc drift vs `origin/main` | Specs present on `origin/main` |
| Unrelated dirty | `next-env.d.ts` modified; `ONEDECORE_LOCAL_QA.env.txt` untracked — **not** part of 2A-1 |
| Implementation branch (when authorized) | Fresh branch from `origin/main` @ `c21a22b…` — **not** this docs branch |

---

## 2. Repository audit findings

### 2.1 Migration inventory

| Fact | Evidence |
| :--- | :--- |
| Migration file count | **39** under `supabase/migrations/` |
| Latest timestamp | `20260825170000_crm_lead_notes_insert_privilege_repair.sql` |
| Prior | `20260825163000_lead_timeline_taxonomy_v2.sql` |
| Conceptual “M38 payment” | **Absent** (ADR-0033) — distinct from timestamped CRM/timeline repairs |
| Open PR collisions | **None** |

### 2.2 Managed relationship (owner-corrected baseline)

| Migration | Managed status |
| :--- | :--- |
| `20260825163000_lead_timeline_taxonomy_v2.sql` | **APPLIED** |
| `20260825170000_crm_lead_notes_insert_privilege_repair.sql` | **APPLIED** |
| Deferred payment conceptual M38 | **Out of scope / untouched** (ADR-0033) |
| Repository | **39** files through `20260825170000` |

**Do not** describe `20260825163000` / `20260825170000` as potentially pending. **Do not** reapply them.

**Pre-apply gate for 2A-1:** push **only** `20260826120000_crm_activity_control_plane_foundation.sql` after PR merge + owner authorization. Prior CRM/timeline migrations are already on managed.

**This plan does not query or modify managed Supabase.**

### 2.3 Follow-up surface (current)

| Object | Status |
| :--- | :--- |
| `public.lead_follow_ups` | Exists — minimal columns (see §3) |
| `public.create_lead_follow_up` | SECURITY INVOKER wrapper → private impl |
| `private.create_lead_follow_up_impl` | Inserts `lead_id, owner_id, due_at, status, created_by` only |
| `private.complete_lead_follow_up_impl` | Sets status completed + outcome; **no primary flag** |
| `private.cancel_lead_follow_up_impl` | Sets status cancelled + outcome; **no primary flag** |
| Mutations | Via RPC only — authenticated has **SELECT only** on table |
| RLS | `lead_follow_ups_select` via lead visibility |

### 2.4 Auth helpers (actor-bound)

| Helper | Binds to |
| :--- | :--- |
| `public.authorize` / `private.has_permission` | `auth.uid()` |
| `private.crm_can_view_lead(p_assigned_to)` | Current user + assignee match |
| `private.crm_can_view_lead_by_id` | Uses `crm_can_view_lead` → **current actor** |
| `private.crm_can_mutate_lead` | **Current actor** + permissions |
| `private.crm_is_eligible_follow_up_owner(p_user_id)` | **Target user** active profile + CRM sales roles (exists today; eligibility only, not lead-scoped operate) |

**Canonical active-user state:** `public.profiles.status = 'active'` (plus active `roles` / `user_roles`). Confirmed.

### 2.5 Append-only pattern

`private.forbid_append_only_mutation()` + triggers on `lead_activities`, notes, assignment history, touchpoints. **Reuse for `lead_follow_up_events`.**

### 2.6 Quotation root

`public.quotations` (`20260812140000`):

- `id` PK
- `lead_id uuid not null unique` → `leads(id)`
- 1:1 lead ↔ quotation root

Safe FK target for optional `lead_follow_ups.quotation_id`.

### 2.7 Existing pgTAP CRM tests

| File | Relevance |
| :--- | :--- |
| `05_crm_identity_core_foundation_test.sql` | create/complete/cancel follow-up + RLS |
| `07_crm_assignment_mutations_test.sql` | open follow-ups block unassign/reassign |
| `10_crm_sales_targets_reporting_test.sql` | `idx_lead_follow_ups_owner_status_due` |
| `30_crm_lead_notes_insert_privilege_repair_test.sql` | Notes privilege |

New suite should be **`31_…`** to follow numbering.

---

## 3. Current schema / function / index evidence

### 3.1 `lead_follow_ups` columns today

From `20260730184426_crm_identity_core_foundation.sql`:

| Column | Notes |
| :--- | :--- |
| `id` | uuid PK |
| `lead_id` | FK → leads |
| `owner_id` | FK → profiles |
| `due_at` | timestamptz NOT NULL |
| `status` | `open` \| `completed` \| `cancelled` |
| `outcome` | free text nullable |
| `created_by` / `completed_by` / `cancelled_by` | |
| `completed_at` / `cancelled_at` / `created_at` | lifecycle CHECK |

**Absent today:** `activity_type`, `title`, `priority`, `is_primary_next_action`, `duration_minutes`, `reminder_at`, `outcome_code`, `completion_note`, `quotation_id`, `source`, `updated_at`.

### 3.2 Indexes today

| Index | Definition |
| :--- | :--- |
| `idx_lead_follow_ups_lead_due` | `(lead_id, due_at)` |
| `idx_lead_follow_ups_owner_status_due` | `(owner_id, status, due_at)` *(M16 / `20260803140000`)* |

**Keep both.** Add non-duplicates in §8.

### 3.3 Create insert shape (breakage risk)

```sql
insert into public.lead_follow_ups (
  lead_id, owner_id, due_at, status, created_by
) values (...);
```

Any new **NOT NULL without DEFAULT** breaks create. Plan uses **DEFAULT** on all new NOT NULL columns (§7).

### 3.4 Complete/cancel update shape (primary risk)

```sql
update ... set status = 'completed'|'cancelled', outcome = ..., completed_*/cancelled_* = ...
```

Does **not** clear a future `is_primary_next_action`. Partial unique index (`status = 'open' AND is_primary_next_action`) would still allow `completed` + `primary = true`, but semantic rule requires primary only when open → **must clear flag** (see §9).

---

## 4. Collision audit

| Check | Result |
| :--- | :--- |
| Open PRs touching CRM/migrations | **None** |
| Filename `20260827140000_crm_activity_control_plane_foundation.sql` | **Absent** (free) |
| Filename `20260826120000_crm_activity_control_plane_foundation.sql` | **Absent** (free) |
| Parallel task table already exists | **No** |
| `lead_activity_outcome_codes` exists | **No** |
| `lead_follow_up_events` exists | **No** |
| `next_action_*` on `leads` | **No** (must remain absent) |
| `crm_user_can_operate_lead` exists | **No** |

**No STOP collisions found for planning.**

---

## 5. Exact migration timestamp candidate

| Candidate | Value |
| :--- | :--- |
| **Chosen timestamp** | `20260826120000` |
| Rationale | Strictly after `20260825170000`; calendar-aligned to plan date; collision-free |
| Rejected placeholder | Do **not** reuse speculative older placeholders without checking — `20260827140000` also free but later than needed |

---

## 6. Exact proposed migration filename

```text
supabase/migrations/20260826120000_crm_activity_control_plane_foundation.sql
```

---

## 7. Exact tables / columns / functions / indexes affected

### 7.1 ALTER `public.lead_follow_ups` — add columns

| Column | Type / default | Constraints |
| :--- | :--- | :--- |
| `activity_type` | `text NOT NULL DEFAULT 'call'` | CHECK allowlist |
| `title` | `text NOT NULL DEFAULT 'Follow-up'` | length 1–120 |
| `priority` | `text NOT NULL DEFAULT 'normal'` | `low\|normal\|high\|urgent` |
| `is_primary_next_action` | `boolean NOT NULL DEFAULT false` | + CHECK: primary ⇒ status = `open` |
| `duration_minutes` | `smallint NULL` | optional positive bound |
| `reminder_at` | `timestamptz NULL` | CHECK null or `<= due_at` |
| `outcome_code` | `text NULL` | FK → outcome catalogue (nullable) |
| `completion_note` | `text NULL` | max 1000 |
| `quotation_id` | `uuid NULL` | FK → `public.quotations(id)` ON DELETE RESTRICT |
| `source` | `text NOT NULL DEFAULT 'manual'` | `manual\|sla_auto\|completion_chain\|on_hold_review\|import` |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | maintained by RPC updates |

**Activity type allowlist:** `call`, `whatsapp`, `consultation`, `site_visit`, `quotation_follow_up`, `internal_task`.

**Do not add** any `next_action_*` columns to `public.leads`.

### 7.2 New table `public.lead_activity_outcome_codes`

| Column | Notes |
| :--- | :--- |
| `code` | text PK |
| `display_name` | text |
| `activity_types` | text[] (empty = all) |
| `closes_contact_attempt` | boolean — **seed true** for attempt outcomes including **`voicemail`** (for later SLA; unused in 2A-1 runtime) |
| `is_active` | boolean |
| `display_order` | smallint |

**Seed minimum:** `connected`, `no_answer`, `busy`, `callback_requested`, `voicemail`, `not_interested`, `whatsapp_sent`, `consultation_booked`, `needs_manager`, `completed`, `rescheduled`, `quotation_sent`.

### 7.3 New table `public.lead_follow_up_events`

See §11.

### 7.4 Functions

| Function | Action in 2A-1 |
| :--- | :--- |
| `private.create_lead_follow_up_impl` | **Minimal update** — gated auto-primary + events (§9) |
| `private.complete_lead_follow_up_impl` | **Minimal update** — clear primary + events (§9) |
| `private.cancel_lead_follow_up_impl` | **Minimal update** — clear primary + events (§9) |
| `private.crm_user_can_operate_lead` | **NEW** (§8) |
| Public wrappers | Signatures unchanged |

### 7.5 Indexes (new)

| Name | Definition |
| :--- | :--- |
| `uq_lead_follow_ups_one_primary_open` | `UNIQUE (lead_id) WHERE status = 'open' AND is_primary_next_action = true` |
| `idx_lead_follow_ups_owner_primary_open_due` | `(owner_id, due_at) WHERE status = 'open' AND is_primary_next_action = true` |
| `idx_lead_follow_up_events_lead_created` | `(lead_id, created_at DESC)` |
| `idx_lead_follow_up_events_follow_up_created` | `(follow_up_id, created_at DESC)` |

**Optional / skip if redundant:** open-by-lead index — `idx_lead_follow_ups_lead_due` already covers `(lead_id, due_at)`; filter `status = 'open'` in queries is acceptable for 2A-1. Add `idx_lead_follow_ups_lead_open_due` only if EXPLAIN in tests shows need.

**Retain:** `idx_lead_follow_ups_lead_due`, `idx_lead_follow_ups_owner_status_due`.

### 7.6 Explicitly out of migration

No `crm_sla_*`, no `crm.sla.manage`, no assign/reassign behavior changes, no My Day RPCs, no `complete_lead_activity`, no reschedule/designate/transfer public RPCs, no UI.

---

## 8. Exact owner-aware auth helper design

### Signature

```sql
private.crm_user_can_operate_lead(
  p_user_id uuid,
  p_lead_id uuid,
  p_capability text  -- e.g. 'crm.follow_ups.manage'
) returns boolean
```

### Properties

| Property | Value |
| :--- | :--- |
| Schema | `private` only — **no** `public` wrapper |
| Security | `SECURITY DEFINER`, `set search_path = ''` |
| Grants | `REVOKE ALL FROM public, anon, authenticated`; `GRANT EXECUTE TO authenticated` (same pattern as sibling private CRM helpers used by SECURITY DEFINER call chains / tests) |
| Impersonation | **Forbidden** — must not `SET ROLE` / `SET LOCAL ROLE` / change `auth.uid()` |

### Evaluation logic (target user = `p_user_id`)

1. `p_user_id` and `p_lead_id` and `p_capability` non-null; else false.
2. Profile exists and `profiles.status = 'active'`.
3. Target holds **active** role with **active** permission `p_capability` via `user_roles` → `roles` → `role_permissions` → `permissions` (**do not** call `public.authorize` / `private.has_permission` — those bind to caller).
4. Lead exists.
5. Lead visibility for target:
   - **Broad:** target has `leads.read_all` **OR** (`leads.read` AND NOT `leads.read_assigned`) — mirror `crm_has_broad_lead_read` for `p_user_id`; **OR**
   - **Assigned:** target has `leads.read_assigned` AND `leads.assigned_to = p_user_id`.
6. For follow-up operate capability, require `p_capability = 'crm.follow_ups.manage'` (callers pass this explicitly).
7. Return true only if all above hold.

### Privilege amplification

Caller identity is **irrelevant** to the boolean result. A manager invoking the helper cannot make it return true for an unauthorized target. (Later assign RPC still authorizes the **caller** separately via existing assign permissions.)

### 2A-1 usage

- Ship helper + pgTAP only.
- **Do not** wire into `assign_lead` in 2A-1 (later slice).

---

## 9. Existing RPC compatibility strategy

### Decision (architecture-based)

**Choose Strategy A: minimally update existing private complete/cancel (and lightly create) implementations.**

| Strategy | Verdict |
| :--- | :--- |
| **A — Update private complete/cancel (and create)** | **SELECTED** |
| **B — Trigger clears primary when status leaves open** | Rejected as primary mechanism |

**Why A matches this codebase:**

- Follow-up lifecycle mutations already live in `private.*_lead_follow_up_impl` (SECURITY DEFINER), not business triggers.
- Triggers in CRM are used for **append-only forbids** and intake touchpoints — not for clearing workflow flags.
- Authenticated has no direct UPDATE; the only writers are these RPCs → updating them is sufficient and auditable.
- A CHECK constraint `is_primary_next_action = false OR status = 'open'` **fail-closes** if any path forgets to clear primary (complements A; does not replace A).

**Why not B alone:** A trigger would duplicate business rules outside the existing RPC pattern and still needs the CHECK for clarity; B alone without RPC awareness is harder to test alongside outcome/activity logging order.

### Exact compatibility changes

#### Create (`private.create_lead_follow_up_impl`) — **OWNER LOCKED**

1. Keep public signature unchanged.
2. Prefer **explicit column list** including new structured fields (defaults remain for safety).
3. Defaults: `activity_type = 'call'`, `title = 'Follow-up'`, `priority = 'normal'`, `source = 'manual'`.
4. **Auto-primary only when all of the following are true:**
   - lead is **assigned** (`assigned_to IS NOT NULL`)
   - lead is **active / non-terminal** (not `closed_won`, not `closed_lost`)
   - lead is **not** `on_hold`
   - **no open primary** exists for the lead
   - activity **`owner_id` equals `leads.assigned_to`**
5. Otherwise: `is_primary_next_action = false` (secondary).
6. This does **not** introduce the global “exactly one primary for every active assigned lead” invariant — later CRM 2A workflow slices own that.
7. **Prospective events (required):**
   - always emit `created` (`actor_id = auth.uid()`)
   - emit `primary_designated` **if and only if** auto-primary occurs

#### Complete (`private.complete_lead_follow_up_impl`) — **OWNER LOCKED**

1. Capture whether the row was primary before update.
2. `UPDATE`: `status = 'completed'`, clear `is_primary_next_action = false`, set completion fields / free-text `outcome` as today, `updated_at = now()`.
3. **Prospective events (required):**
   - always emit `completed`
   - emit `outcome_recorded` when outcome exists (non-null/non-empty after normalize)
   - emit `primary_cleared` when completing a primary
4. Do **not** implement complete-with-next. Do **not** require `outcome_code` yet.

#### Cancel (`private.cancel_lead_follow_up_impl`) — **OWNER LOCKED**

1. Capture whether the row was primary before update.
2. `UPDATE`: `status = 'cancelled'`, clear `is_primary_next_action = false`, set cancel fields / optional outcome as today, `updated_at = now()`.
3. **Prospective events (required):**
   - always emit `cancelled`
   - emit `primary_cleared` when cancelling a primary

**No fabricated historical lifecycle-event backfill** for existing rows during migration.

### Partial unique index safety

Index only applies to `status = 'open' AND is_primary_next_action`. Clearing primary on complete/cancel keeps semantics clean; CHECK enforces it.

---

## 10. Deterministic backfill design

### Steps (inside migration transaction)

1. `ALTER TABLE` add columns with defaults (all existing rows get defaults; `is_primary_next_action = false` initially).
2. Backfill structured defaults explicitly if needed (idempotent).
3. **Primary designation** for each lead that has ≥1 open follow-up:

```sql
WITH ranked AS (
  SELECT id, lead_id,
    row_number() OVER (
      PARTITION BY lead_id
      ORDER BY due_at ASC NULLS LAST, created_at ASC, id ASC
    ) AS rn
  FROM public.lead_follow_ups
  WHERE status = 'open'
)
UPDATE public.lead_follow_ups f
SET is_primary_next_action = true,
    updated_at = now()
FROM ranked r
WHERE f.id = r.id AND r.rn = 1;
```

**Note (not a contradiction):** this one-time backfill is **index-safety for existing open rows** (at most one open primary). It is **not** the create-RPC auto-primary gate (§9) and does **not** assert the later global “every active assigned lead has a primary” invariant.
4. **Validation (fail closed):**

```sql
-- Exactly one primary among open rows per lead that has open rows
-- Zero leads with >1 open primary
-- Row count of lead_follow_ups unchanged vs pre-migration snapshot
```

Capture counts into `DO $$ … RAISE EXCEPTION` if violation.

5. Create partial unique index **after** validation.
6. **Do not** delete/complete/cancel/merge any historical rows.
7. **Do not** insert fabricated historical lifecycle events for backfill (no migration `created` / `primary_designated` spam). Prospective events apply only to **future** create/complete/cancel RPC calls after migration.

---

## 11. Event-table security design

### Table `public.lead_follow_up_events`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid PK | `gen_random_uuid()` |
| `follow_up_id` | uuid NOT NULL FK → `lead_follow_ups` | |
| `lead_id` | uuid NOT NULL FK → `leads` | |
| `actor_id` | uuid NULL FK → `profiles` | NULL only for true system cases; create uses actor |
| `event_type` | text NOT NULL | allowlist |
| `previous_values` | jsonb NOT NULL DEFAULT `{}` | |
| `new_values` | jsonb NOT NULL DEFAULT `{}` | |
| `reason_code` | text NULL | |
| `reason_note` | text NULL | max 500 |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Event types (CHECK):**  
`created`, `rescheduled`, `ownership_transferred`, `priority_changed`, `primary_designated`, `primary_cleared`, `completed`, `cancelled`, `outcome_recorded`, `reminder_changed`

**Same-lead integrity:** BEFORE INSERT trigger or CHECK via trigger function:

```text
follow_up.lead_id must equal events.lead_id
```

**JSON size:** `pg_column_size(previous_values) + pg_column_size(new_values) <= 4096` (or 2048 each — mirror `lead_activities` 2048 object bound; recommend **2048 per jsonb column**).

**Append-only:**

```sql
CREATE TRIGGER trg_lead_follow_up_events_no_update
  BEFORE UPDATE ON public.lead_follow_up_events
  FOR EACH ROW EXECUTE FUNCTION private.forbid_append_only_mutation();
CREATE TRIGGER trg_lead_follow_up_events_no_delete
  BEFORE DELETE ON public.lead_follow_up_events
  FOR EACH ROW EXECUTE FUNCTION private.forbid_append_only_mutation();
```

**Privileges:**

- `ENABLE ROW LEVEL SECURITY`
- `REVOKE ALL FROM public, anon, authenticated`
- `GRANT SELECT TO authenticated`
- **No** INSERT/UPDATE/DELETE to authenticated
- Writes only from SECURITY DEFINER private RPCs (create/complete/cancel in 2A-1; later reschedule/transfer)

**RLS SELECT:** same pattern as `lead_follow_ups` — exists lead where `crm_can_view_lead(assigned_to)`.

**Complete/cancel/create events (2A-1) — OWNER LOCKED:**

| RPC | Events |
| :--- | :--- |
| create | `created`; + `primary_designated` if auto-primary |
| complete | `completed`; + `outcome_recorded` when outcome exists; + `primary_cleared` when was primary |
| cancel | `cancelled`; + `primary_cleared` when was primary |

No historical backfill events.

---

## 12. Quotation-link decision

| Option | Decision |
| :--- | :--- |
| Add `quotation_id uuid NULL REFERENCES public.quotations(id)` | **YES — include in 2A-1** |
| Enforce same-lead | **YES** — trigger: if `quotation_id` set, `quotations.lead_id = lead_follow_ups.lead_id` |
| Expand quotation domain | **NO** |

Rationale: root table is clear (`quotations.lead_id` unique); integrity trigger is small; nullable keeps legacy rows valid; no weak cross-record link.

If trigger complexity surprises during implementation, defer **enforcement** only (keep nullable FK) — but plan assumes full same-lead check.

---

## 13. Exact expected changed-file list (when coding is authorized)

| Path | Action |
| :--- | :--- |
| `supabase/migrations/20260826120000_crm_activity_control_plane_foundation.sql` | **Created** |
| `supabase/tests/database/31_crm_activity_control_plane_foundation_test.sql` | **Created** |
| `supabase/tests/database/01_identity_rbac_test.sql` | **Updated** public table count 101 → 103 (inventory companion) |
| `src/features/whatsapp/__tests__/phase-6b-integrated-matrix.test.ts` | **Updated** migration inventory pin (40; CRM 2A-1 latest; M38 still absent) |
| `src/features/commerce/__tests__/phase-9d-d2-cart-checkout-tracking.test.ts` | **Updated** latest-migration / count pin |
| `src/features/commerce/__tests__/phase-9d-f-cod-certification.test.ts` | **Updated** latest-migration / count pin |
| `src/features/commerce/__tests__/phase-10-cod-production-readiness.test.ts` | **Updated** migration count pin |
| `src/types/database.generated.ts` | **Skipped** — not required for this DB-only PR |
| `docs/product/crm-2a1-implementation-plan.md` | **Updated** with implementation evidence |

**Must not change in 2A-1:** app CRM UI, My Day routes, assign RPC hardening beyond what’s required for compile (assign untouched), SLA tables, reporting UI.

---

## 14. Exact pgTAP test file(s) and test matrix

**File:** `supabase/tests/database/31_crm_activity_control_plane_foundation_test.sql`

### Schema

- [ ] Columns exist on `lead_follow_ups` as specified
- [ ] `lead_activity_outcome_codes` seeded (≥ listed codes); `voicemail.closes_contact_attempt = true`
- [ ] `lead_follow_up_events` exists
- [ ] Partial unique index exists
- [ ] No `next_action_*` columns on `leads`

### Legacy compatibility

- [ ] `create_lead_follow_up` succeeds (exec + manager patterns from test 05)
- [ ] Create auto-primary **only** when assigned + non-terminal + not on_hold + no open primary + owner = assignee; else secondary
- [ ] Create emits `created`; emits `primary_designated` only when auto-primary
- [ ] `complete_lead_follow_up` succeeds; primary cleared; emits `completed` (+ `outcome_recorded` / `primary_cleared` as applicable)
- [ ] `cancel_lead_follow_up` succeeds; primary cleared; emits `cancelled` (+ `primary_cleared` when applicable)
- [ ] Existing test 05/07 behaviors still pass under full suite
- [ ] No fabricated historical events for pre-migration rows

### Primary invariant

- [ ] Multiple open secondaries allowed
- [ ] One primary + multiple secondary allowed
- [ ] Second open primary same lead → unique violation / rejected
- [ ] Two leads each may have one open primary
- [ ] Deterministic backfill: given fixtures ordered by due/created/id, rank-1 is primary
- [ ] Row count preserved across migration backfill (migration-time assertion + test fixtures)
- [ ] Completed/cancelled cannot remain `is_primary_next_action = true` (CHECK)

### Events

- [ ] UPDATE rejected
- [ ] DELETE rejected
- [ ] lead/follow_up mismatch rejected
- [ ] Authenticated cannot INSERT
- [ ] SELECT scoped to visible leads
- [ ] JSON oversize rejected

### Owner-aware auth

- [ ] Assigned sales exec + own lead + `crm.follow_ups.manage` → true
- [ ] Same exec + other rep’s lead → false
- [ ] Broad manager with permissions → true for team lead
- [ ] User without `crm.follow_ups.manage` → false
- [ ] Inactive profile → false
- [ ] Result depends on `p_user_id`, **not** caller `auth.uid()` (call as manager, assert for exec A vs B)

### Security

- [ ] No public wrapper for `crm_user_can_operate_lead`
- [ ] Anon cannot execute helper
- [ ] Unauthorized direct events DML blocked

### Regression

- [ ] `supabase db reset` + full pgTAP suite
- [ ] DB lint / CI Database Quality
- [ ] Application Quality if generated types regenerated

---

## 15. Forward-only rollout strategy

1. Branch from `origin/main` @ `c21a22b…`.
2. Author migration + pgTAP only.
3. Local: `supabase db reset` → full database tests green.
4. PR → CI green (Database Quality + Application Quality if needed).
5. Owner-authorized managed apply: push **only** `20260826120000` (`20260825163000` / `20260825170000` already applied — do not reapply).
6. No app feature flag required for schema defaults (legacy RPC compatible).
7. No production activation implications for CRM UI (unchanged).

---

## 16. Risks and fail-closed conditions

| Risk | Fail-closed response |
| :--- | :--- |
| Backfill produces >1 open primary | Migration `RAISE EXCEPTION`; abort |
| Create without defaults | Forbidden — must ship defaults |
| Complete/cancel leaves primary true | CHECK fails update — must clear in RPC |
| Fabricated backfill events | **Forbidden** — prospective events only |
| Create auto-primary on unassigned / on_hold / wrong owner | **Forbidden** — must remain secondary |
| Quotation FK to wrong table | Use `public.quotations` only |
| Helper uses `authorize()` | Forbidden — target-user joins only |
| Scope creep (SLA, My Day, assign) | Reject in PR review |
| Reapply `20260825163000` / `20260825170000` | **Forbidden** — already applied |

### STOP conditions (re-check before coding)

Stop and re-report if any become true:

- Migration timestamp collision appears on main
- Open PR modifies same CRM surface
- Managed is **ahead** of repo (unexpected)
- Live open follow-up data cannot satisfy deterministic primary rule (should be impossible with the SQL)
- Quotation model changes

**None of these STOP conditions are true at plan time.**

---

## 17. Implementation checklist (when authorized)

- [ ] Create branch from `c21a22b…`
- [ ] Write failing pgTAP file `31_…` (schema expectations)
- [ ] Author migration `20260826120000_…`
  - [ ] outcome catalogue + seeds
  - [ ] ALTER follow-ups + CHECKs
  - [ ] backfill + validate + unique index
  - [ ] events table + triggers + RLS
  - [ ] quotation same-lead trigger
  - [ ] `crm_user_can_operate_lead`
  - [ ] patch create/complete/cancel impls
- [ ] Expand pgTAP matrix (§14)
- [ ] `supabase db reset` + full suite
- [ ] Regenerate types only if required
- [ ] PR (no managed apply until owner gate)

---

## 18. Acceptance criteria (2A-1)

1. Migration `20260826120000_crm_activity_control_plane_foundation.sql` applies cleanly on reset.
2. Structured columns exist with defaults; **no** `next_action_*` on `leads`.
3. Multiple open activities allowed; **at most one open primary** per lead (unique index).
4. Deterministic backfill preserved all rows; one primary per lead that had open follow-ups.
5. Legacy `create` / `complete` / `cancel` succeed with **owner-locked** event emissions; complete/cancel clear primary.
6. Create auto-primary only under locked conditions (assigned, non-terminal, not on_hold, no open primary, owner = assignee); otherwise secondary.
7. `lead_follow_up_events` append-only; SELECT via lead visibility; no authenticated write; **no historical backfill events**.
8. `lead_activity_outcome_codes` seeded; `voicemail.closes_contact_attempt = true` (for later SLA).
9. `private.crm_user_can_operate_lead` target-user semantics proven in pgTAP.
10. Optional `quotation_id` FK + same-lead enforcement.
11. No SLA / My Day / assign / UI changes shipped.
12. Full pgTAP suite green; CI green on PR.

---

## 19. Owner locks (CRM 2A-1) — CLOSED

| # | Topic | Locked decision |
| :--- | :--- | :--- |
| **1** | Prospective events from legacy RPCs | **SHALL** emit: create → `created` (+ `primary_designated` if auto-primary); complete → `completed` (+ `outcome_recorded` when outcome exists) (+ `primary_cleared` when primary); cancel → `cancelled` (+ `primary_cleared` when primary). **No** fabricated historical backfill. |
| **2** | Legacy create auto-primary | **Only when** assigned + non-terminal + not `on_hold` + no open primary + `owner_id = assigned_to`; else secondary. Does **not** introduce global “exactly one primary per active assigned lead” invariant. |
| **3** | Managed migration baseline | `20260825163000` and `20260825170000` are **APPLIED**. Do not describe as pending. Do not reapply. Deferred payment M38 remains out of scope. |

**No remaining open owner decisions for CRM 2A-1 plan scope.** (Managed apply of `20260826120000` remains a later operational gate after coding PR merge.)

---

## 20. Explicit non-goals (reminder)

Do **not** implement in 2A-1: `crm_sla_policies`, `crm_sla_clocks`, first-contact automation, `effective_from`, `crm.sla.manage`, assign/reassign ownership transfer rules, `complete_lead_activity`, reschedule/designate/transfer RPCs, My Day UI/RPCs, reports/nav, Calendar, Pipeline, cadences, notifications, AI, commerce/payments.

---

## Revision history

| Date | Change |
| :--- | :--- |
| 2026-08-26 | Initial CRM 2A-1 implementation plan from repo audit @ `c21a22b` |
| 2026-08-26 | Owner locks: prospective RPC events; gated create auto-primary; managed `20260825163000`/`20260825170000` applied |
| 2026-08-26 | Implemented: migration + pgTAP + table-count companion; local reset/pgTAP/lint green; managed apply not done |
