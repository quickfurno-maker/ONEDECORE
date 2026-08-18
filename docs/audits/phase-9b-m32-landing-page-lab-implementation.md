# Phase 9B M32 Landing Page Lab — Repository Implementation Audit

**Date:** 2026-08-18  
**Authority:** ADR-0029 / DEC-0081 / DEC-0082 / OD9B-1–OD9B-12  
**Migration:** `supabase/migrations/20260819140000_landing_page_lab_experimentation_foundation.sql`

## Scope

Forward-only M32 implements the Phase 9B data plane, RPCs, RLS, first-touchpoint enrichment, public `/lp/[slug]`, SA/SM admin workspace, signed publication context, privacy-safe exposures, and lead-intake `fbclid`/`gclid` plus server-verified landing identity.

## Explicit non-goals (this gate)

- M32 is **not** applied to managed Supabase (`lpurlfmpvriyvpkujvyl` remains M1–M31).
- Production Landing Lab public serving remains disabled unless `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED=true` (not committed).
- No Phase 9C provider execution, spend, or conversion feedback.
- M1–M31 files were not rewritten. pgTAP `23_` only dropped `landing_pages`/`landing_page_versions` from the 9A “tables absent” freeze list because M32 now creates them.

## Public gate

`ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` must equal `"true"` to render `/lp`. Default is fail-closed `notFound`.

## HMAC

Visitor hashes and publication signatures use `ONEDECORE_LANDING_LAB_HMAC_SECRET` when set (≥32 chars), otherwise `ONEDECORE_LEAD_HASH_SECRET`. Secrets are not stored in the database.

## Containment

Expected domains only: M32, pgTAP `24_`, `src/features/landing-lab/**`, lead-intake attribution/context bridge, `/admin/landing-pages`, `/lp/[slug]`, `src/proxy.ts`, admin nav, `package.json` test inclusion, `database.generated.ts`, truth-sync docs.

Ledger-only extras (required so existing fail-closed tests match M32): `01_identity_rbac_test.sql` permission/table counts; `23_campaign_consent_audience_approval_test.sql` no longer forbids `landing_pages`/`landing_page_versions`; `phase-6b-integrated-matrix.test.ts` repository migration count 32.

## Fingerprints

| Item | Value |
| --- | --- |
| M32 filename | `20260819140000_landing_page_lab_experimentation_foundation.sql` |
| Git blob | `fc5aa2e8138e1136fe1d3e681f7fcfe6a8cfc6a7` |
| Raw SHA-256 | `2DCD874A9C0336981F5DD322FBCFE798453909F658358B50EF1A08C5036C52B8` |

## Local gates (2026-08-18)

| Gate | Result |
| --- | --- |
| `npm run test:phase-9b` | PASS (60 tests) |
| `npm run test:app` | PASS |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run db:reset` | PASS |
| `npm run db:lint` | PASS (0 ERROR; existing extra WARNs) |
| `npm run db:test` | PASS (24 files, 1412 tests) |
| `git diff --check` | PASS |
