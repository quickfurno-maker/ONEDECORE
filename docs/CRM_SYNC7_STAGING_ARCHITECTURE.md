# CRM-SYNC-7 — Protected staging architecture and independent security review

Date: 2026-10-24 · Status: **PREPARATION ONLY — STAGING AND PRODUCTION HOLD**

## Source baselines
- CRM backend: `quickfurno-maker/ONEDECORE` draft PR #219.
- Android Owner: `quickfurno-maker/onedecore-mobile` draft PR #26.
- Production (read-only truth) Supabase project: `lpurlfmpvriyvpkujvyl`, 109 migration versions matching repository version identifiers. **No OneDecore staging project was identified in the connected account.**
- Distinct staging approval, isolated Supabase and HTTPS backend, reviewer identities and rollback remain missing.

## Reference architecture (not provisioned)
1. **Staging project:** New, separately billed and approved Supabase project in the approved data region. Keep staging storage, Auth identities, Edge Functions, secrets, database and backups isolated. Use synthetic leads only, no copied production conversation contents or tokens.
2. **Staging backend:** Independently configured Next.js service reachable only through approved staging HTTPS hostname. Unique process/deployment namespace, network/ingress controls and application logs without customer data. Pin immutable reviewed backend commit SHA. Don't install production WhatsApp, Meta, Razorpay or cron credentials.
3. **Operator/quarantine controls:** Actual outbound integrations must be nonfunctional by default; `WHATSAPP_OUTBOUND_ENABLED=false`, `META_WEBHOOK_ENABLED=false`, `CAMPAIGNS_ENABLED=false`, `PAYMENTS_ENABLED=false` are *preflight assertions*, not proof that every existing code path honors the flag. DBA/AppSec must inspect each provider call path or additionally block egress at network level. Staging must not expose an active Meta webhook or payment capture callback.
4. **Android staging app:** `com.onedecore.owner.staging`, EAS Preview internal APK and `crm-staging` update channel; staging binary has OTA disabled. Never mix production Supabase ref, API hostname or Firebase config.
5. **Identity/RLS:** Two distinct authorized/denied identities with real staging auth JWTs; owned/unowned synthetic test leads and WhatsApp evidence; permissions and function EXECUTE grants explicitly reviewed, including SECURITY DEFINER routines.
6. **Data recovery:** Export staging migration inventory before changes, verify backup + restore to *isolated* staging target, test signed rollback on the exact backend SHA. No backup, restore or migration was executed in this batch.

## Readiness commands (no deployment)
- `node scripts/crm-sync7-staging-preflight.mjs` — requires isolated staging URL/ref, reviewed SHA, synthetic-only data, every provider flag disabled and explicit DBA/deploy approvals. Never echo tokens. Exits 2 on missing requirements.
- `node scripts/crm-sync5-migration-parity.mjs <sanitized-staging-versions.txt>` — verifies ordered version presence but NOT RLS, function bodies, schema checksums or restore readiness.
- `scripts/sql/crm_sync6_staging_readonly_audit.sql` — run under approved read-only staging reviewer identity. Return only sanitized metadata. **Do not execute on production as a shortcut.**
- `node scripts/crm-sync7-permission-review.mjs <sanitized-function-metadata.json>` — identifies anon/authenticated callable privileged functions and grant-with-inaccessible-schema edge cases. Returns HOLD unconditionally; no mass revoke.
- `node scripts/verify-crm-staging.mjs` (paired Android repository) — 8 live GET-only API checks once staging exists and is approved.
- `node scripts/check-crm-uat-preflight.mjs`, then physical device preflight and 16-case UAT. Not yet run on real staging/device.

## Independent review packet
DBA: staging provision approval; migration versions/checksums; direct table RLS; caller-specific claims; function `SECURITY DEFINER` and EXECUTE reachability; service key isolation; reviewer signoff; restore/rollback proof.
AppSec: mobile Expo Zod/node-forge upstream exposure; remaining advisory triage; bearer token scoping; API output allowlist; no-existence-oracle; staging webhook/provider quarantine; secret handling; Android artifact provenance; signed decision.
Owner: staging project budget/region/data lifetime, test-device consent, and later separate explicit production go/no-go.

## Provisioning HOLD
No cloud account or secret was changed. A valid preflight requires actual infrastructure and reviewer evidence; do not bypass by setting flags without approvals. Deployment, database migration, WhatsApp/Meta activation, private APK build and production merge are prohibited until the user separately authorizes each required external step.
