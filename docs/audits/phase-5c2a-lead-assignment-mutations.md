# Phase 5C2A — Lead Assignment Mutations Audit

**Status:** **COMPLETE** — PR #7 merged (head `be93880d94c9ae7efd258e11a5a19c73309b408f`; merge commit `01254ee2ffde65a4e410361663aba2fb55e9dbe4`, 2026-08-01T04:19:23Z). Migrations 11–13 applied to managed OneDecore Supabase (2026-08-01). Application **not production-deployed**. Public lead intake **inactive**.

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

## Final verification (protected main @ `01254ee`)

| Gate | Result |
|------|--------|
| `npm run check` | PASS |
| Application tests | 363/363 PASS |
| Image tests | 17/17 PASS |
| Database tests | 289/289 PASS |
| Owner RPC/RLS QA | 22/22 PASS |
| Browser QA | 31/31 PASS |
| Six roles × four viewports | 24/24 PASS |
| PR-head CI (Quality Gate) | PASS |
| Merge-commit main CI | PASS |
| Managed migrations 11–13 | Applied; post-apply dry-run clean |
| Production deployment | **Not authorized / not performed** |

## Non-goals

- Status transitions, notes, follow-up mutations, manual lead creation
- Production deployment, public lead-intake activation
