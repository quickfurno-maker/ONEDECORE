# CRM 2A-7 — Implementation Plan (Assignment + First Contact Automation)

**Goal:** Safe assign/reassign activity ownership, automatic SLA First Contact primary on assignment when clock has legitimate due, lead-receipt SLA clock coverage for public/manual paths, preserved import opt-out and unassign fail-closed discipline.

**Document status:** Implementation authorized 2026-08-27 on `crm-2a7-assignment-first-contact`  
**Baseline:** `1797cf1299f3efba41cda30b1ff8710157520162` (origin/main)  
**Managed tip at lane start:** `20260828140000` / `crm_activity_rpc_workflows`  
**Migration:** `20260829140000_crm_assignment_first_contact_automation.sql`  
**pgTAP:** `35_crm_assignment_first_contact_automation_test.sql`

---

## 1. Audit summary

### 1.1 Assignment RPC (pre-2A-7)

| Item | Value |
|------|-------|
| Public RPC | `public.assign_lead(p_lead_id, p_assignee_id, p_reason, p_expected_assignee, p_expected_updated_at, p_enforce_expected_state)` → `public.leads` |
| Private impl | `private.assign_lead_impl(...)` — SECURITY DEFINER |
| Lock | Lead `FOR UPDATE` only; no activity locks |
| Reassign | **Blocked** on open follow-ups owned by anyone other than new assignee (`CRM_ASSIGNMENT_OPEN_FOLLOW_UPS`) |
| Unassign | **Blocked** on any open follow-up |
| First Contact | Not created on assign |
| SLA clock on assign | Not ensured |

### 1.2 Lead creation paths

| Path | Function | Clock at creation (pre-2A-7) | Import opt-out |
|------|----------|-------------------------------|----------------|
| Public intake | `public.submit_lead_intake` | No | N/A |
| Manual CRM | `private.create_manual_lead_impl` | No | N/A |
| Bulk import | `private.crm_create_imported_lead` | No | `entry_method = 'import'` — no opt-in column (2A-8) |

### 1.3 Helpers available (2A-1..2A-3)

- `private.ensure_first_contact_sla_clock(p_lead_id)` — idempotent; `clock_started_at = leads.created_at`; never rescopes due
- `private.clear_open_primary_for_lead(...)` — demote open primary with `primary_cleared` audit
- `private.crm_user_can_operate_lead(p_user_id, p_lead_id, p_capability)` — post-condition owner retention check

---

## 2. Design decisions

### 2.1 Lock order (assignment mutation)

1. Auth / input preflight  
2. `leads FOR UPDATE`  
3. Expected-state / terminal / mode / assignee validation  
4. Unassign open-activity precheck (fail-closed, unchanged)  
5. Reason validation  
6. Update assignment (`assigned_to`, `status`)  
7. Ensure SLA clock (non-import leads only)  
8. Reassign: sync open activity ownership (deterministic `ORDER BY id FOR UPDATE`)  
9. Assign/reassign: ensure SLA First Contact primary when due pending  
10. Assignment audit (history, `lead.assigned`, `assignment.changed`)  

Lead lock precedes all activity mutations. Activity locks use ascending `id` order.

### 2.2 Lead receipt clock coverage

`AFTER INSERT` trigger on `public.leads` calls `ensure_first_contact_sla_clock` when `entry_method <> 'import'`. Covers public intake and manual creation without duplicating large intake functions. Import rows set `entry_method = 'import'` at insert — explicitly excluded.

### 2.3 First Contact auto criteria

Create primary activity **only when all hold**:

- Lead not terminal  
- `entry_method <> 'import'`  
- `crm_sla_clocks.first_contact_attempt_at IS NULL`  
- `crm_sla_clocks.sla_due_at IS NOT NULL` (active/configured snapshot)  
- No duplicate open `source = 'sla_auto'` + `title = 'First Contact'`  

**Row fields:** `activity_type = 'call'`, `title = 'First Contact'`, `source = 'sla_auto'`, `priority = 'high'`, `owner_id = assignee`, `due_at = clock.sla_due_at`, `is_primary_next_action = true`.

**Deadline source:** existing clock snapshot only — never computed from assignment time.

### 2.4 Existing primary handling

When First Contact required and another open primary exists: demote via `clear_open_primary_for_lead` (`primary_cleared`), then create/designate First Contact as primary (`primary_designated`). Never delete activities.

### 2.5 Reassignment

- **Primary:** `owner_id` → new assignee; `ownership_transferred` if changed; retain primary flag  
- **Secondary:** retain owner if `crm_user_can_operate_lead(old_owner, lead, 'crm.follow_ups.manage')`; else transfer to new assignee with audit  
- Remove blanket `CRM_ASSIGNMENT_OPEN_FOLLOW_UPS` reassign block (replaced by transfer logic)  
- If no primary and SLA due pending: ensure First Contact; if SLA inactive (NULL due): allow assignment (My Day "No Next Action" transitional state)

### 2.6 Unassign

Preserve stricter MVP: block when **any** open follow-up exists. No auto-cancel.

### 2.7 Audit

On auto-create: `lead_follow_up_events` (`created`, `primary_designated`, optional `primary_cleared`); `lead_activities` (`follow_up.auto_created`). Task creation does **not** set `first_contact_attempt_at`.

---

## 3. Files

| File | Action |
|------|--------|
| `supabase/migrations/20260829140000_crm_assignment_first_contact_automation.sql` | Create |
| `supabase/tests/database/35_crm_assignment_first_contact_automation_test.sql` | Create |
| `supabase/tests/database/07_crm_assignment_mutations_test.sql` | Update reassign expectation (transfer not block) |
| `src/features/crm/__tests__/phase-5c2a-assignment-mutations.test.ts` | Extend 2A-7 contract evidence |

**Not in scope:** Lane A lead-detail UX, Lane B My Day, SLA activation UI, import opt-in (2A-8), M38.

---

## 4. RPC signature preservation

`public.assign_lead` signature and return type unchanged. No new public RPCs.

---

## 5. STOP conditions

None encountered. Migration timestamp `20260829140000` is free; Lane B `120000` not required for local implementation (will rebase before merge).
