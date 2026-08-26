# CRM 2A — Follow-up Control Plane

**Document status:** Approved with owner corrections (2026-08-26) — **no implementation authorized**  
**Baseline:** protected `main` @ `6f07e08bf349ada2cabc96145585b89506e770d8`  
**Date:** 2026-08-26  
**Parent roadmap:** [CRM 2.0 Product Roadmap](./crm-2.0-roadmap.md)

---

## 1. Purpose & scope

CRM 2A turns follow-ups from a passive lead-detail feature into the **daily sales execution control plane**. It introduces **My Day**, evolves `lead_follow_ups` into structured **activities**, enforces the **no open lead without a primary next action** invariant, and adds business-window-aware first-contact SLA automation with manager visibility.

**User-facing terminology:** Activities / Next Action. **Physical table name:** `lead_follow_ups` (no rename in 2A).

### In scope (2A)

- My Day workspace — task buckets + lead-attention sections
- Structured activities on `lead_follow_ups` with **primary next action** semantics
- Activity types, priority, title, duration, reminder, structured outcomes
- Append-only **`lead_follow_up_events`** lifecycle audit
- Business-window first-contact SLA + **`crm.sla.manage`**
- First-contact auto-creation (with safe bulk-import policy)
- Complete-with-next-action flow (reusing existing transition RPCs)
- On Hold with review activity as primary next action
- Manager attention surfaces (in-app only)
- Reporting additions for SLA and execution discipline
- Lead list/detail UX upgrades tied to primary next action

### Explicitly deferred

| Feature | Target phase |
| :--- | :--- |
| CRM Calendar (day/week/month views) | 2B |
| Dedicated advanced Pipeline (`/admin/crm/pipeline`) | 2B |
| Stale/rotting rules & stage thresholds | 2B |
| Saved views | 2B |
| Stage-gate playbooks | 2C |
| Cadences/sequences | 2C |
| Notification centre (push/email/in-app bell) | Post-2A |
| Forecasting & scoring | 2D+ |
| AI suggestions | 2E+ |
| Payment/commerce changes | Out of scope |

### Design constraint

**Evolve, do not duplicate.** `lead_follow_ups` remains the single source of truth for scheduled sales work. `lead_activities` remains the staff-facing cross-domain interaction stream. `lead_follow_up_events` is the detailed authoritative audit for activity lifecycle changes. No parallel task table. **No mutable denormalized `next_action_*` columns on `leads` in 2A.**

---

## 2. Baseline audit (current repository)

### 2.1 Data model — `lead_follow_ups`

**Migration:** `20260730184426_crm_identity_core_foundation.sql`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `lead_id` | uuid FK → leads | |
| `owner_id` | uuid FK → profiles | May differ from lead assignee (delegation) |
| `due_at` | timestamptz | Required |
| `status` | text | `open` \| `completed` \| `cancelled` |
| `outcome` | text nullable | Free text, 1–1000 chars when set |
| `created_by` | uuid | |
| `completed_by` / `cancelled_by` | uuid nullable | |
| `completed_at` / `cancelled_at` | timestamptz nullable | |
| `created_at` | timestamptz | |

**Indexes today**

- `idx_lead_follow_ups_lead_due` — `(lead_id, due_at)`
- `idx_lead_follow_ups_owner_status_due` — `(owner_id, status, due_at)` *(M16)*

**Gaps:** no activity type, title, priority, primary flag, duration, reminder, structured outcome, quotation link, source/automation flag, lifecycle event audit, or primary-next-action constraint.

### 2.2 RPCs — follow-up lifecycle

| Public RPC | Private impl | Behavior |
| :--- | :--- | :--- |
| `create_lead_follow_up` | `private.create_lead_follow_up_impl` | Auth: `crm.follow_ups.manage`; writes `follow_up.scheduled` to `lead_activities` |
| `complete_lead_follow_up` | `private.complete_lead_follow_up_impl` | Outcome optional; no next-action requirement |
| `cancel_lead_follow_up` | `private.cancel_lead_follow_up_impl` | Outcome optional |

**Missing:** reschedule, complete-with-next (atomic), primary designation, business-SLA helpers, My Day queue RPC.

### 2.3 Activity & event model

**`lead_activities`** — append-only staff-facing stream. Types today include `follow_up.scheduled`, `follow_up.completed`, `follow_up.cancelled`, `note.created`, `status.changed`, `assignment.changed`, `lead.manual_created`, `lead.bulk_imported`.

**`lead_events`** — intake/system stream.

**2A additions to `lead_activities` (summary events only):**

```
follow_up.auto_created | follow_up.sla_breached
```

Detailed lifecycle changes (reschedule, ownership transfer, priority change, primary designation, etc.) go to **`lead_follow_up_events`**, not one table per event type.

### 2.4 Permissions & RLS

**Today:** `crm.follow_ups.manage` for all sales roles; mutations via SECURITY DEFINER impl; SELECT via lead visibility RLS.

**2A adds:** `crm.sla.manage` — **super_admin only** (initial grant). Sales managers view SLA state/breaches through `crm.reporting.read` / management scope; they do **not** edit policy in 2A.

### 2.5 Lead list & queries

- `followUpDue` filter: overdue / today / upcoming on open follow-ups
- `nextFollowUpDue`: earliest open follow-up due per lead (application enrichment — **not** a DB column)
- No primary-next-action filter; no My Day RPC

### 2.6 Reporting

Follow-up KPIs: open, overdue, dueSoon, completed, cancelled. Overview links overdue to Leads filter. Missing: business-SLA compliance, no-primary-next-action count, first-response from lead receipt.

### 2.7 Assignment flow interactions

- **Unassign:** blocked if any open follow-ups exist
- **Reassign:** blocked if open follow-ups owned by someone other than new assignee
- **Assign:** no auto first-contact task today

**2A replaces blanket block/transfer-all** with authorization-aware primary/secondary rules (§9.2).

### 2.8 On Hold today

Reason + `on_hold_since` + `on_hold_previous_status`; no review date. UI: reason only.

### 2.9 UI today

| Surface | Path | Notes |
| :--- | :--- | :--- |
| Overview | `/admin/crm` | Manager dashboard |
| Leads | `/admin/crm/leads` | List + **pipeline preview toggle** (retained in 2A) |
| Lead detail | `/admin/crm/leads/[id]` | Minimal follow-up composer |
| Reports | `/admin/crm/reports` | Follow-up KPI cards |
| Nav | `CrmNav.tsx` | Overview, Leads, Targets, Reports, … |

### 2.10 Managed migration state

39 migrations through `20260825170000_crm_lead_notes_insert_privilege_repair.sql`. Next migration forward-only after latest.

---

## 3. Product principles (2A)

1. **Single activity truth:** `lead_follow_ups` holds all scheduled work; exactly **one open primary next action** per active assigned lead.
2. **Multiple activities allowed:** secondary/non-primary open activities may coexist (consultation + prep, site visit + reminder, etc.).
3. **Atomic completion:** complete + next primary action (or controlled terminal/on-hold) in one transaction; pipeline transitions reuse existing impl.
4. **Audit everything:** lifecycle changes in `lead_follow_up_events`; summary in `lead_activities`.
5. **Business-window SLA:** no false overnight breaches; **policy not active/configured** until owner sets business hours — fail closed, no silent wall-clock or invented schedule.
6. **Reps live in My Day;** managers monitor Overview + team My Day + Reports.
7. **No duplicate mutable truth on `leads`:** query primary activity via indexes/joins/lateral/view.

---

## 4. User journeys

### 4.1 Sales Executive — morning routine

1. Login → **My Day** (`/admin/crm/my-day`).
2. Work **Overdue** task bucket (primary activities only — no duplicate rows across buckets).
3. Work **Today** bucket.
4. Scan **New Uncontacted** lead-attention section (lead rows, not task duplicates).
5. End day with zero owned primary activities overdue and no assigned leads in **No Next Action**.

### 4.2 Sales Executive — inbound lead

1. Lead created → **SLA clock starts at lead receipt** (stored UTC; evaluated Asia/Kolkata business window) **only if receipt ≥ policy `effective_from`** (§11).
2. If immediately assigned → **First Contact** primary activity created atomically when SLA policy is active; due = receipt + 60 business minutes (only after owner-configured business hours).
3. If unassigned → appears in manager **Unassigned** + SLA attention when applicable; on assign, First Contact created with deadline derived from **original receipt clock**, not assignment time.
4. Executive completes a **qualifying first-contact attempt** (e.g. Call with `no_answer` / `connected` / `busy` / `callback_requested`) → SLA satisfied even if customer did not answer → structured outcome → mandatory next **primary** action.

### 4.3 Sales Executive — complete activity

1. Tap **Complete** on primary or secondary activity.
2. Structured outcome (required) + optional completion note.
3. Branch:
   - **Schedule next primary action** (default for primary completion)
   - **Schedule secondary activity** (optional; does not satisfy invariant alone unless primary also set)
   - **On Hold** — reason + review date → review activity becomes primary; previous primary resolved atomically via existing `transition_lead_status_impl`
   - **Closed Lost** — via existing `transition_lead_status_impl` (reason/note unchanged)
   - **Closed Won** — **not** a direct complete-path transition. Closed-Won remains exclusively owned by **`private.accepted_quotation_close_won_impl`**. Completing an activity may only acknowledge an already-closed-won lead or deep-link the user into the commercial quotation-acceptance flow.

### 4.4 Sales Manager — oversight

1. **Overview** — Unassigned, SLA Breaches, no-primary-next-action, overdue roll-up.
2. **My Day (Team)** — filter by rep; same bucket semantics.
3. **Reports** — SLA compliance, no-next-action, completion rates.
4. **Reassign** — primary next action follows new assignee; secondary activities retain owner **only when that owner retains lead authorization**; otherwise transfer/cancel with audit (§9.2).

### 4.5 Super Admin — SLA & business hours

1. **Settings → CRM SLA** (`/admin/crm/settings/sla`) — requires `crm.sla.manage`.
2. Configure: first-contact target (60 business minutes initial), timezone (`Asia/Kolkata`), business days/hours.
3. **Exact opening/closing schedule is a deployment configuration input** — must be explicitly owner-approved before SLA evaluation goes live. The spec does **not** lock Mon–Sat or any default hours.
4. Until business hours are saved and policy is active → SLA evaluation reports **policy not active/configured**; **fail closed** (no silent wall-clock fallback, no migration-invented schedule).

---

## 5. Data model changes

### 5.1 Evolve `lead_follow_ups` (ALTER, not rename)

**New columns**

| Column | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `activity_type` | text NOT NULL | `'call'` | Allowlist §5.3 |
| `title` | text NOT NULL | derived | Max 120 chars |
| `priority` | text NOT NULL | `'normal'` | `low` \| `normal` \| `high` \| `urgent` |
| `is_primary_next_action` | boolean NOT NULL | `false` | At most one `true` among open rows per lead |
| `duration_minutes` | smallint NULL | NULL | Optional |
| `reminder_at` | timestamptz NULL | NULL | ≤ `due_at` when set |
| `outcome_code` | text NULL | NULL | Required on complete |
| `completion_note` | text NULL | NULL | Max 1000 chars |
| `quotation_id` | uuid NULL FK | NULL | Must belong to lead |
| `source` | text NOT NULL | `'manual'` | `manual` \| `sla_auto` \| `completion_chain` \| `on_hold_review` \| `import` |
| `updated_at` | timestamptz NOT NULL | `now()` | RPC-maintained |

**Constraints**

- Check constraints on `activity_type`, `priority`, `source`, `title` length.
- **Partial unique index — primary next action only:**

```sql
CREATE UNIQUE INDEX uq_lead_follow_ups_one_primary_open
  ON public.lead_follow_ups (lead_id)
  WHERE status = 'open' AND is_primary_next_action = true;
```

- **No** constraint limiting total open activities per lead.

**Backfill (migration-safe — §15)**

1. Set defaults on all existing rows (`activity_type`, `title`, `priority`, `source`, `is_primary_next_action = false`).
2. For each lead with open follow-ups: designate **one** row as primary using deterministic ordering:
   - `ORDER BY due_at ASC NULLS LAST, created_at ASC, id ASC`
   - `LIMIT 1` → `is_primary_next_action = true`
3. **Preserve all rows** — do not delete or auto-complete duplicates.
4. Emit migration audit report for leads with multiple open rows (informational, not blocking unless contradictory state).

### 5.2 New table — `lead_follow_up_events` (append-only)

Generic lifecycle audit for follow-up/activity changes.

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `follow_up_id` | uuid FK → lead_follow_ups | |
| `lead_id` | uuid FK → leads | Denormalized for queries |
| `actor_id` | uuid FK → profiles | |
| `event_type` | text NOT NULL | See below |
| `previous_values` | jsonb NOT NULL | Default `{}` |
| `new_values` | jsonb NOT NULL | Default `{}` |
| `reason_code` | text NULL | |
| `reason_note` | text NULL | Max 500 chars |
| `created_at` | timestamptz | |

**`event_type` allowlist (2A minimum)**

```
created | rescheduled | ownership_transferred | priority_changed
primary_designated | primary_cleared | completed | cancelled
outcome_recorded | reminder_changed
```

No UPDATE/DELETE. RLS SELECT via lead visibility.

**Relationship to `lead_activities`:** `lead_follow_up_events` = detailed authoritative audit; `lead_activities` = staff-facing timeline summaries (cross-domain).

### 5.3 Activity type allowlist

| Code | Label | Default duration |
| :--- | :--- | :--- |
| `call` | Call | 15 min |
| `whatsapp` | WhatsApp | 10 min |
| `consultation` | Consultation | 60 min |
| `site_visit` | Site Visit / Measurement | 90 min |
| `quotation_follow_up` | Quotation Follow-up | 15 min |
| `internal_task` | Internal Task | 15 min |

### 5.4 Structured outcome codes

**Reference table:** `lead_activity_outcome_codes` (unchanged intent from prior draft).

Key outcomes: `connected`, `no_answer`, `busy`, `callback_requested`, `voicemail`, `whatsapp_sent`, `consultation_booked`, `not_interested`, `needs_manager`, `completed`, `rescheduled`, `quotation_sent`, `primary_reassigned_migration` (migration-only).

**SLA-qualifying attempt outcomes (Call):** at minimum `connected`, `no_answer`, `busy`, `callback_requested`. `voicemail` may qualify if seeded as an attempt outcome (owner may confirm in 2A-1 plan). WhatsApp qualifies only with a recorded governed outbound send, not task creation alone.

Free-text `outcome` column retained for backward compatibility.

### 5.5 SLA & business-hours configuration

**Table:** `crm_sla_policies`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `policy_code` | text UNIQUE | `'first_contact'` |
| `target_business_minutes` | integer NOT NULL | Initial: **60** |
| `timezone` | text NOT NULL | Initial: **`Asia/Kolkata`** |
| `business_hours_enabled` | boolean NOT NULL | Must be **true** and config valid for SLA evaluation |
| `business_hours_config` | jsonb NULL | Days + start/end local times; **NULL/empty until owner configures** |
| `is_active` | boolean NOT NULL | Policy active only when hours configured and explicitly enabled |
| `effective_from` / `activated_at` | timestamptz NULL | Set when policy first activated; **non-retroactive boundary** |
| `updated_by` / `updated_at` | | Audit |

**Table:** `crm_sla_clocks` (per-lead SLA tracking — canonical, not denormalized next-action cache)

| Column | Type | Notes |
| :--- | :--- | :--- |
| `lead_id` | uuid PK FK → leads | |
| `policy_code` | text | `'first_contact'` |
| `clock_started_at` | timestamptz NOT NULL | **Lead creation/receipt** |
| `sla_due_at` | timestamptz NULL | Computed only when policy **active** AND lead receipt ≥ `effective_from`; business-window-aware |
| `first_contact_attempt_at` | timestamptz NULL | First **qualifying contact attempt** (not successful connection) — see §9.1 / §9.5 |
| `breached_at` | timestamptz NULL | Set once when breach detected (idempotent); only for in-scope leads |
| `created_at` / `updated_at` | | |

If `business_hours_enabled = false`, `business_hours_config` invalid/empty, or `is_active = false` → SLA operations **fail closed** with **policy not active/configured** state; no silent wall-clock invention; migration must **not** seed arbitrary operating hours.

**SLA measures speed to first qualifying contact attempt**, not successful customer connection. Successful engagement remains separately derivable from structured outcomes (`connected`, etc.).

**Rejected for 2A:** mutable `next_action_due_at`, `next_action_activity_type` on `public.leads`.

### 5.6 Read models (query-only, not mutable truth)

**View or RPC helper:** `crm_lead_primary_next_action_v`

- Lateral join / subquery: open row where `is_primary_next_action = true`
- Used by lead list enrichment, lead header, pipeline preview cards
- Follows existing `fetchNextOpenFollowUpDueByLeadIds` pattern but filters `is_primary_next_action`

If production scale later requires it, a **derived projection** may be added post-2A — not mutable columns on `leads`.

### 5.7 `lead_activities` constraint extension

Add: `follow_up.auto_created`, `follow_up.sla_breached` (summary only).

---

## 6. Primary next-action invariant

### 6.1 Definition

| Lead state | Requirement |
| :--- | :--- |
| `closed_won`, `closed_lost` | No primary next action |
| `on_hold` | Exactly one open **primary** activity: `source = 'on_hold_review'`, future `due_at` |
| Active non-terminal assigned lead | Exactly one open **primary** next action |
| `new` unassigned | No primary required until assigned *(manager attention via Unassigned + SLA clock)* |

**No Next Action** = no open row with `is_primary_next_action = true` for an lead that requires one.

### 6.2 Enforcement points

| Operation | Rule |
| :--- | :--- |
| `complete_lead_activity` | Requires outcome; primary completion requires next primary OR controlled **on_hold** / **closed_lost** via **existing** `transition_lead_status_impl`. **Must not** call transition for `closed_won` — Closed-Won remains exclusive to `private.accepted_quotation_close_won_impl` |
| `create_lead_activity` (primary) | Clears/demotes prior primary in same transaction if flag set |
| `transition_lead_status` → `on_hold` | Atomic: resolve old primary; create review primary |
| `assign_lead` | Create First Contact primary if none; SLA deadline from receipt clock when in-scope |
| Manual lead w/ assignee | Atomic lead + First Contact primary |
| Bulk import | See §9.1 — **not** blind mass auto-create |

### 6.3 Active assigned lead rule

For `assigned_to IS NOT NULL` and status not terminal/on_hold:

```sql
EXISTS (
  SELECT 1 FROM lead_follow_ups f
  WHERE f.lead_id = l.id
    AND f.status = 'open'
    AND f.is_primary_next_action = true
)
```

### 6.4 "New uncontacted" detection

Lead-attention (not task-bucket):

- `assigned_to IS NOT NULL`
- `first_contact_attempt_at IS NULL` on `crm_sla_clocks` (no qualifying attempt yet — §9.5)
- Typically still in `new` or `assigned` stage

---

## 7. RBAC implications

| Capability | Permission | Roles (2A) |
| :--- | :--- | :--- |
| View My Day (own) | `crm.follow_ups.manage` + lead read | All sales roles |
| View My Day (team) | `leads.read_all` | Manager, super_admin |
| Create/reschedule/complete activities | `crm.follow_ups.manage` | All sales roles |
| Designate primary / create primary | `crm.follow_ups.manage` | All sales roles |
| Choose activity owner (delegation) | `leads.read_all` | Manager+ |
| Configure SLA & business hours | **`crm.sla.manage`** | **super_admin only** |
| View SLA breaches / compliance | `crm.reporting.read` + management scope | Manager, super_admin, executives (own) |

**Migration:** add `crm.sla.manage` permission + grant to `super_admin` only. Expand later without redesign.

**Owner-aware authorization (reassignment):** existing `crm_can_view_lead_by_id` / `crm_can_mutate_lead` evaluate **`auth.uid()`** (current actor) and **must not** be used to prove whether a **different** `owner_id` can operate a lead after reassignment. 2A adds a **private** helper (not publicly exposed):

```text
private.crm_user_can_operate_lead(p_user_id uuid, p_lead_id uuid, p_capability text)
```

It evaluates the **target user's** active profile, active roles, relevant permissions, and **post-reassignment** lead ownership/scope **without impersonating `auth.uid()`**. SECURITY DEFINER, fixed `search_path`, least privilege — consistent with existing private CRM helpers. For an open activity owner to remain after reassignment, the target owner must retain lead READ authorization **and** `crm.follow_ups.manage` mutation authority for that lead **and** be active/eligible.

---

## 8. RPC & server-action boundaries

### 8.1 New / changed database RPCs

| RPC | Description |
| :--- | :--- |
| `create_lead_activity` | Extended create; optional `p_is_primary`; writes `lead_follow_up_events` + summary `lead_activities` |
| `reschedule_lead_activity` | Updates `due_at` (and optional reminder); event `rescheduled` |
| `transfer_activity_ownership` | Secondary explicit transfer; event `ownership_transferred` |
| `designate_primary_next_action` | Demote prior primary; event `primary_designated` |
| `complete_lead_activity` | See §8.2 — **no** direct Closed-Won transition |
| `private.compute_business_sla_due_at` | Business-window calculator; fail closed if config missing |
| `private.auto_create_first_contact_primary` | Idempotent; uses receipt clock; respects `effective_from` |
| `private.crm_user_can_operate_lead` | Owner-aware auth for reassignment post-condition (§7); **not** public |
| `fetch_my_day_task_bucket` / `fetch_my_day_lead_attention` | Queue RPCs; capture one `v_now` per transaction |
| `transition_lead_status` | Extended: on_hold atomic primary swap; still **blocks** `closed_won` |
| `assign_lead` | Extended: authorization-aware primary/secondary transfer on reassign; First Contact on assign |

Deprecated wrappers: `create_lead_follow_up`, `complete_lead_follow_up` (one release).

### 8.2 `complete_lead_activity` — atomic workflow (no second state machine)

Single transaction:

1. Validate actor, permissions, RLS, row lock (`FOR UPDATE`).
2. Validate structured outcome.
3. Complete current activity; write `lead_follow_up_events` (`completed`, `outcome_recorded`).
4. If outcome is a **qualifying first-contact attempt** (§9.5) and `first_contact_attempt_at` is null → set it on `crm_sla_clocks`.
5. Require exactly one resolution path:
   - **A.** `p_next_primary_action` → create/designate new primary
   - **B.** `p_on_hold` → call **`private.transition_lead_status_impl`** with review primary creation
   - **C.** `p_closed_lost` → call existing **`private.transition_lead_status_impl`** (reason codes unchanged)
   - **D.** Closed-Won path — **must not** call `transition_lead_status_impl` for `closed_won` (baseline blocks it). Options:
     - if lead is **already** `closed_won` via quotation acceptance → allow complete without manufacturing a transition
     - otherwise → reject with guidance to the commercial quotation-acceptance flow (`private.accepted_quotation_close_won_impl` remains exclusive authority)
6. Write summary `lead_activities` entries.
7. Idempotency: reject duplicate complete on non-open row; use request idempotency key if required by existing patterns.

**Do not** embed duplicate pipeline transition rules. **Do not** add a second path that can manufacture Closed-Won.

### 8.3 Application services

| Module | Responsibility |
| :--- | :--- |
| `crm-activity-service.ts` | Create, reschedule, complete-with-next, primary designation |
| `crm-my-day-queries.ts` | Task buckets + lead-attention sections |
| `crm-sla-service.ts` | Policy CRUD, business-window evaluation, breach helpers |
| `crm-lead-queries.ts` | Primary next-action enrichment via view/lateral; no `leads` column cache |

### 8.4 Server actions

`createLeadActivityAction`, `rescheduleLeadActivityAction`, `completeLeadActivityAction`, `updateCrmSlaPolicyAction` — revalidate My Day, leads, overview.

---

## 9. Automation rules

### 9.1 First-contact primary auto-creation

**SLA clock:** `crm_sla_clocks.clock_started_at = leads.created_at` (lead receipt).

**SLA satisfaction field:** `first_contact_attempt_at` — first **qualifying contact attempt**, not successful connection.

**Qualifying attempts (2A — explicit and auditable):**

| Qualifies | Does not qualify |
| :--- | :--- |
| Completed **Call** with attempt outcome: `connected`, `no_answer`, `busy`, `callback_requested` (and equivalent seeded codes) | Merely creating/scheduling a First Contact task |
| Completed **WhatsApp** activity only when an actual **governed outbound service action** was successfully recorded against the lead/contact | Opening WhatsApp UI / drafting without a recorded send |
| — | `internal_task`, consultation prep, notes, site-visit prep alone |

Successful connection (`connected`) remains separately derivable for engagement analytics; **SLA is not breached because the customer did not answer.**

**Public / manual lead**

| Scenario | Behavior |
| :--- | :--- |
| Created + immediately assigned | Atomically create First Contact **primary**; `sla_due_at = business_add(clock_started_at, 60 min)` **only when SLA policy is active and receipt ≥ `effective_from`** |
| Created unassigned | No primary yet; clock row may exist; `sla_due_at` NULL until policy active + in-scope; manager **Unassigned** attention |
| Later assigned | Create First Contact primary; **deadline from original receipt clock**, not assignment timestamp (when in-scope) |
| Lead receipt **before** `effective_from` | Still gets primary-next-action discipline; **excluded** from SLA compliance/breach metrics (grandfathered) |

**First Contact activity defaults**

```
activity_type = call | title = First contact | source = sla_auto
is_primary_next_action = true | priority = high | owner_id = assignee
```

Skip if primary First Contact already exists OR `first_contact_attempt_at` already set.

**Bulk imports**

- **Do NOT** blindly create thousands of immediate/overdue First Contact tasks for historical rows.
- Import batch option: `create_first_contact_activities` (boolean, default **`false`**).
- When `false`: import leads only; managers activate via separate controlled action or assignment flow.
- When `true`: apply same business-SLA rules using **original row receipt timestamp** from import metadata (not `now()`), still subject to `effective_from`.
- Document default in import wizard and spec.

### 9.2 Reassignment behaviour (authorization-aware)

On lead reassignment, the `assign_lead` RPC (or equivalent) must finish with **zero open activities whose owner cannot legally operate on that lead**.

**A. Primary next action** — always transfer `owner_id` to the new lead assignee atomically. Audit `ownership_transferred` in `lead_follow_up_events` + summary in `lead_activities`.

**B. Secondary open activities** — may retain current owner **only if** `private.crm_user_can_operate_lead(owner_id, lead_id, …)` is true **for that target owner** under **post-reassignment** lead ownership (not the current manager's `auth.uid()`).

**C. Secondary owner would lose access** (typical case: assignment-scoped sales executive after lead moves to another rep) — do **not** silently leave the activity with the previous owner. The RPC must either:
- transfer to the new lead owner,
- transfer to another authorized owner (manager operation), or
- cancel/resolve with audit and structured reason.

**D. Automated/default reassignment rule (deterministic):**
- Assignment-scoped sales-owned secondary activities → **transfer to new lead owner**.
- Broad-scope manager/admin-delegated activities → **may remain** with explicit owner **only if** `crm_user_can_operate_lead` confirms they retain READ + `crm.follow_ups.manage` + active/eligible status after reassignment.

**E. Audit** — every ownership transfer or cancellation during reassignment recorded in `lead_follow_up_events` (`ownership_transferred`, `cancelled`, etc.).

**F. Post-condition** — after commit, for every open activity on the lead:

```text
private.crm_user_can_operate_lead(activity.owner_id, lead_id, 'follow_ups.manage') = true
```

Do **not** use `crm_can_view_lead_by_id` / `crm_can_mutate_lead` for this check — those bind to the **current actor**.

**Unassign:** fail closed unless primary next action explicitly resolved (complete/cancel/transfer) under controlled manager operation. Same owner-aware post-condition applies.

**Remove** today's blanket reassign block for primary; replace with authorization-safe transfer rules above.

### 9.3 On Hold (primary semantics)

Entering On Hold atomically:

1. Require reason (existing validation).
2. Require future review date.
3. **Resolve/replace** current primary (complete or cancel with audit — not silent delete).
4. Create review activity: `source = on_hold_review`, `is_primary_next_action = true`, `activity_type = internal_task`, `title = On-hold review`.
5. Call `transition_lead_status_impl` → `on_hold`.
6. No automatic customer-contact cadences while held.

Resume from on hold: existing resume rules + require new primary if returning to active work.

### 9.4 Completion chain

Completing primary with `p_next_primary_action`:

1. Complete current row.
2. Insert new open row with `is_primary_next_action = true`, `source = completion_chain`.
3. Demote any stale primary flag (should be none if invariant held).

Secondary activities may be added in same transaction but do not replace primary unless explicitly designated.

### 9.5 SLA breach detection

Read-time evaluation for 2A (no notification centre):

- Policy must be **active** (`is_active = true`, valid `business_hours_config`, `business_hours_enabled = true`, `effective_from` set)
- If policy not active → report **policy not active/configured**; do not compute breaches
- **Non-retroactive:** only leads with `clock_started_at >= effective_from` are in SLA scope
- When active and in-scope: breach when `first_contact_attempt_at IS NULL` AND `now() > sla_due_at` AND lead non-terminal
- Optional one-time `follow_up.sla_breached` summary in `lead_activities` (idempotent)

---

## 10. Screens & routes

### 10.1 New routes

| Route | Role | Description |
| :--- | :--- | :--- |
| `/admin/crm/my-day` | Sales + manager team view | Primary execution workspace |
| `/admin/crm/settings/sla` | super_admin (`crm.sla.manage`) | SLA + business hours |

### 10.2 Changed routes

| Route | Changes |
| :--- | :--- |
| `/admin/crm` | Manager attention: Unassigned, SLA Breaches, No Next Action, overdue |
| `/admin/crm/leads` | Primary next action column; pipeline preview retained; filter chips |
| `/admin/crm/leads/[id]` | Activity composer; primary badge; complete/reschedule |
| `/admin/crm/reports` | SLA compliance, no-next-action, completion metrics |

### 10.3 Default redirects

| Role | `/admin/crm` |
| :--- | :--- |
| sales_executive, sales | → `/admin/crm/my-day` |
| sales_manager, management, super_admin | Overview |

### 10.4 Navigation (2A — approved)

```
My Day | Leads | Overview | Reports
```

Pipeline preview stays on **Leads** page. No `/admin/crm/pipeline` or Calendar in 2A.

### 10.5 My Day layout — buckets vs sections

**Task buckets (mutually exclusive — primary activities only, one row per activity)**

Capture a single evaluation timestamp **`v_now`** (and derived `v_start_of_tomorrow_local`) once per query/transaction so rows cannot jump buckets mid-query.

| Bucket | Predicate |
| :--- | :--- |
| **Overdue** | open primary AND `due_at < v_now` |
| **Due Today** | open primary AND `due_at >= v_now` AND `due_at < v_start_of_tomorrow_local` |
| **Upcoming** | open primary AND `due_at >= v_start_of_tomorrow_local` |

- **Overdue is relative to the current instant**, not start-of-today. A task due today at 09:00 viewed at 14:00 is **Overdue**.
- **Timezone** (`Asia/Kolkata`) controls **local day boundaries** for “tomorrow” only; it does not redefine overdue.
- Example: due today 09:00, now 14:00 → Overdue; due today 16:00, now 14:00 → Due Today; due tomorrow → Upcoming.

**Lead-attention sections (lead rows — avoid duplicating tasks already in buckets)**

| Section | Audience | Predicate |
| :--- | :--- | :--- |
| **No Next Action** | All | Requires primary but none open |
| **New Uncontacted** | All | Assigned, `first_contact_attempt_at IS NULL` |
| **Unassigned** | Manager | `assigned_to IS NULL`, non-terminal |
| **SLA Breaches** | Manager | In-scope receipt SLA breached, no qualifying attempt |

UI rule: a primary activity appears in **exactly one** task bucket. Lead-attention sections show leads, not duplicate task rows for the same work.

---

## 11. SLA configuration model

### Locked product parameters

| Setting | Value |
| :--- | :--- |
| Policy code | `first_contact` |
| Target | **60 business minutes** |
| Timezone | **Asia/Kolkata** (IANA; used for day boundaries and business-window math) |
| Storage | UTC timestamptz |
| Clock start | **Lead creation/receipt** |
| SLA satisfaction | **`first_contact_attempt_at`** — first qualifying **attempt**, not successful connection |
| Activation | **`effective_from` / `activated_at`** — **non-retroactive** by default |
| Unconfigured / inactive | **Fail closed** — **policy not active/configured**; no SLA due computed; no silent wall-clock fallback |

### Deployment configuration (requires explicit owner lock)

| Setting | Status |
| :--- | :--- |
| Exact business days | **Not locked in spec** — owner input at deployment |
| Exact opening/closing times | **Not locked in spec** — owner input at deployment |
| Migration default schedule | **Forbidden** — do not seed Mon–Sat or any arbitrary hours |
| Retroactive SLA backfill | **Forbidden by default** — only via later explicit owner-authorized policy |

The schema supports `business_hours_config` (JSON). The **CRM 2A-1 implementation plan** must treat the exact schedule as a deployment/configuration step before SLA evaluation and breach reporting go live in production. Leads received **before** `effective_from` remain in primary-next-action discipline but are **grandfathered out** of SLA metrics unless a later controlled backfill is authorized.

### Admin UI (`/admin/crm/settings/sla`)

- Target business minutes (default 60)
- Timezone selector (default Asia/Kolkata)
- Business days + hours editor
- Enable policy (requires valid hours before `is_active = true`; sets `effective_from` / `activated_at` on first activation)
- Save rejects incomplete config when enabling
- Clear copy: activation is **non-retroactive**

### Future (post-2A)

Per-source SLA overrides; escalation thresholds; optional wall-clock fallback policy (explicit opt-in only); optional controlled historical SLA backfill (owner-authorized only).

---

## 12. Query & index strategy

### 12.1 Indexes (before denormalization)

```sql
-- Primary next action (partial unique)
uq_lead_follow_ups_one_primary_open
  ON lead_follow_ups (lead_id)
  WHERE status = 'open' AND is_primary_next_action = true;

-- My Day owner queue (primary tasks)
idx_lead_follow_ups_owner_primary_open_due
  ON lead_follow_ups (owner_id, due_at)
  WHERE status = 'open' AND is_primary_next_action = true;

-- Lead + open tasks
idx_lead_follow_ups_lead_status_due
  ON lead_follow_ups (lead_id, status, due_at)
  WHERE status = 'open';

-- Existing (retain)
idx_lead_follow_ups_owner_status_due ON (owner_id, status, due_at);

-- SLA clocks (in-scope open clocks)
idx_crm_sla_clocks_due ON crm_sla_clocks (sla_due_at)
  WHERE first_contact_attempt_at IS NULL;

-- Events audit
idx_lead_follow_up_events_lead ON lead_follow_up_events (lead_id, created_at DESC);
idx_lead_follow_up_events_follow_up ON lead_follow_up_events (follow_up_id, created_at DESC);
```

### 12.2 Query plan review (required before ship)

- EXPLAIN My Day buckets (owner + team scope)
- EXPLAIN lead list primary-next-action lateral enrichment
- EXPLAIN no-next-action manager scan
- EXPLAIN SLA breach snapshot

### 12.3 Timezone & evaluation timestamp

- Capture **`v_now`** once per My Day / queue query.
- **Overdue** = `due_at < v_now` (instant-relative).
- **Due Today / Upcoming** day cutover uses `v_start_of_tomorrow_local` derived in **`Asia/Kolkata`** (or configured policy timezone).
- Do not use server-local time. Do not redefine overdue as “before start of today.”

---

## 13. Reporting additions (2A)

| Metric | Definition |
| :--- | :--- |
| `firstResponseSlaCompliancePct` | % **in-scope** leads (`clock_started_at >= effective_from`) where `first_contact_attempt_at <= sla_due_at` |
| `firstResponseAvgBusinessMinutes` | Avg business minutes from **receipt** to **first qualifying attempt** (in-scope only) |
| `assignmentDelayAvgMinutes` | Avg time from receipt to first assignment (visibility metric; not SLA) |
| `noPrimaryNextActionCount` | Active assigned leads missing open primary |
| `taskCompletionRate` | completed / (completed + overdue primary) in range |
| `slaBreachCount` | Current breached **in-scope** leads where policy **active**; null/N/A when policy not configured |

Managers see SLA state; they do not edit policy without `crm.sla.manage`. Pre-`effective_from` leads are excluded from SLA compliance/breach metrics.

---

## 14. Failure & edge cases

| Case | Handling |
| :--- | :--- |
| Complete primary without next resolution | `NEXT_ACTION_REQUIRED` |
| Second primary designation | Partial unique index violation → transaction rollback |
| Multiple open activities, one primary | Allowed |
| Reassign | Primary transfers; secondaries retain owner **only if `crm_user_can_operate_lead(owner)`**; otherwise transfer/cancel; **zero inaccessible open activities** |
| Unassign with unresolved primary | Fail closed |
| Business hours not configured | SLA **policy not active/configured**; admin prompted; no breach counts |
| Policy inactive at lead receipt | Clock may exist; `sla_due_at` NULL; no breach until in-scope + active |
| Lead receipt before `effective_from` | Grandfathered out of SLA metrics; primary-next-action still enforced |
| Policy activation mid-flight | **Non-retroactive** — does not instantly breach pre-existing leads |
| Lead received outside business hours | When policy active and in-scope: due computed in next business window |
| Bulk import default | No First Contact tasks unless opt-in |
| On hold | Old primary resolved; review becomes primary |
| Complete → Closed Won | **Rejected** as transition path; Closed-Won only via `accepted_quotation_close_won_impl` |
| Call no_answer before SLA due | Sets `first_contact_attempt_at` — **SLA satisfied** (attempt, not connection) |
| Concurrent complete | `FOR UPDATE` row lock |
| Migration: multiple open rows | Designate one primary; preserve all rows |
| Migration: ambiguous primary candidates | Deterministic ordering; log report |
| Orphaned primary after role change | Manager transfer operation required |
| Secondary activity owner loses lead access after reassign | Auto-transfer to new assignee (sales-scoped) or cancel with audit; never leave orphaned |
| Post-condition using actor auth helper | **Forbidden** — must use `crm_user_can_operate_lead(target_owner, …)` |

---

## 15. Migration plan

**File:** `20260827140000_crm_activity_control_plane_foundation.sql` *(placeholder timestamp)*

**Forward-only. Fail closed on unsafe contradictions.**

1. `lead_activity_outcome_codes`, `crm_sla_policies`, `crm_sla_clocks`, `lead_follow_up_events`
2. ALTER `lead_follow_ups` + column backfill
3. Primary designation backfill (deterministic; **preserve all rows**)
4. Partial unique index `uq_lead_follow_ups_one_primary_open`
5. Performance indexes (§12.1)
6. Extend `lead_activities` check constraint
7. Add `crm.sla.manage` permission + super_admin grant
8. Seed outcomes; insert SLA policy row (**60 business minutes**, Asia/Kolkata, **`is_active = false`**, **`business_hours_config = NULL`**) — **no arbitrary business-hours seed**
9. Business-window helper functions (fail closed when config missing)
10. RPC impls (§8)
11. Update `assign_lead`, manual create, import (opt-in flag)
12. pgTAP tests

**Rejected:** mutable `next_action_*` on `leads`; deleting duplicate open follow-ups.

---

## 16. Test plan

### 16.1 Database (pgTAP)

| Test | Assert |
| :--- | :--- |
| Multiple open activities allowed | Two open secondaries + one primary succeeds |
| Second primary blocked | Partial unique violation |
| Primary backfill | Deterministic; all rows preserved |
| Business SLA due | Outside-hours receipt → due in next window (in-scope + active) |
| SLA fail closed | Inactive policy → `sla_due_at` NULL; policy not active state |
| Policy activation non-retroactive | Pre-`effective_from` leads not in breach metrics |
| Qualifying attempt (no_answer) | Sets `first_contact_attempt_at`; clears SLA breach eligibility |
| Non-qualifying complete (internal_task) | Does not set `first_contact_attempt_at` |
| Receipt clock on assign | Assign later → due from creation not assign (when in-scope) |
| Complete → on_hold / closed_lost | Uses `transition_lead_status_impl` |
| Complete → closed_won | Rejected / no manufacture; quotation path remains exclusive |
| Reassign primary transfer | Primary owner = new assignee |
| Reassign secondary (sales-scoped) | Transfers to new assignee when previous owner loses access |
| Reassign secondary (manager-scoped) | May retain owner when `crm_user_can_operate_lead` true |
| Reassign post-condition | Uses `crm_user_can_operate_lead(target_owner)` — not actor `crm_can_view_lead_by_id` |
| On hold primary swap | Old primary resolved; review primary open |
| Import opt-in false | No First Contact tasks |
| Import opt-in true | Tasks use receipt timestamp; still respect `effective_from` |
| RLS / permissions | `crm.sla.manage` super_admin only; helper not public |

### 16.2 Application tests

Contract validation; My Day bucket exclusivity with **instant-relative overdue** (due today 09:00 at 14:00 → Overdue); single `v_now` capture; lead-attention vs task-bucket separation; SLA attempt vs connection; error tokens.

### 16.3 Manual QA

- [ ] Task due earlier today appears in **Overdue**, not Due Today
- [ ] Task due later today appears in **Due Today**
- [ ] Task buckets mutually exclusive; one `v_now` per refresh
- [ ] Lead-attention sections don't duplicate tasks
- [ ] Call no_answer clears SLA risk without requiring connected
- [ ] Activating SLA does not retroactively breach old leads
- [ ] Complete cannot set Closed-Won; quotation acceptance still sole authority
- [ ] Reassign: no orphaned secondary owned by rep who lost lead access
- [ ] Bulk import default safe
- [ ] Pipeline preview still on Leads

---

## 17. Phased implementation slices

| Slice | Deliverable |
| :--- | :--- |
| **2A-1** | DB migration + events table + primary index + `crm_user_can_operate_lead` + pgTAP |
| **2A-2** | Business-SLA helpers + `crm_sla_clocks` (`first_contact_attempt_at`) + inactive policy scaffold + `effective_from` |
| **2A-3** | Activity RPCs + complete-with-next (on_hold/closed_lost only; no closed_won manufacture) |
| **2A-4** | Activity service + contracts |
| **2A-5** | Lead detail activity UX + primary badge |
| **2A-6** | My Day task buckets (instant overdue) + lead-attention sections |
| **2A-7** | Assign/reassign owner-aware transfer + First Contact automation |
| **2A-8** | SLA settings UI + import opt-in + non-retroactive activation copy |
| **2A-9** | Overview/Reports metrics + nav/redirects |
| **2A-10** | Query plan review + hardening |

---

## 18. Acceptance criteria

1. My Day default for sales executives.
2. Task buckets **Overdue / Due Today / Upcoming** mutually exclusive; **Overdue = `due_at < now()`**; Due Today = remaining today after `now()`; single evaluation timestamp per query.
3. Lead-attention sections **No Next Action / New Uncontacted** (+ manager **Unassigned / SLA Breaches**) without duplicating task rows.
4. Multiple open activities allowed; **exactly one open primary** per lead requiring it.
5. Structured activities with type, title, priority, due; optional duration, reminder, quotation.
6. **`lead_follow_up_events`** audits reschedule, ownership, priority, primary changes, complete, cancel, outcome.
7. Complete requires outcome; atomic next primary or controlled **on_hold / closed_lost** via **existing transition impl**; **never manufactures Closed-Won** (quotation acceptance remains exclusive).
8. First-contact SLA: **60 business minutes**, **Asia/Kolkata**, clock from **receipt**; satisfaction = **`first_contact_attempt_at`** (qualifying attempt); **non-retroactive `effective_from`**; **policy not active/configured** until owner sets business hours; fail closed — **no migration default schedule**.
9. Bulk import: no mass First Contact unless explicit opt-in.
10. On Hold: review activity becomes primary; previous primary resolved atomically.
11. Reassign: primary follows assignee; secondaries retain owner **only when `crm_user_can_operate_lead(target)`**; otherwise transfer/cancel with audit; **no inaccessible/orphaned open activities**.
12. **`crm.sla.manage`** super_admin only; managers read breaches.
13. **No** mutable `next_action_*` on `leads`.
14. Pipeline preview on Leads retained; no Calendar/dedicated Pipeline route.
15. pgTAP green; forward-only migration auditable.
16. Reassignment RPC post-condition: pgTAP proves **zero open activities** whose **target owner** fails `crm_user_can_operate_lead` (not actor-bound helpers).
17. Call `no_answer` before SLA due satisfies first-contact SLA (attempt semantics).
18. Activating SLA does not mark pre-`effective_from` leads breached.

---

## 19. Owner decisions (locked)

**Product architecture decisions** — locked 2026-08-26. **Deployment configuration inputs** — listed separately; not implied as locked defaults.

### Product architecture (locked)

| # | Topic | Locked decision |
| :--- | :--- | :--- |
| **1** | **First-contact SLA (architecture)** | Business-window-aware; **60 business minutes**; **Asia/Kolkata**; UTC; clock from **receipt**; satisfaction = **`first_contact_attempt_at`** (qualifying **attempt**, not connection); **non-retroactive `effective_from`**; fail closed until hours configured; **no migration-invented schedule** |
| **2** | **One open task vs primary** | **Reject** one-total-open-task rule. **Allow multiple open activities.** Require **at most one open primary next action** per lead. |
| **3** | **Reassignment** | **Primary** always transfers. **Secondary** retains owner only if **`crm_user_can_operate_lead(target_owner)`** under post-reassignment lead state; otherwise transfer/cancel with audit. Post-condition validates **target owners**, not current actor helpers. |
| **4** | **SLA permission** | **`crm.sla.manage`** — super_admin only in 2A. |
| **5** | **Denormalized `next_action_*` on leads** | **Rejected for 2A.** |
| **6** | **Today / overdue semantics** | Timezone **Asia/Kolkata** for day boundaries; **Overdue = `due_at < now()`**; Due Today = remaining local day after now; single `v_now` per query |
| **7** | **Closed-Won authority** | **Exclusive** to `private.accepted_quotation_close_won_impl`. `complete_lead_activity` must **not** transition to `closed_won`. |

### Deployment configuration (explicit owner lock required — not product-architecture locks)

| Item | Requirement |
| :--- | :--- |
| **Exact business opening/closing times** | Owner must configure via SLA settings before policy goes active. Spec does **not** lock Mon–Sat or any default hours. CRM 2A-1 implementation plan must document this as a deployment gate. |
| **Policy activation** | Super admin enables policy only after valid `business_hours_config` is saved; sets `effective_from` / `activated_at`. Until then: **policy not active/configured**. Activation is **non-retroactive**. |

### Additional locked spec corrections (2026-08-26)

| ID | Correction |
| :--- | :--- |
| **A** | Generic append-only **`lead_follow_up_events`** |
| **B** | **`complete_lead_activity`** reuses **`transition_lead_status_impl`** for on_hold/closed_lost only — **no** Closed-Won manufacture |
| **C** | First-contact triggers refined; bulk import **opt-in** default **false** |
| **D** | On Hold: review activity = primary; previous primary resolved atomically |
| **E** | My Day: mutually exclusive task buckets + separate lead-attention sections |
| **F** | Nav: My Day \| Leads \| Overview \| Reports; pipeline preview on Leads until 2B |
| **G** | UX term **Activities/Next Action**; table stays **`lead_follow_ups`** |
| **H** | Performance via indexes + query review before denormalization |
| **I** | Migration: preserve all rows; deterministic primary backfill; fail closed on unsafe contradictions |
| **J** | Scope deferrals unchanged (Calendar, Pipeline route, cadences, AI, commerce, etc.) |
| **K** | Pre-PR: No migration seed of arbitrary business hours |
| **L** | Pre-PR: Reassignment authorization rules for secondary activities |
| **M** | **Final pre-merge:** Overdue = `due_at < now()` (not start-of-today) |
| **N** | **Final pre-merge:** Closed-Won exclusive to quotation acceptance path |
| **O** | **Final pre-merge:** `private.crm_user_can_operate_lead` for reassignment post-condition |
| **P** | **Final pre-merge:** SLA = first qualifying **attempt**; field `first_contact_attempt_at`; activation **non-retroactive** |

---

## 20. Known tensions & resolution notes

| Tension | Resolution |
| :--- | :--- |
| Multiple open activities vs assignment hardening | Key off primary + owner-aware post-conditions |
| SLA clock at receipt vs task created on assign | Clock at receipt; due only when active + in-scope (`effective_from`) |
| Fail-closed SLA vs usable out-of-box | Inactive policy scaffold only; owner configures hours at deployment |
| Exact business hours not locked in spec | Deployment configuration item for CRM 2A-1 |
| My Day “due today but past time” | **Overdue is instant-relative** (§10.5); timezone only for tomorrow boundary |
| Closed-Won via complete vs baseline block | Complete **never** calls transition for closed_won; commercial path exclusive |
| Actor-bound `crm_can_view_lead_by_id` vs target owner | **`crm_user_can_operate_lead(p_user_id, …)`** for reassignment checks |
| SLA “contacted” vs “attempted” | **`first_contact_attempt_at`**; no_answer etc. satisfy SLA |
| Policy activation vs old leads | **Non-retroactive** `effective_from`; no silent retro-breach |
| Secondary activity completion without primary successor | Allowed — only primary completion requires next resolution |

**No unresolved contradictions** between owner decisions and this spec after final pre-merge corrections (§19 M–P). Remaining **deployment** input: exact business hours schedule (not a product-architecture defect).

---

## 21. Revision history

| Date | Change |
| :--- | :--- |
| 2026-08-26 | Initial 2A design from baseline audit @ `6f07e08` |
| 2026-08-26 | Owner review corrections: business-window SLA, primary-next-action semantics, events table, reassignment rules, reject leads denormalization, My Day bucket model, locked §19 |
| 2026-08-26 | Pre-PR corrections: business hours = deployment config; reassignment authorization rules (§9.2, §19 K–L) |
| 2026-08-26 | Final pre-merge: overdue=`now()`; Closed-Won commercial-only; `crm_user_can_operate_lead`; SLA attempt semantics + non-retroactive activation (§19 M–P) |
