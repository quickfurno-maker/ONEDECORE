# Phase 6D — Implementation Contract Freeze

**Status:** CONTRACT FROZEN — **runtime NOT STARTED**  
**Date:** August 8, 2026  
**Baseline main:** `d162d9c164a0c4d72269064b6cc50f35cf84c99a`  
**Depends on:** [ADR-0023](../ADR/ADR-0023-staff-attendance-leave-architecture.md), [Phase 6D architecture freeze](phase-6d-staff-attendance-leave-architecture-freeze.md), [DEC-0059](../10-decision-register.md)

This document freezes **exact future contracts** for Phase 6D implementation. It authorizes no migration, SQL, routes, runtime, or managed writes.

---

## 1. Identity and employment

### 1.1 Existing tables (unchanged responsibility)

| Table | Responsibility |
| :--- | :--- |
| `auth.users` | Supabase Auth identity; invitation-only |
| `public.profiles` | Display name, `phone_e164`, `status`, timestamps; 1:1 `auth.users` |
| `public.user_roles` | Role assignment; `assigned_by`, `assigned_at` |
| `public.roles` / `permissions` / `role_permissions` | RBAC catalogue and grants |
| `public.authorize(text)` | Permission probe; requires `profiles.status = 'active'` |

**Not duplicated on employment extension:** email (Auth), phone (`profiles.phone_e164`), role (`user_roles`), profile status (`profiles.status`).

### 1.2 `public.staff_employment_profiles` (future)

1:1 extension keyed to `profiles.id`. Name follows repo `snake_case` table convention.

| Column | Type | Nullable | Default | Validation / constraint |
| :--- | :--- | :---: | :--- | :--- |
| `staff_id` | `uuid` | NO | — | PK, FK → `profiles(id)` ON DELETE RESTRICT |
| `employee_code` | `text` | NO | — | UNIQUE; `^[A-Z0-9][A-Z0-9_-]{2,31}$` (implementation may normalize case) |
| `designation` | `text` | NO | — | `length(trim(designation))` between 1 and 120 |
| `joining_date` | `date` | NO | — | Not in the future (business calendar) |
| `reporting_manager_id` | `uuid` | YES | NULL | FK → `profiles(id)` ON DELETE RESTRICT |
| `attendance_eligible` | `boolean` | NO | `false` | — |
| `attendance_policy_id` | `uuid` | YES | NULL | FK → `attendance_policies(id)` ON DELETE RESTRICT |
| `invite_reconciliation_state` | `text` | NO | `'none'` | See §2 |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | trigger `private.set_updated_at()` |

| Concern | Rule |
| :--- | :--- |
| Mutator | Super Admin via `staff.manage` RPCs only |
| Visibility | SA all; SM direct reports (limited fields); SE self (limited) |
| Audit | `staff_admin_events` on create/update of employment fields |

**CHECK constraints (future migration):**

- `reporting_manager_id IS NULL OR reporting_manager_id <> staff_id`
- `attendance_eligible = false OR attendance_policy_id IS NOT NULL` (fail closed when eligible but no policy)

---

## 2. Staff invite / add contract

### 2.1 Input DTO — `CreateStaffMemberInput`

| Field | Type | Required | Notes |
| :--- | :--- | :---: | :--- |
| `clientRequestId` | `uuid` | YES | Idempotency key for full add-staff operation |
| `employeeCode` | `string` | YES | Unique |
| `displayName` | `string` | YES | 1–120 chars; maps to `profiles.display_name` |
| `email` | `string` | YES | Auth email; RFC-valid, max 254 |
| `phoneE164` | `string` | NO | E.164 if present |
| `designation` | `string` | YES | |
| `joiningDate` | `string` (ISO date) | YES | Business calendar date |
| `roleCode` | enum | YES | One of ADR-0019 operational roles assignable by SA |
| `reportingManagerId` | `uuid` | NO | Required when `roleCode = sales_executive` |
| `attendanceEligible` | `boolean` | YES | Must align with OD-6 at activation |
| `attendancePolicyId` | `uuid` | NO | Required when `attendanceEligible = true` |

### 2.2 Output DTO — `CreateStaffMemberResult`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `staffId` | `uuid` | `profiles.id` |
| `employeeCode` | `string` | |
| `profileStatus` | `pending` \| `active` | |
| `invitationState` | `invited` \| `reconciliation_required` \| `completed` | |
| `reconciliationState` | `none` \| `auth_created_db_pending` \| `db_created_auth_pending` | |
| `idempotentReplay` | `boolean` | |

### 2.3 Validation order (frozen)

1. Authenticate + `staff.manage` + active staff  
2. `clientRequestId` idempotency lookup  
3. `employeeCode` uniqueness  
4. Email format + not already active staff with conflicting employment  
5. Phone format if present  
6. `roleCode` allowed for SA assignment  
7. `reportingManagerId` rules (active, no cycle, role eligibility)  
8. `attendanceEligible` / `attendancePolicyId` consistency  
9. External Auth invite/create (server-only Admin API)  
10. DB transactional finalize: `profiles`, `staff_employment_profiles`, `user_roles` (single operational role), audit event  
11. On DB failure after Auth success: set `invite_reconciliation_state = 'auth_created_db_pending'`; return `reconciliation_required` (no Auth user deletion in V1)

### 2.4 Reconciliation saga (frozen)

Auth and PostgreSQL **cannot** share one transaction.

| Step | Action |
| :--- | :--- |
| 1 | Record idempotency ledger row keyed by `clientRequestId` |
| 2 | Call Supabase Auth Admin invite/create |
| 3 | `BEGIN` — upsert profile (`pending`), employment row, single `user_roles` row, audit |
| 4 | `COMMIT` or mark reconciliation state on failure |
| 5 | Resend/reconcile RPC: `reconcile_staff_invite(p_client_request_id)` — idempotent |

**Idempotency identity:** `clientRequestId` (primary) + secondary uniqueness on `employee_code` and Auth `email`.

**Prohibited:** plaintext passwords; browser service-role; orphan Auth without reconciliation marker.

### 2.5 Future RPC names

| RPC | Purpose |
| :--- | :--- |
| `create_staff_member(...)` | Add staff + invite |
| `reconcile_staff_invite(p_client_request_id uuid)` | Retry DB finalize |
| `resend_staff_invite(p_staff_id uuid)` | Resend invitation |
| `update_staff_employment(...)` | Metadata/manager/eligibility |
| `set_staff_profile_status(p_staff_id uuid, p_status text, p_reason text)` | Status transitions |

---

## 3. Staff status and role transitions

### 3.1 Status enum (reuse)

`pending` | `active` | `suspended` | `disabled`

### 3.2 Allowed transitions (frozen)

| From | To | Authority | Notes |
| :--- | :--- | :--- | :--- |
| `pending` | `active` | System on first verified session OR SA explicit activate | Invite completion |
| `active` | `suspended` | SA | Audit required |
| `suspended` | `active` | SA | Audit required |
| `active` / `suspended` | `disabled` | SA | Offboarding; audit required |
| `disabled` | `active` | **Denied in V1** | Requires **rehire** path: new `create_staff_member` or future `rehire_staff_member` (separate contract) |

### 3.3 V1 single operational role

- `user_roles` technically allows multiple rows; **V1 staff admin RPCs enforce exactly one operational role** from the ADR-0019 set per staff member.
- Attendance/manager resolution uses employment row + that primary role code (from join), not permission union ambiguity.
- PM/Designer roles are not attendance-eligible unless explicitly set via `attendance_eligible` + owner policy (default false).

---

## 4. Reporting hierarchy

### 4.1 Invariants

- `reporting_manager_id <> staff_id`
- Manager `profiles.status = 'active'` at assignment
- No cycles (recursive CTE in `private.assert_no_reporting_cycle(p_staff_id, p_manager_id)`)
- Assignment authority: **Super Admin only** (`staff.manage`)
- No automatic reassignment when manager disabled; SA must reassign
- Historical attendance/leave retained

### 4.2 Direct-report resolver (canonical)

**Single helper:** `private.staff_direct_report_ids(p_manager_id uuid) returns setof uuid`

Used by:

- RLS policies (`attendance_days`, `leave_requests`, team reads)
- `attendance.team.read` / `leave.team.approve` scope checks
- Manager team UI loaders

No competing team resolver functions.

### 4.3 Future RPC

`set_staff_reporting_manager(p_staff_id uuid, p_manager_id uuid, p_reason text)` — SA only; cycle check; audit.

---

## 5. Permission codes (frozen vocabulary)

| Code | SA | SM | SE | PM | Designer | pending/inactive |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `staff.manage` | ✓ | — | — | — | — | — |
| `staff.read` | ✓ | ✓* | — | — | — | — |
| `attendance.self` | —† | ✓‡ | ✓‡ | — | — | — |
| `attendance.team.read` | ✓ | ✓* | — | — | — | — |
| `attendance.read.all` | ✓ | — | — | — | — | — |
| `attendance.correct.all` | ✓ | — | — | — | — | — |
| `attendance.correct.team` | — | ✓§ | — | — | — | — |
| `leave.self` | —† | ✓‡ | ✓‡ | — | — | — |
| `leave.team.approve` | ✓ | ✓* | — | — | — | — |
| `leave.manage` | ✓ | — | — | — | — | — |
| `holidays.manage` | ✓ | — | — | — | — | — |
| `attendance.policies.manage` | ✓ | — | — | — | — | — |

\* Direct reports only for team-scoped permissions  
† SA not attendance-tracked by default; may receive read permissions without `attendance.self`  
‡ Only if `attendance_eligible`  
§ Only if OD-7 enabled

**Seed intent:** New rows in `permissions` + `role_permissions` in future migration packet; no seed SQL in this contract.

---

## 6. Attendance policies

### 6.1 Table `public.attendance_policies`

**Historical reproducibility strategy (frozen): Strategy A — versioned immutable policies**

- Policy rows are **insert-only**; changes create a new row with new `id`.
- `is_current` boolean marks assignable default (at most one current per org in V1).
- `attendance_days.attendance_policy_id` stores the policy version used for derivation (FK).
- Past days **never** silently recompute when a new policy is published.

| Column | Type | Nullable | Validation |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | NO | PK default `gen_random_uuid()` |
| `code` | `text` | NO | Unique per version family; e.g. `default` |
| `name` | `text` | NO | 1–120 chars |
| `timezone` | `text` | NO | Must be `Asia/Kolkata` in V1 |
| `workday_start_local` | `time` | NO | — |
| `workday_end_local` | `time` | NO | Must be after start |
| `late_grace_minutes` | `integer` | NO | 0–240 |
| `half_day_threshold_minutes` | `integer` | NO | 0–720 |
| `missing_checkout_cutoff_local` | `time` | NO | — |
| `weekly_off_days` | `smallint[]` | NO | ISO DOW 1–7; distinct |
| `location_required` | `boolean` | NO | OD-8 input |
| `is_current` | `boolean` | NO | default false |
| `supersedes_policy_id` | `uuid` | YES | FK self; lineage |
| `created_at` | `timestamptz` | NO | `now()` |

**No numeric defaults seeded in this contract.** Until owner supplies OD-1–OD-5 and OD-8, `create_staff_member` with `attendanceEligible=true` **fails closed** if no current policy exists.

### 6.2 Policy RPCs

| RPC | Authority |
| :--- | :--- |
| `publish_attendance_policy(...)` | `attendance.policies.manage` |
| `set_current_attendance_policy(p_policy_id uuid)` | SA |

---

## 7. Attendance events (append-only)

### 7.1 Table `public.attendance_events`

| Column | Type | Nullable | Notes |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | NO | PK |
| `staff_id` | `uuid` | NO | FK → profiles |
| `attendance_date` | `date` | NO | Business TZ date at event time |
| `event_type` | `text` | NO | `check_in` \| `check_out` |
| `occurred_at` | `timestamptz` | NO | Server `now()` at insert |
| `idempotency_key` | `text` | NO | Per staff + action |
| `location_category` | `text` | YES | `office` \| `field` \| `client_site` |
| `latitude` | `numeric(9,6)` | YES | Coarse; optional |
| `longitude` | `numeric(9,6)` | YES | Coarse; optional |
| `location_accuracy_m` | `numeric(8,2)` | YES | 0–5000 if present |
| `client_reported_at` | `timestamptz` | YES | **Non-authoritative** diagnostic only |
| `attendance_policy_id` | `uuid` | NO | FK snapshot |
| `created_at` | `timestamptz` | NO | `now()` |

**Constraints:**

- UNIQUE (`staff_id`, `idempotency_key`)
- Partial unique: at most one open `check_in` without matching `check_out` per staff (enforced in RPC + partial index on open session marker in `attendance_days`)
- Append-only triggers (`private.forbid_append_only_mutation`)

**Indexes:** `(staff_id, attendance_date, occurred_at)`, `(staff_id, idempotency_key)`

---

## 8. Attendance days (authoritative derived)

### 8.1 Table `public.attendance_days`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `staff_id` | `uuid` | FK |
| `attendance_date` | `date` | Business calendar |
| `primary_status` | `text` | Enum below |
| `first_check_in_at` | `timestamptz` | nullable |
| `last_check_out_at` | `timestamptz` | nullable |
| `worked_minutes` | `integer` | 0–1440; derived |
| `is_late` | `boolean` | flag |
| `is_early_checkout` | `boolean` | flag |
| `is_missing_checkout` | `boolean` | flag |
| `has_manual_adjustment` | `boolean` | flag |
| `open_session` | `boolean` | invariant helper |
| `attendance_policy_id` | `uuid` | FK version used |
| `derived_at` | `timestamptz` | last derivation |
| `created_at` / `updated_at` | `timestamptz` | |

**Primary key:** (`staff_id`, `attendance_date`)

**`primary_status` enum:** `present` | `absent` | `half_day` | `leave` | `weekly_off` | `holiday`

**Derivation:** RPCs call `private.derive_attendance_day(p_staff_id, p_attendance_date)` after event/correction/leave/holiday changes. Persisted values (not query-only).

**Precedence:** approved leave → holiday → weekly off → evidence-based present/half_day/absent.

---

## 9. Attendance corrections (append-only)

### 9.1 Table `public.attendance_corrections`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `staff_id` | `uuid` | |
| `attendance_date` | `date` | |
| `actor_id` | `uuid` | FK profiles |
| `reason` | `text` | 1–500 chars required |
| `correction_type` | `text` | `set_primary_status` \| `clear_missing_checkout` \| `adjust_worked_minutes` \| `void_open_session` |
| `before_digest` | `text` | SHA-256 of bounded before JSON |
| `after_digest` | `text` | SHA-256 of bounded after JSON |
| `details` | `jsonb` | bounded ≤ 2048 bytes |
| `created_at` | `timestamptz` | |

**Authority:** `attendance.correct.all` OR (`attendance.correct.team` + direct report).

**Flow:** append correction → `derive_attendance_day` → set `has_manual_adjustment`.

---

## 10. Check-in / check-out RPC contracts

Naming follows repo verb_noun pattern (`assign_lead`, `create_manual_lead`).

### 10.1 `check_in_attendance`

```text
check_in_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
) returns jsonb
```

**Validation order:** auth → active → `attendance.self` → `attendance_eligible` → current policy exists → location policy (OD-8) → no open session → idempotency → append `check_in` event → derive day → return summary.

**Return JSON fields:** `staffId`, `attendanceDate`, `primaryStatus`, `eventId`, `openSession`, `idempotentReplay`, `occurredAt`.

### 10.2 `check_out_attendance`

```text
check_out_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
) returns jsonb
```

**Validation order:** auth → active → eligible → permission → open session required → location policy → idempotency → append `check_out` → derive minutes/flags → return summary.

### 10.3 Concurrency

- `SELECT … FOR UPDATE` on `attendance_days` row for (`staff_id`, `attendance_date`)
- Duplicate idempotency key → return prior result (`idempotentReplay: true`)
- Conflicting idempotency payload → `ATTENDANCE_IDEMPOTENCY_CONFLICT`

---

## 11. Attendance error vocabulary

Frozen codes (TypeScript mirror in `src/features/staff-attendance/contracts/errors.ts`):

| Code | When |
| :--- | :--- |
| `ATTENDANCE_UNAUTHORIZED` | No session / permission |
| `ATTENDANCE_INACTIVE_STAFF` | pending/suspended/disabled |
| `ATTENDANCE_NOT_ELIGIBLE` | `attendance_eligible = false` |
| `ATTENDANCE_POLICY_MISSING` | No current policy |
| `ATTENDANCE_ALREADY_CHECKED_IN` | Open session exists |
| `ATTENDANCE_NOT_CHECKED_IN` | Checkout without open session |
| `ATTENDANCE_LOCATION_REQUIRED` | OD-8 true; category/coords missing |
| `ATTENDANCE_LOCATION_INVALID` | Bad category or out-of-range coords |
| `ATTENDANCE_IDEMPOTENCY_CONFLICT` | Same key, different payload |
| `ATTENDANCE_INVALID_CORRECTION` | Validation failed |
| `ATTENDANCE_MANAGER_SCOPE_DENIED` | Team action outside direct reports |
| `ATTENDANCE_POLICY_NOT_CONFIGURED` | Owner policy values not yet published |

Pattern: `DOMAIN_REASON` uppercase; no raw SQL in client responses.

---

## 12. Location contract

| Rule | Value |
| :--- | :--- |
| Continuous GPS | **Prohibited** |
| Categories | `office`, `field`, `client_site` |
| Coordinates | Nullable columns exist; populated only when client supplies and policy allows |
| Precision | Round to 3 decimal degrees max before persist (~100m) |
| Accuracy | `location_accuracy_m` 0–5000 if stored |
| Manager visibility | Category only by default; coordinates SA-only read |
| Retention | Same as attendance events; no route history |
| OD-8 false | Check-in/out proceeds without location fields |
| OD-8 true | `ATTENDANCE_LOCATION_REQUIRED` if category missing |
| Permission denied | No fabricated coords; structured failure |

---

## 13. Leave types

### 13.1 Table `public.leave_types`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `code` | `text` | UNIQUE; `^[a-z][a-z0-9_]*$` |
| `display_name` | `text` | 1–80 chars |
| `allows_half_day` | `boolean` | default false |
| `is_active` | `boolean` | default true |
| `created_at` | `timestamptz` | |

**No `is_paid`** — payroll out of scope.

OD-9 selects which codes are active at seed/activation; **no rows seeded in this contract**.

---

## 14. Leave requests

### 14.1 Table `public.leave_requests`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `staff_id` | `uuid` | FK requester |
| `leave_type_id` | `uuid` | FK |
| `start_date` | `date` | |
| `end_date` | `date` | >= start |
| `half_day_part` | `text` | NULL \| `am` \| `pm` |
| `reason` | `text` | 1–500 |
| `status` | `text` | `pending` \| `approved` \| `rejected` \| `cancelled` |
| `reviewed_by` | `uuid` | nullable |
| `reviewed_at` | `timestamptz` | nullable |
| `review_note` | `text` | nullable, max 500 |
| `created_at` / `updated_at` | `timestamptz` | |

**Rules:**

- Overlap with `approved` leave on same staff → reject
- Half-day only if `leave_types.allows_half_day`
- Approver: reporting manager for direct reports; SA override via `leave.manage`
- Self-approval denied
- Inactive staff cannot create
- Approved leave sets `attendance_days.primary_status = leave` (overrides holiday for that date)
- OD-10 governs post-approval cancellation (contract only; no value invented)

### 14.2 Leave RPCs

| RPC | Actor |
| :--- | :--- |
| `create_leave_request(...)` | Self + `leave.self` |
| `cancel_leave_request(p_request_id uuid, p_reason text)` | Self (rules per OD-10) or SA |
| `approve_leave_request(p_request_id uuid, p_note text)` | Manager/SA |
| `reject_leave_request(p_request_id uuid, p_note text)` | Manager/SA |

**Leave error codes:** `LEAVE_UNAUTHORIZED`, `LEAVE_OVERLAP`, `LEAVE_INVALID_RANGE`, `LEAVE_HALF_DAY_NOT_ALLOWED`, `LEAVE_SELF_APPROVAL_DENIED`, `LEAVE_NOT_CANCELLABLE`, `LEAVE_MANAGER_SCOPE_DENIED`.

---

## 15. Holidays

### 15.1 Table `public.holidays`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `holiday_date` | `date` | UNIQUE among active |
| `name` | `text` | 1–120 |
| `is_active` | `boolean` | default true |
| `created_at` / `updated_at` | `timestamptz` | |

**Mutations:** `holidays.manage` (SA). Archive via `is_active = false`; no hard delete.

**RPCs:** `create_holiday`, `archive_holiday` (names frozen at implementation).

---

## 16. Staff admin audit

**Canonical:** dedicated `public.staff_admin_events` (append-only), mirroring `lead_events` / `kriti_events`.

| Column | Type |
| :--- | :--- |
| `id` | `uuid` |
| `staff_id` | `uuid` (subject) |
| `actor_id` | `uuid` |
| `event_type` | `text` |
| `details` | `jsonb` ≤ 2048 |
| `created_at` | `timestamptz` |

**Event types:** `staff.created`, `staff.invited`, `staff.invite_resent`, `staff.role_changed`, `staff.manager_changed`, `staff.status_changed`, `staff.employment_updated`, `staff.reconciliation_updated`

No passwords, tokens, or invite URLs in `details`.

---

## 17. RLS contract matrix

| Table | anon | inactive/pending | SE | SM | SA | PM/Designer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `staff_employment_profiles` | — | — | self read | direct reports read | all read | — |
| `attendance_policies` | — | — | read current | read current | all read | — |
| `attendance_events` | — | — | self | direct reports | all | — |
| `attendance_days` | — | — | self | direct reports | all | — |
| `attendance_corrections` | — | — | — | team if permitted | all | — |
| `leave_types` | — | read active | read active | read active | all | — |
| `leave_requests` | — | — | self CRUD pending | team read/approve | all | — |
| `holidays` | — | read active | read active | read active | manage | read active |
| `staff_admin_events` | — | — | — | — | read scoped | — |

Mutations only via SECURITY DEFINER RPCs (no direct INSERT policies for authenticated on append-only tables).

---

## 18. Routes and server actions (inventory only)

| Route | Permission | Loader / action | Mobile |
| :--- | :--- | :--- | :--- |
| `/admin/staff` | `staff.read` | list staff | responsive |
| `/admin/staff/new` | `staff.manage` | create form | desktop-first |
| `/admin/staff/[id]` | `staff.read` + scope | detail + mutations | responsive |
| `/admin/attendance` | `attendance.self` | today + check-in/out | **mobile-first** |
| `/admin/attendance/team` | `attendance.team.read` | team summary | responsive |
| `/admin/attendance/calendar` | `attendance.self` or team | month grid | responsive |
| `/admin/attendance/corrections` | correct permissions | correction list | desktop |
| `/admin/attendance-policies` | `attendance.policies.manage` | policy admin | desktop |
| `/admin/leave` | `leave.self` | my requests | responsive |
| `/admin/leave/team` | `leave.team.approve` | approvals | responsive |
| `/admin/leave/types` | `leave.manage` | type admin | desktop |
| `/admin/holidays` | `holidays.manage` | holiday admin | desktop |

**Server modules (future):** `src/features/staff-admin/`, `src/features/staff-attendance/`, `src/features/staff-leave/`

**Actions pattern:** `"use server"` wrappers calling RPCs; no service-role in browser.

---

## 19. UI component inventory

| Component | Package area |
| :--- | :--- |
| `StaffDirectoryTable` | staff-admin |
| `StaffCreateForm` | staff-admin |
| `StaffDetailPanel` | staff-admin |
| `StaffStatusBadge` | staff-admin |
| `ReportingManagerPicker` | staff-admin |
| `AttendanceTodayCard` | staff-attendance |
| `AttendanceCheckInButton` | staff-attendance |
| `AttendanceCheckOutButton` | staff-attendance |
| `AttendanceMonthlyCalendar` | staff-attendance |
| `TeamAttendanceTable` | staff-attendance |
| `AttendanceCorrectionDialog` | staff-attendance |
| `AttendancePolicyForm` | staff-attendance |
| `LeaveRequestForm` | staff-leave |
| `LeaveStatusBadge` | staff-leave |
| `TeamLeaveApprovalTable` | staff-leave |
| `LeaveTypeManager` | staff-leave |
| `HolidayCalendarAdmin` | staff-leave |

---

## 20. DTO contracts (stable public shapes)

| DTO | Key fields |
| :--- | :--- |
| `StaffListItem` | `staffId`, `employeeCode`, `displayName`, `designation`, `roleCode`, `managerName`, `status`, `joiningDate` |
| `StaffDetail` | list fields + `phoneE164`, `email` (scoped), `attendanceEligible`, `policyName`, audit summary |
| `AttendanceToday` | `attendanceDate`, `primaryStatus`, flags, `openSession`, `firstCheckInAt`, `workedMinutesSoFar` |
| `AttendanceDaySummary` | day row + event count |
| `AttendanceMonthSummary` | `days: AttendanceDaySummary[]`, totals |
| `TeamAttendanceRow` | `staffId`, `displayName`, `todayStatus`, flags, `lastCheckInAt` |
| `LeaveRequestSummary` | `id`, `typeName`, `range`, `status`, `halfDayPart` |
| `HolidaySummary` | `holidayDate`, `name` |

Managers do not receive employee email/phone in team attendance rows by default.

---

## 21. Mobile attendance UX contract

- Primary card: today status + CTA (check-in OR check-out)
- Show server-confirmed times only
- Duplicate tap → idempotent feedback (no double session)
- Offline: read cache allowed; mutations disabled with explicit message
- Success only after server JSON acknowledgment
- Location category selector when policy requires or optional

---

## 22. Reporting contract

Operational fields only: `presentDays`, `absentDays`, `leaveDays`, `halfDays`, `lateCount`, `earlyCheckoutCount`, `missingCheckoutCount`, `workedMinutes`.

**Explicit prohibition:** no joins/updates to `sales_targets`, achievement views, commission, payroll tables.

---

## 23. Future migration packet — `PHASE_6D_FOUNDATION_MIGRATION`

**Not allocated as M23 in this contract.**

### 23.1 Objects (exact list)

**Tables (9):**

1. `staff_employment_profiles`
2. `staff_admin_events`
3. `attendance_policies`
4. `attendance_events`
5. `attendance_days`
6. `attendance_corrections`
7. `leave_types`
8. `leave_requests`
9. `holidays`

**Private helpers:**

- `private.staff_direct_report_ids(uuid)`
- `private.assert_no_reporting_cycle(uuid, uuid)`
- `private.derive_attendance_day(uuid, date)`
- `private.staff_require_active_actor()` (or reuse existing active-staff guard)

**Public RPCs (minimum set):**

- Staff: `create_staff_member`, `reconcile_staff_invite`, `resend_staff_invite`, `update_staff_employment`, `set_staff_profile_status`, `set_staff_reporting_manager`
- Attendance: `check_in_attendance`, `check_out_attendance`, `correct_attendance_day`, `publish_attendance_policy`, `set_current_attendance_policy`
- Leave: `create_leave_request`, `cancel_leave_request`, `approve_leave_request`, `reject_leave_request`
- Holidays: `create_holiday`, `archive_holiday`

**Permissions seed:** 12 codes from §5

**RLS + grants + append-only triggers on events/corrections/audit**

### 23.2 One vs multiple migrations

**Conclusion:** One migration is **feasible** if object count stays at 9 tables and RPC set is bounded as above. If invite reconciliation or derivation helpers exceed safe review size during implementation, **split at 6D-DB gate** — still without pre-allocating version numbers here.

---

## 24. Future PR / DAG contract

| Packet | Deliverables | Serializes on |
| :--- | :--- | :--- |
| **6D-A** | Employment tables, staff RPCs, permissions seed, staff admin events, staff-admin server module | migration file, permissions seed |
| **6D-B** | Attendance tables, policy versioning, check-in/out/correction RPCs, derivation helpers | migration if not in A; shared contracts |
| **6D-C** | Leave + holiday tables/RPCs | migration |
| **6D-D** | UI routes/components | `admin/layout.tsx` nav, shared DTOs |
| **6D-I** | pgTAP + app + security tests | CI |
| **6D-DB** | Recovery + owner gate + managed apply | managed |
| **6D-CLOSE** | Governance docs | docs |

**Parallel-safe during planning:** DTO/contracts in `src/features/staff-*/contracts/` can precede UI if RPC stubs exist.

**Depends on:** Phase 6C COMPLETE (M22 managed).

---

## 25. Test file inventory

### 25.1 Database (pgTAP)

`supabase/tests/database/17_phase_6d_staff_attendance_leave_foundation_test.sql`

Minimum assertions: tables exist; RLS on; anon denied; inactive denied; employee_code unique; cycle rejected; check-in idempotency; checkout without session denied; append-only events; correction audit; leave overlap; holiday precedence; manager scope; no `sales_targets` mutation from attendance RPCs.

### 25.2 Application

| File | Scope |
| :--- | :--- |
| `src/features/staff-admin/__tests__/phase-6d-a-staff-admin.test.ts` | invite validation, reconciliation |
| `src/features/staff-attendance/__tests__/phase-6d-b-attendance-runtime.test.ts` | derivation, errors, idempotency |
| `src/features/staff-leave/__tests__/phase-6d-c-leave-holiday.test.ts` | lifecycle, overlap |
| `src/features/staff-attendance/__tests__/phase-6d-d-attendance-ui.test.ts` | component contracts |
| `scripts/phase-6d-integrated-local-e2e.mjs` | integrated local gate |

### 25.3 Security

Actor spoof, IDOR, cross-team, service-role bundle scan, location minimization, append-only — covered in 6D-I packet.

---

## 26. Owner policy gate (OD-1 – OD-10)

| ID | Policy input | Required before schema impl? | Required before seed/config? | Required before runtime activation? |
| :--- | :--- | :---: | :---: | :---: |
| OD-1 | `workday_start_local` | NO | YES | YES |
| OD-2 | `late_grace_minutes` | NO | YES | YES |
| OD-3 | `half_day_threshold_minutes` | NO | YES | YES |
| OD-4 | `workday_end_local` / checkout expectation | NO | YES | YES |
| OD-5 | `weekly_off_days` | NO | YES | YES |
| OD-6 | SM attendance tracked | NO | NO | YES (eligibility defaults) |
| OD-7 | SM correct team attendance | NO | NO | YES (permission grant) |
| OD-8 | Location mandatory | NO | YES | YES |
| OD-9 | Launch leave types | NO | YES | YES |
| OD-10 | Post-approval cancellation | NO | NO | YES (RPC rules) |

**Schema implementation may proceed** with nullable/configurable policy storage and fail-closed behavior when no current policy exists. **Runtime activation** requires OD-1–OD-5, OD-8, OD-9 resolved and at least one `attendance_policies` row published.

---

## 27. Phase 6C firewall

This contract does not modify M22, create M23, or perform managed writes. Phase 6C remains on M22 recovery gate.

---

## Related

- [ADR-0023](../ADR/ADR-0023-staff-attendance-leave-architecture.md)
- [Phase 6D architecture freeze](phase-6d-staff-attendance-leave-architecture-freeze.md)
