# ONEDECORE CRM-SYNC-8 — Tracks B/C/D Protected Staging & DBA Review Packet

**24 October 2026 · No staging/prod deployment authorized · Release HOLD**

### B — Source/CI pairing
The Android PR checks backend contracts against one immutable reviewed backend SHA. CRM-SYNC-8 introduces a **credential-free pin-integrity job** separate from the private-backend checkout job. The pin-integrity job detects mismatch among the mobile JSON release manifest and GitHub Actions checkout `ref`, without needing private credentials; it is not proof of backend contract compatibility. The second job still **fails closed** without `ONEDECORE_WEB_READ_TOKEN` with read-only Contents access to ONEDECORE. No GitHub secret was created, guessed or requested in chat.

### C — Protected staging topology
OneDecore currently has only one visible connected Supabase project, `lpurlfmpvriyvpkujvyl` (treated as production). The separate QuickFurno Staging project is **not** an acceptable OneDecore test database. No new Supabase project, paid resource, database, SSH service, DNS route or EAS staging APK was created.
- Separate approval required: staging region, monthly budget, synthetic-only data, credential custodian, retention, backups and restore.
- Backend staging service: unique HTTPS origin, unique service/process/namespace, immutable backend commit SHA, no production Meta/WhatsApp/payment keys, disabled campaign/worker dispatch and preferably egress firewall.
- Mobile staging: `com.onedecore.owner.staging`, `crm-staging-apk` internal EAS Preview profile, separate Supabase publishable key, staging CRM origin, OTA disabled.
- New `scripts/crm-sync8-staging-pair.mjs` validates matching backend/mobile staging metadata (commit, CRM origin, Supabase project, package/channel, outbound quarantine) **without reading tokens**. Its result always remains HOLD until independent DBA/AppSec and real staging checks. 5/5 synthetic pairing cases pass.
- The provider-disable flags in `crm-sync7-staging-preflight.mjs` are explicit assertions, not proof the existing backend actually honors each flag; AppSec must inspect each outbound code path and runtime network policy.

### D — Read-only production security metadata (NOT STAGING CERTIFICATION)
Connected OneDecore project metadata observed under read-only SQL:
- Migration version baseline: 109 applied versions and 109 source migration version identifiers previously matched; version equality does not prove DDL checksums, grants or rollback.
- `SECURITY DEFINER` metadata: 324 `private`, 298 `public` = 622 definer functions. All 622 have explicit function-level `search_path`; the relevant inspected functions have empty `search_path`. **This alone does not certify per-function authorization.**
- `public.leads` RLS authenticated SELECT policy checks `deleted_at IS NULL` and `private.crm_can_view_lead(assigned_to)`.
- `public.whatsapp_conversations` and `public.whatsapp_messages` authenticated SELECT policies enforce `private.whatsapp_inbox_can_view_conversation`.
- `private.crm_can_view_lead` and `private.list_crm_whatsapp_lead_signals_impl` are definer functions with authenticated EXECUTE and denied anonymous EXECUTE. `public.list_crm_whatsapp_lead_signals` is a security-invoker wrapper with denied anonymous EXECUTE.
- Trigger-only long-term Nurture functions have effective anonymous schema USAGE denied, although the metadata lists anonymous EXECUTE grants. Trigger-context handling and privilege reachability require independent review.
- No SQL grants, RLS policies, roles or function bodies were modified.

### Next independent reviewer gates
1. Owner approves isolated project creation and budget, credentials stored only in approved account interfaces.
2. DBA reconciles 109 migration bodies/checksums, EXECUTE grants, direct table RLS and function security, signs staging backup/restore and rollback proof.
3. AppSec reviews privilege paths, customer isolation, Meta/outbound network quarantine and mobile Zod/node-forge advisories.
4. Deploy approved code to isolated staging only after authorization. Run 8 authenticated staging API checks (including hidden-lead negative tests) using synthetic identities and JWTs, without exposing tokens.
5. Run isolated signed staging Android APK on authorized physical device, 16-case UAT. Verify resolved bundled environment and certificate fingerprints.
6. Separate Owner GO decision before production merge/private production APK.

**No staging activation, Meta/WhatsApp sending, Firebase push, public app release or production deployment in CRM-SYNC-8.**
