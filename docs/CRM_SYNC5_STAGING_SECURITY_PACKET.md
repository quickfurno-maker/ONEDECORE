# CRM-SYNC-5 — independent staging DBA/AppSec packet (2026-10-24)

**No production database modification was performed.** This packet is an evidence log and a future isolated staging checklist; it does not authorize merging or deploying.

## Exact production migration truth (read only)
- Connected managed OneDecore production project: `lpurlfmpvriyvpkujvyl` (ap-south-1).
- `supabase_migrations.schema_migrations`: **109 installed versions**; latest **20260928044923**.
- Local `supabase/migrations`: **109 SQL files** and **109 distinct timestamps**, latest **20260928044923**.
- Full ordered version-by-version comparison: **109 matches, 0 missing, 0 unknown**.
- This proves only version **identities**, not checksums, drift, row policies, grants or rollback restore. No migration has been executed.
- Read-only local helper `node scripts/crm-sync5-migration-parity.mjs <approved-applied-version-file>` exits 2 without evidence, 1 on conflict, 0 on exact match.
- **Protected OneDecore staging project is not present in the currently connected Supabase account**; do not treat production or QuickFurno staging as the OneDecore staging environment.

## Selected production permission inventory (read only)
- `public.leads`: RLS enabled, 1 policy; `public.whatsapp_conversations`: RLS enabled, 1 policy; `public.whatsapp_messages`: RLS enabled, 1 policy; `public.whatsapp_campaign_recipients`: RLS enabled and FORCE RLS, 2 policies.
- `public.crm_assignment_settings` and `crm_assignment_setting_events`: RLS enabled with zero policies, which may intentionally deny direct row access and allow governed RPC access.
- `private.list_crm_whatsapp_lead_signals_impl`: SECURITY DEFINER; anon EXECUTE denied; authenticated EXECUTE granted; body references `auth.uid()`. `public.list_crm_whatsapp_lead_signals` wrapper is SECURITY INVOKER, anon EXECUTE denied. Source also applies `private.crm_can_view_lead`.
- `private.capture_long_term_nurture_send` and `private.capture_long_term_nurture_reply`: SECURITY DEFINER **trigger functions** with EXECUTE granted to PUBLIC/anon by default; anonymous `private` schema USAGE denied, authenticated schema USAGE granted. They are trigger-only routines, so the grant alone does not establish an immediately exploitable public endpoint. **Independent review should determine whether explicit EXECUTE revocation is safe and justified.** No grant was modified.
- Existing Supabase advisors previously flagged 8 anonymous-executable and 232 authenticated-executable SECURITY DEFINER functions; distinguish direct invocation, exposed schemas, trigger-only routines and guard checks before making a grant change.

## Protected staging work requiring approvals and real evidence
1. Approve separate isolated OneDecore Supabase staging project/budget, region and owner. No production data clone without privacy approval.
2. Provision staging database, deploy exactly reviewed versioned migrations; no live WhatsApp/Meta/commerce sending.
3. Export staging migration version list **read only**, compare using the script; reconcile RLS policies, EXECUTE grants and SQL function definitions/checksums independently.
4. Establish two test identities with different CRM grants, one visible and one inaccessible lead, and synthetic nurture/WhatsApp signals. Never paste bearer tokens into chat.
5. Deploy signed backend PR to HTTPS staging with rollback proof and record exact commit SHA. Verify secure env separation and no production provider keys.
6. Execute `node scripts/verify-crm-staging.mjs` against the staging origin (8 GET checks) plus database-level RLS negative/positive tests.
7. AppSec and DBA reviewers sign actual access boundaries, function permissions, rollback and dependency severity decisions. Then authorize staging Android EAS build.
8. Production remains HOLD until physical Android UAT (16 cases), security CI and Owner approval.

## Explicit hold
No new managed Supabase staging project, no staging credentials, no migration application, no SQL GRANT/REVOKE, no production change or genuine live E2E certification occurred in CRM-SYNC-5.
