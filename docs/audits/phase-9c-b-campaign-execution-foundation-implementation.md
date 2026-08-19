# Phase 9C-B — Campaign Execution Foundation Implementation

**Status:** `REPOSITORY_IMPLEMENTED` (PR open, not merged)  
**Authority:** ADR-0031 / DEC-0085 / OD9C-1–OD9C-18 / OD9C-A / OD9C-B / OD9C-C / **DEC-0086**  
**Date:** 2026-08-19  
**Branch:** `phase-9c-b-execution-foundation`  
**Starting main:** `cd5487f9663aa36e8b9352d88424468fd2419e10` (PR #69 true merge)

## Scope

Repository-only Phase 9C-B: campaign run/target/operation/event schema, RBAC, mock provider, replay-safe worker claim, signed run/target context foundation, fail-closed provider-data-sharing policy, minimal admin execution UI.

## Explicitly out of scope

- Meta Ads / Google Ads adapters or SDKs
- Managed Supabase apply (`lpurlfmpvriyvpkujvyl` remains M1–M32)
- Landing Lab public `/lp/*` activation
- Attribution enrichment on public intake (9C-C)
- Metric snapshots / conversion feedback tables (9C-C)
- Production scheduler / live spend (Phase 10)
- Phase 9C-C / 9D-B

## Migration

- File: `supabase/migrations/20260820140000_campaign_execution_foundation.sql` (M33)
- Git blob: `326ef4f2770ca5021f9e273605f0e7a5f6aaf992`
- Raw SHA-256: `C87D4B478EA6C76520A715C58D669238F425DAFB1D595DB6FEE50A80DE277C84`
- Pre-correction (never managed-applied): blob `afae5ab143f92b9663bde0354837ca72c9bd0621` / SHA-256 `B50C2141FDCBAB303F3146B90F95DF436E6CD08F827764B93C6473375904CCFD`
- Forward-only. M1–M32 unmodified. **No M34.**
- **Not** managed-applied in this gate.

## Tables

| Table | Notes |
| :--- | :--- |
| `public.campaign_runs` | `OD-CR-{YYYY}-{SEQ6}`; one `meta_ads` **or** `google_ads`; lifecycle `scheduled\|running\|paused\|completed\|failed\|cancelled` |
| `public.campaign_run_targets` | `UNIQUE(campaign_run_id)`; `OD-CRT-{YYYY}-{SEQ6}`; channel must match parent |
| `public.campaign_run_operations` | Claimable queue: create/activate/pause/resume/cancel/sync |
| `public.campaign_execution_events` | Append-only |
| `private.marketing_execution_idempotency_requests` | Dedicated execution ledger (not M31/M32) |

No `campaign_metric_snapshots` / `campaign_conversion_feedback_events`.

## Permissions

Seeded: `campaigns.execute`, `campaigns.pause`, `campaigns.metrics.read`.  
Grants: `super_admin`, `sales_manager` only. No SE/PM/designer/legacy/Kriti.

Cancel: Super Admin only (narrow ADR-0031 reading). SM may execute/pause/resume.

## Staff / worker RPCs

Staff: `create_campaign_run`, `pause_campaign_run`, `resume_campaign_run`, `cancel_campaign_run`.  
Service-role: `claim_campaign_run_operation`, `bind_campaign_run_operation`, `complete_campaign_run_operation`, `fail_campaign_run_operation`, `mark_campaign_run_operation_needs_reconcile`, `get_campaign_run_operation_for_reconcile`, `resolve_campaign_run_create_reconcile_found`.

OD9C-A: dual paid channels fail with `MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS`. Deferred email/WhatsApp stored, not executed.

## Application

- `src/features/marketing/execution/**` domain, mock provider, dispatcher, HMAC context, sharing policy
- `ONEDECORE_CAMPAIGN_EXECUTION_MODE=disabled|mock|sandbox|live` — sandbox/live → `CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED`
- Separate `ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET` (no Landing Lab key reuse)
- Internal POST `/api/internal/campaign-execution/dispatch` + admin mock dispatch action
- Admin execution panel on `/admin/campaigns/[campaignId]`

OD9C-B: issue/verify only. Public `/lp/*` unchanged/OFF. No UTM/time guessing.

OD9C-C: `canShareProviderCustomerData` always denies identifier sharing in 9C-B. `direct_or_custom` does not fall back to `broad_public`.

## Managed

Read-only dry-run must propose **only** this M33 file. Do not apply.

## Same-PR correction (unmerged / unmanaged M33)

In-place M33 + app/test fixes (no M34, no managed write):

1. Expired `claimed` rows are selectable regardless of `attempt_count`. At `max_attempts` they move to `needs_reconcile` (`CLAIM_EXPIRED_UNKNOWN`); below max they reclaim and increment.
2. `reconcile_found` uses `resolve_campaign_run_create_reconcile_found` (not ordinary bind). Scheduled → one activate; cancelled → one cancel cleanup; replay is unique. Provider `not_found` does not recreate.
3. `cancel_campaign_run` cancels pending only. In-flight `claimed` create can bind/complete; cancelled runs never activate and enqueue one provider cancel if an object is bound.
4. Manual mock-dispatch Server Action authorizes active staff + `campaigns.execute` before any service-role dispatcher work. SA/SM allowed; other roles denied. Internal bearer route unchanged.

