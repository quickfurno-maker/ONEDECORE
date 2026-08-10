# Phase 6D — Managed Alignment & Governance Closeout

**Status:** **COMPLETE** (August 10, 2026)  
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

Frozen M23 hash (UTF-8 LF SHA-256) verified unchanged pre-write:

| Field | Value |
| :--- | :--- |
| File | `20260810140000_staff_attendance_leave_foundation.sql` |
| Git blob | `785325143dae0e81b918f8371325785ce061d57a` |
| SHA-256 | `c8c2739b0ea45d6eed49ee5bd3eed6fa383fbb685cd60d21cd9d550f42358f20` |

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

### Alignment checkpoint

| Check | Result |
| :--- | :--- |
| Managed migrations | M1–M23 aligned |
| Repository migrations | M1–M23 (23 files) |
| M24+ | Absent |
| Frozen M23 hash | Unchanged |
| Project health | ACTIVE_HEALTHY |

**PHASE 6D MANAGED ALIGNMENT — PASS**

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
