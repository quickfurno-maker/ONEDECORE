# Phase 5B — CRM Identity, Authorization & Core Data Foundation Audit

**Date:** 2026-07-31  
**Branch:** `phase-5b-crm-identity-core-foundation`  
**Base SHA:** `ad2044f2ddb7bc906445e6c7f61bf39ccf82ca2d`  
**Migration:** `20260730184426_crm_identity_core_foundation.sql` (local migration 11)  
**Managed Supabase:** migrations 1–10 only — **no remote apply in this phase**

---

## 1. Scope delivered

| Area | Outcome |
|------|---------|
| RBAC | Added `sales_manager`, `sales_executive`, `project_manager`; 9 new CRM permissions; legacy roles retained with documented deprecation |
| Lead sources | `lead_sources` catalogue with 21 locked seeds; `leads.primary_source_id` authoritative; `leads.source` legacy transport |
| Touchpoints | Append-only `lead_source_touchpoints` |
| Pipeline | Status graph reconciled; `assign_lead` / `transition_lead_status` RPCs; `closed_won` blocked until Phase 7B |
| Loss reasons | `lead_closure_reasons` + mandatory `closed_lost_note` |
| Assignment | Append-only `lead_assignment_history`; direct `assigned_to`/`status` update revoked |
| Collaboration | `lead_notes`, `lead_follow_ups`, `lead_activities`; `lead_events` remains intake/system stream |
| Targets | **Deferred to Phase 5E** (schema not created) |
| Application | `src/features/crm/` server-only contracts, repository, adapters, tests |
| Public site | **No changes** |

---

## 2. Legacy role strategy (no user remapping)

| Legacy role | Phase 5B treatment |
|-------------|-------------------|
| `super_admin` | Unchanged; all CRM + portfolio permissions |
| `management` | Retained; granted same breadth as `sales_manager` via `leads.read_all` |
| `sales` | Retained; **`leads.read` removed**, `leads.read_assigned` granted (assignment-scoped RLS) |
| `designer` | Unchanged; no CRM lead access |
| `project_operations` | Retained; documented legacy; no CRM lead access |
| `content_manager` | Unchanged; portfolio dependency via existing grants only |

**No `user_roles` rows were modified.** Owner must manually migrate users to canonical roles in a future authorized phase.

### Managed pre-apply checklist (future)

1. Verify no active users rely solely on `leads.read` broad visibility without `leads.read_all`.
2. Confirm executive users should receive `sales_executive` (or retain narrowed `sales`).
3. Run migration 11 on staging; validate pgTAP suite and intake RPC regression.
4. Document any manual role assignments before apply.

---

## 3. Permission matrix summary

| Permission | super_admin | sales_manager | sales_executive | management (legacy) | sales (legacy) |
|------------|-------------|---------------|-----------------|---------------------|----------------|
| leads.read_all | ✓ | ✓ | — | ✓ | — |
| leads.read_assigned | ✓ | — | ✓ | — | ✓ |
| leads.assign | ✓ | ✓ | — | ✓ | — |
| leads.transition | ✓ | ✓ | ✓ | ✓ | ✓ |
| sources.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| sources.manage | ✓ | — | — | — | — |
| crm.notes.manage | ✓ | ✓ | ✓ | ✓ | ✓ |
| crm.follow_ups.manage | ✓ | ✓ | ✓ | ✓ | ✓ |
| crm.activities.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| portfolio.* | ✓ (unchanged) | — | — | — | — |

`project_manager` and `designer`: no CRM lead permissions in Phase 5B.

---

## 4. RLS isolation proof (pgTAP)

Synthetic users in `05_crm_identity_core_foundation_test.sql` prove:

- Sales Manager sees assigned + unassigned leads
- Sales Executive sees **only** assigned leads
- Cross-executive contact/note/consent inference blocked
- Project Manager denied general lead access
- Anon denied (permission error, not empty result)
- Super Admin full visibility; sources.manage Super Admin only

---

## 5. Quality gates (local)

| Gate | Result |
|------|--------|
| `npm run check` | PASS |
| `npm run check:db` | PASS (222 pgTAP tests) |
| `npm run test:app` | PASS (313 tests) |
| `npm run test:image` | PASS (17 tests) |
| `npm run build` | PASS |
| Public-site diff | EMPTY |
| Managed DB changes | **NONE** |

---

## 6. Independent security review correction

**Correction commit:** post-`a1568cdb` on the same branch; migration 11 corrected in place (no migration 12).

### 6.1 `crm_can_mutate_lead` authorization bug

The original helper grouped `AND`/`OR` so `p_lead_id` constrained the broad-reader branch but not the assigned-reader branch. An executive who owned any lead could satisfy the predicate while targeting another executive’s lead UUID. The prior pgTAP case used an attacker with **zero** assigned leads, so the defect was not exercised.

**Fix:** explicit parentheses and a single target-row predicate on every branch. **Tests:** two executives each own a different lead; cross-executive note, follow-up, and status mutations fail with no side effects; target IDs passed via session-stored UUIDs so RLS-hidden subqueries cannot turn writes into no-ops.

### 6.2 Follow-up lifecycle hardening

Broad authenticated `UPDATE` on `lead_follow_ups` allowed spoofing `owner_id`, `created_by`, `completed_by`, `cancelled_by`, and lifecycle timestamps. Direct DML and permissive RLS policies were removed.

**Fix:** `create_lead_follow_up`, `complete_lead_follow_up`, `cancel_lead_follow_up` (SECURITY INVOKER wrappers + private SECURITY DEFINER impls). Actor fields derived from `auth.uid()`; terminal `completed`/`cancelled` enforced; owner assignment validated against active eligible sales staff; executives default to self-ownership unless policy permits manager/admin assignment.

### 6.3 Lead source historical resolution and mutation

`sources.read` previously exposed only active catalogue rows, so historical leads referencing inactive sources could not be resolved. `sources.manage` policy could not mutate because only `SELECT` was granted.

**Fix:** catalogue `SELECT` for `sources.read` includes active and inactive rows; UI may filter active for new selection. Mutation only via `create_lead_source` / `update_lead_source` RPCs (Super Admin only); `created_by`/`updated_by` derived; stable `code` immutable; `is_system` seeds protected; hard delete blocked by trigger.

### 6.4 Assignment method derivation

`assign_lead` accepted caller-supplied `p_method`, allowing managers to record `system` or `source_rule`.

**Fix:** `p_method` removed from public RPC. `private.crm_derive_human_assignment_method()` records `super_admin`, `manager`, or `manual` from the authenticated actor. Reserved methods `system` and `source_rule` are unavailable through the human RPC.

### 6.5 `new` / `assigned` pipeline invariants

`transition_lead_status` permitted `new` ↔ `assigned` without changing `assigned_to` or writing assignment history.

**Fix:** `chk_leads_status_assignment_invariant` constraint (`assigned` requires `assigned_to IS NOT NULL`; `new` requires `assigned_to IS NULL`); `transition_lead_status` rejects `new` and `assigned` targets; `assign_lead` remains authoritative for ownership and exactly one assignment-history row per assignment event.

### 6.6 Activity log completeness

Only assignment and status changes wrote `lead_activities` rows.

**Fix:** `note.created` on note insert; `follow_up.scheduled` / `follow_up.completed` / `follow_up.cancelled` from follow-up RPCs; assignment activity links the exact `lead_assignment_history.id` via `INSERT … RETURNING`, not latest-by-timestamp lookup. Failed/cross-executive operations write no activity.

### 6.7 Revised test count

| Suite | Count |
|-------|-------|
| pgTAP baseline (01–04) | 183 |
| pgTAP Phase 5B (05) | 39 |
| **pgTAP total** | **222** |
| Application tests | 313 |
| Image pipeline | 17 |

### 6.8 Unchanged managed / public / deployment truth

- Managed Supabase remains at migrations 1–10 only.
- Migration 11 not applied to managed Supabase.
- Public lead intake RPC behavior unchanged.
- Homepage and public-site files unchanged.
- No PR opened; no merge; no deployment or public CRM activation.

---

## 7. Residual risks

- Legacy `management` users retain broad access until manually remapped to `sales_manager`.
- `closed_won` guard is RPC-level only until quotation acceptance table exists (Phase 7B).
- Sales target schema intentionally deferred to Phase 5E.
- Migration 11 not applied to managed Supabase — production CRM remains inactive.

---

## 8. Evidence

Local bundle: `.artifacts/phase-5b-crm-identity-core-foundation-evidence.zip` (git-ignored).

**No PR opened. No merge performed.**
