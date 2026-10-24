# ONEDECORE CRM-SYNC-8 — Protected Staging + DBA/AppSec Readiness

Date: 2026-10-24. Status: **SOURCE CERTIFICATION ONLY — ALL DEPLOYMENTS HOLD**.

## Staging baseline, read-only
- Only connected OneDecore Supabase project: `lpurlfmpvriyvpkujvyl` (ap-south-1), treated as production. No separate OneDecore staging project is visible in this connected account.
- 109 production applied migration version identifiers matched 109 repository migrations as recorded in CRM-SYNC-5; this is not a schema checksum or permissions certification.
- Synthetic-only data; no copying production leads, customer conversations or credentials.
- Staging HTTPS app, Supabase ref, EAS Preview package `com.onedecore.owner.staging`, deploy SHA and outbound quarantine must be checked as a pair. `scripts/crm-sync8-staging-pair.mjs` performs metadata-only consistency checks and **always returns HOLD**, including on a matching mock sample.
- True provisioning still requires explicit Owner authorization for budget/region and independent DBA review. No infrastructure has been created.

## Production privilege metadata observed (read-only on Oct 24)
- 622 `SECURITY DEFINER` functions across `private` (324) and `public` (298); all 622 have explicit function-level `search_path`. This is a *partial* hardening signal, not a security verdict.
- `public.leads` SELECT RLS: authenticated, `deleted_at is null` and `private.crm_can_view_lead(assigned_to)`.
- `public.whatsapp_conversations` SELECT RLS: authenticated and `private.whatsapp_inbox_can_view_conversation`.
- `public.whatsapp_messages` SELECT RLS: authenticated, correlated conversation and `private.whatsapp_inbox_can_view_conversation`.
- `public.whatsapp_campaign_recipients` SELECT policies: service-role and permission-gated authenticated staff; does not authorize mobile CRM campaign writes.
- `private.crm_can_view_lead`, `private.list_crm_whatsapp_lead_signals_impl`: SECURITY DEFINER, authenticated execution allowed, anonymous execution denied, schema anonymous USAGE denied, explicit empty search_path.
- `public.list_crm_whatsapp_lead_signals`: SECURITY INVOKER with authenticated execution, anonymous execution denied.
- Trigger-only `private.capture_long_term_nurture_send/reply`: metadata lists anon EXECUTE true via grants but `private` schema anonymous USAGE false; distinguish *effective SQL callability* and trigger execution before considering a revoke.
- No SQL permission changes performed. Function-level token claims, caller authorization and complete exposed-schema inventory remain for independent DBA/AppSec review.

## Authenticated test requirements
- Create two distinct **staging-only** test identities with different CRM grants. Never send JWTs or live lead identifiers to chat.
- Prepare one permitted and one forbidden synthetic lead; ensure 8 GET-only API checks return expected 200, 400, 401, 403, 404 without existence oracle.
- Independently validate direct lead RLS for both users and Nurture terminal exclusions, not just HTTP statuses.
- Record staging migration versions/checksums, grants and explicit privileges, backup/restore test, signed deployed backend SHA, and provider network quarantine.
- Independent reviewer must verify real policy bodies, invocation reachability and search_path resolution. **Preflight flags or source-level metadata do not certify runtime behavior.**

## Operational order
1. Owner approves isolated OneDecore staging costs, region, test-data policy and owners.
2. DBA approves migrations, least-privilege roles and staging restore/rollback.
3. AppSec approves forbidden provider egress, API JWT/RLS, mobile dependency findings and no live sending.
4. Approved backend deployed only to staging; run 8 live API checks and sign evidence.
5. Build signed staging APK with separate package, validate resolved public env and hardware UAT.
6. Owner separately approves production go/no-go. Until then both PRs stay draft and Production HOLD.

### Automated source guards
`node --test scripts/crm-sync8-staging-pair.test.mjs scripts/crm-sync7-staging-preflight.test.mjs scripts/crm-sync7-permission-review.test.mjs`

`npm run test:crm-mobile-read`

Current source RC is not yet a staged or production release.
