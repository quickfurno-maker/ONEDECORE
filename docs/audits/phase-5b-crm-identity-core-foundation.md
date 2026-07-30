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
| `npm run check:db` | PASS (220 pgTAP tests) |
| `npm run test:app` | PASS (312 tests) |
| `npm run test:image` | PASS (17 tests) |
| `npm run build` | PASS |
| Public-site diff | EMPTY |
| Managed DB changes | **NONE** |

---

## 6. Residual risks

- Legacy `management` users retain broad access until manually remapped to `sales_manager`.
- `closed_won` guard is RPC-level only until quotation acceptance table exists (Phase 7B).
- Sales target schema intentionally deferred to Phase 5E.
- Migration 11 not applied to managed Supabase — production CRM remains inactive.

---

## 7. Evidence

Local bundle: `.artifacts/phase-5b-crm-identity-core-foundation-evidence.zip` (git-ignored).

**No PR opened. No merge performed.**
