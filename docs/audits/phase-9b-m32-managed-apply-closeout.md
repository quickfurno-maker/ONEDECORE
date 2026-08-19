# Phase 9B M32 — Managed Apply Closeout

**Date:** 2026-08-19  
**Authority:** ADR-0029 / DEC-0081 / DEC-0082 / DEC-0084 / OD9B-1–OD9B-12  
**Managed project:** OneDecore `lpurlfmpvriyvpkujvyl` (`ap-south-1`)  
**Repository HEAD at apply:** `8bb8a6cc05a119395d8cb00a307beb0e430ecd5b` (PR #67 true merge of Phase 9D-A docs freeze; PR #66 M32 implementation already on main)

This document certifies **managed apply of M32 only**. It does **not** authorize Landing Lab production activation, Phase 9C provider execution, Phase 9D-B commerce implementation, deployment, or public lead-intake enablement.

---

## Identity

| Item | Value |
| :--- | :--- |
| Migration | `supabase/migrations/20260819140000_landing_page_lab_experimentation_foundation.sql` |
| Git blob | `c1224fa0de919e8c189c511078d0a55901bf2a77` |
| Raw SHA-256 | `B4709DDF9FA36218330267EDE61670A4501600FB8FEF549B3F18C1910F06C56E` |
| M31 historical blob (unchanged) | `ea76b214e8b133b5f8cebd437f4a524916fb5bdd` |
| Repository migrations | **M1–M32** (M33 absent) |
| Managed before apply | **M1–M31**, latest `20260818140000`, M32 absent |
| Managed after apply | **M1–M32**, latest `20260819140000`, pending **NONE** |

PR #67 changed **docs only**. No commerce schema, `/shop` runtime, or commerce migration exists.

---

## Recovery checkpoint (hard gate)

Qualified **pre-M32** physical/WALG checkpoint:

| Field | Value |
| :--- | :--- |
| Backup ID | **1412215555** |
| inserted_at | `2026-08-18T19:54:24.861Z` |
| status | COMPLETED |
| is_physical_backup | true |
| walg_enabled | true |
| pitr_enabled | false |
| region / project | `ap-south-1` / `lpurlfmpvriyvpkujvyl` |

M31 managed apply completed `2026-08-18T03:34:46Z`. Checkpoint **1412215555** is after that instant.

Forbidden IDs **not** used: `1402715223`, `1393334013`, `1384020355`.

Evidence captured outside Git: `C:\Users\KESHAV SHARMA\Desktop\ONEDECORE_RECOVERY\M32_APPLY_20260819T024800Z\`.

---

## Apply

| Field | Value |
| :--- | :--- |
| CLI | `npx supabase@2.109.1` (2.109.1) |
| Command | `npx supabase@2.109.1 db push --linked --yes` |
| Start (UTC) | `2026-08-19T02:50:44Z` |
| End (UTC) | `2026-08-19T02:50:49Z` |
| Exit | 0 |

Applied **only** `20260819140000_landing_page_lab_experimentation_foundation.sql`. No SQL paste, reset, seed, or M33.

Post-apply dry-run: **Remote database is up to date.**

---

## Objects / RBAC / security

Landing Lab tables present: `landing_pages`, `landing_page_versions`, `landing_publications`, `landing_experiments`, `landing_experiment_variants`, `landing_exposures`, `private.landing_lab_idempotency_requests`.

Permissions (SA + SM only): `landing_pages.read`, `landing_pages.manage`, `landing_pages.publish`, `landing_experiments.manage`, `landing_analytics.read`. No grants to sales_executive / project_manager / designer / legacy ops.

RLS on all six public Landing Lab tables. Anon DML denied. Authenticated direct INSERT/UPDATE/DELETE denied.

Live RPCs `get_live_landing_publication`, `verify_live_landing_publication_context`, `record_landing_exposure`: **EXECUTE** denied for anon/authenticated; **granted** to `service_role`. Private landing helpers: anon EXECUTE empty.

Publication status check: `draft | live | paused | archived` (no `scheduled`). Experiments: `draft | running | concluded`. Exposures store `visitor_key_hash` (64 hex) only — no raw cookie/IP columns.

---

## Counts

Pre-apply and post-apply business rows all **0**: contacts, leads, consent_events, campaigns, campaign_versions, quotations, projects.

Post-apply Landing Lab rows all **0**: pages, versions, publications, experiments, variants, exposures, private idempotency.

No unexplained business-data delta. RBAC metadata only.

---

## Security advisor

`npx supabase@2.109.1 db advisors --linked -o json`

| | Count |
| :--- | :--- |
| ERROR | **0** |
| WARN | **97** |

Classification: **M32_SECURITY_ADVISOR_BLOCKERS=NONE**.

New M32 WARNs: nine intended `authenticated_security_definer_function_executable` staff RPCs (`create_landing_page_draft`, `save_landing_page_draft`, `freeze_landing_page_version`, `create_next_landing_page_version`, `create_landing_publication`, `transition_landing_publication`, `save_landing_experiment_draft`, `start_landing_experiment`, `conclude_landing_experiment`). Same pattern as M31 campaign staff RPCs: `authorize()` inside SECURITY DEFINER.

Live Landing Lab RPCs do **not** appear as anon/authenticated advisor hits.

Pre-existing: two anon quotation capability WARNs; remaining authenticated staff-RPC WARNs; PERFORMANCE `multiple_permissive_policies` on `consent_events` SELECT (M31 marketing + CRM scoped policies — not an M32 ERROR).

Linked `db lint --level warning`: unused-parameter extras only; no schema errors. No M32 lint errors.

---

## Production / other phases

- `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` remains default **OFF** (no production activation).
- Public lead intake unchanged.
- No deployment.
- Meta/Google execution **NONE**.
- Phase 9C **NOT STARTED**.
- Phase 9D-A remains **docs freeze** (PR #67). 9D-B **NOT STARTED**. No commerce schema/runtime.
- No production payment keys.

Protected stashes untouched:

1. `phase-9d-roadmap-lock-pending-after-pr63`
2. `pre-phase-5c local residue 2026-07-31`
