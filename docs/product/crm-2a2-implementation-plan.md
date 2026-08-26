# CRM 2A-2 — Implementation Plan (Business SLA Database Foundation Only)

> **For agentic workers:** Do **not** execute this plan until the owner explicitly authorizes coding. When authorized, implement migration + pgTAP only — no UI, no assign wiring, no My Day, no managed apply until separately authorized.

**Goal:** Introduce inactive first-contact SLA policy scaffold, business-window helpers, per-lead SLA clocks, non-retroactive activation model, `crm.sla.manage` (super_admin only), and pgTAP — without computing production SLA dues until an owner activates a valid schedule later.

**Architecture:** Forward-only SQL migration after CRM 2A-1; fail closed while inactive; Option A snapshot semantics for `sla_due_at`; no wall-clock fallback; no migration-invented business hours.

**Tech stack:** PostgreSQL / Supabase migrations, private SECURITY DEFINER helpers, public SECURITY INVOKER RPC wrappers, `private.set_updated_at`, pgTAP under `supabase/tests/database/`.

**Document status:** Implementation complete (local) — PR open; **merge / managed apply / production deploy NOT authorized**  
**Plan date:** 2026-08-26  
**Implementation date:** 2026-08-26  
**Specs:** [crm-2.0-roadmap.md](./crm-2.0-roadmap.md), [crm-2a-follow-up-control-plane-design.md](./crm-2a-follow-up-control-plane-design.md), [crm-2a1-implementation-plan.md](./crm-2a1-implementation-plan.md)

---

## 0. Owner locks (AUTHORIZED 2026-08-26)

| # | Lock | Status |
| :--- | :--- | :--- |
| **1** | Option A snapshot semantics — existing `sla_due_at` never silently recomputed on policy edit/deactivate/reactivate | **APPROVED** |
| **2** | Existing NULL due is also a receipt-time snapshot — later activation/edit must **not** silently fill NULL → non-NULL via `ensure_first_contact_sla_clock` | **APPROVED** |
| **3** | Deactivation/reactivation preserve first `activated_at` / `effective_from` | **APPROVED** |
| **4** | Production/managed policy remains **inactive** after 2A-2 (no hours seeded; no activation) | **APPROVED** |
| **5** | Exact business days/hours deferred (2A-8 / separate auth) — no Mon–Sat / 09–18 defaults | **APPROVED** |
| **6** | Attempt marking deferred to 2A-3; voicemail qualifies later; `whatsapp_sent` alone does not | **APPROVED** |

---

## 0.1 Implementation evidence (2026-08-26)

| Item | Value |
| :--- | :--- |
| Branch | `crm-2a2-business-sla-foundation` |
| Base SHA | `881ee56468604473e1d8e001864c1844b05a6064` |
| Migration | `supabase/migrations/20260827140000_crm_business_sla_foundation.sql` |
| pgTAP | `supabase/tests/database/32_crm_business_sla_foundation_test.sql` (74 assertions) |
| Permission | `crm.sla.manage` → **super_admin only** |
| Tables | `public.crm_sla_policies`, `public.crm_sla_clocks` |
| Seed | `first_contact` / 60 / `Asia/Kolkata` / inactive / hours NULL / boundaries NULL |
| Public RPC | `public.update_crm_sla_policy` → `private.update_crm_sla_policy_impl` |
| Compute | `private.compute_business_sla_due_at` — weekday `[start,end)` + IANA tz; fail-closed NULL |
| Ensure | `private.ensure_first_contact_sla_clock` — insert-only due compute; **existing rows returned unchanged** (no silent rescope) |
| Attempt helper | **Not implemented** (deferred 2A-3) |
| Inventory pins | permissions **83**; tables **105**; migrations **41**; latest `20260827140000_…`; M38 still absent |
| Local validation | `db reset` OK; full pgTAP **PASS** (1946); `db lint` OK (no new SLA issues); pin unit tests green |
| Managed apply | **NOT done** |
| Production deploy | **NOT done** |

### Final object names

| Kind | Name |
| :--- | :--- |
| Permission | `crm.sla.manage` |
| Tables | `crm_sla_policies`, `crm_sla_clocks` |
| Index | `idx_crm_sla_clocks_unsatisfied_due` |
| Validators | `private.crm_sla_timezone_is_valid`, `private.validate_crm_sla_business_hours_config` |
| Compute | `private.compute_business_sla_due_at` |
| Ensure | `private.ensure_first_contact_sla_clock` |
| Policy RPC | `public.update_crm_sla_policy` / `private.update_crm_sla_policy_impl` |
| Activity allowlist | `follow_up.sla_breached` added (no emissions) |

### Snapshot enforcement proof (pgTAP)

- Active in-scope new clock gets non-NULL due
- Existing non-NULL due unchanged after target edit + re-ensure
- Clock created while inactive stays NULL after later activation + ensure
- Pre-`effective_from` clock stays NULL
- Deactivate/reactivate preserve original `activated_at` / `effective_from`

---

## 1. Exact baseline SHA

| Item | Value |
| :--- | :--- |
| **Protected `origin/main`** | `881ee56468604473e1d8e001864c1844b05a6064` |
| **Verified** | **YES** (`git fetch` + `git rev-parse origin/main`) |
| **Tip commit** | Merge PR #99 — CRM 2A-1 activity control-plane foundation |
| **Reviewed PR head (merged)** | `7b8f0e372d271dc9573563e63d6a5fdfde974910` |
| **Open PRs (CRM/SLA/migration)** | **None** (`gh pr list --state open` → empty) |
| **Worktree used for audit** | `OneDecore-crm-2a1-managed-apply` @ `881ee56` (detached, clean) |

### Tracked-tree note

| Item | Value |
| :--- | :--- |
| Audit worktree status | Clean at merge SHA |
| Unrelated dirty elsewhere | Do **not** plan/implement from `public-site-simplification`, payment worktree, or stale feature branches |

---

## 2. Managed Supabase tip

| Item | Value |
| :--- | :--- |
| **Project** | `lpurlfmpvriyvpkujvyl` (`ap-south-1`) |
| **Managed tip** | `20260826120000` / `crm_activity_control_plane_foundation` |
| **Verified** | **YES** (`npx supabase@2.109.1 migration list --linked` — local == remote for all 40; tip matches) |
| **Pending** | **NONE** |
| **Prior CRM/timeline** | `20260825163000`, `20260825170000` already applied (do not reapply) |
| **Deferred payment M38** | **Absent** / untouched |

---

## 3. Repository audit findings

### 3.1 Migration inventory

| Fact | Evidence |
| :--- | :--- |
| Migration file count | **40** under `supabase/migrations/` |
| Latest timestamp | `20260826120000_crm_activity_control_plane_foundation.sql` |
| Conceptual payment M38 | **Absent** (ADR-0033) |
| Open PR collisions | **None** |

### 3.2 CRM 2A-1 objects this slice depends on

| Object | Role for 2A-2 |
| :--- | :--- |
| `public.lead_activity_outcome_codes` | `closes_contact_attempt` catalogue (voicemail = true; whatsapp_sent = false) |
| `public.lead_follow_ups` / events | Activity discipline continues; SLA is separate |
| `private.crm_user_can_operate_lead` | **Not required** for 2A-2 scaffold (later assign/reassign) |
| `leads.created_at` | Canonical receipt clock source |
| `public.authorize` / `private.has_permission` | Gate `crm.sla.manage` |
| `private.set_updated_at` | Reuse for policy `updated_at` trigger |

### 3.3 Auth / permission precedents

| Pattern | Precedent |
| :--- | :--- |
| Super-admin-only permission | `sales_targets.manage`, `sources.manage` (super_admin branch) |
| Catalogue mutate RPC | `public.update_lead_source` INVOKER → `private.update_lead_source_impl` DEFINER + `authorize(...)` |
| Avoid | Quotation tax-profile public DEFINER + `has_role` shortcut |

### 3.4 Timezone / JSONB / updated_at

| Topic | Finding |
| :--- | :--- |
| `pg_timezone_names` usage | **None today** — attendance hard-locks `Asia/Kolkata` |
| JSONB CHECKs | `jsonb_typeof = 'object'` + `pg_column_size` bounds (e.g. follow-up events 2048) |
| `private.set_updated_at` | Exists; INVOKER trigger; does **not** set `updated_by` (RPC must) |

### 3.5 Collision audit

| Name | Status |
| :--- | :--- |
| `crm_sla_policies` / `crm_sla_clocks` | **Absent** (docs only) |
| `crm.sla.manage` | **Absent** |
| `compute_business_sla_due_at` / `ensure_first_contact_sla_clock` | **Absent** |
| `first_contact_attempt_at` column | **Absent** on leads/clocks |
| `follow_up.sla_breached` activity type | **Absent** from `chk_lead_activities_type` |
| Parallel business-minute helper | **Absent** (attendance uses wall/local day windows only) |

**No STOP collisions for planning.**

---

## 4. Exact migration timestamp candidate

| Candidate | Value |
| :--- | :--- |
| **Chosen timestamp** | `20260827140000` |
| Rationale | Strictly after `20260826120000`; follows common `…140000` convention; collision-free |
| Rejected | Reusing `20260826120000`; speculative payment timestamps |

---

## 5. Exact proposed migration filename

```text
supabase/migrations/20260827140000_crm_business_sla_foundation.sql
```

**pgTAP:** `supabase/tests/database/32_crm_business_sla_foundation_test.sql`

---

## 6. Exact tables / columns / functions / indexes

### 6.1 Permission

| Item | Value |
| :--- | :--- |
| Code | `crm.sla.manage` |
| Grant | **`super_admin` only** |
| Managers | View breaches later via reporting/read — **not** in 2A-2 edit path |

### 6.2 `public.crm_sla_policies`

| Column | Type / default | Notes |
| :--- | :--- | :--- |
| `policy_code` | `text PRIMARY KEY` | CHECK `^[a-z][a-z0-9_]{1,63}$` |
| `target_business_minutes` | `integer NOT NULL` | CHECK `> 0` and reasonable upper bound (e.g. `<= 10080`) |
| `timezone` | `text NOT NULL` | IANA; seed `Asia/Kolkata` |
| `business_hours_enabled` | `boolean NOT NULL DEFAULT false` | |
| `business_hours_config` | `jsonb NULL` | Object; size-bounded; structure validated by helper |
| `is_active` | `boolean NOT NULL DEFAULT false` | |
| `effective_from` | `timestamptz NULL` | Non-retroactive scope boundary (UTC) |
| `activated_at` | `timestamptz NULL` | First successful activation timestamp |
| `updated_by` | `uuid NULL FK → profiles` | Set by mutation RPC |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `private.set_updated_at` trigger |

**Seed (locked):**

```text
policy_code = 'first_contact'
target_business_minutes = 60
timezone = 'Asia/Kolkata'
business_hours_enabled = false
business_hours_config = NULL
is_active = false
effective_from = NULL
activated_at = NULL
```

**No Mon–Sat / open–close seed.**

### 6.3 `public.crm_sla_clocks`

| Column | Type / default | Notes |
| :--- | :--- | :--- |
| `lead_id` | `uuid PRIMARY KEY FK → leads` ON DELETE RESTRICT | |
| `policy_code` | `text NOT NULL FK → crm_sla_policies` | Default/seed path: `first_contact` |
| `clock_started_at` | `timestamptz NOT NULL` | **= `leads.created_at`** |
| `sla_due_at` | `timestamptz NULL` | Snapshot; NULL when inactive/out-of-scope |
| `first_contact_attempt_at` | `timestamptz NULL` | First qualifying attempt; immutable once set |
| `breached_at` | `timestamptz NULL` | Nullable; **no scheduler in 2A-2** |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` on update |

**CHECK (recommended):**  
`first_contact_attempt_at IS NULL OR first_contact_attempt_at >= clock_started_at`  
`breached_at IS NULL OR sla_due_at IS NOT NULL`

### 6.4 Functions / RPCs (2A-2)

| Function | Action |
| :--- | :--- |
| `private.validate_crm_sla_business_hours_config(jsonb)` | Structural validator; boolean for read path |
| `private.crm_sla_policy_is_evaluable(...)` | Active + enabled + valid config + `effective_from` set |
| `private.compute_business_sla_due_at(p_start, p_minutes, p_timezone, p_config)` | Returns timestamptz **or NULL** (read-safe fail closed) |
| `private.ensure_first_contact_sla_clock(p_lead_id uuid)` | Idempotent clock row; computes due only if in-scope |
| `private.update_crm_sla_policy_impl(...)` | Mutate/activate/deactivate with `authorize('crm.sla.manage')` |
| `public.update_crm_sla_policy(...)` | SECURITY INVOKER thin wrapper |
| `private.mark_first_contact_attempt_if_qualifying(...)` | **Interface designed; implementation DEFERRED to 2A-3** |

### 6.5 Indexes

| Name | Definition |
| :--- | :--- |
| PK | `crm_sla_clocks (lead_id)` |
| `idx_crm_sla_clocks_unsatisfied_due` | `(sla_due_at) WHERE first_contact_attempt_at IS NULL AND sla_due_at IS NOT NULL` |

**Retain:** policy PK on `policy_code` sufficient.  
**Skip:** redundant `(policy_code)` indexes unless EXPLAIN later proves need.

Future manager “SLA Breaches” query joins clocks→leads filtered by visibility and predicate:

```sql
first_contact_attempt_at IS NULL
AND sla_due_at IS NOT NULL
AND now() > sla_due_at
AND lead status non-terminal
```

Partial index supports the due-ordered unsatisfied set.

### 6.6 Optional activity-type allowlist prep

Design mentions optional `follow_up.sla_breached` timeline summary in **later** slices.

**2A-2 decision:** Expand `chk_lead_activities_type` to **allow** `'follow_up.sla_breached'` as schema preparation **only**.  
**Do not** insert breach activity rows in 2A-2. No scheduler.

---

## 7. `business_hours_config` JSON schema (MVP)

### Locked shape — **one interval per enabled weekday**

```json
{
  "monday": { "start": "HH:MM", "end": "HH:MM" },
  "tuesday": { "start": "HH:MM", "end": "HH:MM" }
}
```

| Rule | Value |
| :--- | :--- |
| Top-level type | JSON **object** |
| Allowed keys | Exactly `monday`…`sunday` (lowercase English) |
| Unknown keys | **Rejected** |
| Day present | That weekday is a business day with **one** `[start, end)` local interval |
| Day absent | Non-business day |
| Time format | `HH:MM` 24h, zero-padded (`00`–`23` / `00`–`59`) |
| Ordering | `start < end` (same local calendar day; overnight windows **not** supported in MVP) |
| Empty object / no days | **Invalid for activation** (must have ≥1 day) |
| Timezone | **Not** stored in JSON — use `crm_sla_policies.timezone` |
| Size bound | `pg_column_size(config) <= 2048` |
| Multi-interval / holidays / exceptions | **Out of MVP** |

### Validator API

```text
private.validate_crm_sla_business_hours_config(p_config jsonb) → boolean
```

- Returns `false` for NULL / wrong type / structural errors when used by compute/read paths.
- Admin activation path **raises** stable error (e.g. `CRM_SLA_HOURS_INVALID`) after `false`.

### Timezone validation

```text
exists (select 1 from pg_timezone_names where name = p_timezone)
```

- Seed remains `Asia/Kolkata`.
- Mutation rejects unknown IANA names.
- No server-local timezone assumptions; all conversions via `timezone(tz, …)` / `AT TIME ZONE`.

---

## 8. Activation / deactivation / reactivation / `effective_from`

### First activation (requires all)

1. Caller has `crm.sla.manage`
2. `business_hours_config` present and validate = true
3. `business_hours_enabled = true`
4. `timezone` valid IANA
5. `target_business_minutes` valid

**Effects:**

| Field | Action |
| :--- | :--- |
| `is_active` | `true` |
| `activated_at` | `now()` (**first** activation only — never overwritten) |
| `effective_from` | `now()` on first activation (**never silently reset** by normal edits) |
| `updated_by` / `updated_at` | actor / now |

### Deactivation

- Sets `is_active = false` (and may set `business_hours_enabled = false` if requested)
- **Preserves** `activated_at` and `effective_from`
- **Does not** null existing clock `sla_due_at` values (snapshot remains historical)
- New `ensure_*` calls while inactive → due stays NULL for newly computed paths that only set due when evaluable

### Reactivation

- Requires valid config + `business_hours_enabled = true`
- Sets `is_active = true`
- **Does not** change `activated_at` or `effective_from`
- **Does not** mass-recompute existing clocks
- New in-scope leads (receipt ≥ original `effective_from`) get dues under **current** target/hours (Option A)

### Normal edits while active (target minutes, hours, timezone)

- Allowed under `crm.sla.manage` with validation
- **Preserve** `effective_from` and `activated_at`
- **Do not** rewrite existing `crm_sla_clocks.sla_due_at` (Option A)

### Exact hours

Exact open/close times remain a **later deployment configuration** decision (2A-8 UI / controlled activation). This plan does **not** require them now.

---

## 9. Policy-edit semantics — **OWNER LOCK RECOMMENDED: Option A (snapshot)**

| Option | Verdict |
| :--- | :--- |
| **A — Snapshot `sla_due_at` at scope entry** | **SELECTED / recommended lock** |
| **B — Dynamic recompute on policy edit** | **Rejected** for MVP (moves deadlines; creates/removes breaches after the fact) |

**Rules:**

1. When a clock first becomes in-scope under an evaluable policy, compute `sla_due_at` once and store it.
2. Later policy edits affect **new** computations only.
3. Existing rows keep stored `sla_due_at` unless a **future explicit owner-authorized repair** is designed (out of 2A-2).
4. No full policy-version history table in 2A-2 — the snapshot column is the audit of “due under policy-as-of-computation.”

**No product-doc contradiction** with non-retroactive `effective_from`.

---

## 10. Existing-lead clock backfill

### Strategy (deterministic, fail-closed)

```sql
INSERT INTO public.crm_sla_clocks (
  lead_id, policy_code, clock_started_at,
  sla_due_at, first_contact_attempt_at, breached_at
)
SELECT
  l.id,
  'first_contact',
  l.created_at,
  NULL,   -- policy inactive / effective_from NULL
  NULL,   -- NO historical attempt inference
  NULL
FROM public.leads l
ON CONFLICT (lead_id) DO NOTHING;
```

| Rule | Decision |
| :--- | :--- |
| One row per lead | Yes |
| `clock_started_at` | `leads.created_at` |
| `sla_due_at` | **NULL** (inactive seed) |
| `first_contact_attempt_at` | **NULL** — **no inference** from notes/status/tasks/WhatsApp UI |
| `breached_at` | **NULL** |
| Postcondition | Clock count = lead count; all due NULL |

Historical attempt attribution is **out of 2A-2** and requires separate owner authorization if ever proposed.

---

## 11. Business-window algorithm (`private.compute_business_sla_due_at`)

### Signature

```sql
private.compute_business_sla_due_at(
  p_start timestamptz,          -- UTC receipt
  p_target_business_minutes int,
  p_timezone text,
  p_config jsonb
) returns timestamptz           -- NULL = fail closed (inactive/invalid)
```

### Fail closed (return NULL — do not raise on read path)

- `p_start` / minutes / timezone / config NULL
- Invalid timezone / invalid config / zero usable days
- Non-positive minutes

Admin activation uses validator + raise separately.

### Interval semantics (locked)

- Local day windows are **`[start, end)`**
- Receipt **exactly at start** → counts immediately
- Receipt **exactly at end** → treated as after close → next opening
- No overnight intervals in MVP

### Algorithm (conceptual)

1. Convert `p_start` to local timestamp in `p_timezone`.
2. Find the local business cursor = earliest local instant ≥ receipt inside a business window (or next opening if outside).
3. While remaining business minutes > 0:
   - Consume `min(remaining, minutes until that day's local end)`
   - If exhausted inside window → return UTC instant
   - Else advance to next configured business-day opening
4. Defensive iteration cap (e.g. 400 day-steps) → raise `CRM_SLA_COMPUTE_GUARD` (unreachable if validator requires ≥1 day)

### Cases to test with synthetic hours (never production seed)

| Case | Expectation |
| :--- | :--- |
| Inside window | Due = receipt + N business minutes within/across windows |
| Before opening | Start at today’s open |
| Exactly opening | Counts immediately |
| Exactly closing | Next opening |
| After closing | Next opening |
| Non-business day | Next opening |
| Cross-day carry | Remainder after close continues next open day |
| Gap (weekend) | Skip closed days |
| Asia/Kolkata conversion | No hard-coded `+05:30` arithmetic |

**No holiday calendar in 2A-2.**

---

## 12. Helper / RPC interfaces

### `private.ensure_first_contact_sla_clock(p_lead_id uuid) → crm_sla_clocks`

1. Load lead (`id`, `created_at`); missing → `P0002`
2. Upsert clock: `clock_started_at = created_at`, `policy_code = 'first_contact'`
3. Load `first_contact` policy
4. If **not** evaluable OR `created_at < effective_from` → leave/keep due NULL for new inserts; on conflict do not overwrite existing non-null due (Option A)
5. If evaluable and in-scope and `sla_due_at IS NULL` and attempt NULL → set `sla_due_at = compute_business_sla_due_at(...)`
6. **Does not** create follow-ups / activities
7. **Not wired** into intake/`assign_lead` in 2A-2

### `public.update_crm_sla_policy(...)` (2A-2 YES)

Proposed parameters (exact arg list finalized at coding):

| Arg | Purpose |
| :--- | :--- |
| `p_policy_code` | e.g. `first_contact` |
| `p_target_business_minutes` | optional patch |
| `p_timezone` | optional patch |
| `p_business_hours_enabled` | optional |
| `p_business_hours_config` | optional jsonb |
| `p_is_active` | optional activation/deactivation intent |

**Behavior:** INVOKER public → DEFINER private; `authorize('crm.sla.manage')`; validate; apply §8; set `updated_by`.

**No server actions / UI in 2A-2.**

### Qualifying attempt helper — **DEFER implementation to 2A-3**

Documented interface for later:

```sql
private.mark_first_contact_attempt_if_qualifying(
  p_lead_id uuid,
  p_attempt_at timestamptz,
  p_source text,              -- 'call_outcome' | 'whatsapp_governed_send' | …
  p_outcome_code text default null
) returns public.crm_sla_clocks
```

| Rule | Later behavior |
| :--- | :--- |
| Call + outcome with `closes_contact_attempt` | Qualifies |
| Voicemail | Qualifies (catalogue true) |
| `whatsapp_sent` alone | **Does not** qualify |
| Governed WhatsApp send evidence | Future path |
| `internal_task` / notes | Never |
| Idempotent | Sets once; never moves later |

**Why defer:** Completing activities / WhatsApp evidence is 2A-3+; shipping a half-wired second completion path risks duplicate state machines.

2A-2 still tests: column exists, remains NULL after backfill, no inference.

---

## 13. Breach representation (2A-2)

| Mechanism | Decision |
| :--- | :--- |
| Query breach | `sla_due_at IS NOT NULL AND first_contact_attempt_at IS NULL AND now() > sla_due_at` (+ lead non-terminal in later read models) |
| `breached_at` column | Exists; stays **NULL** in 2A-2 (no daemon / cron / mark job) |
| Pre-effective / inactive | `sla_due_at` NULL → **not** breached |

---

## 14. RLS / grants

### `crm_sla_policies`

| Privilege | Rule |
| :--- | :--- |
| Authenticated | **SELECT** only |
| Direct DML | **Blocked** (no INSERT/UPDATE/DELETE policies) |
| SELECT policy | `authorize('crm.sla.manage') OR authorize('crm.reporting.read') OR authorize('leads.read_all') OR authorize('leads.read')` |
| Writes | Via `update_crm_sla_policy` only |

### `crm_sla_clocks`

| Privilege | Rule |
| :--- | :--- |
| Authenticated | **SELECT** only |
| Direct DML | **Blocked** |
| SELECT policy | Exists lead where `private.crm_can_view_lead(assigned_to)` (same pattern as follow-ups/events) |
| Writes | Private helpers / future RPCs only |

### Private helpers

- `search_path = ''`
- Schema-qualified
- `REVOKE` from `public`, `anon`
- `GRANT EXECUTE TO authenticated` only where required for INVOKER→DEFINER architecture
- No anon execute

---

## 15. Exact expected changed-file list (when coding authorized)

| Path | Action |
| :--- | :--- |
| `supabase/migrations/20260827140000_crm_business_sla_foundation.sql` | **Create** |
| `supabase/tests/database/32_crm_business_sla_foundation_test.sql` | **Create** |
| `supabase/tests/database/01_identity_rbac_test.sql` | Permissions **82→83**; tables **103→105** |
| `src/features/whatsapp/__tests__/phase-6b-integrated-matrix.test.ts` | Migration count **40→41**; `later` list append; M38 still absent |
| `src/features/commerce/__tests__/phase-9d-d2-cart-checkout-tracking.test.ts` | Latest + count pins |
| `src/features/commerce/__tests__/phase-9d-f-cod-certification.test.ts` | Latest + count pins |
| `src/features/commerce/__tests__/phase-10-cod-production-readiness.test.ts` | Count pin **40→41** |
| `docs/product/crm-2a2-implementation-plan.md` | This plan |
| `src/types/database.generated.ts` | **Only if** repo process requires regeneration |

**Must not change:** React/UI, My Day, assign RPCs, intake, WhatsApp send, payments, M38.

If app runtime code becomes required for 2A-2 to function → **STOP**.

---

## 16. Exact pgTAP test matrix

**File:** `supabase/tests/database/32_crm_business_sla_foundation_test.sql`  
**Estimated assertions:** ~55–75 (finalize when coding)

### Schema / permission

- [ ] Tables `crm_sla_policies`, `crm_sla_clocks`
- [ ] Columns/defaults/FKs/CHECKs
- [ ] Indexes (incl. partial unsatisfied due)
- [ ] `crm.sla.manage` exists; super_admin has it; manager/exec do **not**
- [ ] Optional: `follow_up.sla_breached` allowed in activities CHECK if included

### Inactive / fail closed

- [ ] Seed inactive / hours disabled / config NULL / effective_from NULL / activated_at NULL
- [ ] Backfilled clocks: due NULL, attempt NULL, breached NULL
- [ ] `compute_*` returns NULL on inactive/invalid
- [ ] No invented breach

### Config validation

- [ ] Invalid timezone rejected on update
- [ ] Empty days rejected on activation
- [ ] Malformed HH:MM rejected
- [ ] `start >= end` rejected
- [ ] Unknown weekday rejected
- [ ] Valid synthetic config accepted

### Business add (synthetic hours only)

- [ ] Inside / before / exact open / exact close / after close
- [ ] Non-business day / cross-day / weekend gap
- [ ] Timezone conversion without fixed offset hacks
- [ ] No wall-clock fallback when invalid

### Activation

- [ ] Activate without config rejected
- [ ] First activation sets `effective_from` + `activated_at`
- [ ] Pre-effective lead stays due NULL after ensure
- [ ] Post-effective + active → due computed
- [ ] Deactivation preserves boundaries
- [ ] Reactivation preserves `effective_from` / `activated_at`
- [ ] Normal edit preserves `effective_from`

### Snapshot Option A

- [ ] Existing due not rewritten when target/hours change
- [ ] New in-scope clock uses updated policy

### Clocks

- [ ] Idempotent ensure (one row)
- [ ] `clock_started_at = leads.created_at`
- [ ] No historical attempt inference

### Breach query (no daemon)

- [ ] In-scope overdue unsatisfied → query-visible breached predicate true
- [ ] Attempt before due → not breached
- [ ] Pre-effective → not breached
- [ ] `breached_at` remains NULL in 2A-2 fixtures

### Security

- [ ] Direct policy/clock DML denied for authenticated
- [ ] Clock SELECT follows lead visibility
- [ ] Anon/public cannot execute private helpers
- [ ] Non–super_admin cannot call update RPC successfully

### Regression

- [ ] Full pgTAP suite
- [ ] `db reset`
- [ ] DB lint
- [ ] App inventory pins green

---

## 17. Local validation plan

1. Fresh branch from `origin/main` @ `881ee56…`
2. Implement migration + tests + inventory pins only
3. `npx supabase db reset`
4. Full `supabase test db`
5. `supabase db lint --local --level warning`
6. App tests that pin migration count/latest (if pins changed)
7. **Do not** managed-apply until separate authorization

---

## 18. Fail-closed / STOP conditions

STOP before/during implementation if:

- `origin/main` ≠ `881ee56…` unexpectedly
- Managed tip ≠ `20260826120000` before coding/apply
- Open PR touches SLA/migration surface
- Name collisions appear
- 2A-1 outcome catalogue / `closes_contact_attempt` semantics drift
- `leads.created_at` cannot serve as receipt
- Business helper requires unsupported extensions
- UI / assign / My Day becomes required
- Payment M38 appears in worktree
- Option B recomputation becomes necessary without owner lock

---

## 19. Migration order (inside single forward migration)

1. Preflight comments / collision guards  
2. `crm.sla.manage` permission + super_admin grant  
3. `crm_sla_policies` + constraints + `set_updated_at` trigger + RLS/grants  
4. Inactive `first_contact` seed  
5. Config validator + timezone check  
6. `compute_business_sla_due_at`  
7. `crm_sla_clocks` + indexes + RLS/grants  
8. Existing-lead clock scaffold (`due` NULL)  
9. `ensure_first_contact_sla_clock`  
10. `update_crm_sla_policy` public/private pair  
11. Optional `follow_up.sla_breached` allowlist expansion  
12. Comments / revoke hardening  
13. Postconditions (seed inactive; clock count = lead count; all due NULL)

---

## 20. Implementation checklist (when authorized)

- [ ] Branch from exact main SHA  
- [ ] Migration filename collision-free  
- [ ] Permission + tables + seed inactive  
- [ ] Validators + compute + ensure + update RPC  
- [ ] Backfill clocks with NULL dues  
- [ ] pgTAP 32_… green  
- [ ] Inventory pins updated  
- [ ] Local reset/pgTAP/lint green  
- [ ] Plan evidence section updated  
- [ ] PR opened — **no merge/apply/deploy** until authorized  

---

## 21. Acceptance criteria

1. Migration applies cleanly on reset after 2A-1.  
2. Seeded `first_contact` policy inactive; no hours; no `effective_from`.  
3. Every lead has one clock; `clock_started_at = created_at`; dues NULL.  
4. Compute returns NULL when inactive/invalid; never wall-clock invents dues.  
5. Activation with valid synthetic config sets boundaries; pre-effective leads stay out of scope.  
6. Option A: existing dues not rewritten on edit.  
7. `crm.sla.manage` super_admin only.  
8. No My Day / assign / UI / WhatsApp / payment changes.  
9. Full regression green.  

---

## 22. Owner decisions

| # | Topic | Status |
| :--- | :--- | :--- |
| **1** | Exact business open/close schedule | **Deferred** — deployment/config at activation (2A-8); **not** required to authorize 2A-2 coding |
| **2** | Policy-edit **Option A snapshot** semantics | **APPROVED LOCK** — existing dues (incl. NULL) never silently rescoped |
| **3** | Defer `mark_first_contact_attempt_if_qualifying` to 2A-3 | **APPROVED LOCK** — not implemented in 2A-2 |
| **4** | Allowlist `follow_up.sla_breached` without emitting rows | **DONE** — CHECK expanded; no row inserts |

**No remaining architecture blockers.** Merge / managed apply / production deploy remain separately authorized.

---

## 23. Explicit non-goals (reminder)

Do **not** implement in 2A-2: My Day UI/RPCs, SLA settings UI, `/admin/crm/settings/sla`, activity complete/reschedule actions, complete-with-next, on-hold review workflow, `assign_lead` / reassign transfer, First Contact auto-creation, manual/bulk import opt-in, governed WhatsApp SLA completion, manager dashboards/reports, Calendar, Pipeline, cadences, notifications, AI, commerce/payments, M38, production deploy, breach daemon.

---

## Revision history

| Date | Change |
| :--- | :--- |
| 2026-08-26 | Initial CRM 2A-2 implementation plan from audit @ `881ee56` / managed tip `20260826120000` |
| 2026-08-26 | Implementation evidence + owner locks recorded; migration `20260827140000` + pgTAP 32 shipped locally |
