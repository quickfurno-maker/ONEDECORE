# Phase 9C M33+M34 — Managed Apply Closeout

**Date:** 2026-08-20  
**Authority:** ADR-0031 / DEC-0085 / DEC-0086 / DEC-0087 / **DEC-0088** / OD9C-1–OD9C-18 / OD9C-A / OD9C-B / OD9C-C  
**Managed project:** OneDecore `lpurlfmpvriyvpkujvyl` (`ap-south-1`)  
**Repository HEAD at apply:** `ba70a679667bb7c5512c1e0b88279532f274d173` (PR #71 true merge of `1741dab9a9d508f60c797bf7ba0980f780c98dad`)

This document certifies **managed apply of M33 then M34 only**. It does **not** authorize production campaign execution, provider-data-sharing, Landing Lab public serving, public lead intake, Meta/Google live writes, deployment, a production scheduler, or Phase 9D-B.

---

## Identity

| Item | Value |
| :--- | :--- |
| PR #71 true merge | `ba70a679667bb7c5512c1e0b88279532f274d173` |
| Merged PR #71 head | `1741dab9a9d508f60c797bf7ba0980f780c98dad` |
| M33 | `supabase/migrations/20260820140000_campaign_execution_foundation.sql` |
| M33 Git blob | `326ef4f2770ca5021f9e273605f0e7a5f6aaf992` |
| M33 SHA-256 (LF) | `C87D4B478EA6C76520A715C58D669238F425DAFB1D595DB6FEE50A80DE277C84` |
| M34 | `supabase/migrations/20260821140000_campaign_metrics_conversion_feedback_foundation.sql` |
| M34 Git blob | `6103f3cede63eb59b82e1154e9b0475ed5ef4c0e` |
| M34 SHA-256 (LF) | `208626BAB69A10136F9AA214CB5D4F75F3BBEBDEF321985884DF0A1BF78E06C5` |
| Repository migrations | **M1–M34** (no M35) |
| Managed before apply | **M1–M32**, latest `20260819140000`, M33/M34 absent |
| Managed after apply | **M1–M34**, latest `20260821140000`, pending **NONE** |

M1–M34 files were not edited in this gate.

---

## Recovery checkpoint (hard gate)

Qualified **post-M32** physical/WALG checkpoint (strictly after M32 apply `2026-08-19T02:50:49Z`):

| Field | Value |
| :--- | :--- |
| Backup ID | **1421707121** |
| inserted_at | `2026-08-19T19:53:53.722Z` |
| status | COMPLETED |
| is_physical_backup | true |
| walg_enabled | true |
| pitr_enabled | false |
| region / project | `ap-south-1` / `lpurlfmpvriyvpkujvyl` |

Forbidden IDs **not** used: `1412215555`, `1402715223`, `1393334013`, `1384020355`.

Evidence captured outside Git: `C:\Users\KESHAV SHARMA\Desktop\ONEDECORE_RECOVERY\M33_M34_APPLY_20260820T031500Z\`.

---

## Apply

| Field | Value |
| :--- | :--- |
| CLI | `npx supabase@2.109.1` (2.109.1) |
| Command | `npx supabase@2.109.1 db push --linked --yes` |
| Start (UTC) | `2026-08-20T03:17:15Z` |
| End (UTC) | `2026-08-20T03:17:20Z` |
| Exit | 0 |

Applied in order:

1. `20260820140000_campaign_execution_foundation.sql`
2. `20260821140000_campaign_metrics_conversion_feedback_foundation.sql`

No SQL paste, Dashboard editor, reset, seed, or M35. A local Docker catalog-cache warning after apply did not change remote history.

Post-apply dry-run: **Remote database is up to date.**

---

## Objects / RBAC / security

M33 present: `campaign_runs`, `campaign_run_targets`, `campaign_run_operations`, `campaign_execution_events`, `private.marketing_execution_idempotency_requests`.

M34 present: `campaign_metric_snapshots`, `campaign_conversion_feedback_events`.

Constraints certified: one target per run (`campaign_run_id` unique); provider channel `meta_ads`/`google_ads`; run lifecycle check; operation types include `metrics_sync` and `conversion_feedback`; metric target/window unique; conversion `source_event_key` unique; attribution/submission checks present.

Permissions (SA + SM only): `campaigns.execute`, `campaigns.pause`, `campaigns.metrics.read`. No grants to sales_executive / project_manager / designer / legacy / Kriti execution.

RLS enabled on all six public M33/M34 tables. FORCE RLS on M34 tables as defined. Anon table grants empty. Authenticated table privilege is SELECT only (no INSERT/UPDATE/DELETE). Policies are SELECT-only through `campaigns.read` / `campaigns.metrics.read`.

Worker/reconcile RPCs (`claim_campaign_run_operation`, `resolve_campaign_run_create_reconcile_found`, metric upsert/enqueue, conversion enqueue/mark) are **service_role** only — no anon/authenticated execute. Staff RPCs `create_campaign_run` / `pause_campaign_run` / `resume_campaign_run` / `cancel_campaign_run` / `get_campaign_metrics_board` remain authenticated (authorize inside SECURITY DEFINER).

---

## Counts

Pre-apply and post-apply business rows all **0**: contacts, leads, consent_events, campaigns, campaign_versions, campaign_audience_rule_versions, campaign_approvals, quotations, quotation_acceptances, projects, landing_pages, landing_page_versions, landing_publications, landing_experiments, landing_experiment_variants, landing_exposures.

Post-apply M33/M34 operational rows all **0**: runs, targets, operations, execution events, execution idempotency, metric snapshots, conversion-feedback events.

No unexplained business-data delta. RBAC metadata only (permission seeds). No fabricated managed test rows.

---

## Security advisor

`npx supabase@2.109.1 db advisors --linked -o json`

| | Count |
| :--- | :--- |
| ERROR | **0** |
| WARN | **102** |

Classification: **M33_M34_SECURITY_ADVISOR_BLOCKERS=NONE**.

New M33/M34 WARNs: five intended `authenticated_security_definer_function_executable` staff RPCs (`create_campaign_run`, `pause_campaign_run`, `resume_campaign_run`, `cancel_campaign_run`, `get_campaign_metrics_board`). Same pattern as prior campaign/Landing Lab staff RPCs: `authorize()` inside SECURITY DEFINER.

Worker/reconcile functions do **not** appear as anon/authenticated advisor hits.

Pre-existing: two anon quotation capability WARNs; remaining authenticated staff-RPC WARNs.

---

## Production / other phases

- `ONEDECORE_CAMPAIGN_EXECUTION_MODE` default **disabled**.
- `ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED` not set true (fail-closed).
- `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED` default **false**.
- `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` remains default **OFF**.
- Public lead intake unchanged (`copy-only` / disabled).
- No production worker/cron (Quality Gate is PR/push CI only).
- No deployment.
- No Meta/Google live campaign mutations, custom-audience export, or conversion-feedback submit.
- Phase 10 remains production activation authority.
- Phase 9D-B **NOT STARTED**. 9D-B becomes next only after this closeout PR is independently reviewed and merged.

Protected stashes untouched:

1. `phase-9d-roadmap-lock-pending-after-pr63`
2. `pre-phase-5c local residue 2026-07-31`
