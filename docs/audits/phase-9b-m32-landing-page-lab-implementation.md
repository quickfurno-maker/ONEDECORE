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

Visitor hashes and publication signatures use `getLandingLabHmacSecret()`: dedicated `ONEDECORE_LANDING_LAB_HMAC_SECRET` when set (≥32 chars), otherwise fallback `ONEDECORE_LEAD_HASH_SECRET`. `/lp` issuance and lead-intake verification use that same helper. `ONEDECORE_LEAD_HASH_SECRET` remains the lead-intake request/phone/network hash secret and is not forced into publication-context verification. Secrets are not stored in the database.

## Public live RPCs

`get_live_landing_publication` and `verify_live_landing_publication_context` are **service_role only**. Anon/authenticated EXECUTE is revoked so the Phase 10 app gate cannot be bypassed with the public Supabase key. Public `/lp` loading uses `createLandingLabServiceClient()` after the gate and HMAC secret checks. `record_landing_exposure` remains service_role only.

## Fingerprints

| Item | Value |
| --- | --- |
| M32 filename | `20260819140000_landing_page_lab_experimentation_foundation.sql` |
| Git blob | `c1224fa0de919e8c189c511078d0a55901bf2a77` |
| Raw SHA-256 | `B4709DDF9FA36218330267EDE61670A4501600FB8FEF549B3F18C1910F06C56E` |
| Prior never-managed-applied blob | `fc5aa2e8138e1136fe1d3e681f7fcfe6a8cfc6a7` |

## Local gates (2026-08-18 correction)

| Gate | Result |
| --- | --- |
| `npm run test:phase-9b` | PASS (63 tests) |
| `npm run test:app` | PASS (839 tests) |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run db:reset` | PASS |
| `npm run db:lint` | PASS (0 ERROR on public/private; existing extra WARNs) |
| `npm run db:test` | PASS (24 files, 1420 tests) |
| `git diff --check` | PASS |

## Containment

Expected domains only: M32, pgTAP `24_`, `src/features/landing-lab/**`, lead-intake attribution/context bridge, `/admin/landing-pages`, `/lp/[slug]`, `src/proxy.ts`, admin nav, `package.json` test inclusion, `database.generated.ts`, truth-sync docs.

Ledger-only extras (required so existing fail-closed tests match M32): `01_identity_rbac_test.sql` permission/table counts; `23_campaign_consent_audience_approval_test.sql` no longer forbids `landing_pages`/`landing_page_versions`; `phase-6b-integrated-matrix.test.ts` repository migration count 32.
