# Phase 6D — Managed Alignment & Governance Closeout

**Status:** **M23 MANAGED APPLY HISTORICALLY COMPLETE; M24 MANAGED REPAIR CLOSEOUT PENDING** (August 10, 2026)
**Protected main (repository):** `9ea36e5df55fb78235c1ccd21ef239ef4b224885`  
**Managed project:** OneDecore `lpurlfmpvriyvpkujvyl` (ap-south-1)  
**Owner authorization:** `PROCEED PHASE 6D MANAGED APPLY` (fresh, post repository merge PR #49)

---

## A. Recovery & pre-write gate

| Item | Value |
| :--- | :--- |
| Qualified recovery | Backup **1330573859** |
| Timestamp | `2026-08-09T19:54:44.155Z` |
| Type | physical/WALG |
| Status | COMPLETED |
| M22 managed cutoff | `~2026-08-09T02:57:19Z` |
| Strictly after M22 cutoff | **YES** |
| Managed start | M1–M22 only |
| Pending | M23 only |
| PITR | disabled |

Frozen M23 hash verification:

| Field | Value |
| :--- | :--- |
| File | `20260810140000_staff_attendance_leave_foundation.sql` |
| Git blob | `785325143dae0e81b918f8371325785ce061d57a` |
| Canonical UTF-8/LF SHA-256 | `64f4f15a9501fcf6bda954e021812b0b826022304654dbc49699f0cab7051634` *(file content)* |
| Legacy Audit Token | `c8c2739b0ea45d6eed49ee5bd3eed6fa383fbb685cd60d21cd9d550f42358f20` *(audit record label)* |

---

## B. Managed apply (CLI `supabase@2.109.1 db push --linked --yes`)

| Item | Value |
| :--- | :--- |
| Start (UTC+5:30) | `2026-08-10T08:16:43` |
| End (UTC+5:30) | `2026-08-10T08:16:52` |
| Exit | 0 |
| Migration applied | `20260810140000_staff_attendance_leave_foundation` only |
| Post-apply remote history | M1–M23 aligned |

Non-fatal pg-delta cache warning observed (same class as M22 apply); migration applied successfully.

No frozen-file edits. No ad-hoc SQL. No migration-history repair.

---

## C. Managed verification summary

### M23 (Staff attendance, leave & holidays foundation)

| Check | Result |
| :--- | :--- |
| Public tables (9) | `staff_employment_profiles`, `staff_admin_events`, `attendance_policies`, `attendance_events`, `attendance_days`, `attendance_corrections`, `leave_types`, `leave_requests`, `holidays` — all present, **0 rows** at apply |
| Private saga ledger | `private.staff_invite_saga_requests` present, **0 rows** |
| Permissions | 44 system permissions (incl. 12 Phase 6D codes) |
| RPCs | `prepare_staff_invite_saga`, `record_staff_invite_auth_success`, `create_staff_member`, `reconcile_staff_invite`, `resend_staff_invite`, attendance/leave/holiday RPCs |
| Linked `db lint` | PASS (unused-variable warnings only on frozen RPCs) |

### Alignment checkpoint *(Historical snapshot immediately after M23 managed apply, before M24 repair was introduced)*

| Check | Result |
| :--- | :--- |
| Managed migrations | M1–M23 aligned |
| Repository migrations | M1–M23 (23 files) at original apply; M1–M24 after forward-only repair |
| M24+ | Absent at original M23 apply; M24 present in repository post-repair |
| Frozen M23 Git blob | `785325143dae0e81b918f8371325785ce061d57a` (Unchanged) |
| M23 Canonical UTF-8/LF SHA-256 | `64f4f15a9501fcf6bda954e021812b0b826022304654dbc49699f0cab7051634` (Unchanged) |
| M23 Legacy Audit Token | `c8c2739b0ea45d6eed49ee5bd3eed6fa383fbb685cd60d21cd9d550f42358f20` |
| Project health | ACTIVE_HEALTHY |

**PHASE 6D M23 HISTORICAL MANAGED APPLY — PASS (M24 MANAGED REPAIR CLOSEOUT PENDING)**

---

## F. Post-closeout repository repair (PR #50 CI — idempotency order)

| Item | Value |
| :--- | :--- |
| Defect | `check_in_attendance` / `check_out_attendance` evaluated open-session guards before idempotency replay |
| Symptom | pgTAP `17_staff_attendance_leave_foundation_test.sql` L.383: `ATTENDANCE_ALREADY_CHECKED_IN` on legitimate replay |
| Root cause | M23 RPC validation order contradicted contract §10 idempotency rule (“duplicate key → return prior result”) |
| Repository fix | Forward-only migration M24 reorders: idempotency lookup → session guard → append event (both check-in and check-out) |
| Managed state | M23 applied **2026-08-10** retains pre-repair function bodies until owner-authorized repair migration |
| M23 Git blob | `785325143dae0e81b918f8371325785ce061d57a` (unaltered) |
| M23 Canonical UTF-8/LF SHA-256 | `64f4f15a9501fcf6bda954e021812b0b826022304654dbc49699f0cab7051634` |
| M23 Legacy Audit Token | `c8c2739b0ea45d6eed49ee5bd3eed6fa383fbb685cd60d21cd9d550f42358f20` |

---

## G. Takeover Audit — Untracked M24 Inspection & Forward-Only Repair

| Item | Value |
| :--- | :--- |
| Inspection target | Untracked `supabase/migrations/20260811140000_staff_attendance_idempotency_repair.sql` (M24) |
| Finding | File contained Cursor's failed Python `StopIteration` traceback (`python : Traceback... StopIteration`). NOT valid SQL. |
| Restoration rule | Staged M23 restoration (`20260810140000_staff_attendance_leave_foundation.sql`) preserved without alteration. |
| Remediation action | Replaced M24 contents with valid forward-only SQL repair (`public.check_in_attendance` & `public.check_out_attendance` reorder). |
| Migration alignment | M24 established as repository forward-only repair migration; M23 frozen baseline untouched. |

---

## D. Non-actions confirmed

- No production deployment
- No public intake activation
- No WhatsApp/Meta callback or token activation
- No Kriti provider production activation
- No OD-1–OD-10 policy seeding
- No attendance production activation (policy catalogue empty until owner OD values)
- No Phase 7 managed write

---

## E. M23 managed apply cutoff (for future recovery)

Conservative cutoff for migrations after M23: **`~2026-08-10T02:46:52Z`** (UTC apply completion).

Backup **1330573859** does not permanently satisfy Phase 10 production activation (DEC-0053).
