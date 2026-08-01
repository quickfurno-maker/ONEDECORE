# Phase 5C2A — Lead Assignment Mutations Audit

**Status:** Local implementation complete — not merged, not deployed, managed migration 13 not applied remotely.

## Scope

Single CRM mutation slice: **assign**, **reassign**, and **safe unassign** via `public.assign_lead` only.

## Authorization matrix

| Role | `leads.assign` | Can operate assignment UI |
|------|----------------|---------------------------|
| super_admin | yes | yes |
| sales_manager | yes | yes |
| management (legacy) | yes | yes |
| sales_executive | no | no |
| sales (legacy) | no | no |
| project_manager | no | no |
| designer | no | no |

Assignee targets must be active `sales_executive` or legacy `sales` only.

## Migration 13

**File:** `supabase/migrations/20260731143050_crm_assignment_mutation_hardening.sql`

### Signature

```sql
public.assign_lead(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_reason text default null,
  p_expected_assignee uuid default null,
  p_expected_updated_at timestamptz default null,
  p_enforce_expected_state boolean default false
) returns public.leads
```

### Expected-state semantics

- Phase 5C2A application calls set `p_enforce_expected_state = true`.
- Expected unassigned state: `p_expected_assignee = null` with enforcement enabled.
- Stale `assigned_to` or `updated_at` → `CRM_ASSIGNMENT_STALE` (`P0001`).
- Same desired assignee is idempotent before stale conflict (no new audit rows).

### Guards

- Visibility via `crm_can_view_lead_by_id`; missing/inaccessible → `CRM_ASSIGNMENT_LEAD_NOT_FOUND` (`P0002`).
- Terminal `closed_won` / `closed_lost` → `CRM_ASSIGNMENT_TERMINAL`.
- Safe unassign only from `assigned` → `new`; progressed stages rejected.
- Open follow-ups (`status = 'open'`) block orphaning on reassign/unassign.

### Reason rules

| Operation | Reason |
|-----------|--------|
| Initial assign | optional, 1–500 if provided |
| Reassign | required, 10–500 |
| Unassign | required, 10–500 |

## Application boundary

- `crm-assignment-service.ts` → authenticated SSR client only
- `crm-assignment-actions.ts` → server actions with `revalidatePath` on success
- No service role, no direct `leads` updates, no optimistic UI

## Local verification

| Gate | Result |
|------|--------|
| `npm run check` | pending final run |
| Application tests | 361 expected after Phase 5C2A file |
| Database tests | 289 (includes 16 in test 07) |
| Owner QA | `scripts/phase-5c2a-owner-qa.mjs` |
| Browser QA | `scripts/phase-5c2a-browser-qa.mjs` |

## Non-goals

- Status transitions, notes, follow-up mutations, manual lead creation
- Managed Supabase apply, deployment, public lead-intake activation
