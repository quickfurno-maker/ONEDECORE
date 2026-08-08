# Phase 6D — Staff Administration, Attendance & Leave (Architecture Freeze)

**Status:** PREFLIGHT COMPLETE — **implementation NOT STARTED**  
**Date:** August 8, 2026  
**Baseline main:** `9e4547d4b83fdd733ab66665bfc6519b4771df2f`  
**Managed:** M1–M21 (M22 repository-only; pending Phase 6C recovery gate)  
**Governance:** DEC-0059 (scope lock); [ADR-0023](../ADR/ADR-0023-staff-attendance-leave-architecture.md) (architecture invariants)

---

## 1. Purpose

Freeze Phase 6D architecture while Phase 6C waits for post-M21 recovery before managed M22 apply. This packet makes Phase 6D **implementation-ready** without creating M23+, modifying M22, managed writes, routes, runtime, or UI.

---

## 2. Existing Identity / RBAC Audit

### 2.1 Canonical tables (live)

| Table | Role |
| :--- | :--- |
| `auth.users` | Supabase Auth identity (invitation-only per ADR-0010) |
| `public.profiles` | 1:1 staff profile; `id` = `auth.users.id` |
| `public.roles` / `permissions` / `role_permissions` / `user_roles` | Database-backed RBAC |
| `public.authorize(text)` | Permission probe; requires `profiles.status = 'active'` |

### 2.2 Profile fields today

- `display_name`, `phone_e164`, `status`, `created_at`, `updated_at`
- **No** `employee_code`, `designation`, `joining_date`, `reporting_manager_id` — **new in Phase 6D extension**

### 2.3 Status model (reuse — do not fork)

| Status | Semantics |
| :--- | :--- |
| `pending` | Auth user exists; not yet active for operations |
| `active` | Full runtime when permissions grant |
| `suspended` | Blocked login and all runtime |
| `disabled` | Offboarded (*owner term: inactive*) |

Enforced in `private.has_permission()` / `private.has_role()` (migration 4).

### 2.4 Roles (ADR-0019)

`super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer` (+ legacy seeds retained).

**Multiple roles:** `user_roles` allows multiple rows; Phase 6D authorization must evaluate **effective permissions** union, but attendance eligibility uses explicit `attendance_eligible` flag to avoid accidental PM/Designer tracking.

### 2.5 Invitation model today

- ADR-0010: staff-only email/password; no public signup.
- Account creation today: controlled admin/CLI/dashboard — **no production invite UI yet**.
- Phase 6D V1 adds **Super Admin Add Staff** with server-only `auth.admin.inviteUserByEmail` (or equivalent supported Supabase Admin API) — never browser service-role.

### 2.6 Reusable audit patterns

- Append-only event tables (`lead_events`, `kriti_events`, import events, WhatsApp events)
- `private.forbid_append_only_mutation()` triggers
- SECURITY DEFINER RPCs with hardened `search_path`
- Actor from `auth.uid()`; active staff guard
- Bounded JSONB payloads; no secrets in audit

### 2.7 Admin shell

- `/admin` layout: `requireStaffPermission("admin.access")`
- Permission-gated nav (CRM, WhatsApp) — Phase 6D adds Staff / Attendance / Leave sections similarly

### 2.8 Business timezone convention

- `Asia/Kolkata` already used in CRM reporting (`REPORT_TIMEZONE`).

---

## 3. Staff Administration (frozen V1)

### 3.1 Add Staff lifecycle

```
Super Admin
  → validate employee_code, email, phone, role eligibility
  → server-only Auth invite/create
  → upsert profiles (pending)
  → insert staff_employment_profiles
  → assign user_roles (single primary operational role V1)
  → set reporting_manager_id
  → audit: staff.created / staff.invited
  → user completes Supabase invite/password flow
  → on first verified session: profiles.status active (explicit transition or invite callback policy)
```

**Guards:**

- No plaintext passwords in app DB or logs
- No browser service-role
- Unique `employee_code`
- Email uniqueness via Auth
- Orphan prevention: transactional RPC wrapping profile + employment + role
- Partial failure reconciliation: idempotent invite retry keyed by email + employee_code

### 3.2 Staff directory V1 fields

Display: name, employee ID, designation, role, reporting manager, status, joining date, contact (scoped).

Actions: view, edit safe metadata, resend invite, role change (SA only), manager change (SA only), suspend/disable (SA only).

### 3.3 Fields rationale

| Field | Why | Mutator | Visibility |
| :--- | :--- | :--- | :--- |
| `employee_code` | Human ops reference | SA | SA, SM (team), SE (self) |
| `designation` | Org chart label | SA | directory scoped |
| `joining_date` | HR ops | SA | directory scoped |
| `reporting_manager_id` | Leave/attendance scope | SA | directory scoped |
| `attendance_eligible` | Explicit tracking gate | SA | SA, self |
| `attendance_policy_id` | Threshold config | SA | SA |

---

## 4. Reporting Manager (frozen)

- Single `reporting_manager_id` → `profiles.id`
- Constraints: not self; manager active; no cycles (recursive check in RPC)
- Assignment authority: **Super Admin only** V1
- Sales Executive → Sales Manager default pattern
- Inactive manager: historical attendance/leave retained; SM approval routes blocked until reassignment

---

## 5. Attendance Domain (frozen)

### 5.1 Eligible roles (V1 default)

| Role | Default tracked |
| :--- | :--- |
| `sales_executive` | Yes |
| `sales_manager` | Owner decision (architect as configurable; default yes) |
| `super_admin` | No (visibility only) |
| `project_manager` | No |
| `designer` | No |

### 5.2 Check-in flow (logical)

```
active staff + attendance_eligible + permission
  → resolve attendance_date (Asia/Kolkata)
  → ensure no open session
  → optional one-time location category
  → append attendance_events (check_in)
  → upsert attendance_days (derive status/flags)
  → return summary
```

### 5.3 Check-out flow (logical)

```
active staff + attendance_eligible + open session
  → optional one-time location category
  → append attendance_events (check_out)
  → compute duration server-side
  → update attendance_days flags (early_checkout, etc.)
```

### 5.4 Idempotency / concurrency

- Client-generated idempotency key per check-in/out action
- DB unique partial index: one open session per staff
- `SELECT … FOR UPDATE` on attendance_days row during mutation RPC
- Duplicate tap → same result payload (no double session)

### 5.5 Workday policy (configurable — not invented numerically)

Stored in `attendance_policies`:

| Policy key | Owner decision required |
| :--- | :--- |
| `workday_start_local` | Yes |
| `workday_end_local` | Yes |
| `late_grace_minutes` | Yes |
| `half_day_threshold_minutes` | Yes |
| `missing_checkout_cutoff_local` | Yes |
| `weekly_off_days` | Yes (e.g. Sunday) |

Architecture treats these as **data**, not hard-coded constants.

### 5.6 Derivation precedence

1. Approved leave  
2. Holiday  
3. Weekly off  
4. Evidence-based present / half_day / absent  
5. Flags: late, early_checkout, missing_checkout, manual_adjustment  

### 5.7 Manual corrections

Append-only `attendance_corrections` + update derived `attendance_days` with `manual_adjustment` flag. Original events never deleted.

---

## 6. Location Privacy (frozen)

| Rule | Value |
| :--- | :--- |
| Continuous GPS | **Prohibited** |
| Capture points | Check-in and check-out only |
| V1 UI category | `office`, `field`, `client_site` |
| Coordinates | Optional future; minimized precision; shorter retention than events |
| Manager view | Category by default; coordinates SA-only if stored |
| Permission denied | Check-in/out still allowed if location optional; if owner mandates location, structured denial code |

---

## 7. Leave & Holidays (frozen)

### 7.1 Leave types (V1 catalogue — owner selects active set)

Suggested starter types (enable subset at implementation): `casual`, `sick`, `earned`, `unpaid` — **owner decision on launch set**.

### 7.2 Leave request lifecycle

`pending` → `approved` | `rejected`; `cancelled` (rules frozen at implementation for post-approval cancel).

Validations: date range; no overlap with approved leave; half-day flag; inactive staff cannot create.

### 7.3 Approvers

- Direct reporting manager for reportees
- Super Admin override
- No manager self-approval

### 7.4 Holidays

`holidays(date, name, is_active)` — SA manage; append-only audit on change.

---

## 8. Authorization Matrix (frozen)

| Action | SA | SM | SE | PM | Designer | Inactive |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Add/edit staff | ✓ | — | — | — | — | — |
| Role assign | ✓ | — | — | — | — | — |
| Manager assign | ✓ | — | — | — | — | — |
| Own check-in/out | opt | ✓* | ✓ | — | — | — |
| Team attendance read | ✓ | ✓† | — | — | — | — |
| All attendance read | ✓ | — | — | — | — | — |
| Correct attendance | ✓ | ‡ | — | — | — | — |
| Own leave request | opt | ✓* | ✓ | — | — | — |
| Approve team leave | ✓ | ✓† | — | — | — | — |
| Manage holidays | ✓ | — | — | — | — | — |

\* If `attendance_eligible`  
† Direct reports only  
‡ Only if owner enables `attendance.correct.team`  
`opt` = Super Admin not tracked by default but has visibility

---

## 9. RLS / RPC Strategy (frozen)

- 100% RLS on all Phase 6D tables
- `anon`: no access
- `authenticated` + inactive: no mutations
- Reads: self → `auth.uid()`; manager → direct reports via `reporting_manager_id`; SA → policy-gated broad read
- Mutations: SECURITY DEFINER RPCs only for invariants (check-in/out, leave approve, corrections)
- Grants: revoke PUBLIC; explicit execute to `authenticated` per RPC
- `search_path = ''` on all definer functions

---

## 10. UI / Information Architecture (design only)

### 10.1 Navigation (under `/admin`)

**Staff**

- `/admin/staff` — directory
- `/admin/staff/new` — add staff (SA)
- `/admin/staff/[id]` — detail

**Attendance**

- `/admin/attendance` — my attendance (mobile-first check-in card)
- `/admin/attendance/team` — manager team view
- `/admin/attendance/calendar` — monthly calendar
- `/admin/attendance/corrections` — SA (optional SM scoped)

**Leave**

- `/admin/leave` — my requests
- `/admin/leave/team` — approvals (SM)
- `/admin/leave/types` — SA catalogue

**Administration**

- `/admin/holidays` — SA
- `/admin/attendance-policies` — SA

Nav links permission-gated like CRM/WhatsApp.

### 10.2 Mobile check-in UX

- Large check-in / check-out CTA
- Today status, duration, flags
- Optional location category picker (not map surveillance)
- Offline-tolerant UI shows last known server state; mutations require connectivity

---

## 11. Reporting Scope (plan only)

Operational counts only: present, absent, leave, half days, late count, early checkout count, recorded duration.

**No** linkage to `sales_targets`, commission, payroll, or achievement calculations.

---

## 12. Proposed Future Migration Scope (NOT CREATED)

**Single bounded future migration** (tentatively next after Phase 6C M22 — **not allocated as M23 in this preflight**):

| Object | Type | Notes |
| :--- | :--- | :--- |
| `staff_employment_profiles` | table | 1:1 `profiles`; employment metadata |
| `attendance_policies` | table | Configurable thresholds |
| `attendance_days` | table | Derived daily authoritative state |
| `attendance_events` | table | Append-only check-in/out evidence |
| `attendance_corrections` | table | Append-only |
| `leave_types` | table | Catalogue |
| `leave_requests` | table | Workflow state |
| `holidays` | table | Calendar |
| `staff_admin_events` | table | Optional unified audit or per-domain events |

Reuse: `profiles`, `user_roles`, `roles`, `authorize`, existing active-staff guards.

Estimated: **8 tables + RPCs + RLS** in one migration if scope holds; if not, stop and re-govern before M23.

---

## 13. Future Implementation DAG

| Packet | Scope |
| :--- | :--- |
| **6D-A** | Staff employment extension + invite/add RPC + directory API |
| **6D-B** | Attendance policies, events, days, check-in/out RPCs |
| **6D-C** | Leave types, requests, holidays |
| **6D-D** | Staff/attendance/leave UI (mobile-first attendance) |
| **6D-I** | Integrated local E2E + security |
| **6D-DB** | Recovery readiness + managed apply owner gate |
| **6D-CLOSE** | Governance closeout |

Depends on: Phase 6C COMPLETE (including M22 managed).

---

## 14. Test / Security Matrices

### 14.1 pgTAP (planned)

- RLS enabled all tables
- anon denied
- inactive/pending denied
- self scope read/write
- manager direct-report scope
- cross-manager denial
- SA broad read
- employee_code uniqueness
- manager cycle rejection
- check-in idempotency
- checkout without session denied
- append-only events
- correction audit immutability
- leave overlap rejection
- holiday precedence
- no sales_targets mutation from attendance RPCs

### 14.2 App tests (planned)

- Add staff validation
- Mocked invite flow
- Mobile check-in/out
- Duplicate click
- Location optional/mandatory paths
- Calendars
- Leave approve/reject
- Correction forms
- Role visibility
- a11y + responsive

### 14.3 Security (planned)

- Actor spoof / IDOR
- Cross-team access
- Role escalation
- Service-role leak scan
- Location data minimization
- PII in logs audit
- CSRF/origin on mutations
- Request size bounds

---

## 15. Owner Decisions Required (minimized)

| # | Decision | Architecture handling |
| :--- | :--- | :--- |
| OD-1 | Standard office start time | `attendance_policies.workday_start_local` |
| OD-2 | Late grace period (minutes) | `late_grace_minutes` |
| OD-3 | Half-day threshold (minutes worked) | `half_day_threshold_minutes` |
| OD-4 | Expected checkout time | `workday_end_local` |
| OD-5 | Weekly off day(s) | `weekly_off_days` array |
| OD-6 | Is Sales Manager attendance-tracked? | `attendance_eligible` default for SM |
| OD-7 | Can SM correct direct-report attendance? | `attendance.correct.team` permission |
| OD-8 | Is location mandatory or optional? | policy flag `location_required` |
| OD-9 | Launch leave types enabled | seed rows in `leave_types` |
| OD-10 | Post-approval leave cancellation allowed? | leave RPC rules |

None block architecture freeze; implementation gate must record chosen values or explicit defaults.

---

## 16. Non-Actions (this preflight)

| Item | Status |
| :--- | :--- |
| M23 created | **NO** |
| M22 edited | **NO** |
| Managed write | **0** |
| Phase 6D runtime | **NOT STARTED** |
| Routes / UI | **NOT STARTED** |
| Phase 7 started | **NO** |
| Production activation | **NO** |

---

## 17. Phase 6C Interaction

Phase 6C remains **waiting only** for post-M21 recovery before managed M22 apply. This preflight does not affect M22 or recovery qualification.

---

## Related

- [ADR-0023](../ADR/ADR-0023-staff-attendance-leave-architecture.md)
- [Phase 6D implementation contract freeze](phase-6d-implementation-contract-freeze.md)
- [Phase 6D roadmap lock](phase-6d-roadmap-lock.md)
- [DEC-0059](../10-decision-register.md)
