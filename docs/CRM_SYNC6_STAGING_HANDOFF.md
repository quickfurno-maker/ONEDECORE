# CRM-SYNC-6 — Protected Staging Provisioning & Independent Review Handoff

**Status:** PLAN ONLY — not provisioned, not authenticated, not security certified. **Production HOLD.**

## Scope and source
- Mobile draft: `quickfurno-maker/onedecore-mobile#26`
- CRM backend draft: `quickfurno-maker/ONEDECORE#219`
- Source-derived backend version lock: Next.js 16.4.3, Sharp 0.35.5. Never use the unreviewed INT-10 draft as the staged backend baseline.
- Connected Supabase account currently exposes OneDecore production project `lpurlfmpvriyvpkujvyl`, with **no separate visible ONEDECORE staging project**.
- Production migration version inventory: 109 installed versions, source 109 versions, exact version identity parity only; does not certify SQL contents/ACLs.

## Track B — infrastructure authorization and architecture
Owner/DBA must explicitly authorize an isolated Supabase staging instance: region, budget, data retention, backup/restore design, an owner for credentials and a test-only data policy. No cloning of live lead/WhatsApp/customer data without separate privacy review.

Use distinct:
- Supabase staging project reference and *publishable* client key
- HTTPS staging CRM host and Next.js process/container with unique port
- staging-only secrets/role mappings and test identities
- separate EAS Preview environment and Android package `com.onedecore.owner.staging`
- provider quarantine: disable live WhatsApp outbound, campaign scheduler, payment capture, production cron/workers and Meta webhooks
- explicit restrictive network/firewall access to staging and staging error logs without personally identifying customer data

Never point the staging app at production Supabase or production CRM. Never put a service-role key in the mobile app, logs, chat or Git repository.

## Track C — database permissions and migration reconciliation
1. Record current staging schema_migrations, compare with `node scripts/crm-sync5-migration-parity.mjs <approved-staging-export>`.
2. Reviewer executes `scripts/sql/crm_sync6_staging_readonly_audit.sql` using a staging read-only connection, stores sanitized metadata and marks exceptions.
3. Separately check version checksums/function bodies, triggers, RLS and row ownership, SQL `EXECUTE` grants. A schema with the same version labels can still have drift.
4. Create two distinct synthetic identities: authorized Owner and denied CRM principal, two distinct lead IDs under different visibility scopes.
5. Test direct row queries under **each actual role/JWT**, not service role; include anonymous and unknown lead conditions.
6. Backup staging and demonstrate restore/rollback before deploying newly governed endpoints.
7. Obtain independent DBA and AppSec signatures; no automatic mass revoke of existing functions.

## Track D — deployed API contract checks
After approved signed backend staging deployment (and never before): run `node scripts/verify-crm-staging.mjs` with local, ephemeral staging credentials. It checks 8 GET requests: anonymous denial, unauthorized principal denial, valid-scoped Owner success, hidden lead 404 and malformed identifier 400. Record only statuses, commit SHA and timestamp. No bearer tokens or lead payloads in evidence. Independently inspect Nurture cohort exclusions and counts.

## Track E — Android UAT
EAS `crm-staging-apk` must be bound to approved Preview variables; build with distinct app ID, no production Firebase config, OTA updates disabled, test-only signing and separate installation. Confirm bundled API/Supabase URLs with an artifact review. Do not install before authorization.

ADB physical test preflight: `node scripts/crm-sync5-device-preflight.mjs`. Complete 16-case matrix documented in `docs/CRM_SYNC3_STAGING_ANDROID_UAT.md`; attach signature fingerprint, artifact ID, SHA256, authenticated result and tester signoff.

## Track F — release candidate package
Source-only RC must include exact backend/mobile SHAs, CI results, npm audit inventory, migration baseline, scoped API contract test logs, DBA/AppSec signatures, staging deployment/rollback evidence, 16 physical UAT cases and Owner go/no-go. Manifest under mobile `docs/CRM_SYNC6_RC1_GATES.json` deliberately stays HOLD until external evidence exists. Changing a JSON status is **not** a production authorization or substitute for signed approvals.

## Required user decisions
- Approve separate ONEDECORE staging infrastructure budget/region and who owns credentials.
- GitHub administrator installs fine-grained ONEDECORE read-only `ONEDECORE_WEB_READ_TOKEN` for parity CI.
- AppSec reviewer accepts a safe vendor-compatible fix/mitigation for Zod and node-forge advisories, or leaves release blocked.
- Provide an authorized Android test device and EAS Preview staging values through their respective secure interfaces.

**No external provisioning, financial commitment, production writes, EAS APK build, provider actions or authenticated staging UAT is performed by this handoff.**
