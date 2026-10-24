# ONEDECORE CRM-SYNC-9D — DBA/AppSec read-only RLS review packet

**Date:** 24 October 2026 · **Status:** Evidence preparation; staging not deployed or certified.

## Reviewer artifacts
- `scripts/sql/crm_sync9_staging_rls_snapshot.sql`: one read-only metadata SELECT over `pg_policy`, `pg_class`, `pg_namespace`. It exports selected table-policy metadata, **not rows or customer data**.
- `scripts/crm-sync9-rls-review.mjs <sanitized-staging-policy-metadata.json>`: offline fail-closed policy auditor. It checks `leads`, `whatsapp_conversations`, and `whatsapp_messages` for enabled RLS, scoped authenticated SELECT, expected CRM permission helpers, and suspicious unconditional/anonymous access. It always returns HOLD (exit 2) even when metadata is internally consistent.
- `node --test scripts/crm-sync9-rls-review.test.mjs scripts/crm-sync9-staging-sql.test.mjs` tests denied RLS, anon/public policies, missing helpers, malformed evidence, and SQL-read-only constraints.

## Read-only production metadata observed on 24 October
No production SQL mutations occurred.
- `public.leads`: RLS enabled, authenticated SELECT requires `deleted_at IS NULL` and `private.crm_can_view_lead(assigned_to)`.
- `public.whatsapp_conversations`: RLS enabled, authenticated SELECT uses `private.whatsapp_inbox_can_view_conversation(id)`.
- `public.whatsapp_messages`: RLS enabled, authenticated SELECT uses the caller-visible conversation guard. No anonymous SELECT policy observed among these three.
- `public.crm_assignment_settings`: RLS enabled, zero direct policies (potential intentional deny-by-default).
- `public.whatsapp_campaign_recipients`: FORCE RLS enabled; separate service-role and authorized staff read policies.
- Existing earlier read-only version inventory: 109 production migration version labels matched 109 source labels, *not* DDL/checksum/privilege certification.
- Earlier function metadata: 622 `SECURITY DEFINER` functions in public/private have explicit function-level `search_path`. This is a useful configuration observation, **not** a complete privilege or function-body audit.

## Staging certification sequence
1. Obtain explicit authorization to provision **isolated ONEDECORE** staging Supabase and HTTPS backend. No production data clone without privacy approval; no QuickFurno staging reuse.
2. A reviewer creates a sanitized RLS-metadata JSON export **on protected OneDecore staging only**, runs the offline script and retains its HOLD/exception report.
3. Independently inspect actual function bodies, per-role grants, `SECURITY DEFINER` reachability, SQL `EXECUTE`, RLS under genuinely distinct JWT identities, Nurture exclusions and unauthorized lead paths.
4. Verify schema-migration checksums, staging backup/restore, rollback proof, outbound provider quarantine, server environment and deployed commit SHA.
5. Run eight real authenticated staging GET/permission cases, then physical Android UAT; record independent DBA and AppSec signatures and Owner approval.

The metadata-only checker never produces authorization, never signs releases and never mutates database grants, policies or tables. Production remains HOLD.
