# CRM 2A-6 — My Day Read Model + Workspace

**Lane B · Date:** 2026-08-27  
**Baseline:** `1797cf1299f3efba41cda30b1ff8710157520162`  
**Managed tip at lane start:** `20260828140000_crm_activity_rpc_workflows`  
**Reserved migration:** `20260829120000_crm_my_day_read_model.sql`  
**Reserved pgTAP:** `34_crm_my_day_read_model_test.sql`

## Audit Summary

### STOP conditions — none

- Migration slot `20260829120000` and suite `34` are free (no collision with Lane C `20260829140000`).
- No existing `get_crm_my_day` or `/admin/crm/my-day` route.
- RLS on `leads`, `lead_follow_ups`, and `crm_sla_clocks` scopes via `private.crm_can_view_lead(assigned_to)` — sufficient for read model without broadening exposure.
- No new permission required; uses existing `crm.follow_ups.manage`, `crm.reporting.read`, `leads.read_assigned`, `leads.read_all`.

### Schema readiness

| Asset | Status |
|-------|--------|
| `lead_follow_ups` primary columns | Ready (2A-1) |
| `idx_lead_follow_ups_owner_primary_open_due` | Ready — My Day task queue |
| `idx_lead_follow_ups_owner_status_due` | Ready |
| `uq_lead_follow_ups_one_primary_open` | Ready — mutual exclusivity invariant |
| `crm_sla_clocks.first_contact_attempt_at` | Ready (2A-2) |
| `idx_crm_sla_clocks_unsatisfied_due` | Ready — SLA breach reads |

### Terminal lead statuses

`closed_won`, `closed_lost` — excluded from all My Day sections.

### Assignment fields

- Lead owner: `leads.assigned_to`
- Task owner: `lead_follow_ups.owner_id` (may differ after delegation)

### Auth / scope

| Actor | Task scope | Assigned attention | Manager sections |
|-------|-----------|--------------------|------------------|
| Sales executive | `owner_id = auth.uid()` only | assigned leads only | hidden |
| Manager / broad | optional `p_owner_id` filter; NULL = team | filtered lead assignee or team | Unassigned, SLA Breaches |

Broad scope: `private.crm_has_broad_lead_read()` (`leads.read_all` or legacy `leads.read` without `read_assigned`).

**Owner-filter contract (manager):**
- Task queues: filter by activity `owner_id` (`v_scope_owner`)
- No Next Action / New Uncontacted: filter by lead `assigned_to`
- SLA Breaches: filter by lead `assigned_to` (same as assigned attention)
- **Unassigned exception:** always global manager attention — unassigned leads cannot match a selected owner and must remain visible regardless of owner filter

## Read Architecture

**Single RPC:** `public.get_crm_my_day(p_owner_id, p_upcoming_limit, p_attention_limit) → jsonb`

- Public wrapper: `SECURITY INVOKER`, `search_path = ''`
- Private impl: `private.get_crm_my_day_impl` — same invoker semantics; explicit auth checks
- One captured `v_now := clock_timestamp()` per call
- No service role; no mutations

### Bucket predicates (primary open tasks only)

Let `local_today_start` = midnight Asia/Kolkata containing `v_now`, `local_tomorrow_start` = next midnight.

| Bucket | Predicate |
|--------|-----------|
| Overdue | `due_at < v_now` |
| Due Today | `due_at >= v_now AND due_at < local_tomorrow_start` |
| Upcoming | `due_at >= local_tomorrow_start` |

Filter: `status = 'open' AND is_primary_next_action = true`. Mutually exclusive by construction.

Sort: `due_at ASC`, `id ASC` tie-break.

### Attention predicates

| Section | Rule |
|---------|------|
| No Next Action | Active non-terminal assigned lead with no open primary activity |
| New Uncontacted | Assigned active non-terminal; `first_contact_attempt_at IS NULL` (missing clock = uncontacted) |
| Unassigned | Manager only; active non-terminal; `assigned_to IS NULL` (global — not owner-filtered) |
| SLA Breaches | Manager only; `sla_due_at IS NOT NULL AND attempt IS NULL AND sla_due_at < v_now`; scoped by `assigned_to` when owner selected |

### Timezone

PostgreSQL `AT TIME ZONE 'Asia/Kolkata'` for day boundaries — not JS UTC helpers.

### Index plan

Reuse existing partial indexes; no new speculative indexes added (audit confirms coverage).

## App Layer

| Path | Role |
|------|------|
| `src/features/crm/contracts/my-day-contracts.ts` | DTOs, mappers, IST date label |
| `src/features/crm/server/crm-my-day-queries.ts` | RPC fetch + mapping |
| `src/app/admin/crm/my-day/page.tsx` | Server page |
| `src/features/crm/components/my-day/*` | UI sections |

**Nav:** unchanged (`CrmNav` not edited — 2A-9 owns nav slice).

**Tests:** extend `phase-5c1-crm-workspace.test.ts` (already in `test:app`).

## Serial integration hotspot

`src/types/database.generated.ts` updated for `get_crm_my_day` RPC. Lane C must regenerate on rebase.

## Out of scope

Assignment automation, SLA activation, lead-detail UI, CrmNav, package.json edits, managed Supabase apply, deploy, M38.
