# ADR-0023: Staff Administration, Attendance & Leave Architecture (Phase 6D Freeze)

**Status:** Accepted (architecture freeze — **implementation NOT STARTED**)  
**Date:** August 8, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Phase 6D preflight / architecture only  
**Depends on:** [DEC-0059](../10-decision-register.md), [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0010](ADR-0010-staff-only-password-authentication.md), [ADR-0008](ADR-0008-database-backed-rbac.md)

---

## Context

Phase 6D is roadmap-locked after Phase 6C (DEC-0059). ONEDECORE already has invitation-only Supabase Auth, `profiles` + `user_roles` RBAC, active-staff enforcement, append-only audit conventions, and a permission-gated `/admin` shell. Phase 6D must add staff employment metadata, sales-staff attendance, leave, and holidays **without** ERP/payroll expansion, continuous GPS, or coupling to sales targets, commission, or salary.

This ADR freezes architecture invariants. It does **not** authorize schema creation, managed apply, routes, or UI.

---

## Decision Drivers

- Reuse existing identity/RBAC; no duplicate staff identity store.
- Server-authoritative timestamps and business-day derivation in `Asia/Kolkata`.
- Append-only operational evidence; corrections are audited overlays, not silent overwrites.
- Role-scoped visibility aligned with ADR-0019 (manager → direct reports; Super Admin operational scope).
- Hard firewall from payroll, commission, sales targets, and ERP (ADR-0005).
- No continuous GPS, route history, or background location.

---

## Decision Outcome

### 1. Identity reuse

| Concept | Source of truth |
| :--- | :--- |
| Auth user | `auth.users` (invitation-only; no public signup) |
| Staff profile | `public.profiles` (`id` = `auth.users.id`) |
| Role | `public.user_roles` → `public.roles` |
| Authorization | `public.authorize(permission_code)` + RLS |
| Active runtime | `profiles.status = 'active'` required (existing enforcement) |

**Status semantics (reuse existing check constraint):**

| `profiles.status` | Meaning | Login | Attendance eligible (if flagged) |
| :--- | :--- | :--- | :--- |
| `pending` | Invited / not yet activated | No | No |
| `active` | Operational staff | Yes (with permissions) | Per `attendance_eligible` flag |
| `suspended` | Temporarily blocked | No | No |
| `disabled` | Offboarded / inactive (maps owner term *inactive*) | No | No; history retained |

Do **not** introduce a parallel status enum.

### 2. Employment extension (future schema — not created in preflight)

New employment metadata lives in a **bounded extension** (proposed name: `staff_employment_profiles`), keyed 1:1 to `profiles.id`, rather than overloading `profiles` with HR fields.

Minimum V1 fields:

| Field | Purpose |
| :--- | :--- |
| `employee_code` | Unique human-facing staff ID |
| `designation` | Job title label |
| `joining_date` | Date (business timezone calendar) |
| `reporting_manager_id` | FK → `profiles.id`; single manager V1 |
| `attendance_eligible` | Boolean; default false except configured roles |
| `attendance_policy_id` | FK → policy row |

Email display/contact continues to use Auth email; phone uses `profiles.phone_e164` where present.

### 3. Reporting manager model (V1)

- Exactly **one** reporting manager per staff member.
- Manager must be `active` at assignment time.
- No self-manager; no cycles (validated server-side).
- Primary sales pattern: `sales_executive` → `sales_manager`.
- Super Admin assigns/reassigns; Sales Manager does **not** reassign managers by default.
- When manager becomes `suspended`/`disabled`, direct reports retain history; new check-ins blocked for inactive manager only as visibility concern — reports remain assigned until Super Admin reassigns.

### 4. Attendance eligibility (V1 default)

| Role | Tracked (check-in/out) | Visibility |
| :--- | :--- | :--- |
| `sales_executive` | Yes (default) | Own |
| `sales_manager` | **Owner decision** (default: yes) | Own + direct reports |
| `super_admin` | No (default) | Full operational read + corrections |
| `project_manager` | No (default) | None unless explicitly enabled later |
| `designer` | No (default) | None unless explicitly enabled later |

Eligibility is enforced by `attendance_eligible` + role permissions, not role alone.

### 5. Timezone

- **Business timezone:** `Asia/Kolkata` (consistent with CRM reporting contracts).
- Store all event timestamps as `timestamptz` (UTC).
- Derive `attendance_date` in business timezone for day bucketing.
- Never use server machine local timezone.

### 6. Attendance logical model

| Concept | Mutability | Purpose |
| :--- | :--- | :--- |
| `attendance_events` | Append-only | Check-in/out evidence, server timestamp, optional location category |
| `attendance_days` | Derived authoritative daily row | One per staff + `attendance_date`; status + flags |
| `attendance_corrections` | Append-only | Manual adjustments with reason and before/after digest |
| `attendance_policies` | Versioned config | Thresholds, workday bounds (owner-configurable) |

**Day invariants:**

- At most one open check-in session per staff.
- Duplicate check-in: idempotent no-op or structured rejection (frozen at implementation).
- Check-out requires open session.
- Missing checkout → `missing_checkout` flag; does not delete check-in evidence.
- Duration derived server-side from evidence timestamps.

### 7. Status derivation

**Primary day status (mutually exclusive):** `present`, `absent`, `half_day`, `leave`, `weekly_off`, `holiday`

**Separate flags:** `late`, `early_checkout`, `missing_checkout`, `manual_adjustment`

Precedence (highest wins for primary status):

1. Approved leave covering date  
2. Holiday calendar entry  
3. Weekly off policy  
4. Present / half_day / absent from evidence + corrections  

`late` / `early_checkout` are flags on top of `present` or `half_day`, not replacements.

Numeric thresholds (office start, grace minutes, half-day hours) are **policy-configurable**; final numbers are owner decisions (see audit doc § Owner Decisions).

### 8. Location (optional one-time evidence)

- Captured at most once per check-in and once per check-out.
- Category only required in V1 UI: `office`, `field`, `client_site`.
- Optional coarse coordinates stored with minimized precision if owner enables; default architecture prefers **category-only** V1.
- Retention: operational minimum; no route history; no background tracking; no geofencing enforcement in V1.

### 9. Leave (V1)

States: `pending` → `approved` | `rejected`; `cancelled` from `pending` (and limited rules from `approved` — owner decision).

- Requester: active, attendance-eligible staff.
- Approver: reporting manager for direct reports; Super Admin override.
- Manager self-approval: **denied** by default.
- No leave balance/accrual/payroll linkage.
- Approved leave sets day primary status to `leave` (overrides absent/present derivation).

### 10. Holidays

- Authoritative internal `holidays` calendar (date, name, active flag).
- Super Admin mutates; append-only audit for changes.
- Holiday → primary status `holiday` when no approved leave.

### 11. Manual corrections

Authorized actors (default):

- Super Admin: any staff/date.
- Sales Manager: direct reports only **if** owner enables (`attendance.correct.team` permission).

Each correction records: actor, time, reason, staff, date, before digest, after digest, correction type. Original evidence immutable.

### 12. Authorization permissions (proposed naming)

| Permission | Typical grant |
| :--- | :--- |
| `staff.manage` | Super Admin |
| `staff.read` | Super Admin |
| `attendance.self` | SE, SM (eligible) |
| `attendance.team.read` | SM |
| `attendance.read.all` | Super Admin |
| `attendance.correct.all` | Super Admin |
| `attendance.correct.team` | SM (optional) |
| `leave.self` | SE, SM |
| `leave.team.approve` | SM |
| `leave.manage` | Super Admin |
| `holidays.manage` | Super Admin |

RLS enforces row scope; UI hiding is insufficient.

### 13. RPC / server boundary

- All mutations via SECURITY DEFINER RPCs or server actions with `auth.uid()` actor resolution.
- Hardened `search_path`; revoke PUBLIC execute.
- No browser service-role; no caller-supplied actor ID trust.
- Idempotency keys for check-in/out and invite retries.

### 14. Explicit non-goals (V1)

- Payroll, salary, commission, sales target adjustment
- Biometrics, facial recognition, fingerprint
- Continuous GPS, route maps, productivity surveillance
- Shift rostering beyond simple policy
- ERP / full HRMS

### 15. Implementation sequencing (future)

See `docs/audits/phase-6d-staff-attendance-leave-architecture-freeze.md` § Implementation DAG.

**No migration file created in this ADR.**

---

## Consequences

### Positive

- Phase 6D can implement against frozen invariants without rework of identity/RBAC.
- Privacy and ERP boundaries are explicit before schema work.

### Negative / trade-offs

- Employment extension adds a new table family (minimal count).
- Owner must supply numeric policy defaults before managed apply or accept seeded policy defaults in implementation gate.

---

## Related

- [Phase 6D architecture freeze audit](../audits/phase-6d-staff-attendance-leave-architecture-freeze.md)
- [Phase 6D implementation contract freeze](../audits/phase-6d-implementation-contract-freeze.md)
- [Phase 6D roadmap lock](../audits/phase-6d-roadmap-lock.md)
- [DEC-0059](../10-decision-register.md)
